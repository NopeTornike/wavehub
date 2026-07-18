import { NotFoundException } from '@nestjs/common';
import { MessageType } from '@wavehub/shared-types';
import { ChatService } from './chat.service';

// Same fake-repository approach as reviews.service.spec.ts / listings.service.spec.ts.
describe('ChatService', () => {
  const orderId = 'order-1';
  const buyerId = 'buyer-1';
  const sellerId = 'seller-1';

  function fakeConversations(existing: any = null) {
    const saved: any[] = [];
    return {
      findOne: jest.fn(async () => existing ?? saved[0] ?? null),
      create: jest.fn((data: any) => ({ id: 'conversation-1', ...data })),
      save: jest.fn(async (row: any) => {
        saved.push(row);
        return row;
      }),
    };
  }

  function fakeMessages() {
    const rows: any[] = [];
    return {
      find: jest.fn(async () => rows),
      findOne: jest.fn(async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null),
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

  describe('ensureConversation', () => {
    it('creates a conversation when none exists for the order', async () => {
      const conversations = fakeConversations(null);
      const service = new ChatService(conversations as any, fakeMessages() as any, fakeNotifications() as any);

      await service.ensureConversation(orderId, buyerId, sellerId);

      expect(conversations.save).toHaveBeenCalledTimes(1);
      expect(conversations.create).toHaveBeenCalledWith({ orderId, buyerId, sellerId });
    });

    it('is idempotent — does not create a second row when one already exists', async () => {
      const conversations = fakeConversations({ id: 'conversation-1', orderId, buyerId, sellerId });
      const service = new ChatService(conversations as any, fakeMessages() as any, fakeNotifications() as any);

      const result = await service.ensureConversation(orderId, buyerId, sellerId);

      expect(conversations.save).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'conversation-1', orderId, buyerId, sellerId });
    });
  });

  describe('postMessage', () => {
    it('rejects when no conversation exists for the order yet', async () => {
      const service = new ChatService(fakeConversations(null) as any, fakeMessages() as any, fakeNotifications() as any);
      await expect(service.postMessage(orderId, buyerId, 'hi')).rejects.toThrow(NotFoundException);
    });

    it('saves a real-user message with type Text and a real senderId', async () => {
      const conversations = fakeConversations({ id: 'conversation-1', orderId, buyerId, sellerId });
      const messages = fakeMessages();
      const notifications = fakeNotifications();
      const service = new ChatService(conversations as any, messages as any, notifications as any);

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
      const service = new ChatService(conversations as any, messages as any, notifications as any);

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
      const service = new ChatService(fakeConversations(null) as any, messages as any, fakeNotifications() as any);

      await expect(service.postSystemMessage(orderId, 'Order created.')).resolves.toBeUndefined();
      expect(messages.save).not.toHaveBeenCalled();
    });

    it('saves a message with a null senderId and type System', async () => {
      const conversations = fakeConversations({ id: 'conversation-1', orderId, buyerId, sellerId });
      const messages = fakeMessages();
      const service = new ChatService(conversations as any, messages as any, fakeNotifications() as any);

      await service.postSystemMessage(orderId, 'Order created.');

      expect(messages._rows[0]).toMatchObject({
        conversationId: 'conversation-1',
        senderId: null,
        type: MessageType.System,
        body: 'Order created.',
      });
    });
  });
});
