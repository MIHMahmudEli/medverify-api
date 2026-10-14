import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import * as argon2 from 'argon2';
import { User, UserRole } from '../../database/entities/user.entity';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { PaginationQueryDto, PaginatedResult } from '../../common/dto/pagination.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findAll(query: PaginationQueryDto & { role?: UserRole }): Promise<PaginatedResult<User>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 10));
    const skip = (page - 1) * limit;

    const qb = this.userRepository.createQueryBuilder('user');

    if (query.search) {
      qb.andWhere(
        '(LOWER(user.fullName) LIKE LOWER(:search) OR LOWER(user.email) LIKE LOWER(:search) OR LOWER(user.department) LIKE LOWER(:search))',
        { search: `%${query.search}%` },
      );
    }

    if (query.role) {
      qb.andWhere('user.role = :role', { role: query.role });
    }

    const validSortFields = ['fullName', 'email', 'role', 'createdAt', 'lastLoginAt'];
    const sortField = validSortFields.includes(query.sortBy) ? `user.${query.sortBy}` : 'user.createdAt';
    const sortOrder = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    qb.orderBy(sortField, sortOrder);
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = this.userRepository.create({
      email: dto.email.toLowerCase(),
      fullName: dto.fullName,
      passwordHash,
      role: dto.role,
      department: dto.department,
      isActive: true,
    });

    return this.userRepository.save(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.department !== undefined) user.department = dto.department;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.password) {
      user.passwordHash = await argon2.hash(dto.password);
    }

    return this.userRepository.save(user);
  }

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const user = await this.findOne(id);
    user.isActive = false;
    await this.userRepository.save(user);
    return { success: true, message: `User ${user.email} deactivated` };
  }

  async resetPassword(
    id: string,
    customTempPassword?: string,
  ): Promise<{ temporaryPassword: string; message: string; user: { id: string; fullName: string; email: string } }> {
    const user = await this.findOne(id);

    const tempPassword =
      customTempPassword && customTempPassword.trim().length >= 6
        ? customTempPassword.trim()
        : `Temp@${Math.random().toString(36).slice(-5).toUpperCase()}${Math.floor(100 + Math.random() * 900)}!`;

    user.passwordHash = await argon2.hash(tempPassword);
    await this.userRepository.save(user);

    return {
      temporaryPassword: tempPassword,
      message: `Temporary password created successfully.`,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
      },
    };
  }
}
