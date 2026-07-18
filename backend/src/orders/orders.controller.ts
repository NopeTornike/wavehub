import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { OrdersService } from './orders.service';
import { PurchaseOrderDto } from './dto/purchase-order.dto';
import { RequestRevisionDto } from './dto/request-revision.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { SendMessageDto } from '../chat/dto/send-message.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';

@Controller('orders')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  purchase(@CurrentUserId() buyerId: string, @Body() dto: PurchaseOrderDto) {
    return this.orders.purchase(buyerId, dto);
  }

  @Get('as-buyer')
  findMineAsBuyer(@CurrentUserId() buyerId: string) {
    return this.orders.findMineAsBuyer(buyerId);
  }

  @Get('as-seller')
  findMineAsSeller(@CurrentUserId() sellerId: string) {
    return this.orders.findMineAsSeller(sellerId);
  }

  @Get(':id')
  findOne(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.orders.findForParticipant(userId, id);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  start(@CurrentUserId() sellerId: string, @Param('id') id: string) {
    return this.orders.startOrder(sellerId, id);
  }

  @Post(':id/deliver')
  @HttpCode(HttpStatus.OK)
  deliver(@CurrentUserId() sellerId: string, @Param('id') id: string) {
    return this.orders.deliverOrder(sellerId, id);
  }

  @Post(':id/delivery-files')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }))
  addDeliveryFile(
    @CurrentUserId() sellerId: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.orders.addDeliveryFile(sellerId, id, file);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  accept(@CurrentUserId() buyerId: string, @Param('id') id: string) {
    return this.orders.acceptDelivery(buyerId, id);
  }

  @Post(':id/request-revision')
  @HttpCode(HttpStatus.OK)
  requestRevision(
    @CurrentUserId() buyerId: string,
    @Param('id') id: string,
    @Body() dto: RequestRevisionDto,
  ) {
    return this.orders.requestRevision(buyerId, id, dto.reason);
  }

  @Post(':id/cancel-as-buyer')
  @HttpCode(HttpStatus.OK)
  cancelAsBuyer(@CurrentUserId() buyerId: string, @Param('id') id: string) {
    return this.orders.cancelByBuyer(buyerId, id);
  }

  @Post(':id/cancel-as-seller')
  @HttpCode(HttpStatus.OK)
  cancelAsSeller(
    @CurrentUserId() sellerId: string,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.orders.cancelBySeller(sellerId, id, dto.reason);
  }

  @Get(':id/messages')
  listMessages(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.orders.listMessages(userId, id);
  }

  @Post(':id/messages')
  sendMessage(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.orders.sendMessage(userId, id, dto.body);
  }
}
