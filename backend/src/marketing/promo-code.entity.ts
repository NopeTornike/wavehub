import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { User } from '../users/user.entity';

// A promo code (marketing/CLAUDE.md): adds `amountWaveCoin` of spendable credit, once per account,
// up to `maxRedemptions` times overall, inside an optional date window. Codes are stored uppercase.
@Entity('promo_codes')
export class PromoCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  code: string;

  @Column({ type: 'integer' })
  amountWaveCoin: number;

  @Column({ type: 'integer' })
  maxRedemptions: number;

  @Column({ type: 'integer', default: 0 })
  redeemedCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  // Internal note for staff (campaign name etc.) — never shown to users.
  @Column({ type: 'varchar', length: 200, nullable: true })
  note: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}

@Entity('promo_redemptions')
@Unique('UQ_promo_redemptions_code_user', ['promoCodeId', 'userId'])
export class PromoRedemption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  promoCodeId: string;

  @ManyToOne(() => PromoCode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'promoCodeId' })
  promoCode: PromoCode;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'integer' })
  amountWaveCoin: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
