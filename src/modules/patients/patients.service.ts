import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Patient } from '../../database/entities/patient.entity';
import { MedicalReport } from '../../database/entities/medical-report.entity';
import { MedicalCertificate } from '../../database/entities/medical-certificate.entity';
import { MedicalReportRevision } from '../../database/entities/medical-report-revision.entity';
import { ReportVerificationToken } from '../../database/entities/report-verification-token.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { User } from '../../database/entities/user.entity';
import { CreatePatientDto, UpdatePatientDto } from './dto/patient.dto';
import { PaginationQueryDto, PaginatedResult } from '../../common/dto/pagination.dto';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    private dataSource: DataSource,
  ) {}

  async findAll(
    query: PaginationQueryDto & { isArchived?: boolean },
  ): Promise<PaginatedResult<Patient>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 10));
    const skip = (page - 1) * limit;

    const qb = this.patientRepository.createQueryBuilder('patient');

    if (query.isArchived !== undefined) {
      qb.andWhere('patient.isArchived = :isArchived', { isArchived: query.isArchived });
    } else {
      qb.andWhere('patient.isArchived = false');
    }

    if (query.search && query.search.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        '(LOWER(patient.fullName) LIKE LOWER(:term) OR LOWER(patient.passportNumber) LIKE LOWER(:term) OR LOWER(patient.agency) LIKE LOWER(:term) OR LOWER(patient.country) LIKE LOWER(:term))',
        { term },
      );
    }

    const validSortFields = ['fullName', 'passportNumber', 'dateOfBirth', 'createdAt', 'agency'];
    const sortField = validSortFields.includes(query.sortBy) ? `patient.${query.sortBy}` : 'patient.createdAt';
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

  async findOne(id: string): Promise<Patient> {
    const patient = await this.patientRepository.findOne({
      where: { id },
      relations: ['reports'],
    });

    if (!patient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    // Sort reports desc by createdAt
    if (patient.reports) {
      patient.reports.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }

    return patient;
  }

  async create(dto: CreatePatientDto): Promise<Patient> {
    const existing = await this.patientRepository.findOne({
      where: { passportNumber: dto.passportNumber.trim().toUpperCase() },
    });

    if (existing) {
      throw new ConflictException(
        `A patient with passport number ${dto.passportNumber} already exists (${existing.fullName})`,
      );
    }

    const patient = this.patientRepository.create({
      ...dto,
      passportNumber: dto.passportNumber.trim().toUpperCase(),
    });

    return this.patientRepository.save(patient);
  }

  async update(id: string, dto: UpdatePatientDto): Promise<Patient> {
    const patient = await this.findOne(id);

    if (dto.passportNumber && dto.passportNumber.trim().toUpperCase() !== patient.passportNumber) {
      const existing = await this.patientRepository.findOne({
        where: { passportNumber: dto.passportNumber.trim().toUpperCase() },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Passport number ${dto.passportNumber} is already registered to another patient`,
        );
      }
      patient.passportNumber = dto.passportNumber.trim().toUpperCase();
    }

    Object.assign(patient, dto);
    return this.patientRepository.save(patient);
  }

  async archive(id: string): Promise<{ success: boolean; message: string }> {
    const patient = await this.findOne(id);
    patient.isArchived = true;
    await this.patientRepository.save(patient);
    return { success: true, message: `Patient ${patient.fullName} archived` };
  }

  async unarchive(id: string): Promise<{ success: boolean; message: string }> {
    const patient = await this.patientRepository.findOne({ where: { id } });
    if (!patient) throw new NotFoundException('Patient not found');
    patient.isArchived = false;
    await this.patientRepository.save(patient);
    return { success: true, message: `Patient ${patient.fullName} restored` };
  }

  async deletePatient(id: string, user?: User): Promise<{ success: boolean; message: string }> {
    const patient = await this.patientRepository.findOne({ where: { id } });
    if (!patient) {
      throw new NotFoundException(`Patient with ID ${id} not found`);
    }

    const patientName = patient.fullName;
    const passportNo = patient.passportNumber;

    await this.dataSource.transaction(async (manager) => {
      // 1. Find all reports for this patient
      const reports = await manager.find(MedicalReport, {
        where: { patientId: id },
        select: ['id'],
      });
      const reportIds = reports.map((r) => r.id);

      if (reportIds.length > 0) {
        // Delete all child entities associated with reports
        await manager.delete(MedicalCertificate, { reportId: In(reportIds) });
        await manager.delete(ReportVerificationToken, { reportId: In(reportIds) });
        await manager.delete(MedicalReportRevision, { reportId: In(reportIds) });
        // Delete the reports
        await manager.delete(MedicalReport, { patientId: id });
      }

      // 2. Delete any medical certificates directly associated with this patient
      await manager.delete(MedicalCertificate, { patientId: id });

      // 3. Delete the patient profile
      await manager.delete(Patient, { id });

      // 4. Audit log entry
      const auditEntry = manager.create(AuditLog, {
        userId: user?.id,
        action: 'DELETE_PATIENT',
        entityType: 'PATIENT',
        entityId: id,
        details: {
          patientName,
          passportNumber: passportNo,
          deletedReportsCount: reportIds.length,
          deletedBy: user?.email || user?.fullName || 'Super Admin',
        },
      });
      await manager.save(AuditLog, auditEntry);
    });

    return {
      success: true,
      message: `Patient ${patientName} (${passportNo}) and all associated records have been permanently deleted.`,
    };
  }
}

