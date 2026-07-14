import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { CreatePackageDto } from './dto/create-package.dto';
import { BrowseListingsDto } from './dto/browse-listings.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';

@Controller()
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

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

  @Get('listings/:id')
  findOne(@Param('id') id: string) {
    return this.listings.findPublicById(id);
  }

  @Post('listings')
  @UseGuards(AuthGuard)
  create(@CurrentUserId() sellerId: string, @Body() dto: CreateListingDto) {
    return this.listings.createDraft(sellerId, dto);
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

  @Post('listings/:id/images')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  addImage(
    @CurrentUserId() sellerId: string,
    @Param('id') listingId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.listings.addImage(sellerId, listingId, file);
  }
}
