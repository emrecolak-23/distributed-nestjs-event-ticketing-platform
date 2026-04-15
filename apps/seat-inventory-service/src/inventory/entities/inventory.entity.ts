import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { SeatStatus } from '../enums';

@Entity('seat_inventory')
@Index(['eventId', 'seatId'], { unique: true })
export class SeatInventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  eventId: string;

  @Column()
  seatId: string;

  @Column()
  sectionId: string;

  @Column()
  sectionName: string;

  @Column()
  ticketTypeId: string;

  @Column()
  ticketTypeName: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column({ default: 'TRY' })
  currency: string;

  @Column()
  row: string;

  @Column()
  seatNumber: string;

  @Column()
  seatType: string;

  @Column({
    type: 'enum',
    enum: SeatStatus,
    default: SeatStatus.AVAILABLE,
  })
  @Index()
  status: SeatStatus;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  priceOverride: number;

  @Column({ default: 1 })
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
