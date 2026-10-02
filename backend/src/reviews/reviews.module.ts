import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from './review.entity';
import { ReviewReport } from './review-report.entity';
import { Order } from '../orders/order.entity';
import { Listing } from '../listings/listing.entity';
import { User } from '../users/user.entity';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { AdminReviewsController } from './admin-reviews.controller';
import { CoachingSessionReview } from '../coaching/coaching-session-review.entity';
import { Coach } from '../coaching/coach.entity';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommunityModule } from '../community/community.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review, ReviewReport, Order, Listing, User, CoachingSessionReview, Coach]),
    AuthModule,
    AdminModule,
    NotificationsModule,
    CommunityModule,
  ],
  controllers: [ReviewsController, AdminReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
