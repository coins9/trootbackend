import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/database/base.entity';

export enum VendorStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SUSPENDED = 'suspended',
}

export enum VendorEntryPhase {
  FREE = 'FREE',
  PAID = 'PAID',
}

export enum ProductCategory {
  MACHINE = 'machine',
  NEEDLE = 'needle',
  INK = 'ink',
  HYGIENE = 'hygiene',
  STENCIL = 'stencil',
  AFTERCARE = 'aftercare',
  FURNITURE = 'furniture',
  ETC = 'etc',
}

export enum SettlementStatus {
  PENDING = 'pending',
  PAID = 'paid',
}

@Entity('vendors')
@Index('idx_vendor_status', ['status'])
@Index('uq_vendor_user', ['userId'], { unique: true, where: '"deletedAt" IS NULL' })
export class Vendor extends BaseEntity {
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  businessNo: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ecommerceRegNo: string | null;

  @Column({ type: 'varchar', length: 191 })
  contactEmail: string;

  @Column({ type: 'enum', enum: VendorEntryPhase, default: VendorEntryPhase.FREE })
  entryPhase: VendorEntryPhase;

  /** 무료 입점 단계에서는 0 */
  @Column({ type: 'numeric', precision: 4, scale: 2, default: 0 })
  commissionRate: string;

  @Column({ type: 'enum', enum: VendorStatus, default: VendorStatus.PENDING })
  status: VendorStatus;

  @Column({ type: 'int', default: 0 })
  productCount: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  openChatUrl: string | null;

  @Column({ type: 'int', default: 0 })
  inquiryCount: number;
}

@Entity('products')
// 카테고리 목록 + 가격 정렬
@Index('idx_product_category', ['category', 'isActive', 'createdAt'])
@Index('idx_product_vendor', ['vendorId'])
export class Product extends BaseEntity {
  @Column({ type: 'uuid' })
  vendorId: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: ProductCategory })
  category: ProductCategory;

  @Column({ type: 'varchar', length: 100, nullable: true })
  brand: string | null;

  @Column({ type: 'int' })
  priceKrw: number;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  images: string[];

  @Column({ type: 'varchar', length: 500, nullable: true })
  thumbnail: string | null;

  /** 바늘 규격 등 카테고리별 속성 */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  attributes: Record<string, unknown>;

  @Column({ type: 'numeric', precision: 3, scale: 2, default: 0 })
  rating: string;

  @Column({ type: 'int', default: 0 })
  reviewCount: number;

  @Column({ type: 'int', default: 0 })
  soldCount: number;

  /** 외부 스마트스토어 등으로 연결 (MVP 는 아웃바운드 링크) */
  @Column({ type: 'varchar', length: 500, nullable: true })
  externalUrl: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}

@Entity('settlements')
@Index('idx_settlement_vendor', ['vendorId', 'period'])
@Index('idx_settlement_status', ['status', 'dueDate'])
export class Settlement extends BaseEntity {
  @Column({ type: 'uuid' })
  vendorId: string;

  /** 정산 대상 월 (YYYY-MM) */
  @Column({ type: 'varchar', length: 7 })
  period: string;

  @Column({ type: 'int', default: 0 })
  grossSalesKrw: number;

  @Column({ type: 'int', default: 0 })
  commissionKrw: number;

  @Column({ type: 'int', default: 0 })
  netPayoutKrw: number;

  @Column({ type: 'enum', enum: SettlementStatus, default: SettlementStatus.PENDING })
  status: SettlementStatus;

  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;
}
