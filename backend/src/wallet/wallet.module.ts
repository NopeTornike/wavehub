import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletLedgerEntry } from './wallet-ledger-entry.entity';
import { WalletService } from './wallet.service';

@Module({
  imports: [TypeOrmModule.forFeature([WalletLedgerEntry])],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
