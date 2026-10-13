import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Order } from './order.entity';
import { User } from '../users/user.entity';

@Entity('order_delivery_files')
export class OrderDeliveryFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

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
