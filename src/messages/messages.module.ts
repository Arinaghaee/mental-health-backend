import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagesService } from './messages.service';
import { MessagesController, MessagesStatsController } from './messages.controller';
import { Message } from './entities/message.entity';
import { Conversation } from '../conversations/entities/conversation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Message, Conversation])],
  controllers: [MessagesController, MessagesStatsController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
