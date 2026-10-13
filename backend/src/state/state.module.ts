import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { StateController } from './state.controller';
import { UserState } from './user-state.entity';
import { StateService } from './state.service';

const useDatabase = Boolean(process.env.DATABASE_HOST) && process.env.USE_FILE_STORE !== 'true';

@Module({
  imports: [AuthModule, ...(useDatabase ? [TypeOrmModule.forFeature([UserState])] : [])],
  controllers: [StateController],
  providers: [StateService],
  exports: [StateService],
})
export class StateModule {}
