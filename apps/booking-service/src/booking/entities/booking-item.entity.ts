import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Booking } from './booking.entity';

@Entity('booking_items')
export class BookingItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Booking, (booking) => booking.items)
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Column()
  seatInventoryId: string;

  @Column()
  seatId: string;

  @Column()
  ticketTypeId: string;

  @Column()
  ticketTypeName: string;

  @Column()
  sectionName: string;

  @Column()
  row: string;

  @Column()
  seatNumber: string;

  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ nullable: true })
  attendeeName: string;

  @Column({ nullable: true })
  attendeeEmail: string;
}
