import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { MessageType, MessageStatus } from '@wavehub/shared-types';
import { Conversation } from './conversation.entity';
import { User } from '../users/user.entity';

// `senderId` is null exactly for `type: System` messages (order-lifecycle events posted by
// ChatService.postSystemMessage) — there's no dedicated "system" user row; null is the signal a
// renderer uses to show it differently. Every non-system message must have a real senderId.
@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  conversationId: string;

  @ManyToOne(() => Conversation)
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;

  @Column({ type: 'uuid', nullable: true })
  senderId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'senderId' })
  sender: User | null;

  @Column({ type: 'varchar', default: MessageType.Text })
  type: MessageType;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', default: MessageStatus.Sent })
  status: MessageStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
