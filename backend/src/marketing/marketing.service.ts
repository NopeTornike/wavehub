import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import type { AdminBanner, AdminPromoCode, PromoRedemptionResult, PublicBanner } from '@wavehub/shared-types';
import { BannerPlacement } from '@wavehub/shared-types';
import { PromoCode, PromoRedemption } from './promo-code.entity';
import { Banner } from './banner.entity';
import { BannerDto, CreateBannerDto, CreatePromoCodeDto, UpdatePromoCodeDto } from './dto/marketing.dto';
import { WalletService } from '../wallet/wallet.service';
import { StorageService } from '../storage/storage.service';

const POSTGRES_UNIQUE_VIOLATION = '23505';
const iso = (d: Date | null) => (d ? d.toISOString() : null);

@Injectable()
export class MarketingService {
  constructor(
    @InjectRepository(PromoCode) private readonly codes: Repository<PromoCode>,
    @InjectRepository(Banner) private readonly banners: Repository<Banner>,
    private readonly dataSource: DataSource,
    private readonly wallet: WalletService,
    private readonly storage: StorageService,
  ) {}

  // --- Promo codes ---

  private toAdminCode(c: PromoCode): AdminPromoCode {
    return {
      id: c.id,
      code: c.code,
      amountWaveCoin: c.amountWaveCoin,
      maxRedemptions: c.maxRedemptions,
      redeemedCount: c.redeemedCount,
      startsAt: iso(c.startsAt),
      expiresAt: iso(c.expiresAt),
      active: c.active,
      note: c.note,
      createdAt: c.createdAt.toISOString(),
    };
  }

  private window(startsAt: string | null | undefined, expiresAt: string | null | undefined, current?: { startsAt: Date | null; expiresAt: Date | null }) {
    const s = startsAt === undefined ? current?.startsAt ?? null : startsAt ? new Date(startsAt) : null;
    const e = expiresAt === undefined ? current?.expiresAt ?? null : expiresAt ? new Date(expiresAt) : null;
    if (s && e && e <= s) throw new BadRequestException('The end must be after the start');
    return { startsAt: s, expiresAt: e };
  }

  async listCodes(): Promise<AdminPromoCode[]> {
    return (await this.codes.find({ order: { createdAt: 'DESC' }, take: 500 })).map((c) => this.toAdminCode(c));
  }

  async createCode(adminId: string, dto: CreatePromoCodeDto): Promise<AdminPromoCode> {
    try {
      const saved = await this.codes.save(
        this.codes.create({
          code: dto.code,
          amountWaveCoin: dto.amountWaveCoin,
          maxRedemptions: dto.maxRedemptions,
          ...this.window(dto.startsAt, dto.expiresAt),
          note: dto.note?.trim() || null,
          active: true,
          createdBy: adminId,
        }),
      );
      return this.toAdminCode(saved);
    } catch (err) {
      if ((err as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION) throw new ConflictException('This code already exists');
      throw err;
    }
  }

  async updateCode(id: string, dto: UpdatePromoCodeDto): Promise<{ code: AdminPromoCode; before: Record<string, unknown> }> {
    const c = await this.codes.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Promo code not found');
    if (dto.maxRedemptions !== undefined && dto.maxRedemptions < c.redeemedCount) {
      throw new BadRequestException(`Already redeemed ${c.redeemedCount} times`);
    }
    const patch: Partial<PromoCode> = { ...this.window(dto.startsAt, dto.expiresAt, c) };
    if (dto.amountWaveCoin !== undefined) patch.amountWaveCoin = dto.amountWaveCoin;
    if (dto.maxRedemptions !== undefined) patch.maxRedemptions = dto.maxRedemptions;
    if (dto.active !== undefined) patch.active = dto.active;
    if (dto.note !== undefined) patch.note = dto.note?.trim() || null;
    const before = { amountWaveCoin: c.amountWaveCoin, maxRedemptions: c.maxRedemptions, active: c.active, startsAt: iso(c.startsAt), expiresAt: iso(c.expiresAt) };
    await this.codes.update(id, patch);
    return { code: this.toAdminCode(await this.codes.findOneOrFail({ where: { id } })), before };
  }

  // One transaction: lock the code row (so the cap can't be overshot by a burst), the per-account
  // UNIQUE redemption row, the counter and the wallet credit — all or nothing.
  async redeem(userId: string, rawCode: string): Promise<PromoRedemptionResult> {
    const code = rawCode.trim().toUpperCase();
    try {
      return await this.dataSource.transaction(async (manager) => {
        const c = await manager.findOne(PromoCode, { where: { code }, lock: { mode: 'pessimistic_write' } });
        const now = new Date();
        // One message for "unknown", "inactive" and "outside its window", so codes can't be probed.
        if (!c || !c.active || (c.startsAt && c.startsAt > now) || (c.expiresAt && c.expiresAt <= now)) {
          throw new NotFoundException('This code is not valid');
        }
        if (c.redeemedCount >= c.maxRedemptions) throw new ForbiddenException('This code has been fully used');
        await manager.insert(PromoRedemption, { promoCodeId: c.id, userId, amountWaveCoin: c.amountWaveCoin });
        await manager.update(PromoCode, c.id, { redeemedCount: c.redeemedCount + 1 });
        const entry = await this.wallet.creditPromo(userId, c.amountWaveCoin, `promo-${c.id}-${userId}`, manager);
        return { code: c.code, amountWaveCoin: c.amountWaveCoin, balanceAfter: entry.balanceAfter };
      });
    } catch (err) {
      if ((err as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION) throw new ConflictException('You have already used this code');
      throw err;
    }
  }

  // --- Banners ---

  private toAdminBanner(b: Banner): AdminBanner {
    return {
      id: b.id,
      placement: b.placement,
      title: b.title,
      subtitle: b.subtitle,
      imageUrl: b.imageUrl,
      linkUrl: b.linkUrl,
      buttonLabel: b.buttonLabel,
      active: b.active,
      startsAt: iso(b.startsAt),
      endsAt: iso(b.endsAt),
      sortOrder: b.sortOrder,
      updatedAt: b.updatedAt.toISOString(),
    };
  }

  // Live banners for one placement (all placements when none is given), ≤10.
  async listPublicBanners(placement?: BannerPlacement): Promise<PublicBanner[]> {
    const now = new Date();
    const query = this.banners.createQueryBuilder('b').where('b.active = true');
    if (placement) query.andWhere('b.placement = :placement', { placement });
    const rows = await query
      .andWhere(new Brackets((q) => q.where('b.startsAt IS NULL').orWhere('b.startsAt <= :now', { now })))
      .andWhere(new Brackets((q) => q.where('b.endsAt IS NULL').orWhere('b.endsAt > :now', { now })))
      .orderBy('b.sortOrder', 'ASC')
      .addOrderBy('b.createdAt', 'DESC')
      .take(10)
      .getMany();
    return rows.map((b) => ({ id: b.id, placement: b.placement, title: b.title, subtitle: b.subtitle, imageUrl: b.imageUrl, linkUrl: b.linkUrl, buttonLabel: b.buttonLabel }));
  }

  async listBanners(): Promise<AdminBanner[]> {
    return (await this.banners.find({ order: { sortOrder: 'ASC', createdAt: 'DESC' } })).map((b) => this.toAdminBanner(b));
  }

  private bannerPatch(dto: BannerDto, current?: Banner): Partial<Banner> {
    const patch: Partial<Banner> = {};
    if (dto.placement !== undefined) patch.placement = dto.placement;
    if (dto.title !== undefined) patch.title = dto.title.trim();
    if (dto.subtitle !== undefined) patch.subtitle = dto.subtitle?.trim() || null;
    if (dto.linkUrl !== undefined) patch.linkUrl = dto.linkUrl?.trim() || null;
    if (dto.buttonLabel !== undefined) patch.buttonLabel = dto.buttonLabel?.trim() || null;
    if (dto.active !== undefined) patch.active = dto.active;
    if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;
    const w = this.window(dto.startsAt, dto.endsAt, current ? { startsAt: current.startsAt, expiresAt: current.endsAt } : undefined);
    patch.startsAt = w.startsAt;
    patch.endsAt = w.expiresAt;
    return patch;
  }

  async createBanner(dto: CreateBannerDto): Promise<AdminBanner> {
    const saved = await this.banners.save(this.banners.create({ ...this.bannerPatch(dto), active: dto.active ?? false }));
    return this.toAdminBanner(saved);
  }

  async updateBanner(id: string, dto: BannerDto): Promise<AdminBanner> {
    const b = await this.banners.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Banner not found');
    if (dto.active === true && !b.imageUrl) throw new BadRequestException('Upload an image before publishing the banner');
    await this.banners.update(id, this.bannerPatch(dto, b));
    return this.toAdminBanner(await this.banners.findOneOrFail({ where: { id } }));
  }

  async setBannerImage(id: string, file: { buffer: Buffer; originalname: string } | undefined): Promise<AdminBanner> {
    if (!file) throw new BadRequestException('No file uploaded');
    const b = await this.banners.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Banner not found');
    // Byte-sniffed: only real images are accepted (StorageService refuses anything else).
    const stored = await this.storage.save(file.buffer, file.originalname, 'image');
    await this.banners.update(id, { imageUrl: stored.url });
    return this.toAdminBanner(await this.banners.findOneOrFail({ where: { id } }));
  }

  // Delete a promo code nobody has redeemed (a typo, a test). A used code is only deactivated —
  // redemptions cascade from it and are the record of credit handed out. The redeemedCount = 0
  // condition sits in the DELETE itself, so a redemption racing it makes this a no-op, not a loss.
  async deleteCode(id: string): Promise<{ code: string }> {
    const c = await this.codes.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Promo code not found');
    const res = await this.codes.createQueryBuilder().delete().where('id = :id AND "redeemedCount" = 0', { id }).execute();
    if (!res.affected) throw new ConflictException('This code has been redeemed and can’t be deleted — deactivate it instead');
    return { code: c.code };
  }

  async deleteBanner(id: string): Promise<void> {
    const res = await this.banners.delete(id);
    if (!res.affected) throw new NotFoundException('Banner not found');
  }
}
