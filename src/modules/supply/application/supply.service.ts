import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppException } from '../../../shared/exceptions/app.exception';
import { ErrorCode } from '../../../shared/exceptions/error-code';
import {
  buildCursorPage, type OffsetPage, type OffsetPaginationQuery,
} from '../../../shared/http/pagination.dto';
import {
  Product, ProductCategory, Settlement, SettlementStatus, Vendor, VendorStatus,
} from '../domain/supply.entity';

export interface ProductListQuery {
  category?: ProductCategory;
  keyword?: string;
  sort?: 'recent' | 'price_asc' | 'price_desc' | 'popular';
  cursor?: string;
  limit: number;
}

@Injectable()
export class SupplyService {
  constructor(
    @InjectRepository(Vendor) private readonly vendors: Repository<Vendor>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Settlement) private readonly settlements: Repository<Settlement>,
  ) {}

  // ── 상품 (앱) ─────────────────────────────────────────────

  async listProducts(query: ProductListQuery) {
    const qb = this.products
      .createQueryBuilder('p')
      .where('p.isActive = true')
      .take(query.limit + 1);

    if (query.category) qb.andWhere('p.category = :category', { category: query.category });
    // pg_trgm 인덱스를 활용한 부분 일치 검색
    if (query.keyword) {
      qb.andWhere('(p.name ILIKE :kw OR p.brand ILIKE :kw)', { kw: `%${query.keyword}%` });
    }

    switch (query.sort) {
      case 'price_asc': qb.orderBy('p.priceKrw', 'ASC'); break;
      case 'price_desc': qb.orderBy('p.priceKrw', 'DESC'); break;
      case 'popular': qb.orderBy('p.soldCount', 'DESC'); break;
      default: qb.orderBy('p.createdAt', 'DESC');
    }
    qb.addOrderBy('p.id', 'DESC');

    if (query.cursor && (!query.sort || query.sort === 'recent')) {
      qb.andWhere('p.createdAt < :cursor', { cursor: new Date(query.cursor) });
    }

    const rows = await qb.getMany();
    return buildCursorPage(rows, query.limit, (r) => r.createdAt.toISOString());
  }

  async getProduct(id: string): Promise<Product> {
    const product = await this.products.findOne({ where: { id, isActive: true } });
    if (!product) throw new AppException(ErrorCode.NOT_FOUND, { details: { id } });
    return product;
  }

  // ── 셀러 (본인) ───────────────────────────────────────────

  async applyVendor(userId: string, input: Partial<Vendor>): Promise<Vendor> {
    const existing = await this.vendors.findOne({ where: { userId }, select: { id: true } });
    if (existing) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, { details: { reason: 'already_applied' } });
    }
    return this.vendors.save(
      this.vendors.create({ ...input, userId, status: VendorStatus.PENDING }),
    );
  }

  async getMyVendor(userId: string): Promise<Vendor> {
    const vendor = await this.vendors.findOne({ where: { userId } });
    if (!vendor) throw new AppException(ErrorCode.NOT_FOUND, { details: { reason: 'vendor_not_found' } });
    return vendor;
  }

  async updateMyVendor(
    userId: string,
    patch: {
      openChatUrl?: string; name?: string; businessNo?: string;
      ecommerceRegNo?: string; contactEmail?: string;
    },
  ): Promise<Vendor> {
    const vendor = await this.getMyVendor(userId);
    if (patch.openChatUrl !== undefined) {
      vendor.openChatUrl = patch.openChatUrl.trim() || null;
    }
    if (patch.name !== undefined) vendor.name = patch.name.trim();
    if (patch.businessNo !== undefined) vendor.businessNo = patch.businessNo.trim();
    if (patch.ecommerceRegNo !== undefined) vendor.ecommerceRegNo = patch.ecommerceRegNo.trim() || null;
    if (patch.contactEmail !== undefined) vendor.contactEmail = patch.contactEmail.trim();
    return this.vendors.save(vendor);
  }

  async incrementInquiry(vendorOwnerId: string): Promise<void> {
    const vendor = await this.vendors.findOne({ where: { userId: vendorOwnerId } });
    if (vendor) {
      await this.vendors.increment({ id: vendor.id }, 'inquiryCount', 1);
    }
  }

  /** 승인된 셀러만 상품을 등록할 수 있다 */
  private async assertApproved(userId: string): Promise<Vendor> {
    const vendor = await this.getMyVendor(userId);
    if (vendor.status !== VendorStatus.APPROVED) {
      throw new AppException(ErrorCode.FORBIDDEN, { details: { status: vendor.status } });
    }
    return vendor;
  }

  async createProduct(userId: string, input: Partial<Product>): Promise<Product> {
    const vendor = await this.assertApproved(userId);
    const product = await this.products.save(
      this.products.create({ ...input, vendorId: vendor.id }),
    );
    await this.vendors.increment({ id: vendor.id }, 'productCount', 1);
    return product;
  }

  async updateProduct(userId: string, productId: string, patch: Partial<Product>): Promise<Product> {
    const vendor = await this.assertApproved(userId);
    const product = await this.products.findOne({ where: { id: productId, vendorId: vendor.id } });
    if (!product) throw new AppException(ErrorCode.NOT_FOUND, { details: { productId } });

    // 판매 실적은 셀러가 조작할 수 없다
    delete patch.soldCount;
    delete patch.rating;
    delete patch.reviewCount;

    Object.assign(product, patch);
    return this.products.save(product);
  }

  async deleteProduct(userId: string, productId: string): Promise<void> {
    const vendor = await this.assertApproved(userId);
    const result = await this.products.softDelete({ id: productId, vendorId: vendor.id });
    if (!result.affected) throw new AppException(ErrorCode.NOT_FOUND, { details: { productId } });
    await this.vendors.decrement({ id: vendor.id }, 'productCount', 1);
  }

  async listMyProducts(userId: string): Promise<Product[]> {
    const vendor = await this.getMyVendor(userId);
    return this.products.find({ where: { vendorId: vendor.id }, order: { createdAt: 'DESC' } });
  }

  // ── 관리자 ────────────────────────────────────────────────

  async listVendorsForAdmin(
    query: OffsetPaginationQuery & { status?: VendorStatus },
  ): Promise<OffsetPage<Vendor>> {
    const qb = this.vendors
      .createQueryBuilder('v')
      .orderBy('v.createdAt', 'DESC')
      .skip((query.page - 1) * query.size)
      .take(query.size);

    if (query.status) qb.andWhere('v.status = :status', { status: query.status });

    const [items, total] = await qb.getManyAndCount();
    return { items, page: query.page, size: query.size, total, totalPages: Math.ceil(total / query.size) };
  }

  async setVendorStatus(vendorId: string, status: VendorStatus): Promise<Vendor> {
    const vendor = await this.vendors.findOne({ where: { id: vendorId } });
    if (!vendor) throw new AppException(ErrorCode.NOT_FOUND, { details: { vendorId } });

    vendor.status = status;
    // 정지 시 노출 중인 상품도 함께 내린다
    if (status === VendorStatus.SUSPENDED) {
      await this.products.update({ vendorId }, { isActive: false });
    }
    return this.vendors.save(vendor);
  }

  async pendingVendorCount(): Promise<number> {
    return this.vendors.count({ where: { status: VendorStatus.PENDING } });
  }

  // ── 정산 ──────────────────────────────────────────────────

  async listSettlements(
    query: OffsetPaginationQuery & { status?: SettlementStatus },
  ): Promise<OffsetPage<Settlement>> {
    const qb = this.settlements
      .createQueryBuilder('s')
      .orderBy('s.period', 'DESC')
      .skip((query.page - 1) * query.size)
      .take(query.size);

    if (query.status) qb.andWhere('s.status = :status', { status: query.status });

    const [items, total] = await qb.getManyAndCount();
    return { items, page: query.page, size: query.size, total, totalPages: Math.ceil(total / query.size) };
  }

  async markSettlementPaid(id: string): Promise<Settlement> {
    const settlement = await this.settlements.findOne({ where: { id } });
    if (!settlement) throw new AppException(ErrorCode.NOT_FOUND, { details: { id } });

    settlement.status = SettlementStatus.PAID;
    settlement.paidAt = new Date();
    return this.settlements.save(settlement);
  }

  async settlementSummary() {
    const raw = await this.settlements
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.netPayoutKrw) FILTER (WHERE s.status = :pending), 0)::int', 'pendingSum')
      .addSelect('COUNT(*) FILTER (WHERE s.status = :pending)::int', 'pendingCount')
      .addSelect('COALESCE(SUM(s.netPayoutKrw) FILTER (WHERE s.status = :paid), 0)::int', 'paidSum')
      .setParameter('pending', SettlementStatus.PENDING)
      .setParameter('paid', SettlementStatus.PAID)
      .getRawOne<Record<string, number>>();

    return {
      pendingSum: Number(raw?.pendingSum ?? 0),
      pendingCount: Number(raw?.pendingCount ?? 0),
      paidSum: Number(raw?.paidSum ?? 0),
    };
  }
}
