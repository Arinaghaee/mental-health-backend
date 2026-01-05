import { Controller, Get, Delete, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/role.enum';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Delete own account (self-deletion)
   * Any authenticated user can delete their own account
   * DELETE /users/me
   */
  @Delete('me')
  @ApiOperation({
    summary: 'Delete own account',
    description: 'Allows any authenticated user to delete their own account and all associated data (conversations, messages)',
  })
  @ApiResponse({
    status: 200,
    description: 'Account deleted successfully',
    schema: {
      example: {
        message: 'Your account and all associated data have been deleted successfully',
        user: {
          user_id: 'uuid',
          username: 'john_doe',
          role: 'student',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteSelf(@Request() req) {
    const { userId } = req.user;
    const result = await this.usersService.deleteUser(userId);

    return {
      message: 'Your account and all associated data have been deleted successfully',
      user: result.user,
    };
  }

  /**
   * Get all counselors (for assignment purposes)
   * Only accessible by admin and counselor roles
   */
  @Get('counselors')
  @Roles(UserRole.ADMIN, UserRole.COUNSELOR)
  @ApiOperation({
    summary: 'Get all counselors',
    description: 'Retrieves a list of all active counselors (for assignment purposes)',
  })
  @ApiResponse({ status: 200, description: 'Counselors retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin/Counselor only' })
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
  @ApiOperation({
    summary: 'Get all users',
    description: 'Retrieves a list of all users in the system (admin only)',
  })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
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
  @ApiOperation({
    summary: 'Delete user by ID (Admin only)',
    description: 'Allows admins to delete any user account and all associated data',
  })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUser(@Param('id') id: string) {
    return await this.usersService.deleteUser(id);
  }
}
