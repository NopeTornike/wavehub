import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConversationType, MessageType } from '@wavehub/shared-types';
import { ChatService } from './chat.service';

// Same fake-repository approach as reviews.service.spec.ts / listings.service.spec.ts.
describe('ChatService', () => {
  const orderId = 'order-1';
  const buyerId = 'buyer-1';
  const sellerId = 'seller-1';

  function fakeConversations(existing: any = null, rows: any[] = []) {
    const saved: any[] = rows;
    return {
      findOne: jest.fn(async ({ where }: any = {}) => {
        if (existing !== null) return existing;
        if (!where) return saved[0] ?? null;
        const clauses = Array.isArray(where) ? where : [where];
        return saved.find((row) => clauses.some((clause: any) => Object.entries(clause).every(([k, v]) => row[k] === v))) ?? null;
      }),
      find: jest.fn(async ({ where }: any = {}) => {
        const clauses = Array.isArray(where) ? where : [where];
        return saved.filter((row) => clauses.some((clause: any) => Object.entries(clause).every(([k, v]) => row[k] === v)));
      }),
      create: jest.fn((data: any) => ({ id: `conversation-${saved.length + 1}`, createdAt: new Date(), ...data })),
      save: jest.fn(async (row: any) => {
        saved.push(row);
        return row;
      }),
      _rows: saved,
    };
  }

  function fakeMessages() {
    const rows: any[] = [];
    return {
      find: jest.fn(async () => rows),
      findOne: jest.fn(async (opts: any) => {
        if (opts?.where?.id) return rows.find((r) => r.id === opts.where.id) ?? null;
        // "last message" lookup (order: createdAt DESC, no id filter)
        return rows[rows.length - 1] ?? null;
      }),
      create: jest.fn((data: any) => ({ id: `message-${rows.length + 1}`, createdAt: new Date(), ...data })),
      save: jest.fn(async (row: any) => {
        rows.push(row);
        return row;
      }),
      _rows: rows,
    };
  }

  function fakeNotifications() {
    return { emit: jest.fn() };
  }

  function fakeOrders(count = 0) {
    return { count: jest.fn(async () => count) };
  }

  function fakeCoachingSessions(count = 0) {
    return {
      createQueryBuilder: jest.fn(() => ({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn(async () => count),
      })),
    };
  }

  function fakeUsers(byId: Record<string, { id: string; username: string }> = {}) {
    return {
      findOne: jest.fn(async ({ where }: any) => byId[where.id] ?? null),
    };
  }

  function buildService(opts: {
    conversations?: any;
    messages?: any;
    orders?: any;
    coachingSessions?: any;
    users?: any;
    notifications?: any;
  } = {}) {
    return new ChatService(
      (opts.conversations ?? fakeConversations()) as any,
      (opts.messages ?? fakeMessages()) as any,
      (opts.orders ?? fakeOrders()) as any,
      (opts.coachingSessions ?? fakeCoachingSessions()) as any,
      (opts.users ?? fakeUsers()) as any,
      (opts.notifications ?? fakeNotifications()) as any,
    );
  }

  describe('ensureConversation', () => {
    it('creates a conversation when none exists for the order', async () => {
      const conversations = fakeConversations(null);
      const service = buildService({ conversations });

      await service.ensureConversation(orderId, buyerId, sellerId);

      expect(conversations.save).toHaveBeenCalledTimes(1);
      expect(conversations.create).toHaveBeenCalledWith({ orderId, buyerId, sellerId });
    });

    it('is idempotent — does not create a second row when one already exists', async () => {
      const conversations = fakeConversations({ id: 'conversation-1', orderId, buyerId, sellerId });
      const service = buildService({ conversations });

      const result = await service.ensureConversation(orderId, buyerId, sellerId);

      expect(conversations.save).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'conversation-1', orderId, buyerId, sellerId });
    });
  });

  describe('postMessage', () => {
    it('rejects when no conversation exists for the order yet', async () => {
      const service = buildService({ conversations: fakeConversations(null) });
      await expect(service.postMessage(orderId, buyerId, 'hi')).rejects.toThrow(NotFoundException);
    });

    it('saves a real-user message with type Text and a real senderId', async () => {
      const conversations = fakeConversations({ id: 'conversation-1', orderId, buyerId, sellerId });
      const messages = fakeMessages();
      const service = buildService({ conversations, messages });

      const result = await service.postMessage(orderId, buyerId, 'hello seller');

      expect(messages._rows[0]).toMatchObject({
        conversationId: 'conversation-1',
        senderId: buyerId,
        type: MessageType.Text,
        body: 'hello seller',
      });
      expect(result.senderId).toBe(buyerId);
    });

    it('notifies the recipient (the other participant), not the sender', async () => {
      const conversations = fakeConversations({ id: 'conversation-1', orderId, buyerId, sellerId });
      const messages = fakeMessages();
      const notifications = fakeNotifications();
      const service = buildService({ conversations, messages, notifications });

      await service.postMessage(orderId, buyerId, 'hello seller');

      expect(notifications.emit).toHaveBeenCalledWith(
        sellerId,
        expect.any(String),
        expect.any(String),
        'hello seller',
        expect.objectContaining({ orderId }),
      );
    });
  });

  describe('postSystemMessage', () => {
    it('no-ops rather than throwing when no conversation exists yet', async () => {
      const messages = fakeMessages();
      const service = buildService({ conversations: fakeConversations(null), messages });

      await expect(service.postSystemMessage(orderId, 'Order created.')).resolves.toBeUndefined();
      expect(messages.save).not.toHaveBeenCalled();
    });

    it('saves a message with a null senderId and type System', async () => {
      const conversations = fakeConversations({ id: 'conversation-1', orderId, buyerId, sellerId });
      const messages = fakeMessages();
      const service = buildService({ conversations, messages });

      await service.postSystemMessage(orderId, 'Order created.');

      expect(messages._rows[0]).toMatchObject({
        conversationId: 'conversation-1',
        senderId: null,
        type: MessageType.System,
        body: 'Order created.',
      });
    });
  });

  describe('getOrCreateDirectConversation', () => {
    const userA = 'user-a';
    const userB = 'user-b';

    it('rejects messaging yourself', async () => {
      const service = buildService();
      await expect(service.getOrCreateDirectConversation(userA, userA)).rejects.toThrow(BadRequestException);
    });

    it('rejects a recipient that does not exist', async () => {
      const service = buildService({ users: fakeUsers({}) });
      await expect(service.getOrCreateDirectConversation(userA, userB)).rejects.toThrow(NotFoundException);
    });

    it('rejects two users who have never transacted together', async () => {
      const service = buildService({
        users: fakeUsers({ [userB]: { id: userB, username: 'b' } }),
        orders: fakeOrders(0),
        coachingSessions: fakeCoachingSessions(0),
      });
      await expect(service.getOrCreateDirectConversation(userA, userB)).rejects.toThrow(ForbiddenException);
    });

    it('creates a Direct conversation for two users who share an order', async () => {
      const conversations = fakeConversations(null);
      const service = buildService({
        conversations,
        users: fakeUsers({ [userB]: { id: userB, username: 'b' } }),
        orders: fakeOrders(1),
      });

      const result = await service.getOrCreateDirectConversation(userA, userB);

      expect(result.type).toBe(ConversationType.Direct);
      expect(conversations.save).toHaveBeenCalledTimes(1);
    });

    it('creates a Direct conversation for two users who share a coaching session (order check fails, session check passes)', async () => {
      const conversations = fakeConversations(null);
      const service = buildService({
        conversations,
        users: fakeUsers({ [userB]: { id: userB, username: 'b' } }),
        orders: fakeOrders(0),
        coachingSessions: fakeCoachingSessions(1),
      });

      const result = await service.getOrCreateDirectConversation(userA, userB);
      expect(result.type).toBe(ConversationType.Direct);
    });

    it('is idempotent regardless of which user initiates second', async () => {
      const conversations = fakeConversations(null, [
        { id: 'conversation-1', type: ConversationType.Direct, buyerId: userA, sellerId: userB, createdAt: new Date() },
      ]);
      const service = buildService({
        conversations,
        users: fakeUsers({ [userA]: { id: userA, username: 'a' }, [userB]: { id: userB, username: 'b' } }),
        orders: fakeOrders(1),
      });

      const result = await service.getOrCreateDirectConversation(userB, userA);

      expect(result.id).toBe('conversation-1');
      expect(conversations.save).not.toHaveBeenCalled();
    });
  });

  describe('listDirectMessages / postDirectMessage — participant gate', () => {
    const userA = 'user-a';
    const userB = 'user-b';
    const stranger = 'stranger';

    function withDirectConversation() {
      return fakeConversations(null, [
        { id: 'conversation-1', type: ConversationType.Direct, buyerId: userA, sellerId: userB, createdAt: new Date() },
      ]);
    }

    it('rejects a non-participant reading messages', async () => {
      const service = buildService({ conversations: withDirectConversation() });
      await expect(service.listDirectMessages('conversation-1', stranger)).rejects.toThrow(NotFoundException);
    });

    it('rejects a non-participant sending a message', async () => {
      const service = buildService({ conversations: withDirectConversation() });
      await expect(service.postDirectMessage('conversation-1', stranger, 'hi')).rejects.toThrow(NotFoundException);
    });

    it('lets a real participant send and read a message', async () => {
      const conversations = withDirectConversation();
      const messages = fakeMessages();
      const service = buildService({ conversations, messages });

      const sent = await service.postDirectMessage('conversation-1', userA, 'hey there');
      expect(sent.body).toBe('hey there');

      const thread = await service.listDirectMessages('conversation-1', userB);
      expect(thread).toHaveLength(1);
    });
  });

  describe('listMyDirectConversations', () => {
    it("returns the other participant relative to the viewer, whichever column they're in", async () => {
      const userA = 'user-a';
      const userB = 'user-b';
      const conversations = fakeConversations(null, [
        { id: 'conversation-1', type: ConversationType.Direct, buyerId: userA, sellerId: userB, createdAt: new Date() },
      ]);
      const users = fakeUsers({ [userB]: { id: userB, username: 'seller-guy' } });
      const service = buildService({ conversations, users });

      const rows = await service.listMyDirectConversations(userA);

      expect(rows).toEqual([
        expect.objectContaining({ id: 'conversation-1', otherUser: { id: userB, username: 'seller-guy' }, lastMessage: null }),
      ]);
    });
  });
});
