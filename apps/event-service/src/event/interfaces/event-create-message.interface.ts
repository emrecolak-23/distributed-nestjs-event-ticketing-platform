export interface EventSeat {
  seatId: string;
  sectionId: string;
  sectionName: string;
  ticketTypeId: string;
  ticketTypeName: string;
  price: number;
  currency: string;
  row: string;
  number: string;
  type: string;
}

export interface EventCreateMessage {
  eventId: string;
  venueId: string;
  venueName: string;
  title: string;
  startsAt: Date;
  seats: EventSeat[];
}
