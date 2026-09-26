import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AdminGame, GameImageKind } from '@wavehub/shared-types';
import { Game } from './game.entity';
import { StorageService } from '../storage/storage.service';
import { CreateGameDto, UpdateGameDto } from './dto/game.dto';

const MAX_ART_BYTES = 5 * 1024 * 1024;
const IMAGE_COLUMN: Record<GameImageKind, 'iconUrl' | 'coverUrl' | 'tileUrl'> = { icon: 'iconUrl', cover: 'coverUrl', tile: 'tileUrl' };
type UploadedImage = { buffer: Buffer; originalname: string; mimetype: string; size: number };

// Staff management of the game catalogue: add, rename, hide/show, reorder, upload art. A game is
// never deleted — listings, coaches and tournaments reference it — hiding it (isActive=false)
// removes it from every public picker and the home grid while existing listings keep working.
@Injectable()
export class GamesService {
  constructor(
    @InjectRepository(Game) private readonly games: Repository<Game>,
    private readonly storage: StorageService,
  ) {}

  async listForAdmin(): Promise<AdminGame[]> {
    const rows: Array<Game & { listingCount: number }> = await this.games.query(
      `SELECT g.*, (SELECT count(*)::int FROM "listings" l WHERE l."gameId" = g."id") AS "listingCount"
       FROM "games" g ORDER BY g."sortOrder" ASC, g."name" ASC`,
    );
    return rows.map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      iconUrl: g.iconUrl,
      coverUrl: g.coverUrl,
      tileUrl: g.tileUrl,
      isActive: g.isActive,
      sortOrder: g.sortOrder,
      listingCount: g.listingCount,
    }));
  }

  async create(dto: CreateGameDto): Promise<Game> {
    const name = dto.name.trim();
    await this.assertUnique(name, dto.slug);
    const sortOrder = dto.sortOrder ?? (await this.nextSortOrder());
    return this.games.save(this.games.create({ name, slug: dto.slug, sortOrder, isActive: true }));
  }

  async update(id: string, dto: UpdateGameDto): Promise<Game> {
    const game = await this.getOrThrow(id);
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      await this.assertUnique(name, null, id);
      game.name = name;
    }
    if (dto.isActive !== undefined) game.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) game.sortOrder = dto.sortOrder;
    return this.games.save(game);
  }

  async setImage(id: string, kind: GameImageKind, file: UploadedImage | undefined): Promise<Game> {
    const game = await this.getOrThrow(id);
    if (!file) throw new ForbiddenException('An image file is required');
    if (file.size > MAX_ART_BYTES) throw new ForbiddenException('Image exceeds the 5MB size limit');
    // StorageService identifies the type from the file's bytes and rejects anything that isn't an image.
    const stored = await this.storage.save(file.buffer, file.originalname, 'image');
    game[IMAGE_COLUMN[kind]] = stored.url;
    return this.games.save(game);
  }

  async clearImage(id: string, kind: GameImageKind): Promise<Game> {
    const game = await this.getOrThrow(id);
    game[IMAGE_COLUMN[kind]] = null;
    return this.games.save(game);
  }

  private async getOrThrow(id: string): Promise<Game> {
    const game = await this.games.findOne({ where: { id } });
    if (!game) throw new NotFoundException('Game not found');
    return game;
  }

  private async assertUnique(name: string, slug: string | null, exceptId?: string) {
    const clash = await this.games
      .createQueryBuilder('g')
      .where('(lower(g.name) = lower(:name)' + (slug ? ' OR g.slug = :slug)' : ')'), { name, slug })
      .andWhere(exceptId ? 'g.id <> :exceptId' : '1=1', { exceptId })
      .getOne();
    if (clash) throw new ConflictException('A game with this name or slug already exists');
  }

  private async nextSortOrder(): Promise<number> {
    const row = await this.games.createQueryBuilder('g').select('COALESCE(MAX(g.sortOrder), 0)', 'max').getRawOne<{ max: number }>();
    return Math.min(999, Number(row?.max ?? 0) + 1);
  }
}
