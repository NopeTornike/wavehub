import { Module } from '@nestjs/common';
import { BogPaymentsController } from './bog-payments.controller';
import { BogPaymentsService } from './bog-payments.service';

@Module({
  controllers: [BogPaymentsController],
  providers: [BogPaymentsService],
})
export class PaymentsModule {}
