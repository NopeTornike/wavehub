import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Ticket } from './ticket.entity';

@Entity('support_ticket_messages')
export class TicketMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ticketId: string;

  @ManyToOne(() => Ticket, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticketId' })
  ticket: Ticket;

  @Column()
  senderId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'senderId' })
  sender: User;

  // '' for a file-only message.
  @Column({ type: 'text' })
  body: string;

  // An attached file (screenshot, PDF, Word .docx) — byte-checked by StorageService.
  @Column({ type: 'varchar', length: 300, nullable: true })
  fileUrl: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  fileType: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  fileName: string | null;

  // Staff-only visibility — SupportService#getMine (the requester's own view) filters these out
  // server-side; never rely on the frontend to hide them. A user reply and a staff internal note
  // share this one table (same shape either way), distinguished only by this flag and by who the
  // sender is.
  @Column({ type: 'boolean', default: false })
  isInternalNote: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
