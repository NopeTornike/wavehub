import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { AdminGuard } from '../admin/admin-role.guard';
import { RequireAdminRole } from '../admin/require-admin-role.decorator';
import { CurrentAdminRole } from '../admin/current-admin-role.decorator';
import { AdminAuditService } from '../admin/admin-audit.service';
import { UPLOAD_THROTTLE } from '../common/throttle';
import { ListingsService, MAX_IMAGE_BYTES, STAFF_EDITOR, STEAM_PUBLISHER_ROLES } from './listings.service';
import { UpdateListingDto } from './dto/update-listing.dto';

// Admin → Steam (2026-10-07): the Steam catalogue for every Steam publisher, not only the account
// that created a game — list with key stock, edit details/photos, publish / pause. Keys themselves
// go through the existing `admin/listings/:id/keys` routes. Every route 404s for non-Steam listings;
// every change is audit-logged.
@Controller('admin/steam-games')
@UseGuards(AuthGuard, AdminGuard)
@RequireAdminRole(...STEAM_PUBLISHER_ROLES)
export class SteamAdminController {
  constructor(
    private readonly listings: ListingsService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get()
  list() {
    return this.listings.steamCatalogue();
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.listings.steamGameForEdit(id);
  }

  // Same rules and DTO as any listing edit; staff edits apply as-is (no re-review).
  @Patch(':id')
  async update(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateListingDto) {
    await this.listings.assertSteamGame(id);
    await this.listings.update(STAFF_EDITOR, id, dto);
    await this.audit.log({ adminId, adminRole, action: 'steam.update', entityType: 'listing', entityId: id, metadata: { fields: Object.keys(dto).join(',') } });
    return this.listings.steamGameForEdit(id);
  }

  @Post(':id/images')
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES } }))
  async addImage(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File) {
    await this.listings.assertSteamGame(id);
    const image = await this.listings.addImage(STAFF_EDITOR, id, file);
    await this.audit.log({ adminId, adminRole, action: 'steam.add_image', entityType: 'listing', entityId: id, metadata: { imageId: image.id } });
    return image;
  }

  @Post(':id/images/:imageId/cover')
  @HttpCode(HttpStatus.OK)
  async setCover(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string, @Param('imageId', ParseUUIDPipe) imageId: string) {
    await this.listings.assertSteamGame(id);
    const result = await this.listings.setCoverImage(STAFF_EDITOR, id, imageId);
    await this.audit.log({ adminId, adminRole, action: 'steam.set_cover', entityType: 'listing', entityId: id, metadata: { imageId } });
    return result;
  }

  @Delete(':id/images/:imageId')
  @HttpCode(HttpStatus.OK)
  async removeImage(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string, @Param('imageId', ParseUUIDPipe) imageId: string) {
    await this.listings.assertSteamGame(id);
    const result = await this.listings.removeImage(STAFF_EDITOR, id, imageId);
    await this.audit.log({ adminId, adminRole, action: 'steam.remove_image', entityType: 'listing', entityId: id, metadata: { imageId } });
    return result;
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  async publish(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.listings.steamSetLive(id, true);
    await this.audit.log({ adminId, adminRole, action: 'steam.publish', entityType: 'listing', entityId: id });
    return this.listings.steamGameForEdit(id);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  async pause(@CurrentUserId() adminId: string, @CurrentAdminRole() adminRole: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.listings.steamSetLive(id, false);
    await this.audit.log({ adminId, adminRole, action: 'steam.pause', entityType: 'listing', entityId: id });
    return this.listings.steamGameForEdit(id);
  }
}
