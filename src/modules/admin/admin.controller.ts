import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Repository } from 'typeorm';
import { CurrentUser, Roles } from '../../shared/auth/guards';
import { CacheKey, CacheService, CacheTtl } from '../../shared/cache/cache.service';
import { AppException } from '../../shared/exceptions/app.exception';
import { ErrorCode } from '../../shared/exceptions/error-code';
import { OffsetPaginationQuery } from '../../shared/http/pagination.dto';
import { AdService } from '../ad/application/ad.service';
import { ArtistService } from '../artist/application/artist.service';
import { ReportService } from '../report/application/report.service';
import { SupplyService } from '../supply/application/supply.service';
import { User, UserRole, UserStatus } from '../user/domain/user.entity';

class AdminUserQuery extends OffsetPaginationQuery {
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @IsOptional() @IsString() keyword?: string;
}

class UserStatusDto {
  @IsEnum(UserStatus) status: UserStatus;
}

@Controller('admin')
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly reportService: ReportService,
    private readonly artistService: ArtistService,
    private readonly adService: AdService,
    private readonly supplyService: SupplyService,
    private readonly cache: CacheService,
  ) {}

  /**
   * 대시보드 — 여러 도메인의 집계를 한 번에 내려준다.
   * 개별 호출을 합쳐 왕복을 줄이고, 결과 전체를 캐싱해 DB 부하를 낮춘다.
   */
  @Get('dashboard')
  async dashboard() {
    return this.cache.wrap(CacheKey.adminDashboard(), CacheTtl.AGGREGATE, async () => {
      const [userStats, pendingReports, masters, revenue, pendingVendors, settlement] =
        await Promise.all([
          this.users
            .createQueryBuilder('u')
            .select('COUNT(*)::int', 'total')
            .addSelect(`COUNT(*) FILTER (WHERE 'TATTOOIST' = ANY(u.roles))::int`, 'tattooists')
            .addSelect(`COUNT(*) FILTER (WHERE u.status = 'suspended')::int`, 'suspended')
            .getRawOne<Record<string, number>>(),
          this.reportService.pendingCount(),
          this.artistService.getSelectedMasters(),
          this.adService.revenueSummary(),
          this.supplyService.pendingVendorCount(),
          this.supplyService.settlementSummary(),
        ]);

      return {
        users: {
          total: Number(userStats?.total ?? 0),
          tattooists: Number(userStats?.tattooists ?? 0),
          suspended: Number(userStats?.suspended ?? 0),
        },
        selectedMasters: masters.length,
        pendingReports,
        ads: revenue,
        pendingVendors,
        settlement,
      };
    });
  }

  @Get('users')
  async listUsers(@Query() query: AdminUserQuery) {
    const qb = this.users
      .createQueryBuilder('u')
      .orderBy('u.createdAt', 'DESC')
      .skip((query.page - 1) * query.size)
      .take(query.size);

    if (query.status) qb.andWhere('u.status = :status', { status: query.status });
    if (query.role) qb.andWhere(':role = ANY(u.roles)', { role: query.role });
    if (query.keyword) {
      qb.andWhere('(u.nickname ILIKE :kw OR u.email ILIKE :kw)', { kw: `%${query.keyword}%` });
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      items, page: query.page, size: query.size, total,
      totalPages: Math.ceil(total / query.size),
    };
  }

  @Get('users/:id')
  async getUser(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new AppException(ErrorCode.USER_NOT_FOUND);
    return user;
  }

  @Patch('users/:id/status')
  async setUserStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UserStatusDto,
    @CurrentUser('id') adminId: string,
  ) {
    await this.reportService.sanctionUser(id, dto.status, adminId);
    await this.cache.del(CacheKey.adminDashboard());
    return { userId: id, status: dto.status };
  }
}
