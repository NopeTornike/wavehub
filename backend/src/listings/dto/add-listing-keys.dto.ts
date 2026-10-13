import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, Length } from 'class-validator';

// Bulk key upload (paste-a-list) — see ListingsService#addKeys. 500/request is an arbitrary but
// generous ceiling; a seller with more than that pastes in multiple batches.
export class AddListingKeysDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @Length(4, 200, { each: true })
  keys: string[];
}
