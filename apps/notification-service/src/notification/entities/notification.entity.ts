import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { NotificationChannel } from '../../channels/enums';
import { NotificationStatus } from '../enums';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  @Index()
  userId: string;

  @Column({ type: 'enum', enum: NotificationChannel })
  @Index()
  channel: NotificationChannel;

  @Column()
  type: string;

  @Column()
  templateId: string;

  @Column()
  recipient: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.QUEUED,
  })
  @Index()
  status: NotificationStatus;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ type: 'varchar', nullable: true })
  failureReason: string | null;

  @Column({ nullable: true })
  sentAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
