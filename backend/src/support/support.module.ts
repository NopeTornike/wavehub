import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from './ticket.entity';
import { TicketMessage } from './ticket-message.entity';
import { SavedReply } from './saved-reply.entity';
import { Order } from '../orders/order.entity';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';
import { AdminTicketsController, AdminSavedRepliesController } from './admin-tickets.controller';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, TicketMessage, SavedReply, Order]), AuthModule, AdminModule, NotificationsModule],
  controllers: [SupportController, AdminTicketsController, AdminSavedRepliesController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
