import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { WithdrawalsService } from './withdrawals.service';
import { CreateWithdrawRequestDto } from './dto/create-withdraw-request.dto';
import { ProcessWithdrawRequestDto } from './dto/process-withdraw-request.dto';
import { WalletService } from '../wallet/wallet.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';
import { AdminGuard } from '../admin/admin-role.guard';
import { RequireAdminRole } from '../admin/require-admin-role.decorator';
import { CurrentAdminRole } from '../admin/current-admin-role.decorator';
import { AdminAuditService } from '../admin/admin-audit.service';

class ListTransactionsQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  offset?: number;
}

// Wallet balance/transaction routes live here rather than a separate WalletController, because
// the full balance view needs WithdrawRequest data this module owns and wallet/ doesn't — see
// wallet/CLAUDE.md and withdrawals/CLAUDE.md for the fuller reasoning.
@Controller()
@UseGuards(AuthGuard)
export class WithdrawalsController {
  constructor(
    private readonly withdrawals: WithdrawalsService,
    private readonly wallet: WalletService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get('wallet/balance')
  getBalance(@CurrentUserId() userId: string) {
    return this.withdrawals.getBalanceSummary(userId);
  }

  @Get('wallet/transactions')
  listTransactions(@CurrentUserId() userId: string, @Query() query: ListTransactionsQueryDto) {
    return this.wallet.listTransactions(userId, query.limit ?? 20, query.offset ?? 0);
  }

  @Post('withdrawals')
  request(@CurrentUserId() sellerId: string, @Body() dto: CreateWithdrawRequestDto) {
    return this.withdrawals.request(sellerId, dto);
  }

  @Get('withdrawals/mine')
  listMine(@CurrentUserId() sellerId: string) {
    return this.withdrawals.listMine(sellerId);
  }

  @Post('withdrawals/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUserId() sellerId: string, @Param('id') id: string) {
    return this.withdrawals.cancel(sellerId, id);
  }

  // Super Admin only — SPECIFICATION.md's Super Admin "Payments" CAN list is the only one with
  // "approve/reject withdrawal"; every other role's list explicitly excludes it.
  @Post('withdrawals/:id/process')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminGuard)
  @RequireAdminRole()
  async process(
    @CurrentUserId() adminId: string,
    @CurrentAdminRole() adminRole: string,
    @Param('id') id: string,
    @Body() dto: ProcessWithdrawRequestDto,
  ) {
    const request = await this.withdrawals.process(adminId, id, dto.status, dto.note);
    await this.audit.log({
      adminId,
      adminRole,
      action: 'withdrawal.process',
      entityType: 'withdraw_request',
      entityId: id,
      metadata: { status: dto.status, note: dto.note },
    });
    return request;
  }
}
