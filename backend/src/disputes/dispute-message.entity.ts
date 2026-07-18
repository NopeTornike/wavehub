import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Dispute } from './dispute.entity';
import { User } from '../users/user.entity';

// A separate table from backend/src/chat/'s `Message`, per the build plan's explicit schema
// (`disputes`, `dispute_evidence`, `dispute_messages` are listed as their own tables, not folded
// into order chat) — a dispute's 3-party thread (buyer/seller/admin) is a different audience and
// lifecycle from an order's regular buyer/seller chat, even though the shape looks similar.
// `senderId` is always a real user for now — there's no "system message" concept here yet (unlike
// chat/message.entity.ts), and no admin identity exists to post as one until build-plan Phase 11.
@Entity('dispute_messages')
export class DisputeMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  disputeId: string;

  @ManyToOne(() => Dispute, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'disputeId' })
  dispute: Dispute;

  @Column()
  senderId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
