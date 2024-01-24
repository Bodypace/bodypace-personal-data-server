import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { writeFile } from 'node:fs/promises';
import * as yaml from 'yaml';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const config = new DocumentBuilder()
    .setTitle('Bodypace personal data server API')
    .setDescription(
      "All endpoints are here, it's not a lot because the server is indeed simple",
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    customfavIcon: 'https://bodypace.org/favicon.ico',
    customSiteTitle: 'Bodypace API documentation - personal data server',
  });
  await writeFile(
    'docs/openapi.yaml',
    yaml.stringify(document, { aliasDuplicateObjects: false }),
    'utf-8',
  );
  if (process.argv.includes('--only-generate-openapi-spec')) {
    console.log('OpenAPI docs generated, exiting because of CLI arg');
    await app.close();
    return;
  }
  await app.listen(8080);
}
void bootstrap();
