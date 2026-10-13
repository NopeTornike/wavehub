import { IsUUID } from 'class-validator';

export class StartDirectConversationDto {
  @IsUUID()
  recipientUserId: string;
}
