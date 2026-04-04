import { InjectModel } from "@nestjs/mongoose";
import { ConversationDomain, ConversationStatus } from "../../../../shared/domain";
import { Conversation } from "../../schemas/conversation.schema";
import { isValidObjectId, Model, Types } from "mongoose";
import { toDomain } from "../../../../shared/converters";
import { NotFoundException } from "@nestjs/common";
import { FilterConversationDto } from "../../controllers/dto/filter-conversation.dto";

export class ConversationRepository {
  constructor(
    @InjectModel(Conversation.name)
    private model: Model<Conversation>) { }
  async create(conversation: ConversationDomain): Promise<ConversationDomain> {
    const payload: any = { ...conversation };
    if (conversation.id) {
      payload._id = new Types.ObjectId(conversation.id);
      delete payload.id;
    }
    const schema = await this.model.create(payload);
    return toDomain(schema);
  }
  async save(id: string, data: Partial<ConversationDomain>): Promise<ConversationDomain> {
    // 🔹 Build raw $set update (PATCH semantics)
    const $set: any = {};
    Object.keys(data).forEach((key) => {
      const value = data[key as keyof typeof data];

      if (value !== undefined) $set[key] = isValidObjectId(value) ? new Types.ObjectId(value as string) : value;
    });
    const conversation = await this.model
      .findByIdAndUpdate(
        new Types.ObjectId(id),
        { ...$set },
        { returnDocument: 'after' },
      )
      .lean();
    if (!conversation) throw new NotFoundException("conversation not foupasnd");
    return toDomain(conversation);
  }

  async findAll(filter: FilterConversationDto = {}) {
    const query: Record<string, any> = {};

    if (filter.questionnaireId) {
      query.questionnaireId = new Types.ObjectId(filter.questionnaireId);
    }

    if (filter.channelId) {
      query.channelId = new Types.ObjectId(filter.channelId);
    }

    if (filter.participantId) {
      query.participantId = new Types.ObjectId(filter.participantId);
    }

    if (filter.status) {
      query.status = filter.status;
    }

    if (filter.search?.trim()) {
      const regex = new RegExp(filter.search.trim(), 'i');
      query.$or = [
        { participantId: isValidObjectId(filter.search.trim()) ? new Types.ObjectId(filter.search.trim()) : undefined },
        { questionnaireId: isValidObjectId(filter.search.trim()) ? new Types.ObjectId(filter.search.trim()) : undefined },
        { channelId: isValidObjectId(filter.search.trim()) ? new Types.ObjectId(filter.search.trim()) : undefined },
        { workflowInstanceId: isValidObjectId(filter.search.trim()) ? new Types.ObjectId(filter.search.trim()) : undefined },
        { status: regex },
        { state: regex },
      ].filter(Boolean);
    }

    return toDomain(await this.model.find(query).sort({ createdAt: -1 }).lean());
  }

  async delete(id: string) {
    await this.model.findByIdAndDelete(new Types.ObjectId(id));
  }

  async findById(id: string): Promise<ConversationDomain | null> {
    const conversation = await this.model.findById(id);
    if (!conversation) return null;
    return toDomain(conversation)
  }


  async findActiveById(id: string): Promise<ConversationDomain | null> {
    const conversation = await this.model.findOne({
      _id: id,
      status: ConversationStatus.ACTIVE
    });
    if (!conversation) return null;
    return toDomain(conversation)
  }

  async findActiveByParticipantId(participantId: string): Promise<ConversationDomain | null> {
    const conversation = await this.model 
      .findOne({
        participantId,
       status: ConversationStatus.ACTIVE,
      }).lean()
    if (!conversation) return null;
    return toDomain(conversation);
  }

}
