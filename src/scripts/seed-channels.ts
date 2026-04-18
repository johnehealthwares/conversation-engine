import { INestApplicationContext, Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Channel } from '../channels/schemas/channel.schema';
import { Participant } from '../modules/conversation/schemas/participant.schema';

type SeedResult = {
  created: number;
  updated: number;
  skipped: number;
};

type SeedParticipant = {
  _id: Types.ObjectId;
  phone: string;
};

type SeedChannel = {
  _id: Types.ObjectId;
  name: string;
  type: string;
  metadata: Record<string, any>;
  pseudoParticipantId: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
};

const sampleParticipants = (): SeedParticipant[] => [
  {
    _id: new Types.ObjectId('680000000000000000000001'),
    phone: '+234000000001',
  },
  {
    _id: new Types.ObjectId('680000000000000000000002'),
    phone: '+234000000002',
  },
  {
    _id: new Types.ObjectId('680000000000000000000003'),
    phone: '+234000000003',
  },
  {
    _id: new Types.ObjectId('680000000000000000000004'),
    phone: '+234000000004',
  },
];

const sampleChannels = (): SeedChannel[] => [
  {
    _id: new Types.ObjectId('69c2930ad541d741898d521c'),
    name: ' Nigeria Bulk SMS Channel',
    type: 'SMS',
    metadata: {
      provider: 'NigeriaBulkSMS',
      senderId: 'HealthStack',
    },
    pseudoParticipantId: new Types.ObjectId('680000000000000000000001'),
    createdAt: new Date('2026-03-07T22:21:01.481Z'),
    updatedAt: new Date('2026-03-07T22:21:01.481Z'),
    __v: 0,
  },
  {
    _id: new Types.ObjectId('69c27e77d541d741898d521b'),
    name: 'Email Channel',
    type: 'EMAIL',
    metadata: {
      provider: 'NigeriaBulkSMS',
      senderId: 'HealthStack',
    },
    pseudoParticipantId: new Types.ObjectId('680000000000000000000002'),
    createdAt: new Date('2026-03-07T22:21:01.481Z'),
    updatedAt: new Date('2026-03-07T22:21:01.481Z'),
    __v: 0,
  },
  {
    _id: new Types.ObjectId('69aca4cd84a4eab2c5b98b3a'),
    name: 'Mock Channel',
    type: 'MOCK',
    pseudoParticipantId: new Types.ObjectId('680000000000000000000003'),
    metadata: {},
    __v: 0,
  },
  {
    _id: new Types.ObjectId('69aca4cd84a4eab2c5b98b3a'),
    name: 'Whatsapp Channel',
    type: 'WHATSAPP',
    metadata: {
      provider: 'NigeriaBulkSMS',
      senderId: 'HealthStack',
    },
    pseudoParticipantId: new Types.ObjectId('680000000000000000000004'),
    createdAt: new Date('2026-03-07T22:21:01.481Z'),
    updatedAt: new Date('2026-03-07T22:21:01.481Z'),
    __v: 0,
  },
];


export async function seedChannels(
  app: INestApplicationContext,
): Promise<SeedResult> {
  const channelModel = app.get<Model<Channel>>(getModelToken(Channel.name));
  const participantModel = app.get<Model<Participant>>(getModelToken(Participant.name));
    const logger = new Logger('SeedChannels');


  const participants = sampleParticipants();
  const channels = sampleChannels();

  let created = 0;
  let updated = 0;
 logger.log(`Starting seeding...`);
  logger.log(`Participants: ${participants.length}, Channels: ${channels.length}`);

  // Seed participants first
  for (const participant of participants) {
        logger.debug(`Processing participant ${participant._id}`);
const existing = await participantModel.findOne({ _id: participant._id }).lean();

    await participantModel.replaceOne(
      { _id: participant._id },
      participant,
      { upsert: true },
    );
 if (existing) {
      updated += 1;
      logger.verbose(`Updated participant ${participant._id}`);
    } else {
      created += 1;
      logger.verbose(`Created participant ${participant._id}`);
    }
  }
  logger.log(`Finished seeding participants`);

  // Seed channels
  for (const channel of channels) {
        logger.debug(`Processing channel ${channel._id}`);

    const existing = await channelModel.findOne({ _id: channel._id }).lean();

    await channelModel.replaceOne(
      { _id: channel._id },
      channel,
      { upsert: true },
    );

 if (existing) {
      updated += 1;
      logger.verbose(`Updated channel ${channel._id}`);
    } else {
      created += 1;
      logger.verbose(`Created channel ${channel._id}`);
    }
  }

  logger.log(`Finished seeding channels`);

  logger.log(`Seeding complete: created=${created}, updated=${updated}`);

  return {
    created,
    updated,
    skipped: 0,
  };
}