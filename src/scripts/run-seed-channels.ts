import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { seedChannels } from './seed-channels';

async function run(): Promise<void> {
  console.log('Starting channel seed runner...');
  const app = await NestFactory.createApplicationContext(AppModule);
  let runError: unknown;
  try {
    const result = await seedChannels(app);
    console.log(
      `Channel seeding complete. created=${result.created} updated=${result.updated} skipped=${result.skipped}`,
    );
  } catch (error) {
    runError = error;
    console.error('Channel seeding failed before shutdown:', error);
    throw error;
  } finally {
    console.log('Closing channel seed runner...');
    try {
      await app.close();
      console.log('Channel seed runner closed.');
    } catch (closeError) {
      console.error('Channel seed runner close failed:', closeError);
      if (!runError) {
        throw closeError;
      }
    }
  } 
}

run()
  .then(() => undefined)
  .catch((error) => {
    console.error('Channel seed runner failed:', error);
    process.exit(1);
  });