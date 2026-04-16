import { NotificationChannel } from '../../channels/enums';

export interface SendNotificationInput {
  userId?: string;
  channel: NotificationChannel;
  type: string;
  templateId: string;
  recipient: string;
  payload: Record<string, any>;
}
