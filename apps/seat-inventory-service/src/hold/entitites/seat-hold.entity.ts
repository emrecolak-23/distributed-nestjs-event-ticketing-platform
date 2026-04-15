import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { SeatLockReleaseReason } from '../enums';

@Entity('seat_holds')
export class SeatHold {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  seatInventoryId: string;

  @Column()
  @Index()
  eventId: string;

  @Column()
  seatId: string;

  @Column()
  @Index()
  userId: string;

  @Column()
  @Index()
  sessionId: string;

  @CreateDateColumn()
  heldAt: Date;

  @Column()
  expiresAt: Date;

  @Column({ nullable: true })
  releasedAt: Date;

  @Column({ type: 'enum', enum: SeatLockReleaseReason, nullable: true })
  releaseReason: SeatLockReleaseReason;
}
