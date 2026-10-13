import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { AdminRole } from '@wavehub/shared-types';
import { UPLOAD_THROTTLE } from '../common/throttle';
import { AuthGuard } from '../auth/auth.guard';
import { VerifiedEmailGuard } from '../auth/verified-email.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { AdminGuard } from '../admin/admin-role.guard';
import { RequireAdminRole } from '../admin/require-admin-role.decorator';
import { CurrentAdminRole } from '../admin/current-admin-role.decorator';
import { AdminAuditService } from '../admin/admin-audit.service';
import { MarketingService } from './marketing.service';
import { BannerDto, CreateBannerDto, CreatePromoCodeDto, PublicBannersQueryDto, RedeemPromoDto, UpdatePromoCodeDto } from './dto/marketing.dto';

// Guessing codes is the abuse surface: 5 tries a minute per IP, verified accounts only.
const REDEEM_THROTTLE = { default: { limit: 5, ttl: 60_000 } };
const BANNER_IMAGE = FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
// SPECIFICATION.md §5.13: banners are Content Management (Super Admin + Main Administrator);
// promo codes are Marketing (Super Admin only — they create spendable balance).
const CONTENT_ROLES = [AdminRole.MainAdministrator];

@Controller()
export class MarketingController {
  constructor(
    private readonly marketing: MarketingService,
    private readonly audit: AdminAuditService,
  ) {}

  // --- Public / users ---

  @Get('banners')
  publicBanners(@Query() query: PublicBannersQueryDto) {
    return this.marketing.listPublicBanners(query.placement);
  }

  @Post('promo-codes/redeem')
  @HttpCode(HttpStatus.OK)
  @Throttle(REDEEM_THROTTLE)
  @UseGuards(AuthGuard, VerifiedEmailGuard)
  redeem(@CurrentUserId() userId: string, @Body() dto: RedeemPromoDto) {
    return this.marketing.redeem(userId, dto.code);
  }

  // --- Promo codes (Super Admin) ---

  @Get('admin/promo-codes')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole()
  listCodes() {
    return this.marketing.listCodes();
  }

  @Post('admin/promo-codes')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole()
  async createCode(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Body() dto: CreatePromoCodeDto) {
    const code = await this.marketing.createCode(adminId, dto);
    await this.audit.log({ adminId, adminRole, action: 'promo_code.create', entityType: 'promo_code', entityId: code.id, metadata: { code: code.code, amountWaveCoin: code.amountWaveCoin, maxRedemptions: code.maxRedemptions } });
    return code;
  }

  @Patch('admin/promo-codes/:id')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole()
  async updateCode(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePromoCodeDto) {
    const { code, before } = await this.marketing.updateCode(id, dto);
    await this.audit.log({ adminId, adminRole, action: 'promo_code.update', entityType: 'promo_code', entityId: id, metadata: { before, after: dto } });
    return code;
  }

  @Delete('admin/promo-codes/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole()
  async deleteCode(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string) {
    const deleted = await this.marketing.deleteCode(id);
    await this.audit.log({ adminId, adminRole, action: 'promo_code.delete', entityType: 'promo_code', entityId: id, metadata: deleted });
    return { ok: true };
  }

  // --- Banners (Content Management) ---

  @Get('admin/banners')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...CONTENT_ROLES)
  listBanners() {
    return this.marketing.listBanners();
  }

  @Post('admin/banners')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...CONTENT_ROLES)
  async createBanner(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Body() dto: CreateBannerDto) {
    const banner = await this.marketing.createBanner(dto);
    await this.audit.log({ adminId, adminRole, action: 'banner.create', entityType: 'banner', entityId: banner.id, metadata: { title: banner.title } });
    return banner;
  }

  @Patch('admin/banners/:id')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...CONTENT_ROLES)
  async updateBanner(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: BannerDto) {
    const banner = await this.marketing.updateBanner(id, dto);
    await this.audit.log({ adminId, adminRole, action: 'banner.update', entityType: 'banner', entityId: id, metadata: { fields: Object.keys(dto).join(',') } });
    return banner;
  }

  @Post('admin/banners/:id/image')
  @HttpCode(HttpStatus.OK)
  @Throttle(UPLOAD_THROTTLE)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...CONTENT_ROLES)
  @UseInterceptors(BANNER_IMAGE)
  async bannerImage(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File | undefined) {
    const banner = await this.marketing.setBannerImage(id, file);
    await this.audit.log({ adminId, adminRole, action: 'banner.set_image', entityType: 'banner', entityId: id });
    return banner;
  }

  @Delete('admin/banners/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...CONTENT_ROLES)
  async deleteBanner(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.marketing.deleteBanner(id);
    await this.audit.log({ adminId, adminRole, action: 'banner.delete', entityType: 'banner', entityId: id });
    return { ok: true };
  }
}
