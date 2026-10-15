import { Body, Controller, ForbiddenException, Get, Patch, Post, UploadedFile, UseGuards, UseInterceptors, BadRequestException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { memoryStorage } from 'multer';
import { In, Repository } from 'typeorm';
import type { MyProfile, ProfileTitle } from '@wavehub/shared-types';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { CREATE_THROTTLE, UPLOAD_THROTTLE } from '../common/throttle';
import { Game } from '../listings/game.entity';
import { StorageService } from '../storage/storage.service';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfilesService } from '../profiles/profiles.service';

// Avatars (also a coach's portrait): 2MB, same as listing photos (owner decision 2026-10-03).
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

// The signed-in user's own profile (the prototype's Settings page). Declared in ListingsModule next
// to UsersController for the same reason: it needs the games table and StorageService, and
// UsersModule must stay a leaf module (AuthModule imports it).
@Controller('me')
@UseGuards(AuthGuard)
export class ProfileController {
  constructor(
    private readonly users: UsersService,
    private readonly storage: StorageService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Game) private readonly games: Repository<Game>,
    private readonly profiles: ProfilesService,
  ) {}

  private async toMyProfile(user: User): Promise<MyProfile> {
    return {
      profileTitle: (user.profileTitle as ProfileTitle | null) ?? null,
      profileTitleByStaff: user.profileTitleByStaff ?? false,
      availableTitles: await this.profiles.eligibleTitles(user.id),
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      bio: user.bio ?? null,
      avatarUrl: user.avatarUrl ?? null,
      mainGameIds: user.mainGameIds ?? [],
      location: user.location ?? null,
      tagline: user.tagline ?? null,
      platform: user.platform ?? null,
      preferredRole: user.preferredRole ?? null,
      achievement: user.achievement ?? null,
      emailNotifications: user.emailNotifications ?? true,
    };
  }

  private async load(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) throw new BadRequestException('Account not found');
    return user;
  }

  @Get('profile')
  async get(@CurrentUserId() userId: string): Promise<MyProfile> {
    return this.toMyProfile(await this.load(userId));
  }

  @Patch('profile')
  @Throttle(CREATE_THROTTLE)
  async update(@CurrentUserId() userId: string, @Body() dto: UpdateProfileDto): Promise<MyProfile> {
    const patch: Partial<User> = {};
    if (dto.firstName !== undefined) patch.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) patch.lastName = dto.lastName.trim();
    if (dto.bio !== undefined) patch.bio = dto.bio.trim() || null;
    for (const key of ['location', 'tagline', 'platform', 'preferredRole', 'achievement'] as const) {
      if (dto[key] !== undefined) patch[key] = dto[key]!.trim() || null;
    }
    if (dto.emailNotifications !== undefined) patch.emailNotifications = dto.emailNotifications;
    if (dto.profileTitle !== undefined) {
      const current = await this.load(userId);
      if (current.profileTitleByStaff) throw new ForbiddenException('Your profile title was set by WaveHubX staff');
      if (dto.profileTitle !== null && !(await this.profiles.eligibleTitles(userId)).includes(dto.profileTitle)) {
        throw new BadRequestException('You can use this title only while it is true for your account');
      }
      patch.profileTitle = dto.profileTitle;
    }
    if (dto.mainGameIds !== undefined) {
      const ids = [...new Set(dto.mainGameIds)];
      const found = ids.length ? await this.games.count({ where: { id: In(ids), isActive: true } }) : 0;
      if (found !== ids.length) throw new BadRequestException('Unknown game');
      patch.mainGameIds = ids;
    }
    if ((patch.firstName !== undefined && !patch.firstName) || (patch.lastName !== undefined && !patch.lastName)) {
      throw new BadRequestException('Name cannot be empty');
    }
    if (Object.keys(patch).length) await this.userRepo.update({ id: userId }, patch);
    return this.toMyProfile(await this.load(userId));
  }

  @Post('avatar')
  @Throttle(UPLOAD_THROTTLE)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_AVATAR_BYTES } }))
  async avatar(@CurrentUserId() userId: string, @UploadedFile() file: Express.Multer.File | undefined): Promise<MyProfile> {
    if (!file) throw new BadRequestException('No file uploaded');
    const stored = await this.storage.save(file.buffer, file.originalname, 'image');
    await this.userRepo.update({ id: userId }, { avatarUrl: stored.url });
    return this.toMyProfile(await this.load(userId));
  }
}
