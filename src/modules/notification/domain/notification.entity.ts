import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/database/base.entity';

@Entity('user_push_tokens')
@Index('uq_push_token', ['token'], { unique: true, where: '"deletedAt" IS NULL' })
@Index('idx_push_token_user', ['userId', 'enabled'])
export class UserPushToken extends BaseEntity {
  @Column({ type: 'uuid' }) userId: string;
  @Column({ type: 'varchar', length: 500 }) token: string;
  @Column({ type: 'varchar', length: 10 }) platform: 'ios' | 'android';
  @Column({ type: 'varchar', length: 100 }) installationId: string;
  @Column({ type: 'boolean', default: true }) enabled: boolean;
  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' }) lastSeenAt: Date;
}

@Entity('notification_preferences')
@Index('uq_notification_preferences_user', ['userId'], { unique: true })
export class NotificationPreference extends BaseEntity {
  @Column({ type: 'uuid' }) userId: string;
  @Column({ default: true }) reservationStatus: boolean;
  @Column({ default: true }) reservationConfirm: boolean;
  @Column({ default: false }) reservationRemind: boolean;
  @Column({ default: true }) procedureDone: boolean;
  @Column({ default: true }) newReply: boolean;
  @Column({ default: true }) favoriteArtist: boolean;
  @Column({ default: true }) favoriteWorkStock: boolean;
  @Column({ default: false }) favoriteSupplyPrice: boolean;
  @Column({ default: true }) shopApplication: boolean;
  @Column({ default: true }) event: boolean;
  @Column({ default: true }) notice: boolean;
}

@Entity('user_notifications')
@Index('idx_user_notification_feed', ['userId', 'createdAt'])
@Index('uq_user_notification_idempotency', ['userId', 'idempotencyKey'], {
  unique: true,
  where: '"idempotencyKey" IS NOT NULL AND "deletedAt" IS NULL',
})
export class UserNotification extends BaseEntity {
  @Column({ type: 'uuid' }) userId: string;
  @Column({ type: 'varchar', length: 50 }) type: string;
  @Column({ type: 'varchar', length: 200 }) titleKo: string;
  @Column({ type: 'varchar', length: 200 }) titleEn: string;
  @Column({ type: 'text' }) bodyKo: string;
  @Column({ type: 'text' }) bodyEn: string;
  @Column({ type: 'jsonb', default: () => "'{}'" }) data: Record<string, string>;
  @Column({ type: 'varchar', length: 200, nullable: true }) idempotencyKey: string | null;
  @Column({ type: 'timestamptz', nullable: true }) readAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) pushAttemptedAt: Date | null;
  @Column({ type: 'text', nullable: true }) pushError: string | null;
}
