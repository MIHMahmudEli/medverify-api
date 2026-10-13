import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { User, UserRole } from '../../database/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let mockUserRepo: any;
  let mockJwtService: any;

  beforeEach(async () => {
    mockUserRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn((user) => Promise.resolve({ id: 'user-1', ...user })),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should hash passwords and register new users', async () => {
    mockUserRepo.findOne.mockResolvedValue(null);

    const res = await service.register({
      email: 'newuser@medverify.com',
      fullName: 'New User',
      password: 'Password123!',
      role: UserRole.REPORT_OPERATOR,
    });

    expect(mockUserRepo.create).toHaveBeenCalled();
    expect(res.email).toBe('newuser@medverify.com');
  });

  it('should throw ConflictException if registering existing email', async () => {
    mockUserRepo.findOne.mockResolvedValue({ id: 'existing' });

    await expect(
      service.register({
        email: 'existing@medverify.com',
        fullName: 'Existing',
        password: 'Password123!',
        role: UserRole.REPORT_OPERATOR,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should validate user password using Argon2 and sign JWT', async () => {
    const rawPass = 'Doctor123!';
    const hash = await argon2.hash(rawPass);

    const mockQueryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'doc-1',
        email: 'doctor@medverify.com',
        fullName: 'Dr. Test',
        role: UserRole.DOCTOR,
        isActive: true,
        passwordHash: hash,
      }),
    };
    mockUserRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

    const result = await service.login({
      email: 'doctor@medverify.com',
      password: rawPass,
    });

    expect(result.accessToken).toBe('mock-jwt-token');
    expect(result.user.email).toBe('doctor@medverify.com');
    expect(result.user.role).toBe(UserRole.DOCTOR);
  });

  it('should throw UnauthorizedException on wrong password', async () => {
    const hash = await argon2.hash('CorrectPass');

    const mockQueryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'doc-1',
        email: 'doctor@medverify.com',
        isActive: true,
        passwordHash: hash,
      }),
    };
    mockUserRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

    await expect(
      service.login({
        email: 'doctor@medverify.com',
        password: 'WrongPassword',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
