import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { TicketCategory, TicketPriority, TicketStatus } from '@wavehub/shared-types';
import { User } from '../users/user.entity';
import { Order } from '../orders/order.entity';

@Entity('support_tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  requesterId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requesterId' })
  requester: User;

  @Column()
  subject: string;

  @Column({ type: 'varchar', default: TicketCategory.Other })
  category: TicketCategory;

  @Column({ type: 'varchar', default: TicketPriority.Medium })
  priority: TicketPriority;

  @Column({ type: 'varchar', default: TicketStatus.Open })
  status: TicketStatus;

  // Optional — set when the ticket is about a specific order ("Order-related Help" in
  // SPECIFICATION.md §5.13.6). Never validated to still exist beyond creation time; not FK'd with
  // CASCADE since a ticket should survive even if something odd happened to the order.
  @Column({ type: 'uuid', nullable: true })
  orderId: string | null;

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'orderId' })
  order: Order | null;

  // Which staff member owns this ticket right now — null until a staff member picks it up or an
  // Operation Lead "redistributes" it (SPECIFICATION.md §5.13.2's Support Team Management CAN
  // list). Not the same as who *replied* — replies are tracked per-message via
  // TicketMessage.senderId.
  @Column({ type: 'uuid', nullable: true })
  assignedToId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assignedToId' })
  assignedTo: User | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt: Date | null;
}
