import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheKey, CacheService, CacheTtl } from '../../../shared/cache/cache.service';
import { AppException } from '../../../shared/exceptions/app.exception';
import { ErrorCode } from '../../../shared/exceptions/error-code';
import { User, UserRole, UserStatus } from '../domain/user.entity';

const NICKNAME_PATTERN = /^[a-zA-Z0-9가-힣._-]{2,20}$/;
/** 예약어 — 사칭 방지 */
const RESERVED_NICKNAMES = new Set(['admin', 'troot', 'root', 'administrator', '관리자', '운영자']);

export interface UserProfile {
  id: string;
  nickname: string | null;
  email: string | null;
  profileImage: string | null;
  activeRole: UserRole;
  roles: UserRole[];
  onboarded: boolean;
  language: string;
  status: UserStatus;
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly cache: CacheService,
  ) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const profile = await this.cache.wrap(
      CacheKey.userProfile(userId),
      CacheTtl.DETAIL,
      async () => {
        const user = await this.users.findOne({
          where: { id: userId },
          select: {
            id: true, nickname: true, email: true, profileImage: true,
            activeRole: true, roles: true, onboarded: true, language: true, status: true,
          },
        });
        return user ? this.toProfile(user) : null;
      },
    );

    if (!profile) throw new AppException(ErrorCode.USER_NOT_FOUND);
    return profile;
  }

  /** 온보딩: 닉네임 + 역할 확정 */
  async completeOnboarding(
    userId: string,
    nickname: string,
    role: UserRole.USER | UserRole.TATTOOIST,
  ): Promise<UserProfile> {
    this.assertNicknameFormat(nickname);

    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new AppException(ErrorCode.USER_NOT_FOUND);

    await this.assertNicknameAvailable(nickname, userId);

    user.nickname = nickname;
    user.activeRole = role;
    user.roles = Array.from(new Set([...user.roles, role]));
    user.onboarded = true;

    const saved = await this.users.save(user);
    await this.invalidate(userId);
    return this.toProfile(saved);
  }

  async updateNickname(userId: string, nickname: string): Promise<UserProfile> {
    this.assertNicknameFormat(nickname);
    await this.assertNicknameAvailable(nickname, userId);

    const result = await this.users.update(userId, { nickname });
    if (!result.affected) throw new AppException(ErrorCode.USER_NOT_FOUND);

    await this.invalidate(userId);
    return this.getProfile(userId);
  }

  async updateLanguage(userId: string, language: string): Promise<void> {
    const normalized = language.startsWith('ko') ? 'ko' : 'en';
    await this.users.update(userId, { language: normalized });
    await this.invalidate(userId);
  }

  /** 앱 내 역할 전환 (이미 보유한 역할로만 전환 가능) */
  async switchRole(userId: string, role: UserRole): Promise<UserProfile> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new AppException(ErrorCode.USER_NOT_FOUND);
    if (!user.roles.includes(role)) {
      throw new AppException(ErrorCode.FORBIDDEN, { details: { role } });
    }

    await this.users.update(userId, { activeRole: role });
    await this.invalidate(userId);
    return this.getProfile(userId);
  }

  async updateProfileImage(userId: string, profileImage: string): Promise<UserProfile> {
    const result = await this.users.update(userId, { profileImage });
    if (!result.affected) throw new AppException(ErrorCode.USER_NOT_FOUND);
    await this.invalidate(userId);
    return this.getProfile(userId);
  }

  async updateFcmToken(userId: string, fcmToken: string, platform: 'ios' | 'android'): Promise<void> {
    await this.users.update(userId, { fcmToken, fcmPlatform: platform });
  }

  async withdraw(userId: string): Promise<void> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new AppException(ErrorCode.USER_NOT_FOUND);
    await this.invalidate(userId);
    await this.users.remove(user);
  }

  async isNicknameAvailable(nickname: string): Promise<boolean> {
    if (!NICKNAME_PATTERN.test(nickname)) return false;
    if (RESERVED_NICKNAMES.has(nickname.toLowerCase())) return false;
    const count = await this.users.count({ where: { nickname } });
    return count === 0;
  }

  private assertNicknameFormat(nickname: string): void {
    if (!NICKNAME_PATTERN.test(nickname) || RESERVED_NICKNAMES.has(nickname.toLowerCase())) {
      throw new AppException(ErrorCode.NICKNAME_INVALID, {
        details: { min: 2, max: 20 },
      });
    }
  }

  private async assertNicknameAvailable(nickname: string, selfId: string): Promise<void> {
    const existing = await this.users.findOne({
      where: { nickname },
      select: { id: true },
    });
    if (existing && existing.id !== selfId) {
      throw new AppException(ErrorCode.NICKNAME_TAKEN, { details: { nickname } });
    }
  }

  private async invalidate(userId: string): Promise<void> {
    await this.cache.del(CacheKey.userProfile(userId), `auth:user:${userId}`);
  }

  private toProfile(user: User): UserProfile {
    return {
      id: user.id,
      nickname: user.nickname,
      email: user.email,
      profileImage: user.profileImage,
      activeRole: user.activeRole,
      roles: user.roles,
      onboarded: user.onboarded,
      language: user.language,
      status: user.status,
    };
  }
}
