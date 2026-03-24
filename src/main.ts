import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './AllExceptionsFilter';
import { seedQuestionnaires } from './scripts/seed-questionnaires';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { seedWorkflows } from './scripts/seed-workflows';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix('api');

  logger.log('[boot:init] Conversation Engine is wiring up application modules.');

  const config = new DocumentBuilder()
    .setTitle('Conversation Engine API')
    .setDescription('Question & Option Management')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  writeFileSync(join(process.cwd(), 'swagger.json'), JSON.stringify(document, null, 2));
  logger.debug('[boot:docs] Swagger document emitted to ./swagger.json');


  const shouldSeedOnStartup = configService.get<string>('SEED_ON_STARTUP', 'true') !== 'false';
  if (shouldSeedOnStartup) {
    try {
      logger.log('[boot:seed] Startup workflow sync enabled. Beginning seed run.');
      const workflowSeedingResult = await seedWorkflows(app);
      logger.log(
        `[boot:seed] Workflow sync complete :: created=${workflowSeedingResult.created} updated=${workflowSeedingResult.updated} skipped=${workflowSeedingResult.skipped}`,
      );
      logger.log('[boot:seed] Startup workflow sync enabled. Beginning seed run.');
      const seedingResult = await seedQuestionnaires(app);
      logger.log(
        `[boot:seed] Questionnaire sync complete :: created=${seedingResult.created} updated=${seedingResult.updated} skipped=${seedingResult.skipped}`,
      );
    } catch (error: any) {
      logger.error(
        `[boot:seed] Startup questionnaire sync failed :: ${error?.message || error}`,
        error?.stack,
      );
    }
  }

  const port = configService.get<number>('PORT', 8080);
  await app.listen(port, '0.0.0.0');
  logger.log(`[boot:ready] HTTP server listening on 0.0.0.0:${port}`);
}
bootstrap();
