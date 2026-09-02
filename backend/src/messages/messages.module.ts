import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { DirectMessage } from './direct-message.entity';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

const useDatabase = Boolean(process.env.DATABASE_HOST) && process.env.USE_FILE_STORE !== 'true';

@Module({
  imports: [AuthModule, ...(useDatabase ? [TypeOrmModule.forFeature([DirectMessage])] : [])],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
