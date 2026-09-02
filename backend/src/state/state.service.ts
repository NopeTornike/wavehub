import { BadRequestException, ForbiddenException, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { Repository } from 'typeorm';
import { UserState } from './user-state.entity';

type StateRecord = { id: string; scope: string; key: string; value: any; updatedAt: string };

const GLOBAL_KEYS = new Set(['wavehub.sellerListings', 'wavehub.sellerReviews', 'wavehub.tournaments']);
const USER_KEYS = new Set([
  'wavehub.cart',
  'wavehub.favorites',
  'wavehub.purchases',
  'wavehub.coachWishlist',
  'wavehub.steamFavorites',
  'wavehub.notificationSeen',
]);
const PROFILE_KEY = 'wavehub.users';
const WALLET_KEY = 'wavehub.wallets';

@Injectable()
export class StateService {
  private readonly stateFile = join(process.cwd(), 'data', 'state.json');

  constructor(@Optional() @InjectRepository(UserState) private readonly repo?: Repository<UserState>) {}

  async publicState() {
    const records = await this.findByScope('global');
    const values = Object.fromEntries(records.filter((item) => GLOBAL_KEYS.has(item.key)).map((item) => [item.key, item.value]));
    const profiles = records.find((item) => item.key === PROFILE_KEY)?.value;
    values[PROFILE_KEY] = Array.isArray(profiles) ? profiles : [];
    const cartRecords = await this.findByKey('wavehub.cart');
    values['wavehub.publicCoachingListings'] = cartRecords
      .filter((record) => Array.isArray(record.value))
      .flatMap((record) => record.value)
      .filter((item: any) => item?.productType === 'Coaching' && item?.isCoachListing);
    return values;
  }

  async stateFor(username: string) {
    const records = await this.findByScope(username);
    const values = Object.fromEntries(records.filter((item) => USER_KEYS.has(item.key)).map((item) => [item.key, item.value]));
    const ownPurchases = Array.isArray(values['wavehub.purchases']) ? values['wavehub.purchases'] : [];
    const allPurchaseRecords = await this.findByKey('wavehub.purchases');
    const sellerPurchases = allPurchaseRecords
      .filter((record) => record.scope !== username && Array.isArray(record.value))
      .flatMap((record) => record.value)
      .map((purchase: any) => ({
        ...purchase,
        items: Array.isArray(purchase?.items)
          ? purchase.items.filter((item: any) => item?.sellerUsername === username)
          : [],
      }))
      .filter((purchase: any) => purchase.items.length > 0);
    values['wavehub.purchases'] = [...ownPurchases, ...sellerPurchases];
    const wallet = records.find((item) => item.key === WALLET_KEY)?.value || { balance: 0, transactions: [] };
    values[WALLET_KEY] = { [username]: this.sanitizeWallet(wallet) };
    return values;
  }

  async saveClientState(username: string, role: string, key: string, value: any) {
    if (USER_KEYS.has(key)) {
      const safeValue = key === 'wavehub.purchases'
        ? (Array.isArray(value) ? value.filter((item) => item?.buyerUsername === username) : [])
        : key === 'wavehub.cart'
          ? (Array.isArray(value) ? value.filter((item) => !item?.isCoachListing || item?.buyerUsername === username) : [])
          : value;
      await this.upsert(username, key, safeValue);
      return safeValue;
    }

    if (key === PROFILE_KEY) {
      const submitted = Array.isArray(value) ? value.find((item) => item?.username === username) : null;
      if (!submitted) throw new BadRequestException('Current profile is missing');
      const profile = this.sanitizeProfile(submitted, username);
      const current = await this.getValue('global', PROFILE_KEY, []);
      const profiles = Array.isArray(current) ? current : [];
      const next = profiles.some((item) => item?.username === username)
        ? profiles.map((item) => item?.username === username ? profile : item)
        : [...profiles, profile];
      await this.upsert('global', PROFILE_KEY, next);
      return next;
    }

    if (GLOBAL_KEYS.has(key)) {
      if (key === 'wavehub.tournaments' && role !== 'admin') {
        const canonical = await this.mergeTournamentRegistration(username, value);
        await this.upsert('global', key, canonical);
        return canonical;
      }
      const canonical = await this.mergeOwnedCollection(username, key, value);
      await this.upsert('global', key, canonical);
      return canonical;
    }

    throw new BadRequestException('Unsupported state key');
  }

  async recordWalletTransaction(username: string, transaction: any) {
    const wallet = this.sanitizeWallet(await this.getValue(username, WALLET_KEY, { balance: 0, transactions: [] }));
    const transactions = wallet.transactions.filter((item: any) => item.id !== transaction.id);
    const next = { ...wallet, transactions: [{ ...transaction }, ...transactions] };
    await this.upsert(username, WALLET_KEY, next);
    return next;
  }

  private async mergeOwnedCollection(username: string, key: string, proposedValue: any) {
    if (!Array.isArray(proposedValue)) throw new BadRequestException('Collection state must be an array');
    const currentValue = await this.getValue('global', key, []);
    const current = Array.isArray(currentValue) ? currentValue : [];
    const ownerField = key === 'wavehub.sellerListings' ? 'sellerUsername'
      : key === 'wavehub.sellerReviews' ? 'buyerUsername'
        : 'createdBy';
    const existingById = new Map(current.map((item) => [String(item?.id || ''), item]));
    const proposedById = new Map(proposedValue.map((item) => [String(item?.id || ''), item]));

    for (const existing of current) {
      if (key === 'wavehub.tournaments') continue;
      if (existing?.[ownerField] !== username) {
        const proposed = proposedById.get(String(existing?.id || ''));
        if (JSON.stringify(proposed) !== JSON.stringify(existing)) {
          throw new ForbiddenException('Another user\'s record cannot be changed');
        }
      }
    }

    return proposedValue.map((item) => {
      if (!item || typeof item !== 'object' || !item.id) throw new BadRequestException('Every record needs an id');
      const existing: any = existingById.get(String(item.id));
      if (key !== 'wavehub.tournaments' && existing && existing[ownerField] !== username) return existing;
      if (key !== 'wavehub.tournaments' && !existing && item[ownerField] && item[ownerField] !== username) {
        throw new ForbiddenException('Record owner does not match session');
      }
      return { ...item, [ownerField]: key === 'wavehub.tournaments' ? username : username };
    });
  }

  private async mergeTournamentRegistration(username: string, proposedValue: any) {
    if (!Array.isArray(proposedValue)) throw new BadRequestException('Tournament state must be an array');
    const currentValue = await this.getValue('global', 'wavehub.tournaments', []);
    const current = Array.isArray(currentValue) ? currentValue : [];
    if (proposedValue.length !== current.length) throw new ForbiddenException('Only tournament registration is allowed');
    const proposedById = new Map(proposedValue.map((item) => [String(item?.id || ''), item]));
    return current.map((existing: any) => {
      const proposed: any = proposedById.get(String(existing?.id || ''));
      if (!proposed) throw new ForbiddenException('Tournament records cannot be removed');
      const oldUsers = Array.isArray(existing.registeredUsers) ? existing.registeredUsers : [];
      const newUsers = Array.isArray(proposed.registeredUsers) ? proposed.registeredUsers : [];
      const allowedUsers = oldUsers.includes(username) ? oldUsers : [...oldUsers, username];
      const expected = {
        ...existing,
        registeredUsers: allowedUsers,
        players: oldUsers.includes(username)
          ? existing.players
          : Math.min(Number(existing.maxPlayers) || 64, (Number(existing.players) || 0) + 1),
      };
      if (JSON.stringify(proposed) !== JSON.stringify(expected) && JSON.stringify(proposed) !== JSON.stringify(existing)) {
        throw new ForbiddenException('Only your own registration can be added');
      }
      return proposed;
    });
  }

  private sanitizeProfile(profile: any, username: string) {
    return {
      username,
      firstName: String(profile.firstName || '').slice(0, 120),
      lastName: String(profile.lastName || '').slice(0, 120),
      photoData: typeof profile.photoData === 'string' ? profile.photoData : '',
      bio: String(profile.bio || '').slice(0, 2000),
      mainGames: Array.isArray(profile.mainGames) ? profile.mainGames.slice(0, 2).map(String) : [],
      createdAt: profile.createdAt || new Date().toISOString(),
    };
  }

  private sanitizeWallet(wallet: any) {
    return {
      balance: Math.max(0, Number(wallet?.balance) || 0),
      transactions: Array.isArray(wallet?.transactions) ? wallet.transactions : [],
    };
  }

  private async getValue(scope: string, key: string, fallback: any) {
    const record = (await this.findByScope(scope)).find((item) => item.key === key);
    return record?.value ?? fallback;
  }

  private async findByScope(scope: string): Promise<StateRecord[]> {
    if (this.repo) return (await this.repo.find({ where: { scope } })) as any;
    return (await this.readFileStore()).filter((item) => item.scope === scope);
  }

  private async findByKey(key: string): Promise<StateRecord[]> {
    if (this.repo) return (await this.repo.find({ where: { key } })) as any;
    return (await this.readFileStore()).filter((item) => item.key === key);
  }

  private async upsert(scope: string, key: string, value: any) {
    if (this.repo) {
      const existing = await this.repo.findOne({ where: { scope, key } });
      await this.repo.save(existing ? Object.assign(existing, { value }) : this.repo.create({ scope, key, value }));
      return;
    }
    const records = await this.readFileStore();
    const existing = records.find((item) => item.scope === scope && item.key === key);
    if (existing) {
      existing.value = value;
      existing.updatedAt = new Date().toISOString();
    } else {
      records.push({ id: randomUUID(), scope, key, value, updatedAt: new Date().toISOString() });
    }
    await mkdir(dirname(this.stateFile), { recursive: true });
    await writeFile(this.stateFile, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  }

  private async readFileStore(): Promise<StateRecord[]> {
    try {
      const parsed = JSON.parse(await readFile(this.stateFile, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch (err: any) {
      if (err?.code === 'ENOENT') return [];
      throw err;
    }
  }
}
