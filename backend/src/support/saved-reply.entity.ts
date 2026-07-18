import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { TicketCategory } from '@wavehub/shared-types';

// Canned response templates — SPECIFICATION.md §5.13.6 calls these "required," not optional. Seven
// starter rows (one per source-spec example category) are seeded by the CreateSupportTickets
// migration; staff can add more via the admin CRUD routes.
@Entity('saved_replies')
export class SavedReply {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  category: TicketCategory;

  @Column()
  title: string;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
