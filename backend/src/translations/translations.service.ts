import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AdminUiTranslation, PublicUiTranslations } from '@wavehub/shared-types';
import { UiTranslation } from './ui-translation.entity';
import { UpsertTranslationDto } from './dto/translation.dto';

// Staff overrides of UI text (owner 2026-10-28). The public map is read by every visitor's browser
// once per page load, so it is cached in memory and dropped on every edit.
@Injectable()
export class TranslationsService {
  private cache: PublicUiTranslations | null = null;

  constructor(@InjectRepository(UiTranslation) private readonly rows: Repository<UiTranslation>) {}

  async publicMap(): Promise<PublicUiTranslations> {
    if (this.cache) return this.cache;
    const all = await this.rows.find({ select: { key: true, en: true, ka: true } });
    const map: PublicUiTranslations = {};
    for (const r of all) map[r.key] = { ...(r.en ? { en: r.en } : {}), ...(r.ka ? { ka: r.ka } : {}) };
    this.cache = map;
    return map;
  }

  async adminList(): Promise<AdminUiTranslation[]> {
    const all = await this.rows.find({ order: { updatedAt: 'DESC' } });
    return all.map((r) => ({ id: r.id, key: r.key, en: r.en, ka: r.ka, updatedAt: r.updatedAt.toISOString() }));
  }

  async upsert(adminId: string, dto: UpsertTranslationDto): Promise<AdminUiTranslation> {
    const key = dto.key.trim();
    const en = dto.en?.trim() || null;
    const ka = dto.ka?.trim() || null;
    if (!key) throw new BadRequestException('Enter the text to translate');
    const existing = await this.rows.findOne({ where: { key } });
    if (!en && !ka) {
      // Both empty = back to the built-in texts.
      if (existing) await this.rows.delete(existing.id);
      this.cache = null;
      return { id: existing?.id ?? '', key, en: null, ka: null, updatedAt: new Date().toISOString() };
    }
    const saved = await this.rows.save(existing ? Object.assign(existing, { en, ka, updatedById: adminId }) : this.rows.create({ key, en, ka, updatedById: adminId }));
    this.cache = null;
    return { id: saved.id, key: saved.key, en: saved.en, ka: saved.ka, updatedAt: saved.updatedAt.toISOString() };
  }

  async remove(id: string): Promise<{ key: string }> {
    const row = await this.rows.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Translation not found');
    await this.rows.delete(id);
    this.cache = null;
    return { key: row.key };
  }
}
