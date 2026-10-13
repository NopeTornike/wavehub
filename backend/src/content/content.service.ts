import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentPageStatus } from '@wavehub/shared-types';
import { ContentPage } from './content-page.entity';
import { UpsertContentPageDto } from './dto/upsert-content-page.dto';

@Injectable()
export class ContentService {
  constructor(@InjectRepository(ContentPage) private readonly repo: Repository<ContentPage>) {}

  // Public: published pages only — a draft is invisible to everyone but admins, same as a paused
  // listing.
  async getPublishedBySlug(slug: string): Promise<ContentPage> {
    const page = await this.repo.findOne({ where: { slug, status: ContentPageStatus.Published } });
    if (!page) {
      throw new NotFoundException('Page not found');
    }
    return page;
  }

  async listAll(): Promise<ContentPage[]> {
    return this.repo.find({ order: { slug: 'ASC' } });
  }

  async getBySlugAdmin(slug: string): Promise<ContentPage> {
    const page = await this.repo.findOne({ where: { slug } });
    if (!page) {
      throw new NotFoundException('Page not found');
    }
    return page;
  }

  // One route handles both create and edit-in-place — slug is the natural key an admin already
  // knows (it's in the URL of the page they're editing), so there's no separate id-based update
  // path to keep in sync with this one.
  async upsert(dto: UpsertContentPageDto): Promise<ContentPage> {
    const existing = await this.repo.findOne({ where: { slug: dto.slug } });
    if (existing) {
      await this.repo.update(existing.id, {
        title: dto.title,
        body: dto.body ?? existing.body,
        status: dto.status ?? existing.status,
      });
      return this.getBySlugAdmin(dto.slug);
    }

    try {
      const created = this.repo.create({
        slug: dto.slug,
        title: dto.title,
        body: dto.body ?? '',
        status: dto.status ?? ContentPageStatus.Draft,
      });
      return await this.repo.save(created);
    } catch (err) {
      // 23505 = unique_violation — a concurrent create with the same slug lost the race above.
      if ((err as { code?: string }).code === '23505') {
        throw new ConflictException('A page with this slug already exists');
      }
      throw err;
    }
  }
}
