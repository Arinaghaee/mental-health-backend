import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000, { message: 'Message must not exceed 2000 characters' })
  message_text: string;
}
