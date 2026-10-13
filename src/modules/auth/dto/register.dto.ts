import { IsEmail, IsNotEmpty, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../database/entities/user.entity';

export class RegisterDto {
  @ApiProperty({ example: 'admin@medverify.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Dr. John Doe' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'Doctor123!' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;

  @ApiProperty({ enum: UserRole, default: UserRole.REPORT_OPERATOR })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({ example: 'Pathology & Lab' })
  @IsOptional()
  @IsString()
  department?: string;
}
