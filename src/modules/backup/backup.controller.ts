import { Controller, Post, UseGuards } from '@nestjs/common';
import { RolesGuard, Roles } from '../../shared/auth/guards';
import { UserRole } from '../user/domain/user.entity';
import { BackupService } from './backup.service';

/** 수동 백업 실행 — 어드민 전용 */
@Controller('admin/backup')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class BackupController {
  constructor(private readonly backup: BackupService) {}

  @Post('run')
  async run(): Promise<{ key: string }> {
    const key = await this.backup.backup();
    return { key };
  }
}
