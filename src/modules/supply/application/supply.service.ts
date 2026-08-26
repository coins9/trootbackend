import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
    private readonly dataSource: DataSource,
  ) {}

  private normalizeProductInput(input: Partial<Product>): Partial<Product> {
    const next = { ...input };
    const trimNullable = (value: string | null | undefined): string | null | undefined =>
      value === undefined ? undefined : (value?.trim() || null);
    next.name = input.name?.trim();
    next.subtitle = trimNullable(input.subtitle) ?? undefined;
    next.nameEn = trimNullable(input.nameEn);
    next.description = trimNullable(input.description);
    next.descriptionEn = trimNullable(input.descriptionEn);
    next.brand = trimNullable(input.brand);
    next.openChatUrl = trimNullable(input.openChatUrl);
    next.storeUrl = trimNullable(input.storeUrl);
    next.externalUrl = trimNullable(input.externalUrl);
    if (input.images) next.images = [...new Set(input.images.map((url) => url.trim()).filter(Boolean))];
    if (input.thumbnail !== undefined) next.thumbnail = input.thumbnail?.trim() || null;
    return next;
  }

  private assertSellableProduct(product: Partial<Product>): void {
    if (!product.openChatUrl || !/^https:\/\/open\.kakao\.com(?:\/|$)/i.test(product.openChatUrl)) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, { details: { reason: 'invalid_product_open_chat_url' } });
    }
    if (!product.storeUrl || !/^https:\/\//i.test(product.storeUrl)) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, { details: { reason: 'invalid_product_store_url' } });
    }
    if (!product.subtitle?.trim()) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, { details: { reason: 'product_subtitle_required' } });
    }
    if (!product.images?.length || product.images.some((url) => !/^https:\/\//i.test(url))) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, { details: { reason: 'product_image_required' } });
    }
    const thumbnail = product.thumbnail || product.images[0];
    if (!thumbnail || !product.images.includes(thumbnail)) {
      throw new AppException(ErrorCode.VALIDATION_FAILED, { details: { reason: 'invalid_product_thumbnail' } });
    }
    product.thumbnail = thumbnail;
  }

  // ── 상품 (앱) ─────────────────────────────────────────────

  async listProducts(query: ProductListQuery) {
    const qb = this.products
      .createQueryBuilder('p')
      .where('p.isActive = true')
      .andWhere('p.openChatUrl IS NOT NULL')
      .andWhere('p.storeUrl IS NOT NULL')
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

    if (query.cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8')) as { value: string | number; id: string };
        if (query.sort === 'price_asc') {
          qb.andWhere('(p.priceKrw > :value OR (p.priceKrw = :value AND p.id < :id))', decoded);
        } else if (query.sort === 'price_desc') {
          qb.andWhere('(p.priceKrw < :value OR (p.priceKrw = :value AND p.id < :id))', decoded);
        } else if (query.sort === 'popular') {
          qb.andWhere('(p.soldCount < :value OR (p.soldCount = :value AND p.id < :id))', decoded);
        } else {
          qb.andWhere('(p.createdAt < :value OR (p.createdAt = :value AND p.id < :id))', {
            value: new Date(String(decoded.value)), id: decoded.id,
          });
        }
      } catch {
        throw new AppException(ErrorCode.VALIDATION_FAILED, { details: { reason: 'invalid_cursor' } });
      }
    }

    const rows = await qb.getMany();
    const page = buildCursorPage(rows, query.limit, (r) => Buffer.from(JSON.stringify({
      value: query.sort === 'price_asc' || query.sort === 'price_desc'
        ? r.priceKrw
        : query.sort === 'popular' ? r.soldCount : r.createdAt.toISOString(),
      id: r.id,
    })).toString('base64url'));
    const vendorIds = [...new Set(page.items.map((p) => p.vendorId))];
    const vendors = vendorIds.length
      ? await this.vendors.find({ where: vendorIds.map((id) => ({ id })), select: { id: true, name: true } })
      : [];
    const names = new Map(vendors.map((v) => [v.id, v.name]));
    return { ...page, items: page.items.map((product) => ({ ...product, vendorName: names.get(product.vendorId) ?? null })) };
  }

  async getProduct(id: string): Promise<Product & { vendorName: string | null }> {
    const product = await this.products.findOne({ where: { id, isActive: true } });
    if (!product) throw new AppException(ErrorCode.NOT_FOUND, { details: { id } });
    const vendor = await this.vendors.findOne({ where: { id: product.vendorId }, select: { name: true } });
    return Object.assign(product, { vendorName: vendor?.name ?? null });
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
    const normalized = this.normalizeProductInput(input);
    this.assertSellableProduct(normalized);
    return this.dataSource.transaction(async (manager) => {
      const productRepo = manager.getRepository(Product);
      const vendorRepo = manager.getRepository(Vendor);
      const product = await productRepo.save(productRepo.create({ ...normalized, vendorId: vendor.id }));
      await vendorRepo.increment({ id: vendor.id }, 'productCount', 1);
      return product;
    });
  }

  async updateProduct(userId: string, productId: string, patch: Partial<Product>): Promise<Product> {
    const vendor = await this.assertApproved(userId);
    const product = await this.products.findOne({ where: { id: productId, vendorId: vendor.id } });
    if (!product) throw new AppException(ErrorCode.NOT_FOUND, { details: { productId } });

    // 판매 실적은 셀러가 조작할 수 없다
    delete patch.soldCount;
    delete patch.rating;
    delete patch.reviewCount;

    Object.assign(product, this.normalizeProductInput(patch));
    this.assertSellableProduct(product);
    return this.products.save(product);
  }

  async deleteProduct(userId: string, productId: string): Promise<void> {
    const vendor = await this.assertApproved(userId);
    await this.dataSource.transaction(async (manager) => {
      const result = await manager.getRepository(Product).softDelete({ id: productId, vendorId: vendor.id });
      if (!result.affected) throw new AppException(ErrorCode.NOT_FOUND, { details: { productId } });
      await manager.getRepository(Vendor).createQueryBuilder()
        .update().set({ productCount: () => 'GREATEST("productCount" - 1, 0)' })
        .where('id = :id', { id: vendor.id }).execute();
    });
  }

  async listMyProducts(userId: string): Promise<Product[]> {
    const vendor = await this.getMyVendor(userId);
    return this.products.find({ where: { vendorId: vendor.id }, order: { createdAt: 'DESC' } });
  }

  async getMyProduct(userId: string, productId: string): Promise<Product> {
    const vendor = await this.getMyVendor(userId);
    const product = await this.products.findOne({ where: { id: productId, vendorId: vendor.id } });
    if (!product) throw new AppException(ErrorCode.NOT_FOUND, { details: { productId } });
    return product;
  }

  async incrementProductInquiry(productId: string): Promise<{ tracked: boolean }> {
    const product = await this.products.findOne({ where: { id: productId, isActive: true }, select: { id: true, vendorId: true } });
    if (!product) throw new AppException(ErrorCode.NOT_FOUND, { details: { productId } });
    await this.vendors.increment({ id: product.vendorId }, 'inquiryCount', 1);
    return { tracked: true };
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
