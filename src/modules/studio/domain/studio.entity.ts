import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../shared/database/base.entity';

@Entity('studios')
export class Studio extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'double precision', nullable: true })
  lat: number | null;

  @Column({ type: 'double precision', nullable: true })
  lng: number | null;

  @Column({ type: 'uuid' })
  ownerId: string;

  @Index('uq_studio_invite_code', { unique: true })
  @Column({ type: 'varchar', length: 10 })
  inviteCode: string;

  @Column({ type: 'timestamptz', nullable: true })
  inviteCodeExpiresAt: Date | null;
}
