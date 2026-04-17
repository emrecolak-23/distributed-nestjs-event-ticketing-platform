import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { TicketStatus } from '../enums';

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  bookingId: string;

  @Column()
  seatId: string;

  @Column()
  bookingItemId: string;

  @Column()
  ticketCode: string;

  @Column({ type: 'text', nullable: true })
  qrCodeData: string;

  @Column({
    type: 'enum',
    enum: TicketStatus,
    default: TicketStatus.ACTIVE,
  })
  status: TicketStatus;

  @Column()
  sectionName: string;

  @Column()
  row: string;

  @Column()
  seatNumber: string;

  @Column({ type: 'varchar', nullable: true })
  attendeeName: string | null;

  @Column({ type: 'varchar', nullable: true })
  attendeeEmail: string | null;

  @Column({ nullable: true })
  checkedInAt: Date;

  @CreateDateColumn()
  issuedAt: Date;
}
