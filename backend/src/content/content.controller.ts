import { Controller, Get, Param } from '@nestjs/common';
import { ContentService } from './content.service';

// Public, unauthenticated — no guard. Only ever returns published pages (see
// ContentService.getPublishedBySlug).
@Controller('content')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.content.getPublishedBySlug(slug);
  }
}
