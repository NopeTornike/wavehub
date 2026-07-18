import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { ChatService } from './chat.service';
import { NotificationsModule } from '../notifications/notifications.module';

// Deliberately no controller here — chat is order-scoped only (see conversation.entity.ts), so its
// routes live on OrdersController (`/orders/:id/messages`) where the existing participant-ownership
// checks already are, rather than duplicating that check here against an Order this module doesn't
// otherwise know about.
@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message]), NotificationsModule],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
