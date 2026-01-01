import {
  IsEnum,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  ConversationCategory,
  ConversationUrgency,
} from '../../common/enums/conversation.enum';

export class CreateConversationDto {
  @IsEnum(ConversationCategory)
  @IsNotEmpty()
  category: ConversationCategory;

  @IsEnum(ConversationUrgency)
  @IsNotEmpty()
  urgency: ConversationUrgency;

  @IsBoolean()
  @IsOptional()
  is_anonymous?: boolean;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000, { message: 'Initial message must not exceed 1000 characters' })
  initialMessage: string;
}
