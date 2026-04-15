import { Test, TestingModule } from '@nestjs/testing';
import { SeatInventoryServiceController } from './seat-inventory-service.controller';
import { SeatInventoryServiceService } from './seat-inventory-service.service';

describe('SeatInventoryServiceController', () => {
  let seatInventoryServiceController: SeatInventoryServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [SeatInventoryServiceController],
      providers: [SeatInventoryServiceService],
    }).compile();

    seatInventoryServiceController = app.get<SeatInventoryServiceController>(SeatInventoryServiceController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(seatInventoryServiceController.getHello()).toBe('Hello World!');
    });
  });
});
