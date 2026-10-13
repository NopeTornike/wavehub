import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Dispute } from './dispute.entity';
import { User } from '../users/user.entity';

@Entity('dispute_evidence')
export class DisputeEvidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  disputeId: string;

  @ManyToOne(() => Dispute, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'disputeId' })
  dispute: Dispute;

  @Column()
  uploadedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploadedBy' })
  uploader: User;

  @Column()
  fileUrl: string;

  @Column()
  fileType: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
