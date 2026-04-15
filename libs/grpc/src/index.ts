import { join } from 'path';

export const SEAT_INVENTORY_PACKAGE = 'SEAT_INVENTORY_PACKAGE';

export const seatInventoryGrpcOptions = {
  package: 'seat_inventory',
  protoPath: join(process.cwd(), 'libs/grpc/src/proto/seat-inventory.proto'),
};
