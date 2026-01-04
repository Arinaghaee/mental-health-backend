import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from './entities/user.entity';
import { UserRole } from '../common/enums/role.enum';
import { Conversation } from '../conversations/entities/conversation.entity';
import { Message } from '../messages/entities/message.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  /**
   * Hard delete a user and all associated data (conversations and messages)
   * @param userId - The ID of the user to delete
   * @returns Success message with deleted user info
   */
  async deleteUser(userId: string): Promise<{ message: string; user: any }> {
    // Find the user
    const user = await this.userRepository.findOne({
      where: { user_id: userId },
      select: ['user_id', 'username', 'role', 'created_at'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Store user info before deletion
    const deletedUserInfo = {
      user_id: user.user_id,
      username: user.username,
      role: user.role,
    };

    // Find all conversations associated with this user
    const conversations = await this.conversationRepository.find({
      where: [{ user_id: userId }, { assigned_to: userId }],
      select: ['conversation_id'],
    });

    // Delete all messages in these conversations first
    if (conversations.length > 0) {
      const conversationIds = conversations.map((c) => c.conversation_id);
      await this.messageRepository.delete({
        conversation_id: In(conversationIds),
      });
      
      // Delete all conversations (now that messages are gone)
      await this.conversationRepository.delete({
        conversation_id: In(conversationIds),
      });
    }

    // Delete the user
    await this.userRepository.delete(userId);

    return {
      message: 'User and all associated data deleted successfully',
      user: deletedUserInfo,
    };
  }

  /**
   * Get all users (active only)
   */
  async getAllUsers(): Promise<User[]> {
    return await this.userRepository.find({
      where: { is_active: true },
      select: ['user_id', 'username', 'role', 'created_at'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Get all counselors (active only)
   */
  async getCounselors(): Promise<User[]> {
    return await this.userRepository.find({
      where: { role: UserRole.COUNSELOR, is_active: true },
      select: ['user_id', 'username', 'role', 'created_at'],
      order: { username: 'ASC' },
    });
  }
}
