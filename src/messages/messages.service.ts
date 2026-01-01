import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { Conversation } from '../conversations/entities/conversation.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import { SenderType } from '../common/enums/conversation.enum';
import { UserRole } from '../common/enums/role.enum';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
  ) {}

  /**
   * Create a new message in a conversation
   */
  async create(
    conversationId: string,
    userId: string,
    userRole: UserRole,
    createMessageDto: CreateMessageDto,
  ): Promise<Message> {
    // Verify conversation exists
    const conversation = await this.conversationRepository.findOne({
      where: { conversation_id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Authorization check
    if (userRole === UserRole.STUDENT) {
      // Students can only message their own conversations
      if (conversation.user_id !== userId) {
        throw new ForbiddenException(
          'You can only send messages to your own conversations',
        );
      }
    } else if (userRole === UserRole.COUNSELOR) {
      // Counselors can only message conversations assigned to them
      if (conversation.assigned_to !== userId) {
        throw new ForbiddenException(
          'You can only send messages to conversations assigned to you',
        );
      }
    }

    // Determine sender type
    const senderType =
      userRole === UserRole.STUDENT ? SenderType.STUDENT : SenderType.COUNSELOR;

    // Create message
    const message = this.messageRepository.create({
      conversation_id: conversationId,
      sender_id: userId,
      sender_type: senderType,
      message_text: createMessageDto.message_text,
      is_read: false,
    });

    return this.messageRepository.save(message);
  }

  /**
   * Get all messages in a conversation
   */
  async findByConversation(
    conversationId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<Message[]> {
    // Verify conversation exists and user has access
    const conversation = await this.conversationRepository.findOne({
      where: { conversation_id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Authorization check
    if (userRole === UserRole.STUDENT) {
      if (conversation.user_id !== userId) {
        throw new ForbiddenException(
          'You can only view messages from your own conversations',
        );
      }
    } else if (userRole === UserRole.COUNSELOR) {
      if (conversation.assigned_to && conversation.assigned_to !== userId) {
        throw new ForbiddenException(
          'You can only view messages from conversations assigned to you',
        );
      }
    }

    // Get messages ordered by creation time
    return this.messageRepository.find({
      where: { conversation_id: conversationId },
      order: { created_at: 'ASC' },
    });
  }

  /**
   * Mark a message as read
   */
  async markAsRead(
    messageId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<Message> {
    const message = await this.messageRepository.findOne({
      where: { message_id: messageId },
      relations: ['conversation'],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Authorization: Only the recipient can mark as read
    // Students can mark counselor messages as read
    // Counselors can mark student messages as read
    if (userRole === UserRole.STUDENT) {
      if (message.sender_type === SenderType.STUDENT) {
        throw new ForbiddenException(
          'You cannot mark your own messages as read',
        );
      }
      if (message.conversation.user_id !== userId) {
        throw new ForbiddenException('You can only mark messages in your conversations as read');
      }
    } else if (userRole === UserRole.COUNSELOR) {
      if (message.sender_type === SenderType.COUNSELOR) {
        throw new ForbiddenException(
          'You cannot mark your own messages as read',
        );
      }
      if (message.conversation.assigned_to !== userId) {
        throw new ForbiddenException(
          'You can only mark messages in your assigned conversations as read',
        );
      }
    }

    message.is_read = true;
    return this.messageRepository.save(message);
  }

  /**
   * Mark all unread messages in a conversation as read
   */
  async markConversationAsRead(
    conversationId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<void> {
    // Verify conversation exists and user has access
    const conversation = await this.conversationRepository.findOne({
      where: { conversation_id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Authorization check
    if (userRole === UserRole.STUDENT) {
      if (conversation.user_id !== userId) {
        throw new ForbiddenException(
          'You can only mark messages in your own conversations as read',
        );
      }
    } else if (userRole === UserRole.COUNSELOR) {
      if (conversation.assigned_to && conversation.assigned_to !== userId) {
        throw new ForbiddenException(
          'You can only mark messages in your assigned conversations as read',
        );
      }
    }

    // Determine which messages to mark as read based on user role
    const senderTypeToMark =
      userRole === UserRole.STUDENT
        ? SenderType.COUNSELOR
        : SenderType.STUDENT;

    // Update all unread messages from the other party
    await this.messageRepository
      .createQueryBuilder()
      .update(Message)
      .set({ is_read: true })
      .where('conversation_id = :conversationId', { conversationId })
      .andWhere('sender_type = :senderType', { senderType: senderTypeToMark })
      .andWhere('is_read = :isRead', { isRead: false })
      .execute();
  }

  /**
   * Get unread message count for a user
   */
  async getUnreadCount(userId: string, userRole: UserRole): Promise<number> {
    const queryBuilder = this.messageRepository
      .createQueryBuilder('message')
      .leftJoin('message.conversation', 'conversation')
      .where('message.is_read = :isRead', { isRead: false });

    if (userRole === UserRole.STUDENT) {
      // Count unread counselor messages in student's conversations
      queryBuilder
        .andWhere('conversation.user_id = :userId', { userId })
        .andWhere('message.sender_type = :senderType', {
          senderType: SenderType.COUNSELOR,
        });
    } else if (userRole === UserRole.COUNSELOR) {
      // Count unread student messages in counselor's assigned conversations
      queryBuilder
        .andWhere('conversation.assigned_to = :userId', { userId })
        .andWhere('message.sender_type = :senderType', {
          senderType: SenderType.STUDENT,
        });
    }

    return queryBuilder.getCount();
  }
}
