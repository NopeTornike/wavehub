import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionPlan } from './subscription-plan.entity';
import { UserSubscription } from './user-subscription.entity';
import { SubscriptionChargeAttempt } from './subscription-charge-attempt.entity';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { PaymentsModule } from '../payments/payments.module';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';
import { NotificationsModule } from '../notifications/notifications.module';

// One-directional import (subscriptions → payments), same shape as orders → wallet/chat elsewhere
// — PaymentsModule has zero awareness that subscriptions exist, see PaymentsModule's own comment.
@Module({
  imports: [
    TypeOrmModule.forFeature([SubscriptionPlan, UserSubscription, SubscriptionChargeAttempt]),
    PaymentsModule,
    AuthModule,
    AdminModule,
    NotificationsModule,
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
