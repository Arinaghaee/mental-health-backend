import { IsString, IsNotEmpty, MinLength, MaxLength, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../common/enums/role.enum';

export class RegisterDto {
  @ApiProperty({
    description: 'Username for the new account',
    example: 'john_doe',
    minLength: 3,
    maxLength: 30
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(30, { message: 'Username must not exceed 30 characters' })
  username: string;

  @ApiProperty({
    description: 'Password for the new account',
    example: 'SecurePassword123!',
    minLength: 8
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @ApiProperty({
    description: 'User role (student or counselor)',
    enum: UserRole,
    example: UserRole.STUDENT,
    required: false,
    default: UserRole.STUDENT
  })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}
