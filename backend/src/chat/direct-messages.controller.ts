import { CREATE_THROTTLE, MESSAGE_THROTTLE } from '../common/throttle';
import { Throttle } from '@nestjs/throttler';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { VerifiedEmailGuard } from '../auth/verified-email.guard';
import { ChatService } from './chat.service';
import { StartDirectConversationDto } from './dto/start-direct-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUserId } from '../auth/current-user.decorator';

// Direct (non-order) messaging between users who have transacted together — see CLAUDE.md for the
// "why this lives in chat/ instead of a new top-level module" reasoning and the eligibility rule.
// `GET direct-messages` (list) and `POST direct-messages/start` don't collide with
// `GET/POST direct-messages/:id/messages` in route-registration order (different literal path
// shapes), unlike the `:id`-vs-`mine` gotcha documented elsewhere in this codebase.
@Controller('direct-messages')
@UseGuards(AuthGuard)
export class DirectMessagesController {
  constructor(private readonly chat: ChatService) {}

  @Post('start')
  @Throttle(CREATE_THROTTLE)
  @UseGuards(VerifiedEmailGuard)
  start(@CurrentUserId() userId: string, @Body() dto: StartDirectConversationDto) {
    return this.chat.getOrCreateDirectConversation(userId, dto.recipientUserId);
  }

  @Get()
  listMine(@CurrentUserId() userId: string) {
    return this.chat.listMyDirectConversations(userId);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUserId() userId: string): Promise<{ count: number }> {
    return { count: await this.chat.countUnreadDirect(userId) };
  }

  @Get(':id/messages')
  listMessages(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.chat.listDirectMessages(id, userId);
  }

  @Post(':id/messages')
  @Throttle(MESSAGE_THROTTLE)
  sendMessage(@CurrentUserId() userId: string, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.chat.postDirectMessage(id, userId, dto.body);
  }
}
