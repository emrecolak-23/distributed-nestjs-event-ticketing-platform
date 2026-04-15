import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { SeatType } from '../enums';

@Schema({ _id: false })
export class SeatDefinition {
  @Prop({ required: true })
  number: string;

  @Prop({
    required: true,
    type: String,
    enum: SeatType,
  })
  type: SeatType;

  @Prop({ required: true })
  x: number;

  @Prop({ required: true })
  y: number;
}

export const SeatDefinitionSchema =
  SchemaFactory.createForClass(SeatDefinition);

@Schema({ _id: false })
export class Row {
  @Prop({ required: true })
  label: string;

  @Prop({ type: [SeatDefinitionSchema], default: [] })
  seats: SeatDefinition[];
}

export const RowSchema = SchemaFactory.createForClass(Row);

@Schema()
export class Section {
  _id: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  capacity: number;

  @Prop({ default: 0 })
  sortOrder: number;

  @Prop({ type: [RowSchema], default: [] })
  rows: Row[];
}

export const SectionSchema = SchemaFactory.createForClass(Section);
export type VenueDocument = HydratedDocument<Venue>;

@Schema({ timestamps: true })
export class Venue {
  @Prop({ required: true })
  name: string;

  @Prop()
  address: string;

  @Prop({ index: true })
  city: string;

  @Prop()
  country: string;

  @Prop()
  latitude: number;

  @Prop()
  longitude: number;

  @Prop({ default: 0 })
  totalCapacity: number;

  @Prop()
  venueMapUrl: string;

  @Prop({ type: [SectionSchema], default: [] })
  sections: Section[];
}

export const VenueSchema = SchemaFactory.createForClass(Venue);
