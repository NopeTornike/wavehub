import { IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

// Fixed tag vocabulary from the source spec — not free text, so marketplace filtering/analytics
// stay meaningful. Extend this list only if the client asks for more tags, don't let it grow ad hoc.
export const REVIEW_TAGS = [
  'Fast Delivery',
  'Good Communication',
  'Friendly',
  'Professional',
  'Highly Skilled',
  'Recommended',
] as const;

export class CreateReviewDto {
  @IsUUID()
  orderId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @Length(10, 1000)
  body?: string;

  @IsOptional()
  @IsArray()
  @IsIn(REVIEW_TAGS, { each: true })
  tags?: string[];
}
