import { Controller, Get, Delete, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/role.enum';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get all counselors (for assignment purposes)
   * Only accessible by admin and counselor roles
   */
  @Get('counselors')
  @Roles(UserRole.ADMIN, UserRole.COUNSELOR)
  async getCounselors() {
    const counselors = await this.usersService.getCounselors();

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
    const users = await this.usersService.getAllUsers();

    return {
      message: 'Users retrieved successfully',
      users,
      count: users.length,
    };
  }

  /**
   * Delete a user and all associated data (admin only)
   * @param id - The user ID to delete
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async deleteUser(@Param('id') id: string) {
    return await this.usersService.deleteUser(id);
  }
}
