import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { EventStatus } from '../enums';

export class TicketType {
  @Prop({ type: Types.ObjectId, auto: true })
  _id: Types.ObjectId;

  @Prop({ required: true })
  sectionId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  currency: string;

  @Prop({ default: 10 })
  maxPerOrder: number;

  @Prop()
  salesStartAt: Date;

  @Prop()
  salesEndAt: Date;
}

export const TicketTypeSchema = SchemaFactory.createForClass(TicketType);

export type EventDocument = HydratedDocument<Event>;

@Schema({ timestamps: true })
export class Event {
  @Prop({ required: true })
  organizerId: string;

  @Prop({ required: true, index: true })
  venueId: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({
    required: true,
    enum: EventStatus,
    default: EventStatus.DRAFT,
    index: true,
    type: String,
  })
  status: EventStatus;

  @Prop({ required: true, index: true })
  startsAt: Date;

  @Prop()
  endsAt: Date;

  @Prop()
  doorsOpenAt: Date;

  @Prop()
  saleStartsAt: Date;

  @Prop()
  saleEndsAt: Date;

  @Prop({ type: [TicketTypeSchema], default: [] })
  ticketTypes: TicketType[];

  @Prop({ type: Object })
  metadata: Record<string, any>;
}

export const EventSchema = SchemaFactory.createForClass(Event);
