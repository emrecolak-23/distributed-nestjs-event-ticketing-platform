import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto';
import { UserRole } from './enums';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.findByEmail(dto.email);

    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = this.userRepo.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      phone: dto.phone ?? null,
      role: UserRole.USER,
    });

    const saved = await this.userRepo.save(user);
    return this.userWithoutPassword(saved);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: {
        email,
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: {
        id,
      },
    });
  }

  async findByEmailVerificationToken(tokenHash: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: {
        emailVerificationToken: tokenHash,
      },
    });
  }

  async markEmailVerified(userId: string): Promise<void> {
    await this.userRepo.update(userId, {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    });
  }

  async setPasswordResetToken(
    userId: string,
    tokenHash: string,
    expires: Date,
  ): Promise<void> {
    await this.userRepo.update(userId, {
      passwordResetToken: tokenHash,
      passwordResetExpires: expires,
    });
  }

  async findByPasswordResetToken(tokenHash: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: {
        passwordResetToken: tokenHash,
      },
    });
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.userRepo.update(userId, {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    });
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  async setEmailVerificationToken(
    userId: string,
    tokenHash: string,
    expires: Date,
  ): Promise<void> {
    await this.userRepo.update(userId, {
      emailVerificationToken: tokenHash,
      emailVerificationExpires: expires,
    });
  }

  private userWithoutPassword(user: User): User {
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }
}
