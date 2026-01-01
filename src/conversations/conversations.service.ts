import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from '../messages/entities/message.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import {
  ConversationStatus,
  ConversationUrgency,
  SenderType,
} from '../common/enums/conversation.enum';
import { UserRole } from '../common/enums/role.enum';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  /**
   * Create a new conversation (Student only)
   * Also creates the initial message
   */
  async create(
    userId: string,
    createConversationDto: CreateConversationDto,
  ): Promise<Conversation> {
    const { category, urgency, is_anonymous, initialMessage } =
      createConversationDto;

    // Create conversation
    const conversation = this.conversationRepository.create({
      user_id: userId,
      category,
      urgency,
      is_anonymous: is_anonymous ?? false,
      status: ConversationStatus.NEW,
    });

    const savedConversation =
      await this.conversationRepository.save(conversation);

    // Create initial message
    const message = this.messageRepository.create({
      conversation_id: savedConversation.conversation_id,
      sender_id: userId,
      sender_type: SenderType.STUDENT,
      message_text: initialMessage,
      is_read: false,
    });

    await this.messageRepository.save(message);

    return savedConversation;
  }

  /**
   * Get conversations for students (their own conversations only)
   */
  async findByStudent(userId: string): Promise<Conversation[]> {
    return this.conversationRepository.find({
      where: { user_id: userId },
      relations: ['messages'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Get conversations for counselors with PRIORITY QUEUE LOGIC
   * Emergency → High → Medium → Low, then by created_at ASC
   */
  async findByPriority(
    status?: ConversationStatus,
    assignedTo?: string,
  ): Promise<Conversation[]> {
    const queryBuilder = this.conversationRepository
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.messages', 'messages')
      .leftJoinAndSelect('conversation.user', 'user');

    // Filter by status if provided
    if (status) {
      queryBuilder.where('conversation.status = :status', { status });
    } else {
      // Default: show NEW and IN_PROGRESS conversations
      queryBuilder.where(
        'conversation.status IN (:...statuses)',
        {
          statuses: [ConversationStatus.NEW, ConversationStatus.IN_PROGRESS],
        },
      );
    }

    // Filter by assigned counselor if provided
    if (assignedTo) {
      queryBuilder.andWhere('conversation.assigned_to = :assignedTo', {
        assignedTo,
      });
    }

    // PRIORITY QUEUE SORTING
    queryBuilder
      .addSelect(
        `CASE conversation.urgency
          WHEN '${ConversationUrgency.EMERGENCY}' THEN 1
          WHEN '${ConversationUrgency.HIGH}' THEN 2
          WHEN '${ConversationUrgency.MEDIUM}' THEN 3
          WHEN '${ConversationUrgency.LOW}' THEN 4
        END`,
        'priority_order',
      )
      .orderBy('priority_order', 'ASC')
      .addOrderBy('conversation.created_at', 'ASC');

    return queryBuilder.getMany();
  }

  /**
   * Get all conversations (for admin/counselor overview)
   */
  async findAll(userRole: UserRole, userId?: string): Promise<Conversation[]> {
    if (userRole === UserRole.STUDENT) {
      throw new ForbiddenException('Students can only view their own conversations');
    }

    const queryBuilder = this.conversationRepository
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.messages', 'messages')
      .leftJoinAndSelect('conversation.user', 'user');

    if (userRole === UserRole.COUNSELOR && userId) {
      // Counselors see only their assigned conversations
      queryBuilder.where('conversation.assigned_to = :userId', { userId });
    }

    queryBuilder.orderBy('conversation.created_at', 'DESC');

    return queryBuilder.getMany();
  }

  /**
   * Get a single conversation by ID
   * Handles anonymity: hides username if is_anonymous = true
   */
  async findOne(
    conversationId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({
      where: { conversation_id: conversationId },
      relations: ['messages', 'user'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Authorization checks
    if (userRole === UserRole.STUDENT) {
      if (conversation.user_id !== userId) {
        throw new ForbiddenException('You can only view your own conversations');
      }
    } else if (userRole === UserRole.COUNSELOR) {
      if (
        conversation.assigned_to &&
        conversation.assigned_to !== userId
      ) {
        throw new ForbiddenException(
          'You can only view conversations assigned to you',
        );
      }
    }

    // ANONYMITY LOGIC: Hide username if anonymous
    if (conversation.is_anonymous && conversation.user) {
      conversation.user.username = 'Anonymous';
    }

    return conversation;
  }

  /**
   * Update conversation status (Counselor/Admin only)
   */
  async update(
    conversationId: string,
    updateConversationDto: UpdateConversationDto,
    userId: string,
    userRole: UserRole,
  ): Promise<Conversation> {
    if (userRole === UserRole.STUDENT) {
      throw new ForbiddenException('Students cannot update conversation status');
    }

    const conversation = await this.conversationRepository.findOne({
      where: { conversation_id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Counselors can only update their assigned conversations
    if (userRole === UserRole.COUNSELOR) {
      if (
        conversation.assigned_to &&
        conversation.assigned_to !== userId
      ) {
        throw new ForbiddenException(
          'You can only update conversations assigned to you',
        );
      }
    }

    // Update fields
    if (updateConversationDto.status) {
      conversation.status = updateConversationDto.status;
    }

    if (updateConversationDto.assigned_to) {
      conversation.assigned_to = updateConversationDto.assigned_to;
    }

    return this.conversationRepository.save(conversation);
  }

  /**
   * Assign conversation to counselor (Admin/Counselor)
   */
  async assignToCounselor(
    conversationId: string,
    counselorId: string,
    userRole: UserRole,
  ): Promise<Conversation> {
    if (userRole === UserRole.STUDENT) {
      throw new ForbiddenException('Students cannot assign conversations');
    }

    const conversation = await this.conversationRepository.findOne({
      where: { conversation_id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    conversation.assigned_to = counselorId;
    conversation.status = ConversationStatus.IN_PROGRESS;

    return this.conversationRepository.save(conversation);
  }

  /**
   * Toggle anonymity (Student only, their own conversations)
   */
  async toggleAnonymity(
    conversationId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<Conversation> {
    if (userRole !== UserRole.STUDENT) {
      throw new ForbiddenException('Only students can toggle anonymity');
    }

    const conversation = await this.conversationRepository.findOne({
      where: { conversation_id: conversationId, user_id: userId },
    });

    if (!conversation) {
      throw new NotFoundException(
        'Conversation not found or you do not have permission',
      );
    }

    conversation.is_anonymous = !conversation.is_anonymous;

    return this.conversationRepository.save(conversation);
  }

  /**
   * Get conversation statistics (for dashboard)
   */
  async getStatistics(userId?: string, userRole?: UserRole) {
    const queryBuilder = this.conversationRepository.createQueryBuilder('conversation');

    // Filter by counselor if provided
    if (userRole === UserRole.COUNSELOR && userId) {
      queryBuilder.where('conversation.assigned_to = :userId', { userId });
    }

    const total = await queryBuilder.getCount();

    const newCount = await queryBuilder
      .clone()
      .andWhere('conversation.status = :status', {
        status: ConversationStatus.NEW,
      })
      .getCount();

    const inProgressCount = await queryBuilder
      .clone()
      .andWhere('conversation.status = :status', {
        status: ConversationStatus.IN_PROGRESS,
      })
      .getCount();

    const resolvedCount = await queryBuilder
      .clone()
      .andWhere('conversation.status = :status', {
        status: ConversationStatus.RESOLVED,
      })
      .getCount();

    const emergencyCount = await queryBuilder
      .clone()
      .andWhere('conversation.urgency = :urgency', {
        urgency: ConversationUrgency.EMERGENCY,
      })
      .andWhere('conversation.status IN (:...statuses)', {
        statuses: [ConversationStatus.NEW, ConversationStatus.IN_PROGRESS],
      })
      .getCount();

    return {
      total,
      new: newCount,
      inProgress: inProgressCount,
      resolved: resolvedCount,
      emergency: emergencyCount,
    };
  }
}
