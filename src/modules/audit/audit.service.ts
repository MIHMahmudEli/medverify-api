import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { PaginationQueryDto, PaginatedResult } from '../../common/dto/pagination.dto';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditRepository: Repository<AuditLog>,
  ) {}

  async log(data: {
    userId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    ipAddress?: string;
    details?: Record<string, any>;
  }): Promise<AuditLog> {
    const record = this.auditRepository.create({
      ...data,
      details: data.details || {},
    });
    return this.auditRepository.save(record);
  }

  async findAll(query: PaginationQueryDto): Promise<PaginatedResult<AuditLog>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const qb = this.auditRepository.createQueryBuilder('audit');

    if (query.search) {
      qb.andWhere(
        '(LOWER(audit.action) LIKE LOWER(:s) OR LOWER(audit.entityType) LIKE LOWER(:s) OR LOWER(audit.entityId) LIKE LOWER(:s))',
        { s: `%${query.search}%` },
      );
    }

    qb.orderBy('audit.createdAt', 'DESC');
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
}
