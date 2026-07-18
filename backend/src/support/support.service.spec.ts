import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TicketStatus } from '@wavehub/shared-types';
import { SupportService } from './support.service';

// Same fake-repository approach as disputes.service.spec.ts / reviews.service.spec.ts.
describe('SupportService', () => {
  const requesterId = 'user-1';
  const otherUserId = 'user-2';
  const adminId = 'admin-1';
  const ticketId = 'ticket-1';

  function fakeUser(id: string) {
    return { id, username: `user-${id}` };
  }

  function build(options: { ticket?: any; order?: any } = {}) {
    const ticketRow = options.ticket ?? {
      id: ticketId,
      requesterId,
      subject: 'Help',
      category: 'other',
      priority: 'medium',
      status: TicketStatus.Open,
      orderId: null,
      assignedToId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      closedAt: null,
      requester: fakeUser(requesterId),
      assignedTo: null,
    };
    const ticketUpdates: any[] = [];
    const savedMessages: any[] = [];

    const tickets = {
      findOne: jest.fn(async () => ticketRow),
      save: jest.fn(async (data: any) => ({ ...ticketRow, ...data })),
      create: jest.fn((data: any) => ({ ...data })),
      update: jest.fn(async (_id: string, patch: any) => {
        ticketUpdates.push(patch);
        Object.assign(ticketRow, patch);
      }),
      createQueryBuilder: jest.fn(() => ({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn(async () => [ticketRow]),
      })),
    } as any;

    const messages = {
      find: jest.fn(async ({ where }: any) =>
        savedMessages.filter((m) => (where.isInternalNote === undefined ? true : m.isInternalNote === where.isInternalNote)),
      ),
      save: jest.fn(async (data: any) => {
        const saved = {
          id: `msg-${savedMessages.length + 1}`,
          createdAt: new Date(),
          sender: fakeUser(data.senderId),
          isInternalNote: false,
          ...data,
        };
        savedMessages.push(saved);
        return saved;
      }),
      create: jest.fn((data: any) => data),
    } as any;

    const savedReplies = { find: jest.fn(async () => []) } as any;
    const orders = { findOne: jest.fn(async () => options.order ?? null) } as any;
    const notifications = { emit: jest.fn() } as any;

    const service = new SupportService(tickets, messages, savedReplies, orders, notifications);
    return { service, tickets, messages, orders, ticketRow, ticketUpdates, savedMessages };
  }

  describe('createTicket', () => {
    it('creates a ticket with the description as its first message', async () => {
      const { service, savedMessages } = build();
      const result = await service.createTicket(requesterId, {
        subject: 'Help me',
        category: 'other' as any,
        description: 'Something is wrong',
      });
      expect(result.messages).toHaveLength(1);
      expect(savedMessages[0].body).toBe('Something is wrong');
    });

    it('rejects an orderId that does not belong to the requester', async () => {
      const { service } = build({ order: { buyerId: otherUserId, sellerId: 'seller-x' } });
      await expect(
        service.createTicket(requesterId, {
          subject: 'Help',
          category: 'order_status' as any,
          description: 'x',
          orderId: 'order-1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('reply', () => {
    it('rejects a reply from someone other than the requester', async () => {
      const { service } = build();
      await expect(service.reply(otherUserId, ticketId, 'hi')).rejects.toThrow(ForbiddenException);
    });

    it('reopens a closed ticket when the requester replies', async () => {
      const { service, ticketUpdates } = build({
        ticket: {
          id: ticketId,
          requesterId,
          subject: 'Help',
          category: 'other',
          priority: 'medium',
          status: TicketStatus.Closed,
          orderId: null,
          assignedToId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          closedAt: new Date(),
          requester: fakeUser(requesterId),
          assignedTo: null,
        },
      });
      await service.reply(requesterId, ticketId, 'still broken');
      expect(ticketUpdates).toContainEqual({ status: TicketStatus.Open, closedAt: null });
    });
  });

  describe('getMine', () => {
    it('throws NotFoundException for a missing ticket', async () => {
      const { service, tickets } = build();
      tickets.findOne.mockResolvedValueOnce(null);
      await expect(service.getMine(requesterId, 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('staffReply', () => {
    it('flips an Open ticket to InProgress', async () => {
      const { service, ticketUpdates } = build();
      await service.staffReply(adminId, ticketId, 'we are looking into it');
      expect(ticketUpdates).toContainEqual({ status: TicketStatus.InProgress });
    });
  });

  describe('updateTicket', () => {
    it('sets closedAt when moving to Closed', async () => {
      const { service, ticketUpdates } = build();
      await service.updateTicket(ticketId, { status: TicketStatus.Closed } as any);
      expect(ticketUpdates[0].status).toBe(TicketStatus.Closed);
      expect(ticketUpdates[0].closedAt).toBeInstanceOf(Date);
    });

    it('clears closedAt when moving away from Closed', async () => {
      const { service, ticketUpdates } = build();
      await service.updateTicket(ticketId, { status: TicketStatus.InProgress } as any);
      expect(ticketUpdates[0].closedAt).toBeNull();
    });

    it('unassigns when assignedToId is explicitly null', async () => {
      const { service, ticketUpdates } = build();
      await service.updateTicket(ticketId, { assignedToId: null } as any);
      expect(ticketUpdates[0]).toEqual({ assignedToId: null });
    });

    it('leaves assignedToId untouched when omitted', async () => {
      const { service, ticketUpdates } = build();
      await service.updateTicket(ticketId, { priority: 'high' } as any);
      expect(ticketUpdates[0]).toEqual({ priority: 'high' });
    });
  });
});
