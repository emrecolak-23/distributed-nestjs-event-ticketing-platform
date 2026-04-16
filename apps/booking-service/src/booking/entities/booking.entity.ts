import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { BookingStatus, RefundState } from '../enums';
import { BookingItem } from './booking-item.entity';

@Entity('booking')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  bookingNumber: string;

  @Column()
  @Index()
  userId: string;

  @Column()
  @Index()
  eventId: string;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  status: BookingStatus;

  @Column('decimal', { precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ default: 'TRY' })
  currency: string;

  @Column()
  expiresAt: Date;

  @Column({ nullable: true })
  confirmedAt: Date;

  @Column({ nullable: true })
  cancelledAt: Date;

  @Column({ nullable: true })
  cancellationReason: string;

  @OneToMany(() => BookingItem, (item) => item.booking)
  items: BookingItem[];

  @Column({ type: 'varchar', nullable: true })
  @Index()
  refundState: RefundState;

  @Column({ type: 'varchar', nullable: true })
  refundIdempotencyKey: string | null;

  @Column({ default: 0 })
  refundRetryCount: number;

  @Column({ type: 'varchar', nullable: true })
  refundLastError: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
