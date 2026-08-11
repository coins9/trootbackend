import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/database/base.entity';

export enum AuthProvider {
  KAKAO = 'kakao',
  GOOGLE = 'google',
  APPLE = 'apple',
}

export enum UserRole {
  USER = 'USER',
  TATTOOIST = 'TATTOOIST',
  STUDIO = 'STUDIO',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  BANNED = 'banned',
}

@Entity('users')
// 소셜 로그인 조회 경로: provider + providerUserId 로 단건 조회하므로 복합 유니크
@Index('uq_user_provider_identity', ['provider', 'providerUserId'], { unique: true })
// 관리자 목록 필터(상태 + 가입일 정렬)
@Index('idx_user_status_created', ['status', 'createdAt'])
export class User extends BaseEntity {
  @Column({ type: 'enum', enum: AuthProvider })
  provider: AuthProvider;

  @Column({ type: 'varchar', length: 191 })
  providerUserId: string;

  @Column({ type: 'varchar', length: 191, nullable: true })
  email: string | null;

  // 닉네임 중복 검사가 빈번하므로 유니크 인덱스로 조회까지 커버
  @Index('uq_user_nickname', { unique: true })
  @Column({ type: 'varchar', length: 20, nullable: true })
  nickname: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  profileImage: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  activeRole: UserRole;

  @Column({ type: 'enum', enum: UserRole, array: true, default: [UserRole.USER] })
  roles: UserRole[];

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  /** 온보딩(닉네임·역할 선택) 완료 여부 */
  @Column({ type: 'boolean', default: false })
  onboarded: boolean;

  /** 누적 피신고 수 — 3회 이상 제재 정책 판정에 사용. 집계 쿼리를 피하려 비정규화 */
  @Column({ type: 'int', default: 0 })
  reportCount: number;

  @Column({ type: 'varchar', length: 2, default: 'ko' })
  language: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  isActive(): boolean {
    return this.status === UserStatus.ACTIVE;
  }

  isAdmin(): boolean {
    return this.roles.includes(UserRole.ADMIN);
  }
}
