import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { User } from './entities/user.entity';
import { UserRole } from '../common/enums/role.enum';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Get all counselors (for assignment purposes)
   * Only accessible by admin and counselor roles
   */
  @Get('counselors')
  @Roles(UserRole.ADMIN, UserRole.COUNSELOR)
  async getCounselors() {
    const counselors = await this.userRepository.find({
      where: { role: UserRole.COUNSELOR, is_active: true },
      select: ['user_id', 'username', 'role', 'created_at'],
      order: { username: 'ASC' },
    });

    return {
      message: 'Counselors retrieved successfully',
      counselors,
      count: counselors.length,
    };
  }

  /**
   * Get all users (admin only)
   */
  @Get()
  @Roles(UserRole.ADMIN)
  async getAllUsers() {
    const users = await this.userRepository.find({
      where: { is_active: true },
      select: ['user_id', 'username', 'role', 'created_at'],
      order: { created_at: 'DESC' },
    });

    return {
      message: 'Users retrieved successfully',
      users,
      count: users.length,
    };
  }
}
