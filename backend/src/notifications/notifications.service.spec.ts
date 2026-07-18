import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@wavehub/shared-types';
import { NotificationsService } from './notifications.service';

// Same fake-repository approach as every other *.service.spec.ts in this repo.
describe('NotificationsService', () => {
  const userId = 'user-1';
  const notificationId = 'notification-1';

  function build(existing: any = null) {
    const saved: any[] = [];
    const updates: any[] = [];
    const notifications = {
      create: jest.fn((data: any) => ({ id: notificationId, createdAt: new Date(), readAt: null, ...data })),
      save: jest.fn(async (entity: any) => {
        saved.push(entity);
        return entity;
      }),
      find: jest.fn(async () => (existing ? [existing] : [])),
      findOne: jest.fn(async () => existing),
      count: jest.fn(async () => (existing && !existing.readAt ? 1 : 0)),
      update: jest.fn(async (_criteria: any, data: any) => {
        updates.push(data);
      }),
    } as any;
    const email = { send: jest.fn() } as any;

    const service = new NotificationsService(notifications, email);
    return { service, notifications, email, updates };
  }

  describe('emit', () => {
    it('creates a notification row', async () => {
      const { service, notifications } = build();

      const result = await service.emit(userId, NotificationType.OrderPaid, 'New order', 'You got an order');

      expect(notifications.save).toHaveBeenCalledTimes(1);
      expect(result.type).toBe(NotificationType.OrderPaid);
    });

    it('also sends an email when alsoEmail is provided', async () => {
      const { service, email } = build();

      await service.emit(userId, NotificationType.OrderCompleted, 'Order complete', 'Nice work', undefined, {
        to: 'seller@example.com',
        subject: 'Your order completed',
      });

      expect(email.send).toHaveBeenCalledWith('seller@example.com', 'Your order completed', 'Nice work');
    });

    it('does not send an email when alsoEmail is omitted', async () => {
      const { service, email } = build();
      await service.emit(userId, NotificationType.NewMessage, 'New message', 'Hello');
      expect(email.send).not.toHaveBeenCalled();
    });
  });

  describe('markRead', () => {
    it('rejects marking a notification that does not exist', async () => {
      const { service } = build(null);
      await expect(service.markRead(userId, notificationId)).rejects.toThrow(NotFoundException);
    });

    it("rejects marking someone else's notification", async () => {
      const { service } = build({ id: notificationId, userId: 'other-user', readAt: null, createdAt: new Date() });
      await expect(service.markRead(userId, notificationId)).rejects.toThrow(ForbiddenException);
    });

    it('marks the notification read', async () => {
      const { service, updates } = build({ id: notificationId, userId, readAt: null, createdAt: new Date() });

      const result = await service.markRead(userId, notificationId);

      expect(result.readAt).not.toBeNull();
      expect(updates).toHaveLength(1);
    });

    it('is a no-op (no extra update) when already read', async () => {
      const { service, updates } = build({
        id: notificationId,
        userId,
        readAt: new Date('2024-01-01'),
        createdAt: new Date(),
      });

      await service.markRead(userId, notificationId);

      expect(updates).toHaveLength(0);
    });
  });
});
