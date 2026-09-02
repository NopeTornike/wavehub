import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { dirname, join } from 'path';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { DirectMessage } from './direct-message.entity';

type StoredMessage = {
  id: string;
  fromUsername: string;
  toUsername: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

@Injectable()
export class MessagesService {
  private readonly messagesFile = join(process.cwd(), 'data', 'direct-messages.json');

  constructor(
    private readonly auth: AuthService,
    @Optional() @InjectRepository(DirectMessage) private readonly repo?: Repository<DirectMessage>,
  ) {}

  async listFor(username: string) {
    if (!this.repo) {
      const messages = await this.readStoredMessages();
      return messages.filter((message) => message.fromUsername === username || message.toUsername === username);
    }

    return this.repo.find({
      where: [{ fromUsername: username }, { toUsername: username }],
      order: { createdAt: 'ASC' },
    });
  }

  async send(fromUsername: string, toUsernameInput: string, bodyInput: string) {
    const toUsername = toUsernameInput.trim().toLowerCase();
    const body = bodyInput.trim();
    if (fromUsername === toUsername) throw new BadRequestException('You cannot message yourself');
    if (!(await this.auth.usernameExists(toUsername))) throw new NotFoundException('Recipient was not found');

    if (!this.repo) {
      const messages = await this.readStoredMessages();
      const message: StoredMessage = {
        id: randomUUID(),
        fromUsername,
        toUsername,
        body,
        createdAt: new Date().toISOString(),
        readAt: null,
      };
      messages.push(message);
      await this.writeStoredMessages(messages);
      return message;
    }

    return this.repo.save(this.repo.create({ fromUsername, toUsername, body, readAt: null }));
  }

  async markConversationRead(username: string, participantInput: string) {
    const participant = participantInput.trim().toLowerCase();
    const readAt = new Date();

    if (!this.repo) {
      const messages = await this.readStoredMessages();
      let updated = 0;
      const next = messages.map((message) => {
        if (message.toUsername === username && message.fromUsername === participant && !message.readAt) {
          updated += 1;
          return { ...message, readAt: readAt.toISOString() };
        }
        return message;
      });
      if (updated) await this.writeStoredMessages(next);
      return updated;
    }

    const result = await this.repo
      .createQueryBuilder()
      .update(DirectMessage)
      .set({ readAt })
      .where('"toUsername" = :username', { username })
      .andWhere('"fromUsername" = :participant', { participant })
      .andWhere('"readAt" IS NULL')
      .execute();
    return result.affected || 0;
  }

  private async readStoredMessages(): Promise<StoredMessage[]> {
    try {
      const parsed = JSON.parse(await readFile(this.messagesFile, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch (err: any) {
      if (err?.code === 'ENOENT') return [];
      throw err;
    }
  }

  private async writeStoredMessages(messages: StoredMessage[]) {
    await mkdir(dirname(this.messagesFile), { recursive: true });
    await writeFile(this.messagesFile, `${JSON.stringify(messages, null, 2)}\n`, 'utf8');
  }
}
