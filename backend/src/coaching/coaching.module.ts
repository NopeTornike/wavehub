import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coach } from './coach.entity';
import { Game } from '../listings/game.entity';
import { CoachesService } from './coaches.service';
import { CoachesController } from './coaches.controller';
import { AuthModule } from '../auth/auth.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [TypeOrmModule.forFeature([Coach, Game]), AuthModule, AdminModule],
  controllers: [CoachesController],
  providers: [CoachesService],
  exports: [CoachesService],
})
export class CoachingModule {}
