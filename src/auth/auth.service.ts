import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as CryptoJS from 'crypto-js';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserRole } from '../common/enums/role.enum';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Register a new user with bcrypt password hashing
   */
  async register(registerDto: RegisterDto) {
    const { username, password, role } = registerDto;

    // Check if username already exists
    const existingUser = await this.userRepository.findOne({
      where: { username },
    });

    if (existingUser) {
      throw new ConflictException('Username already exists');
    }

    // Hash password with bcrypt (10 rounds)
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Generate recovery key
    const recoveryKey = this.generateRecoveryKey();
    const recovery_key_hash = await bcrypt.hash(recoveryKey, saltRounds);

    // Create user
    const user = this.userRepository.create({
      username,
      password_hash,
      recovery_key_hash,
      role: role || UserRole.STUDENT,
    });

    await this.userRepository.save(user);

    // Generate encrypted recovery file content
    const encryptedRecoveryFile = this.encryptRecoveryKey(
      recoveryKey,
      user.user_id,
    );

    // Generate JWT token
    const token = this.generateJwtToken(user);

    return {
      user: {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
      },
      token,
      recoveryFile: {
        filename: `recovery_${username}_${Date.now()}.key`,
        content: encryptedRecoveryFile,
      },
    };
  }

  /**
   * Login user and return JWT token
   */
  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;

    // Find user
    const user = await this.userRepository.findOne({
      where: { username, is_active: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password with bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token
    const token = this.generateJwtToken(user);

    return {
      user: {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
      },
      token,
    };
  }

  /**
   * Validate recovery key and reset password
   */
  async recoverAccount(
    username: string,
    recoveryFileContent: string,
    newPassword: string,
  ) {
    // Find user
    const user = await this.userRepository.findOne({ where: { username } });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    try {
      // Decrypt recovery file
      const decryptedData = this.decryptRecoveryKey(recoveryFileContent);
      const { recoveryKey, userId } = JSON.parse(decryptedData);

      // Verify user ID matches
      if (userId !== user.user_id) {
        throw new UnauthorizedException('Invalid recovery file');
      }

      // Verify recovery key
      const isRecoveryKeyValid = await bcrypt.compare(
        recoveryKey,
        user.recovery_key_hash,
      );

      if (!isRecoveryKeyValid) {
        throw new UnauthorizedException('Invalid recovery key');
      }

      // Hash new password
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      user.password_hash = password_hash;
      await this.userRepository.save(user);

      return {
        message: 'Password reset successful',
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid recovery file or key');
    }
  }

  /**
   * Generate JWT token for user
   */
  private generateJwtToken(user: User): string {
    const payload = {
      sub: user.user_id,
      username: user.username,
      role: user.role,
    };

    return this.jwtService.sign(payload);
  }

  /**
   * Generate a random recovery key
   */
  private generateRecoveryKey(): string {
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let recoveryKey = '';

    for (let i = 0; i < 32; i++) {
      recoveryKey += characters.charAt(
        Math.floor(Math.random() * characters.length),
      );
    }

    return recoveryKey;
  }

  /**
   * Encrypt recovery key for file download
   */
  private encryptRecoveryKey(recoveryKey: string, userId: string): string {
    const dataToEncrypt = JSON.stringify({
      recoveryKey,
      userId,
      timestamp: new Date().toISOString(),
    });

    const secretKey = process.env.RECOVERY_KEY_SECRET || 'default-secret-key';
    const encrypted = CryptoJS.AES.encrypt(dataToEncrypt, secretKey).toString();

    return encrypted;
  }

  /**
   * Decrypt recovery key from file
   */
  private decryptRecoveryKey(encryptedData: string): string {
    const secretKey = process.env.RECOVERY_KEY_SECRET || 'default-secret-key';
    const decrypted = CryptoJS.AES.decrypt(encryptedData, secretKey);

    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Validate user by JWT payload
   */
  async validateUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { user_id: userId, is_active: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
