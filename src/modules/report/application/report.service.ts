import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CacheKey, CacheService, CacheTtl } from '../../../shared/cache/cache.service';
import { AppException } from '../../../shared/exceptions/app.exception';
import { ErrorCode } from '../../../shared/exceptions/error-code';
import {
  OffsetPage, OffsetPaginationQuery,
} from '../../../shared/http/pagination.dto';
import { User, UserStatus } from '../../user/domain/user.entity';
import {
  Report, ReportReason, ReportStatus, ReportTargetType, SANCTION_THRESHOLD,
} from '../domain/report.entity';

export interface CreateReportCommand {
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  targetUserId?: string;
  reason: ReportReason;
  detail?: string;
}

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly cache: CacheService,
  ) {}

  /**
   * 신고 접수.
   * 접수와 동시에 누적 카운트를 올리고, 임계치/즉시제재 사유면 계정을 정지시킨다.
   * 카운트 증가와 제재는 반드시 한 트랜잭션이어야 중복 신고 시 상태가 어긋나지 않는다.
   */
  async create(command: CreateReportCommand): Promise<{ id: string; sanctioned: boolean }> {
    if (command.targetUserId && command.targetUserId === command.reporterId) {
      throw new AppException(ErrorCode.REPORT_SELF_NOT_ALLOWED);
    }

    return this.dataSource.transaction(async (manager) => {
      const reportRepo = manager.getRepository(Report);
      const userRepo = manager.getRepository(User);

      const duplicated = await reportRepo.findOne({
        where: {
          reporterId: command.reporterId,
          targetType: command.targetType,
          targetId: command.targetId,
        },
        select: { id: true },
      });
      if (duplicated) throw new AppException(ErrorCode.REPORT_DUPLICATED);

      const report = await reportRepo.save(
        reportRepo.create({
          reporterId: command.reporterId,
          targetType: command.targetType,
          targetId: command.targetId,
          targetUserId: command.targetUserId ?? null,
          reason: command.reason,
          detail: command.detail ?? null,
          status: ReportStatus.PENDING,
        }),
      );

      let sanctioned = false;

      if (command.targetUserId) {
        // 원자적 증가 — 동시 신고 시 lost update 방지
        await userRepo.increment({ id: command.targetUserId }, 'reportCount', 1);

        const target = await userRepo.findOne({
          where: { id: command.targetUserId },
          select: { id: true, reportCount: true, status: true },
        });

        const instant = report.requiresInstantSanction();
        const overThreshold = (target?.reportCount ?? 0) >= SANCTION_THRESHOLD;

        if (target && target.status === UserStatus.ACTIVE && (instant || overThreshold)) {
          await userRepo.update(target.id, { status: UserStatus.SUSPENDED });
          sanctioned = true;
          this.logger.warn(
            `auto-sanction user=${target.id} reason=${report.reason} count=${target.reportCount}`,
          );
        }
      }

      await this.cache.del(CacheKey.reportPendingCount(), CacheKey.adminDashboard());
      if (command.targetUserId) await this.cache.del(`auth:user:${command.targetUserId}`);

      return { id: report.id, sanctioned };
    });
  }

  /** 관리자 목록 — 총 건수가 필요하므로 오프셋 방식 */
  async listForAdmin(
    query: OffsetPaginationQuery & { status?: ReportStatus },
  ): Promise<OffsetPage<Report>> {
    const qb = this.reports
      .createQueryBuilder('report')
      .orderBy('report.createdAt', 'DESC')
      .skip((query.page - 1) * query.size)
      .take(query.size);

    if (query.status) qb.andWhere('report.status = :status', { status: query.status });

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      page: query.page,
      size: query.size,
      total,
      totalPages: Math.ceil(total / query.size),
    };
  }

  async pendingCount(): Promise<number> {
    return this.cache.wrap(CacheKey.reportPendingCount(), CacheTtl.AGGREGATE, () =>
      this.reports.count({ where: { status: ReportStatus.PENDING } }),
    );
  }

  /** 관리자 처리 — 상태 전이 규칙을 서비스에서 강제 */
  async updateStatus(
    reportId: string,
    status: ReportStatus,
    adminId: string,
    note?: string,
  ): Promise<Report> {
    const report = await this.reports.findOne({ where: { id: reportId } });
    if (!report) throw new AppException(ErrorCode.REPORT_NOT_FOUND);
    if (report.isClosed()) throw new AppException(ErrorCode.REPORT_ALREADY_RESOLVED);

    report.status = status;
    report.handledBy = adminId;
    report.handledAt = new Date();
    report.handlerNote = note ?? null;

    const saved = await this.reports.save(report);
    await this.cache.del(CacheKey.reportPendingCount(), CacheKey.adminDashboard());
    return saved;
  }

  /** 관리자 수동 제재 */
  async sanctionUser(userId: string, status: UserStatus, adminId: string): Promise<void> {
    const result = await this.users.update(userId, { status });
    if (!result.affected) throw new AppException(ErrorCode.USER_NOT_FOUND);

    this.logger.warn(`manual-sanction user=${userId} status=${status} by=${adminId}`);
    await this.cache.del(`auth:user:${userId}`, CacheKey.userProfile(userId), CacheKey.adminDashboard());
  }
}
