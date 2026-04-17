import { DocumentBuilder } from '@nestjs/swagger';

export function createSwaggerConfig(
  title: string,
  description: string,
  version: string = '1.0',
) {
  return new DocumentBuilder()
    .setTitle(title)
    .setDescription(description)
    .setVersion(version)
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    })
    .build();
}
