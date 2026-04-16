export interface ChannelMessage {
  to: string;
  subjects?: string;
  body: string;
  html?: string;
}

export interface ChannelResult {
  success: boolean;
  providerId?: string;
  error?: string;
}

export interface NotificationChannelAdapter {
  readonly name: string;
  send(message: ChannelMessage): Promise<ChannelResult>;
}
