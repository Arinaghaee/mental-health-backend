import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/role.enum';
import { ConversationStatus } from '../common/enums/conversation.enum';

@ApiTags('Conversations')
@ApiBearerAuth('JWT-auth')
@Controller('conversations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  /**
   * Create a new conversation (Students only)
   * POST /conversations
   */
  @Post()
  @Roles(UserRole.STUDENT)
  @ApiOperation({ 
    summary: 'Create new conversation',
    description: 'Students can create a new conversation to seek mental health support'
  })
  @ApiResponse({ status: 201, description: 'Conversation created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Students only' })
  async create(
    @Request() req,
    @Body() createConversationDto: CreateConversationDto,
  ) {
    const conversation = await this.conversationsService.create(
      req.user.userId,
      createConversationDto,
    );

    return {
      message: 'Conversation created successfully',
      conversation,
    };
  }

  /**
   * Get all conversations (role-specific filtering)
   * GET /conversations
   */
  @Get()
  async findAll(@Request() req) {
    const { userId, role } = req.user;

    if (role === UserRole.STUDENT) {
      // Students get their own conversations
      return this.conversationsService.findByStudent(userId);
    } else {
      // Counselors/Admins get all or assigned conversations
      return this.conversationsService.findAll(role, userId);
    }
  }

  /**
   * Get priority queue (Counselors/Admins only)
   * GET /conversations/priority-queue
   */
  @Get('priority-queue')
  @Roles(UserRole.COUNSELOR, UserRole.ADMIN)
  async getPriorityQueue(
    @Request() req,
    @Query('status') status?: ConversationStatus,
  ) {
    const { userId, role } = req.user;

    // Counselors see only their assigned conversations
    const assignedTo = role === UserRole.COUNSELOR ? userId : undefined;

    const conversations = await this.conversationsService.findByPriority(
      status,
      assignedTo,
    );

    return {
      message: 'Priority queue retrieved successfully',
      conversations,
      urgencyOrder: ['emergency', 'high', 'medium', 'low'],
    };
  }

  /**
   * Get conversation statistics (dashboard)
   * GET /conversations/statistics
   */
  @Get('statistics')
  async getStatistics(@Request() req) {
    const { userId, role } = req.user;

    const stats = await this.conversationsService.getStatistics(userId, role);

    return {
      message: 'Statistics retrieved successfully',
      statistics: stats,
    };
  }

  /**
   * Get a single conversation by ID
   * GET /conversations/:id
   */
  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    const { userId, role } = req.user;

    const conversation = await this.conversationsService.findOne(
      id,
      userId,
      role,
    );

    return {
      message: 'Conversation retrieved successfully',
      conversation,
    };
  }

  /**
   * Update conversation status (Counselors/Admins only)
   * PATCH /conversations/:id
   */
  @Patch(':id')
  @Roles(UserRole.COUNSELOR, UserRole.ADMIN)
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateConversationDto: UpdateConversationDto,
  ) {
    const { userId, role } = req.user;

    const conversation = await this.conversationsService.update(
      id,
      updateConversationDto,
      userId,
      role,
    );

    return {
      message: 'Conversation updated successfully',
      conversation,
    };
  }

  /**
   * Assign conversation to counselor (Counselors/Admins)
   * PATCH /conversations/:id/assign/:counselorId
   */
  @Patch(':id/assign/:counselorId')
  @Roles(UserRole.COUNSELOR, UserRole.ADMIN)
  async assignToCounselor(
    @Request() req,
    @Param('id') id: string,
    @Param('counselorId') counselorId: string,
  ) {
    const { role } = req.user;

    const conversation = await this.conversationsService.assignToCounselor(
      id,
      counselorId,
      role,
    );

    return {
      message: 'Conversation assigned successfully',
      conversation,
    };
  }

  /**
   * Toggle anonymity (Students only, their own conversations)
   * PATCH /conversations/:id/toggle-anonymity
   */
  @Patch(':id/toggle-anonymity')
  @Roles(UserRole.STUDENT)
  async toggleAnonymity(@Request() req, @Param('id') id: string) {
    const { userId, role } = req.user;

    const conversation = await this.conversationsService.toggleAnonymity(
      id,
      userId,
      role,
    );

    return {
      message: `Anonymity ${conversation.is_anonymous ? 'enabled' : 'disabled'} successfully`,
      conversation,
    };
  }
}
