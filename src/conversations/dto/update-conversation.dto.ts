import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ConversationStatus } from '../../common/enums/conversation.enum';

export class UpdateConversationDto {
  @IsEnum(ConversationStatus)
  @IsOptional()
  status?: ConversationStatus;

  @IsUUID()
  @IsOptional()
  assigned_to?: string;
}
