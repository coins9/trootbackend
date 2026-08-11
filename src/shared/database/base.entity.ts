import {
  CreateDateColumn, DeleteDateColumn, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

/** 모든 테이블 공통 컬럼. soft delete 로 데이터 복구 여지를 남긴다 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
