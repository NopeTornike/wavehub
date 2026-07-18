import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { ReportReviewDto } from './dto/report-review.dto';
import { BrowseReviewsDto } from './dto/browse-reviews.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';

@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('listings/:listingId/reviews')
  findForListing(@Param('listingId') listingId: string, @Query() query: BrowseReviewsDto) {
    return this.reviews.findForListing(listingId, query.sort);
  }

  @Post('reviews')
  @UseGuards(AuthGuard)
  create(@CurrentUserId() buyerId: string, @Body() dto: CreateReviewDto) {
    return this.reviews.create(buyerId, dto);
  }

  @Post('reviews/:id/reply')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  reply(@CurrentUserId() sellerId: string, @Param('id') id: string, @Body() dto: ReplyReviewDto) {
    return this.reviews.reply(sellerId, id, dto.body);
  }

  @Post('reviews/:id/report')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  report(@CurrentUserId() reporterId: string, @Param('id') id: string, @Body() dto: ReportReviewDto) {
    return this.reviews.report(reporterId, id, dto.reason);
  }
}
