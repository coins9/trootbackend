import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AppException } from '../../../shared/exceptions/app.exception';
import { ErrorCode } from '../../../shared/exceptions/error-code';
import {
  buildCursorPage, type OffsetPage, type OffsetPaginationQuery,
} from '../../../shared/http/pagination.dto';
import {
  ShopApplication, ShopPost, ShopPostCategory, ShopPostStatus,
} from '../domain/shop-post.entity';
import { User } from '../../user/domain/user.entity';

export interface ShopAuthor {
  id: string;
  nickname: string | null;
  profileImage: string | null;
}

export type ShopPostWithAuthor = ShopPost & { author: ShopAuthor };

export interface ShopListQuery {
  category: ShopPostCategory;
  region?: string;
  cursor?: string;
  limit: number;
}

@Injectable()
export class ShopService {
  constructor(
    @InjectRepository(ShopPost) private readonly posts: Repository<ShopPost>,
    @InjectRepository(ShopApplication) private readonly applications: Repository<ShopApplication>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  private async attachAuthors(posts: ShopPost[]): Promise<ShopPostWithAuthor[]> {
    if (posts.length === 0) return [];
    const ids = [...new Set(posts.map((p) => p.authorId))];
    const authors = await this.users.find({
      where: { id: In(ids) },
      select: { id: true, nickname: true, profileImage: true },
    });
    const map = new Map(authors.map((u) => [u.id, u]));
    return posts.map((p) => {
      const u = map.get(p.authorId);
      return Object.assign(Object.create(Object.getPrototypeOf(p)), p, {
        author: { id: p.authorId, nickname: u?.nickname ?? null, profileImage: u?.profileImage ?? null },
      }) as ShopPostWithAuthor;
    });
  }

  async list(query: ShopListQuery) {
    const qb = this.posts
      .createQueryBuilder('p')
      .where('p.category = :category', { category: query.category })
      .andWhere('p.status = :status', { status: ShopPostStatus.OPEN })
      .orderBy('p.createdAt', 'DESC')
      .take(query.limit + 1);

    if (query.region) qb.andWhere('p.region = :region', { region: query.region });
    if (query.cursor) qb.andWhere('p.createdAt < :cursor', { cursor: new Date(query.cursor) });

    const rows = await qb.getMany();
    const withAuthors = await this.attachAuthors(rows);
    return buildCursorPage(withAuthors, query.limit, (r) => r.createdAt.toISOString());
  }

  async getDetail(id: string): Promise<ShopPostWithAuthor> {
    const post = await this.posts.findOne({ where: { id } });
    if (!post) throw new AppException(ErrorCode.NOT_FOUND, { details: { id } });

    // 조회수는 응답을 막지 않도록 await 하지 않는다
    void this.posts.increment({ id }, 'viewCount', 1);
    const [withAuthor] = await this.attachAuthors([post]);
    return withAuthor;
  }

  async create(authorId: string, input: Partial<ShopPost>): Promise<ShopPost> {
    return this.posts.save(this.posts.create({ ...input, authorId }));
  }

  async update(id: string, authorId: string, patch: Partial<ShopPost>): Promise<ShopPost> {
    const post = await this.posts.findOne({ where: { id, authorId } });
    if (!post) throw new AppException(ErrorCode.NOT_FOUND, { details: { id } });

    // 작성자가 통계를 조작하지 못하도록 집계 필드는 제외
    delete patch.viewCount;
    delete patch.likeCount;
    delete patch.applicationCount;

    Object.assign(post, patch);
    return this.posts.save(post);
  }

  async remove(id: string, authorId: string): Promise<void> {
    const result = await this.posts.softDelete({ id, authorId });
    if (!result.affected) throw new AppException(ErrorCode.NOT_FOUND, { details: { id } });
  }

  /** 내가 쓴 글 관리 */
  async listMine(authorId: string, cursor: string | undefined, limit: number) {
    const qb = this.posts
      .createQueryBuilder('p')
      .where('p.authorId = :authorId', { authorId })
      .orderBy('p.createdAt', 'DESC')
      .take(limit + 1);

    if (cursor) qb.andWhere('p.createdAt < :cursor', { cursor: new Date(cursor) });

    const rows = await qb.getMany();
    const withAuthors = await this.attachAuthors(rows);
    return buildCursorPage(withAuthors, limit, (r) => r.createdAt.toISOString());
  }

  async setStatus(id: string, authorId: string, status: ShopPostStatus): Promise<ShopPost> {
    const post = await this.posts.findOne({ where: { id, authorId } });
    if (!post) throw new AppException(ErrorCode.NOT_FOUND, { details: { id } });

    post.status = status;
    return this.posts.save(post);
  }

  /** 지원·문의 접수 */
  async apply(
    postId: string,
    applicantId: string,
    answers: Record<string, unknown>,
    message?: string,
  ): Promise<ShopApplication> {
    const post = await this.posts.findOne({ where: { id: postId } });
    if (!post) throw new AppException(ErrorCode.NOT_FOUND, { details: { postId } });
    if (post.authorId === applicantId) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, { details: { reason: 'self_apply' } });
    }

    const duplicated = await this.applications.findOne({
      where: { postId, applicantId },
      select: { id: true },
    });
    if (duplicated) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, { details: { reason: 'already_applied' } });
    }

    const application = await this.applications.save(
      this.applications.create({ postId, applicantId, answers, message: message ?? null }),
    );
    await this.posts.increment({ id: postId }, 'applicationCount', 1);
    return application;
  }

  /** 글 작성자만 지원자 목록 열람 */
  async listApplications(postId: string, authorId: string): Promise<ShopApplication[]> {
    const post = await this.posts.findOne({ where: { id: postId, authorId }, select: { id: true } });
    if (!post) throw new AppException(ErrorCode.FORBIDDEN);

    return this.applications.find({ where: { postId }, order: { createdAt: 'DESC' } });
  }

  // ── 관리자 ────────────────────────────────────────────────

  async listForAdmin(
    query: OffsetPaginationQuery & { category?: ShopPostCategory; keyword?: string },
  ): Promise<OffsetPage<ShopPost>> {
    const qb = this.posts
      .createQueryBuilder('p')
      .orderBy('p.createdAt', 'DESC')
      .skip((query.page - 1) * query.size)
      .take(query.size);

    if (query.category) qb.andWhere('p.category = :category', { category: query.category });
    if (query.keyword) qb.andWhere('p.title ILIKE :kw', { kw: `%${query.keyword}%` });

    const [items, total] = await qb.getManyAndCount();
    return { items, page: query.page, size: query.size, total, totalPages: Math.ceil(total / query.size) };
  }

  /** 운영자 강제 숨김 */
  async hideByAdmin(id: string): Promise<ShopPost> {
    const post = await this.posts.findOne({ where: { id } });
    if (!post) throw new AppException(ErrorCode.NOT_FOUND, { details: { id } });

    post.status = ShopPostStatus.HIDDEN;
    return this.posts.save(post);
  }

  /** 운영자 강제 삭제 */
  async deleteByAdmin(id: string): Promise<void> {
    const post = await this.posts.findOne({ where: { id } });
    if (!post) throw new AppException(ErrorCode.NOT_FOUND, { details: { id } });
    await this.posts.remove(post);
  }
}
