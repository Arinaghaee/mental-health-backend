import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Messages')
@ApiBearerAuth('JWT-auth')
@Controller('conversations/:conversationId/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  /**
   * Send a message in a conversation
   * POST /conversations/:conversationId/messages
   */
  @Post()
  @ApiOperation({ 
    summary: 'Send a message',
    description: 'Send a message in a conversation'
  })
  @ApiParam({ name: 'conversationId', description: 'Conversation ID' })
  @ApiResponse({ status: 201, description: 'Message sent successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async create(
    @Request() req,
    @Param('conversationId') conversationId: string,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    const { userId, role } = req.user;

    const message = await this.messagesService.create(
      conversationId,
      userId,
      role,
      createMessageDto,
    );

    return {
      message: 'Message sent successfully',
      data: message,
    };
  }

  /**
   * Get all messages in a conversation
   * GET /conversations/:conversationId/messages
   */
  @Get()
  async findAll(
    @Request() req,
    @Param('conversationId') conversationId: string,
  ) {
    const { userId, role } = req.user;

    const messages = await this.messagesService.findByConversation(
      conversationId,
      userId,
      role,
    );

    return {
      message: 'Messages retrieved successfully',
      messages,
      count: messages.length,
    };
  }

  /**
   * Mark a specific message as read
   * PATCH /conversations/:conversationId/messages/:messageId/read
   */
  @Patch(':messageId/read')
  async markAsRead(
    @Request() req,
    @Param('messageId') messageId: string,
  ) {
    const { userId, role } = req.user;

    const message = await this.messagesService.markAsRead(
      messageId,
      userId,
      role,
    );

    return {
      message: 'Message marked as read',
      data: message,
    };
  }

  /**
   * Mark all unread messages in conversation as read
   * PATCH /conversations/:conversationId/messages/mark-all-read
   */
  @Patch('mark-all-read')
  async markAllAsRead(
    @Request() req,
    @Param('conversationId') conversationId: string,
  ) {
    const { userId, role } = req.user;

    await this.messagesService.markConversationAsRead(
      conversationId,
      userId,
      role,
    );

    return {
      message: 'All messages marked as read successfully',
    };
  }
}

/**
 * Separate controller for message-related user stats
 */
@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesStatsController {
  constructor(private readonly messagesService: MessagesService) {}

  /**
   * Get unread message count for current user
   * GET /messages/unread-count
   */
  @Get('unread-count')
  async getUnreadCount(@Request() req) {
    const { userId, role } = req.user;

    const count = await this.messagesService.getUnreadCount(userId, role);

    return {
      message: 'Unread count retrieved successfully',
      unreadCount: count,
    };
  }
}
