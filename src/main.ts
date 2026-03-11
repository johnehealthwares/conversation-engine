import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './AllExceptionsFilter';
import { seedQuestionnaires } from './scripts/seed-questionnaires';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
    const configService = app.get(ConfigService);
    app.useGlobalFilters(new AllExceptionsFilter());
      app.setGlobalPrefix('api');



   const config = new DocumentBuilder()
    .setTitle('Conversation Engine API')
    .setDescription('Question & Option Management')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const shouldSeedOnStartup = configService.get<string>('SEED_ON_STARTUP', 'true') !== 'false';
  if (shouldSeedOnStartup) {
    try {
      const seedingResult = await seedQuestionnaires(app);
      console.log(
        `Startup questionnaire seeding complete. created=${seedingResult.created} skipped=${seedingResult.skipped}`,
      );
    } catch (error: any) {
      console.error(`Startup questionnaire seeding skipped due to error: ${error?.message || error}`, error);
    }
  }
  const host = '0.0.0.0'; // Bind to all interfaces
  const port = configService.get<number>('PORT', 8080)
  await app.listen(port, host);
}
bootstrap();
