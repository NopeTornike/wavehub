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
import { ListingsService, MAX_IMAGE_BYTES, STAFF_EDITOR, STEAM_PUBLISHER_ROLES } from './listings.service';
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
import { AdminListingSearchDto, SetFeaturedDto } from './dto/admin-listings.dto';

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

  // Moderator search across every status (Admin → Listings → all listings), with the Featured flag.
  @Get('admin/listings')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(AdminRole.MarketplaceCoachingOpsManager)
  adminSearch(@Query() query: AdminListingSearchDto) {
    return this.listings.adminSearch(query);
  }

  // Pick/unpick for the home page's "Featured Items" (shown via GET listings?featured=true).
  @Post('admin/listings/:id/featured')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(AdminRole.MarketplaceCoachingOpsManager)
  async setFeatured(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetFeaturedDto,
  ) {
    const result = await this.listings.setFeatured(id, dto.isFeatured);
    await this.audit.log({ adminId, adminRole, action: dto.isFeatured ? 'listing.feature' : 'listing.unfeature', entityType: 'listing', entityId: id });
    return result;
  }

  // Steam key inventory for staff (client feedback #5): any Steam publisher can stock a game, not
  // only the account that created it. Keys are never returned or logged — only counts.
  @Get('admin/listings/:id/keys')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...STEAM_PUBLISHER_ROLES)
  adminListKeys(@Param('id', ParseUUIDPipe) id: string) {
    return this.listings.listKeys(STAFF_EDITOR, id);
  }

  @Post('admin/listings/:id/keys')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...STEAM_PUBLISHER_ROLES)
  @Throttle(UPLOAD_THROTTLE)
  async adminAddKeys(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddListingKeysDto) {
    const result = await this.listings.addKeys(STAFF_EDITOR, id, dto.keys);
    await this.audit.log({ adminId, adminRole, action: 'listing.keys_add', entityType: 'listing', entityId: id, metadata: { added: result.added } });
    return result;
  }

  @Delete('admin/listings/:id/keys/:keyId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(...STEAM_PUBLISHER_ROLES)
  async adminRemoveKey(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string, @Param('keyId', ParseUUIDPipe) keyId: string) {
    await this.listings.removeKey(STAFF_EDITOR, id, keyId);
    await this.audit.log({ adminId, adminRole, action: 'listing.key_revoke', entityType: 'listing', entityId: id, metadata: { keyId } });
    return { ok: true };
  }

  // Take a live listing off the marketplace with a reason the seller sees (→ Rejected; the seller
  // must fix and resubmit). Restore puts it straight back. Delete only for never-ordered listings
  // and Super Admin only. All audit-logged.
  @Post('admin/listings/:id/take-down')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(AdminRole.MarketplaceCoachingOpsManager)
  async adminTakeDown(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectListingDto,
  ) {
    const listing = await this.listings.adminTakeDown(id, dto.reason);
    await this.audit.log({ adminId, adminRole, action: 'listing.take_down', entityType: 'listing', entityId: id, metadata: { reason: dto.reason } });
    return listing;
  }

  @Post('admin/listings/:id/restore')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(AdminRole.MarketplaceCoachingOpsManager)
  async adminRestore(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string) {
    const listing = await this.listings.adminRestore(id);
    await this.audit.log({ adminId, adminRole, action: 'listing.restore', entityType: 'listing', entityId: id });
    return listing;
  }

  @Delete('admin/listings/:id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole()
  async adminDelete(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string) {
    const deleted = await this.listings.adminDelete(id);
    await this.audit.log({ adminId, adminRole, action: 'listing.delete', entityType: 'listing', entityId: id, metadata: deleted });
    return { ok: true };
  }

  // Moderator preview of any listing (description, packages, requirements, FAQ, photos) before
  // approving or rejecting it — the public GET listings/:id only serves active listings.
  @Get('admin/listings/:id')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole(AdminRole.MarketplaceCoachingOpsManager)
  findForReview(@Param('id', ParseUUIDPipe) id: string) {
    return this.listings.findForReview(id);
  }

  // --- Super Admin edits any listing (2026-10-01) ---
  // Same rules and DTOs as the seller's own edit, minus ownership and re-review: staff are the
  // moderators, so the change applies as-is. Super Admin only; every change is audit-logged.

  @Patch('admin/listings/:id')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole()
  async adminUpdate(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateListingDto,
  ) {
    const listing = await this.listings.update(STAFF_EDITOR, id, dto);
    await this.audit.log({ adminId, adminRole, action: 'listing.admin_update', entityType: 'listing', entityId: id, metadata: { fields: Object.keys(dto).join(',') } });
    return listing;
  }

  @Post('admin/listings/:id/images')
  @Throttle(UPLOAD_THROTTLE)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES } }))
  async adminAddImage(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const image = await this.listings.addImage(STAFF_EDITOR, id, file);
    await this.audit.log({ adminId, adminRole, action: 'listing.admin_add_image', entityType: 'listing', entityId: id, metadata: { imageId: image.id } });
    return image;
  }

  @Post('admin/listings/:id/images/:imageId/cover')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole()
  async adminSetCover(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    const result = await this.listings.setCoverImage(STAFF_EDITOR, id, imageId);
    await this.audit.log({ adminId, adminRole, action: 'listing.admin_set_cover', entityType: 'listing', entityId: id, metadata: { imageId } });
    return result;
  }

  @Delete('admin/listings/:id/images/:imageId')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole()
  async adminRemoveImage(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    const result = await this.listings.removeImage(STAFF_EDITOR, id, imageId);
    await this.audit.log({ adminId, adminRole, action: 'listing.admin_remove_image', entityType: 'listing', entityId: id, metadata: { imageId } });
    return result;
  }

  @Post('admin/listings/:id/packages')
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole()
  async adminAddPackage(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePackageDto,
  ) {
    const pkg = await this.listings.addPackage(STAFF_EDITOR, id, dto);
    await this.audit.log({ adminId, adminRole, action: 'listing.admin_add_package', entityType: 'listing', entityId: id, metadata: { packageId: pkg.id } });
    return pkg;
  }

  @Delete('admin/listings/:id/packages/:packageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard, AdminGuard)
  @RequireAdminRole()
  async adminRemovePackage(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('packageId', ParseUUIDPipe) packageId: string,
  ) {
    await this.listings.removePackage(STAFF_EDITOR, id, packageId);
    await this.audit.log({ adminId, adminRole, action: 'listing.admin_remove_package', entityType: 'listing', entityId: id, metadata: { packageId } });
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
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES } }))
  addImage(
    @CurrentUserId() sellerId: string,
    @Param('id') listingId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.listings.addImage(sellerId, listingId, file);
  }

  // Make this photo the listing's main (cover) photo.
  @Post('listings/:id/images/:imageId/cover')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  setCoverImage(@CurrentUserId() sellerId: string, @Param('id', ParseUUIDPipe) id: string, @Param('imageId', ParseUUIDPipe) imageId: string) {
    return this.listings.setCoverImage(sellerId, id, imageId);
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
