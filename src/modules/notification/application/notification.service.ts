import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { FirebaseService } from '../../../shared/firebase/firebase.service';
import { AppException } from '../../../shared/exceptions/app.exception';
import { ErrorCode } from '../../../shared/exceptions/error-code';
import { buildCursorPage } from '../../../shared/http/pagination.dto';
import { User } from '../../user/domain/user.entity';
import { NotificationPreference, UserNotification, UserPushToken } from '../domain/notification.entity';

export type NotificationPreferenceKey = keyof Omit<
  NotificationPreference,
  'id' | 'userId' | 'createdAt' | 'updatedAt' | 'deletedAt'
>;

export interface NotifyCommand {
  userId: string;
  type: string;
  preference: NotificationPreferenceKey;
  titleKo: string;
  titleEn: string;
  bodyKo: string;
  bodyEn: string;
  data?: Record<string, string>;
  idempotencyKey?: string;
}

const DEFAULTS: Record<NotificationPreferenceKey, boolean> = {
  reservationStatus: true,
  reservationConfirm: true,
  reservationRemind: false,
  procedureDone: true,
  newReply: true,
  favoriteArtist: true,
  favoriteWorkStock: true,
  favoriteSupplyPrice: false,
  shopApplication: true,
  event: true,
  notice: true,
};

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(UserNotification) private readonly notifications: Repository<UserNotification>,
    @InjectRepository(NotificationPreference) private readonly preferences: Repository<NotificationPreference>,
    @InjectRepository(UserPushToken) private readonly tokens: Repository<UserPushToken>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly firebase: FirebaseService,
  ) {}

  async getPreferences(userId: string): Promise<Record<NotificationPreferenceKey, boolean>> {
    const row = await this.preferences.findOne({ where: { userId } });
    if (!row) return { ...DEFAULTS };
    return Object.fromEntries(Object.keys(DEFAULTS).map((key) => [key, row[key as NotificationPreferenceKey]])) as Record<NotificationPreferenceKey, boolean>;
  }

  async updatePreferences(userId: string, patch: Partial<Record<NotificationPreferenceKey, boolean>>) {
    let row = await this.preferences.findOne({ where: { userId } });
    row ??= this.preferences.create({ userId, ...DEFAULTS });
    for (const key of Object.keys(DEFAULTS) as NotificationPreferenceKey[]) {
      if (patch[key] !== undefined) row[key] = patch[key];
    }
    await this.preferences.save(row);
    return this.getPreferences(userId);
  }

  async registerToken(userId: string, token: string, platform: 'ios' | 'android', installationId: string) {
    let row = await this.tokens.findOne({ where: { token }, withDeleted: true });
    if (row) {
      row.userId = userId;
      row.platform = platform;
      row.installationId = installationId;
      row.enabled = true;
      row.deletedAt = null;
      row.lastSeenAt = new Date();
    } else {
      row = this.tokens.create({ userId, token, platform, installationId, enabled: true, lastSeenAt: new Date() });
    }
    await this.tokens.save(row);
    return { registered: true };
  }

  async removeToken(userId: string, installationId: string) {
    await this.tokens.softDelete({ userId, installationId });
    return { removed: true };
  }

  async list(userId: string, cursor: string | undefined, limit: number) {
    const qb = this.notifications.createQueryBuilder('n')
      .where('n.userId = :userId', { userId })
      .andWhere('n.deletedAt IS NULL')
      .orderBy('n.createdAt', 'DESC').addOrderBy('n.id', 'DESC').take(limit + 1);
    if (cursor) {
      const [timestamp, id] = cursor.split('__');
      if (!timestamp || !id) throw new AppException(ErrorCode.VALIDATION_FAILED, { details: { reason: 'invalid_cursor' } });
      qb.andWhere('(n.createdAt < :timestamp OR (n.createdAt = :timestamp AND n.id < :id))', { timestamp: new Date(timestamp), id });
    }
    const rows = await qb.getMany();
    return buildCursorPage(rows, limit, (row) => `${row.createdAt.toISOString()}__${row.id}`);
  }

  unreadCount(userId: string) {
    return this.notifications.count({ where: { userId, readAt: IsNull() } });
  }

  async markRead(userId: string, id: string) {
    const result = await this.notifications.update({ id, userId }, { readAt: new Date() });
    if (!result.affected) throw new AppException(ErrorCode.NOT_FOUND, { details: { id } });
    return { read: true };
  }

  async markAllRead(userId: string) {
    await this.notifications.update({ userId, readAt: IsNull() }, { readAt: new Date() });
    return { read: true };
  }

  async notify(command: NotifyCommand): Promise<UserNotification | null> {
    const preferences = await this.getPreferences(command.userId);
    if (!preferences[command.preference]) return null;
    if (command.idempotencyKey) {
      const existing = await this.notifications.findOne({ where: { userId: command.userId, idempotencyKey: command.idempotencyKey } });
      if (existing) return existing;
    }
    const notification = await this.notifications.save(this.notifications.create({
      ...command,
      data: command.data ?? {},
      idempotencyKey: command.idempotencyKey ?? null,
      readAt: null,
      pushAttemptedAt: null,
      pushError: null,
    }));
    const [user, tokens] = await Promise.all([
      this.users.findOne({ where: { id: command.userId }, select: { language: true } }),
      this.tokens.find({ where: { userId: command.userId, enabled: true } }),
    ]);
    const english = user?.language === 'en';
    const results = await Promise.all(tokens.map((token) => this.firebase.sendToToken(token.token, {
      title: english ? command.titleEn : command.titleKo,
      body: english ? command.bodyEn : command.bodyKo,
      data: { ...notification.data, notificationId: notification.id },
    })));
    notification.pushAttemptedAt = new Date();
    const failures = results.filter((result) => !result.sent);
    notification.pushError = failures.length ? failures.map((result) => result.errorCode ?? 'unknown').join(',') : null;
    await this.notifications.save(notification);
    return notification;
  }
}
