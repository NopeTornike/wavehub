import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from '../users/user.entity';
import { AuthGuard } from './auth.guard';

const useDatabase = Boolean(process.env.DATABASE_HOST) && process.env.USE_FILE_STORE !== 'true';

@Module({
  imports: useDatabase ? [TypeOrmModule.forFeature([User])] : [],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
