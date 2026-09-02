import { Module } from '@nestjs/common';
import { BogPaymentsController } from './bog-payments.controller';
import { BogPaymentsService } from './bog-payments.service';
import { AuthModule } from '../auth/auth.module';
import { StateModule } from '../state/state.module';

@Module({
  imports: [AuthModule, StateModule],
  controllers: [BogPaymentsController],
  providers: [BogPaymentsService],
})
export class PaymentsModule {}
