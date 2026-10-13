import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { ChatService } from './chat.service';
import { DirectMessagesController } from './direct-messages.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { Order } from '../orders/order.entity';
import { CoachingSession } from '../coaching/coaching-session.entity';
import { User } from '../users/user.entity';
import { AuthModule } from '../auth/auth.module';

// Order/CoachingSession/User are registered here as plain entities (read-only lookups inside
// ChatService), not by importing OrdersModule/CoachingModule/UsersModule — see the "read-only,
// entity-level dependencies" comment on ChatService's constructor for why, and CLAUDE.md for the
// full gotcha. AuthModule is imported only so DirectMessagesController's AuthGuard can resolve its
// own UsersService dependency (same pattern as every other guarded controller's module).
@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message, Order, CoachingSession, User]),
    NotificationsModule,
    AuthModule,
  ],
  controllers: [DirectMessagesController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
