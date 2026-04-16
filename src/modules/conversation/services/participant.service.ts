import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ParticipantRepository } from '../repositories/mongo/participant.repository';
import { ParticipantDomain } from '../../../shared/domain';
import { Schema as MongooseSchema } from 'mongoose';
import { toDomain } from '../../../shared/converters';
import { CreateParticipantDto, UpdateParticipantDto } from '../controllers/dto/participant.dto';
import { FilterParticipantDto } from '../controllers/dto/filter-participant.dto';
import { ConversationRepository } from '../repositories/mongo/conversation.repository';
import { Types } from 'mongoose';

@Injectable()
export class ParticipantService {
  private readonly logger = new Logger(ParticipantService.name);

  constructor(
    private readonly participantRepo: ParticipantRepository,
    private readonly conversationRepo: ConversationRepository,
  ) {}

  async create(dto: CreateParticipantDto) {
    return this.createParticipant({
      ...dto,
      id: new Types.ObjectId().toString(),
    });
  }

  async getQuestionaireChannelModerator(questionnaireId: string, channelId: string, phone: string, email: string): Promise<ParticipantDomain> {
    return  this.participantRepo.create({

    })
  }

  async createParticipant(participant: ParticipantDomain) {
    this.logger.debug(`[participant:create] Resolving participant phone=${participant.phone || 'n/a'}`);
    const result = participant.phone
      ? await this.participantRepo.findByPhone(participant.phone)
      : participant.email
        ? await this.participantRepo.findByEmail(participant.email)
        : null;
    if(result) {
      this.logger.verbose(`[participant:create] Reusing existing participant id=${result.id}`);
      return result;
    }
    const schema = await this.participantRepo.create(participant);
    const domain = toDomain(schema);
    this.logger.log(`[participant:create] Created participant id=${domain.id || participant.id}`);
    return domain
  }

   async findOne(id: string) : Promise<ParticipantDomain>{
      this.logger.debug(`[participant:find-one] id=${id}`);
      const participant = await this.participantRepo.findById(id);
        if (!participant) throw new NotFoundException('Participant not found');
      return participant;
    }


  async findByPhone(phone: string) : Promise<ParticipantDomain | null>{
      this.logger.debug(`[participant:find-phone] phone=${phone}`);
      const participant = await this.participantRepo.findByPhone(phone);
      if(!participant) return this.createParticipant({
        phone,
        id: new Types.ObjectId().toString()
      })
      return participant;
    }

  async findByEmail(email: string) : Promise<ParticipantDomain | null>{
      this.logger.debug(`[participant:find-email] email=${email}`);
      return this.participantRepo.findByEmail(email);
    }
    

  async findAll(filter: FilterParticipantDto = {}) {
    return this.participantRepo.findAll(filter);
  }

  async replaceParticipant(id: string, update: UpdateParticipantDto) {
    const updated = await this.participantRepo.replace(id, update);
    if (!updated) throw new NotFoundException('Participant not found');
    return updated;
  }

  async patchParticipant(id: string, update: UpdateParticipantDto) {
    const updated = await this.participantRepo.patch(id, update);
    if (!updated) throw new NotFoundException('Participant not found');
    return updated;
  }

  async updateParticipant(id: string, update: Partial<ParticipantDomain>) {
    return this.patchParticipant(id, update);
  }

  async deleteParticipant(id: string) {
    const result = await this.participantRepo.delete(id);
    if (!result.deletedCount) throw new NotFoundException('Participant not found');
    return { success: true };
  }

  async findConversations(id: string) {
    await this.findOne(id);
    return this.conversationRepo.findAll({ participantId: id });
  }
}
