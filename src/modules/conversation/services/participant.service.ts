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

  private async findExistingParticipantByPhone(phoneIn: string): Promise<ParticipantDomain | null> {
    const formattedPhone = this.formatPhoneNigeriaMobilePhone(phoneIn);
    const candidatePhones = Array.from(new Set([phoneIn, formattedPhone]));

    for (const phone of candidatePhones) {
      const participant = await this.participantRepo.findByPhone(phone);
      if (participant) {
        return participant;
      }
    }

    return null;
  }

  async createParticipant(participant: ParticipantDomain) {
    this.logger.debug(`[participant:create] Resolving participant phone=${participant.phone || 'n/a'}`);
    const result = participant.phone
      ? await this.findExistingParticipantByPhone(participant.phone)
      : participant.email
        ? await this.participantRepo.findByEmail(participant.email)
        : null;
    if (result) {
      this.logger.verbose(`[participant:create] Reusing existing participant id=${result.id}`);
      return result;
    }
    const schema = await this.participantRepo.create(participant);
    const domain = toDomain(schema);
    this.logger.log(`[participant:create] Created participant id=${domain.id || participant.id}`);
    return domain;
  }

  async findOne(id: string) : Promise<ParticipantDomain | null>{
      this.logger.debug(`[participant:find-one] id=${id}`);
      const participant = await this.participantRepo.findById(id);
      return toDomain(participant);
    }


  async findByPhone(phoneIn: string) : Promise<ParticipantDomain>{
      const phone = this.formatPhoneNigeriaMobilePhone(phoneIn);
      this.logger.debug(`[participant:find-phone] input=${phoneIn} formatted=${phone}`);
      const participant = await this.findExistingParticipantByPhone(phoneIn);
      if(!participant) return this.createParticipant({
        phone,
        id: new Types.ObjectId().toString()
      })
      return participant;
    }

  
  async findBy(phoneIn: string, email: string) : Promise<ParticipantDomain>{
      const phone = this.formatPhoneNigeriaMobilePhone(phoneIn);
      this.logger.debug(`[participant:find-phone] phone=${phone}`);
      const emailParticipant = await this.participantRepo.findByPhone(phone);
      const phoneParticipant = await this.participantRepo.findByEmail(email);
      if(!emailParticipant && !phoneParticipant) return this.createParticipant({
        phone,
        email,
        id: new Types.ObjectId().toString()
      })
      return phoneParticipant || emailParticipant!;
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

   formatPhoneNigeriaMobilePhone(phone: string): string {
    let cleaned = ('' + phone).replace(/\D/g, '');

    if (cleaned.startsWith('0') && cleaned.length === 11) {
      cleaned = '234' + cleaned.substring(1);
    } else if (cleaned.length === 10) {
      cleaned = '234' + cleaned;
    }

    return cleaned;
  }

}
