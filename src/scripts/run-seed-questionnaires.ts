import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { seedQuestionnaires } from './seed-questionnaires';

async function run(): Promise<void> {
  console.log('Starting questionnaire seed runner...');
  const app = await NestFactory.createApplicationContext(AppModule);
  let runError: unknown;
  try {
    const result = await seedQuestionnaires(app);
    console.log(
      `Questionnaire seeding complete. created=${result.created} updated=${result.updated} skipped=${result.skipped}`,
    );
  } catch (error) {
    runError = error;
    console.error('Questionnaire seeding failed before shutdown:', error);
    throw error;
  } finally {
    console.log('Closing questionnaire seed runner...');
    try {
      await app.close();
      console.log('Questionnaire seed runner closed.');
    } catch (closeError) {
      console.error('Questionnaire seed runner close failed:', closeError);
      if (!runError) {
        throw closeError;
      }
    }
  } 
}

run()
  .then(() => undefined)
  .catch((error) => {
    console.error('Questionnaire seed runner failed:', error);
    process.exit(1);
  });
