import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../shared/database/base.entity';
import { User } from '../../user/domain/user.entity';

export enum StudioRole {
  OWNER = 'owner',
  ARTIST = 'artist',
  PENDING = 'pending',
}

@Entity('studio_members')
@Index('uq_studio_member', ['studioId', 'userId'], { unique: true })
@Index('idx_studio_member_user', ['userId'])
export class StudioMember extends BaseEntity {
  @Column({ type: 'uuid' })
  studioId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'enum', enum: StudioRole, default: StudioRole.PENDING })
  role: StudioRole;

  /** 작업 자리 이름 (예: A석, 2번 체어) */
  @Column({ type: 'varchar', length: 50, nullable: true })
  bedName: string | null;

  @Column({ type: 'timestamptz' })
  joinedAt: Date;
}
