import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Participant } from '../../schemas/participant.schema';
import { ParticipantDomain } from '../../../../shared/domain';
import { toDomain } from '../../../../shared/converters';
import { FilterParticipantDto } from '../../controllers/dto/filter-participant.dto';

@Injectable()
export class ParticipantRepository {
  constructor(
    @InjectModel(Participant.name) private readonly participantModel: Model<Participant>,
  ) {}

  async create(participant: Participant): Promise<ParticipantDomain> {
    const newParticipant = new this.participantModel(participant);
    return newParticipant.save();
  }

  async findById(id: string): Promise<ParticipantDomain | null> {
    return this.participantModel.findById(id).exec();
  }

  async findAll(filter: FilterParticipantDto = {}): Promise<ParticipantDomain[]> {
    const query: Record<string, unknown> = {};

    if (filter.phone) {
      query.phone = filter.phone;
    }

    if (filter.email) {
      query.email = filter.email;
    }

    if (filter.search?.trim()) {
      const regex = new RegExp(filter.search.trim(), 'i');
      if (filter.attribute === 'phone') {
        query.phone = regex;
      } else if (filter.attribute === 'email') {
        query.email = regex;
      } else {
        query.$or = [
          { firstName: regex },
          { lastName: regex },
          { email: regex },
          { phone: regex },
        ];
      }
    }

    const result = await this.participantModel.find(query).sort({ updatedAt: -1, createdAt: -1 }).lean().exec();
    return toDomain(result);
  }

  async replace(id: string, update: Partial<ParticipantDomain>): Promise<ParticipantDomain> {
    const schema = await this.participantModel.findByIdAndUpdate(id, update, { new: true }).exec();
    return toDomain(schema)
  }

  async patch(id: string, update: Partial<ParticipantDomain>): Promise<ParticipantDomain> {
    const payload = Object.fromEntries(
      Object.entries(update).filter(([, value]) => value !== undefined),
    );
    const schema = await this.participantModel.findByIdAndUpdate(id, payload, { new: true }).exec();
    return toDomain(schema)
  }

  async update(id: string, update: Partial<ParticipantDomain>): Promise<ParticipantDomain> {
    return this.patch(id, update);
  }

  async delete(id: string): Promise<{ deletedCount?: number }> {
    return this.participantModel.deleteOne({ _id: id }).exec();
  }

  async findByPhone(phone: string): Promise<ParticipantDomain | null> {
    const schema = await this.participantModel.findOne({ phone }).lean();
    return toDomain(schema);
  }

  async findByEmail(email: string): Promise<ParticipantDomain | null> {
    const schema = await this.participantModel.findOne({ email }).lean();
    return toDomain(schema);
  }

}
