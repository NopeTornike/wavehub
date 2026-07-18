import { IsIn } from 'class-validator';

export class ReportReviewDto {
  @IsIn(['spam', 'fake', 'abusive', 'other'])
  reason: 'spam' | 'fake' | 'abusive' | 'other';
}
