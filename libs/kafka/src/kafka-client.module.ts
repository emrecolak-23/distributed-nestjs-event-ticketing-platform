import { DynamicModule, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({})
export class KafkaClientModule {
  static register(clientName: string): DynamicModule {
    return {
      module: KafkaClientModule,
      imports: [
        ClientsModule.registerAsync([
          {
            name: clientName,
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
              transport: Transport.KAFKA,
              options: {
                client: {
                  clientId: clientName,
                  brokers: [
                    configService.get('KAFKA_BROKER', 'localhost:9092'),
                  ],
                },
                producer: {
                  allowAutoTopicCreation: true,
                },
              },
            }),
          },
        ]),
      ],
      exports: [ClientsModule],
    };
  }
}
