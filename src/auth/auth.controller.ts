import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  UseGuards,
  Get,
  Request,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user
   * POST /auth/register
   * Rate limit: 3 requests per 60 seconds to prevent spam registrations
   */
  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Register a new user',
    description: 'Creates a new user account and returns a JWT token along with a recovery file for account recovery'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'User successfully registered',
    schema: {
      example: {
        message: 'User registered successfully',
        user: {
          user_id: 1,
          username: 'john_doe',
          email: 'john@example.com',
          role: 'student',
          created_at: '2024-01-01T00:00:00.000Z'
        },
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        recoveryFile: {
          filename: 'recovery_john_doe_1234567890.txt',
          content: 'base64_encoded_content',
          instructions: 'Please download and save this recovery file securely...'
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid input' })
  @ApiResponse({ status: 409, description: 'Conflict - Username or email already exists' })
  async register(@Body() registerDto: RegisterDto) {
    const result = await this.authService.register(registerDto);

    return {
      message: 'User registered successfully',
      user: result.user,
      token: result.token,
      recoveryFile: {
        filename: result.recoveryFile.filename,
        content: result.recoveryFile.content,
        instructions:
          'Please download and save this recovery file securely. You will need it to recover your account if you forget your password.',
      },
    };
  }

  /**
   * Login user
   * POST /auth/login
   * Rate limit: 5 requests per 60 seconds to prevent brute force attacks
   */
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login user',
    description: 'Authenticates a user and returns a JWT token'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Login successful',
    schema: {
      example: {
        message: 'Login successful',
        user: {
          user_id: 1,
          username: 'john_doe',
          email: 'john@example.com',
          role: 'student'
        },
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);

    return {
      message: 'Login successful',
      user: result.user,
      token: result.token,
    };
  }

  /**
   * Recover account using recovery file
   * POST /auth/recover
   * Rate limit: 3 requests per 60 seconds to prevent abuse
   */
  @Post('recover')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Recover account',
    description: 'Recovers an account using the recovery file and sets a new password'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        username: { type: 'string', example: 'john_doe' },
        recoveryFileContent: { type: 'string', example: 'base64_encoded_recovery_content' },
        newPassword: { type: 'string', example: 'NewSecurePassword123!' }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Account recovered successfully',
    schema: {
      example: {
        message: 'Account recovered and password updated successfully'
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid recovery file' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async recoverAccount(
    @Body()
    body: {
      username: string;
      recoveryFileContent: string;
      newPassword: string;
    },
  ) {
    const result = await this.authService.recoverAccount(
      body.username,
      body.recoveryFileContent,
      body.newPassword,
    );

    return result;
  }

  /**
   * Get current user profile (Protected route example)
   * GET /auth/profile
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Get current user profile',
    description: 'Returns the profile information of the currently authenticated user'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Profile retrieved successfully',
    schema: {
      example: {
        user: {
          user_id: 1,
          username: 'john_doe',
          email: 'john@example.com',
          role: 'student'
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  getProfile(@Request() req) {
    return {
      user: req.user,
    };
  }

  /**
   * Download recovery file (for testing purposes)
   * This would typically be called from frontend to download the file
   */
  @Post('download-recovery')
  async downloadRecovery(
    @Body() body: { filename: string; content: string },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename=${body.filename}`);
    res.send(body.content);
  }
}
