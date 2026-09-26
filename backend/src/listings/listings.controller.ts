import { CREATE_THROTTLE, UPLOAD_THROTTLE } from '../common/throttle';
import { Throttle } from '@nestjs/throttler';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { VerifiedEmailGuard } from '../auth/verified-email.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AdminRole } from '@wavehub/shared-types';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { CreatePackageDto } from './dto/create-package.dto';
import { BrowseListingsDto } from './dto/browse-listings.dto';
import { RejectListingDto } from './dto/reject-listing.dto';
import { AddListingKeysDto } from './dto/add-listing-keys.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { AdminGuard } from '../admin/admin-role.guard';
import { RequireAdminRole } from '../admin/require-admin-role.decorator';
import { CurrentAdminRole } from '../admin/current-admin-role.decorator';
import { AdminAuditService } from '../admin/admin-audit.service';

@Controller()
export class ListingsController {
  constructor(
    private readonly listings: ListingsService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get('categories')
  listCategories() {
    return this.listings.listCategories();
  }

  @Get('games')
  listGames() {
    return this.listings.listGames();
  }

  @Get('listings')
  browse(@Query() query: BrowseListingsDto) {
    return this.listings.browseActive(query);
  }

  @Get('listings/mine')
  @UseGuards(AuthGuard)
  findMine(@CurrentUserId() sellerId: string) {
    return this.listings.findMine(sellerId);
  }

  // The seller's own listing in any status (draft/rejected/in review included), for editing.
  @Get('listings/mine/:id')
  @UseGuards(AuthGuard)
  findMineById(@CurrentUserId() sellerId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.listings.findOwnedForEdit(sellerId, id);
  }

  // Moderator preview of any listing (description, packages, requirements, FAQ, photos) before
  // approving or rejecting it — the public GET listings/:id only serves active listings.
  @Get('admin/listings/:id')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(AdminRole.MarketplaceCoachingOpsManager)
  findForReview(@Param('id', ParseUUIDPipe) id: string) {
    return this.listings.findForReview(id);
  }

  // Admin-only — the approval queue. MUST stay registered before `listings/:id` below: Express
  // matches routes in registration order, and `:id` would otherwise swallow this path treating
  // "pending-review" as an id.
  @Get('listings/pending-review')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(AdminRole.MarketplaceCoachingOpsManager)
  listPendingReview() {
    return this.listings.listPendingReview();
  }

  @Get('listings/:id')
  findOne(@Param('id') id: string) {
    return this.listings.findPublicById(id);
  }

  // --- Favourites --- (`me/favorites*` rather than `listings/favorites` so nothing can collide
  // with the `listings/:id` route above.)
  @Get('me/favorites')
  @UseGuards(AuthGuard)
  listFavorites(@CurrentUserId() userId: string) {
    return this.listings.listFavorites(userId);
  }

  @Get('me/favorites/ids')
  @UseGuards(AuthGuard)
  listFavoriteIds(@CurrentUserId() userId: string) {
    return this.listings.listFavoriteIds(userId);
  }

  @Post('listings/:id/favorite')
  @UseGuards(AuthGuard)
  @Throttle(CREATE_THROTTLE)
  addFavorite(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.listings.addFavorite(userId, id);
  }

  @Delete('listings/:id/favorite')
  @UseGuards(AuthGuard)
  @Throttle(CREATE_THROTTLE)
  removeFavorite(@CurrentUserId() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.listings.removeFavorite(userId, id);
  }

  @Post('listings')
  @UseGuards(AuthGuard, VerifiedEmailGuard)
  create(@CurrentUserId() sellerId: string, @Body() dto: CreateListingDto) {
    return this.listings.createDraft(sellerId, dto);
  }

  @Patch('listings/:id')
  @UseGuards(AuthGuard, VerifiedEmailGuard)
  @Throttle(CREATE_THROTTLE)
  update(@CurrentUserId() sellerId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateListingDto) {
    return this.listings.update(sellerId, id, dto);
  }

  @Delete('listings/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  @Throttle(CREATE_THROTTLE)
  async remove(@CurrentUserId() sellerId: string, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.listings.remove(sellerId, id);
  }

  @Post('listings/:id/submit')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  submit(@CurrentUserId() sellerId: string, @Param('id') id: string) {
    return this.listings.submitForReview(sellerId, id);
  }

  @Post('listings/:id/pause')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  pause(@CurrentUserId() sellerId: string, @Param('id') id: string) {
    return this.listings.pause(sellerId, id);
  }

  @Post('listings/:id/unpause')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  unpause(@CurrentUserId() sellerId: string, @Param('id') id: string) {
    return this.listings.unpause(sellerId, id);
  }

  @Post('listings/:id/packages')
  @UseGuards(AuthGuard)
  addPackage(
    @CurrentUserId() sellerId: string,
    @Param('id') listingId: string,
    @Body() dto: CreatePackageDto,
  ) {
    return this.listings.addPackage(sellerId, listingId, dto);
  }

  @Delete('listings/:id/packages/:packageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  removePackage(
    @CurrentUserId() sellerId: string,
    @Param('id') listingId: string,
    @Param('packageId') packageId: string,
  ) {
    return this.listings.removePackage(sellerId, listingId, packageId);
  }

  // Digital key inventory — seller-only (ownership-checked in the service, same as
  // packages/images above). Bulk "paste a list" upload rather than one key at a time; see
  // LAUNCH_PLAN.md §2d and backend/src/listings/CLAUDE.md.
  @Post('listings/:id/keys')
  @UseGuards(AuthGuard)
  addKeys(@CurrentUserId() sellerId: string, @Param('id') listingId: string, @Body() dto: AddListingKeysDto) {
    return this.listings.addKeys(sellerId, listingId, dto.keys);
  }

  @Get('listings/:id/keys')
  @UseGuards(AuthGuard)
  listKeys(@CurrentUserId() sellerId: string, @Param('id') listingId: string) {
    return this.listings.listKeys(sellerId, listingId);
  }

  @Delete('listings/:id/keys/:keyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  removeKey(
    @CurrentUserId() sellerId: string,
    @Param('id') listingId: string,
    @Param('keyId') keyId: string,
  ) {
    return this.listings.removeKey(sellerId, listingId, keyId);
  }

  @Post('listings/:id/images')
  @Throttle(UPLOAD_THROTTLE)
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  addImage(
    @CurrentUserId() sellerId: string,
    @Param('id') listingId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.listings.addImage(sellerId, listingId, file);
  }

  @Delete('listings/:id/images/:imageId')
  @UseGuards(AuthGuard)
  removeImage(@CurrentUserId() sellerId: string, @Param('id') listingId: string, @Param('imageId') imageId: string) {
    return this.listings.removeImage(sellerId, listingId, imageId);
  }

  // Admin-only — see SPECIFICATION.md §5.13.4 (Marketplace & Coaching Ops Manager: "approve/reject"
  // listings) and §5.13.1 (Super Admin's unrestricted access covers it too, via AdminGuard's
  // implicit SuperAdmin bypass — not listed explicitly here since it's never worth repeating).
  @Post('listings/:id/approve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(AdminRole.MarketplaceCoachingOpsManager)
  async approve(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('id') id: string,
  ) {
    const listing = await this.listings.approve(id);
    await this.audit.log({ adminId, adminRole, action: 'listing.approve', entityType: 'listing', entityId: id });
    return listing;
  }

  @Post('listings/:id/reject')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(AdminRole.MarketplaceCoachingOpsManager)
  async reject(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('id') id: string,
    @Body() dto: RejectListingDto,
  ) {
    const listing = await this.listings.reject(id, dto.reason);
    await this.audit.log({
      adminId,
      adminRole,
      action: 'listing.reject',
      entityType: 'listing',
      entityId: id,
      metadata: { reason: dto.reason },
    });
    return listing;
  }
}
