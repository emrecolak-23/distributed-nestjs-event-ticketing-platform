import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationService } from '../notification/notification.service';
import { NotificationChannel } from '../channels/enums';

@Controller()
export class BookingConsumer {
  private readonly logger = new Logger(BookingConsumer.name);

  constructor(private readonly notificationService: NotificationService) {}

  @EventPattern('booking.confirmed')
  async handleBookingConfirmed(@Payload() payload: any) {
    const data = payload?.value ?? payload;

    this.logger.log(`Received booking confirmed event: ${data.bookingId}`);

    for (const item of data.items) {
      if (!item.attendeeEmail) continue;

      await this.notificationService.send({
        userId: data.userId,
        channel: NotificationChannel.EMAIL,
        type: 'booking_confirmed',
        templateId: 'booking_confirmed',
        recipient: item.attendeeEmail,
        payload: {
          attendeeName: item.attendeeName || 'Guest',
          bookingNumber: data.bookingNumber,
          eventTitle: data.eventTitle,
          totalAmount: data.totalAmount,
          currency: data.currency,
          seats: data.items,
        },
      });
    }
  }

  @EventPattern('booking.cancelled')
  async handleBookingCancelled(@Payload() payload: any) {
    const data = payload?.value ?? payload;

    this.logger.log(`Received booking cancelled event: ${data.bookingId}`);

    const primaryEmail = data.items?.[0]?.attendeeEmail;

    if (!primaryEmail) return;

    await this.notificationService.send({
      userId: data.userId,
      channel: NotificationChannel.EMAIL,
      type: 'payment_failed',
      templateId: 'payment_failed',
      recipient: primaryEmail,
      payload: {
        bookingNumber: data.bookingNumber,
        reason: data.cancellationReason || 'Payment failed',
      },
    });
  }
}
