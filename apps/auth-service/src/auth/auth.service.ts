import {
  Injectable,
  UnauthorizedException,
  Logger,
  Inject,
  OnModuleInit,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { UserService } from '../user/user.service';
import { RefreshToken } from '../user/entities/refresh-token.entity';
import { JwtPayload } from './interfaces';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshTokenExpiryDays: number;
  private readonly appUrl: string;

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    @Inject('AUTH_KAFKA') private readonly kafkaClient: ClientKafka,
  ) {
    this.refreshTokenExpiryDays = this.configService.get(
      'REFRESH_TOKEN_EXPIRY_DAYS',
      1,
    );
    this.appUrl = this.configService.get('APP_URL', 'http://localhost:8080');
  }

  async onModuleInit() {
    await this.kafkaClient.connect();
  }

  async register(email: string, password: string, fullName: string) {
    const user = await this.userService.create({
      email,
      password,
      fullName,
    });

    const token = randomUUID();
    const tokenHash = this.hashToken(token);
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);

    await this.userService.setEmailVerificationToken(
      user.id,
      tokenHash,
      expires,
    );

    this.kafkaClient.emit('auth.email_verification', {
      key: user.id,
      value: {
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        verificationUrl: `${this.appUrl}/auth/verify-email?token=${token}`,
        expiresAt: expires.toISOString(),
      },
    });

    this.logger.log(`Email verification email sent to ${user.email}`);

    return user;
  }

  async login(email: string, password: string) {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.userService.validatePassword(
      user,
      password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      user.emailVerified,
    );

    this.logger.log(`User ${user.email} logged in successfully`);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        emailVerified: user.emailVerified,
      },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    const tokenHash = await bcrypt.hash(refreshToken, 10);

    const storedTokens = await this.refreshTokenRepo.findOne({
      where: {
        tokenHash,
        revokedAt: null as any,
      },
    });

    if (!storedTokens) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedTokens.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    storedTokens.revokedAt = new Date();
    await this.refreshTokenRepo.save(storedTokens);
    const user = await this.userService.findById(storedTokens.userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      user.emailVerified,
    );
    this.logger.log(`User ${user.email} refreshed tokens successfully`);

    return tokens;
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);

    const storedToken = await this.refreshTokenRepo.findOne({
      where: {
        tokenHash,
        revokedAt: IsNull(),
      },
    });

    if (storedToken) {
      storedToken.revokedAt = new Date();
      await this.refreshTokenRepo.save(storedToken);
    }
  }

  async resendVerification(userId: string) {
    const user = await this.userService.findById(userId);

    if (!user) throw new UnauthorizedException('User not found');
    if (user.emailVerified) return { message: 'Email already verified' };

    const token = randomUUID();
    const tokenHash = this.hashToken(token);
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);

    await this.userService.setEmailVerificationToken(
      userId,
      tokenHash,
      expires,
    );

    this.kafkaClient.emit('auth.email_verification', {
      key: userId,
      value: {
        userId: userId,
        email: user.email,
        fullName: user.fullName,
        verificationUrl: `${this.appUrl}/auth/verify-email?token=${token}`,
        expiresAt: expires.toISOString(),
      },
    });

    this.logger.log(`Email verification email resent to ${user.email}`);

    return { message: 'Email verification email resent' };
  }

  async requestEmailVerification(userId: string) {
    const user = await this.userService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    const token = randomUUID();
    const tokenHash = this.hashToken(token);
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);
    await this.userService.setEmailVerificationToken(
      userId,
      tokenHash,
      expires,
    );

    this.kafkaClient.emit('auth.email_verification', {
      key: userId,
      value: {
        userId: userId,
        email: user.email,
        fullName: user.fullName,
        verificationUrl: `${this.appUrl}/auth/verify-email?token=${token}`,
        expiresAt: expires.toISOString(),
      },
    });

    this.logger.log(`Email verification email sent to ${user.email}`);

    return { message: 'Email verification email sent' };
  }

  async verifyEmail(token: string) {
    const tokenHash = this.hashToken(token);
    const user = await this.userService.findByEmailVerificationToken(tokenHash);

    if (
      !user ||
      (user.emailVerificationExpires &&
        user.emailVerificationExpires < new Date())
    ) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    await this.userService.markEmailVerified(user.id);
    this.logger.log(`Email verified for user ${user.email} successfully`);

    return { message: 'Email verified successfully' };
  }

  async requestPasswordReset(email: string) {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      return { message: 'If themail exists, a reset link has been sent' };
    }

    const token = randomUUID();
    const tokenHash = this.hashToken(token);
    const expires = new Date();
    expires.setHours(expires.getHours() + 1);
    await this.userService.setPasswordResetToken(user.id, tokenHash, expires);

    this.kafkaClient.emit('auth.password_reset', {
      key: user.id,
      value: {
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        resetUrl: `${this.appUrl}/reset-password?token=${token}`,
        expiresAt: expires.toISOString(),
      },
    });
    this.logger.log(
      `Password reset email sent to ${user.email} token: ${token}`,
    );
    return { message: 'If the email exists, a reset link has been sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = this.hashToken(token);
    const user = await this.userService.findByPasswordResetToken(tokenHash);

    if (
      !user ||
      (user.passwordResetExpires && user.passwordResetExpires < new Date())
    ) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    await this.userService.updatePassword(user.id, newPassword);
    this.logger.log(`Password reset for user ${user.email} successfully`);

    await this.refreshTokenRepo.update(
      {
        userId: user.id,
        revokedAt: IsNull(),
      },
      { revokedAt: new Date() },
    );

    this.logger.log(`Password reset for user ${user.email} successfully`);

    return {
      message: 'Password reset successfully',
    };
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    emailVerified: boolean,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = { sub: userId, email, role, emailVerified };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRY', '15m'),
    });

    const refreshToken = randomUUID();
    const refreshTokenHash = this.hashToken(refreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenExpiryDays);
    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        userId,
        tokenHash: refreshTokenHash,
        expiresAt,
      }),
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
