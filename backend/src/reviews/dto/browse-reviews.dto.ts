import { IsIn, IsOptional } from 'class-validator';

export class BrowseReviewsDto {
  @IsOptional()
  @IsIn(['newest', 'highest', 'lowest'])
  sort?: 'newest' | 'highest' | 'lowest';
}
