import { InjectModel } from "@nestjs/mongoose";
import { ConversationDomain, ConversationStatus, QuestionDomain } from "../../../../shared/domain";
import { Conversation } from "../../schemas/conversation.schema";
import mongoose, { isValidObjectId, Model } from "mongoose";
import { mapQuestionDomainToShcema, toDomain } from "../../../../shared/converters";
import { NotFoundException } from "@nestjs/common";
import { FilterConversationDto } from "../../controllers/dto/filter-conversation.dto";

export class ConversationRepository {
  constructor(
    @InjectModel(Conversation.name)
    private model: Model<Conversation>) { }
  async create(conversation: ConversationDomain): Promise<ConversationDomain> {
    const payload: any = { ...conversation };
    if (conversation.id) {
      payload._id =  conversation.id;
      delete payload.id;
    }
    const schema = await this.model.create(payload);
    return toDomain(schema);
  }
  async patch(id: string, data: Partial<ConversationDomain> | Record<string, any>): Promise<ConversationDomain> {
    const hasUpdateOperator = Object.keys(data).some((key) => key.startsWith('$'));
    const update = hasUpdateOperator
      ? data
      : { $set: Object.fromEntries(
          Object.entries(data).filter(([, value]) => value !== undefined),
        ) };

    const conversation = await this.model
      .findByIdAndUpdate(
        id,
        update,
        { returnDocument: 'after' },
      )
      .lean();
    if (!conversation) throw new NotFoundException("conversation not foupasnd");
    return toDomain(conversation);
  }

  async replace(id: string, data: Partial<ConversationDomain>): Promise<ConversationDomain> {
    const payload: Record<string, unknown> = {};

    Object.entries(data).forEach(([key, value]) => {
      payload[key] = value;
    });

    const conversation = await this.model
      .findByIdAndUpdate(
        id,
        payload,
        { returnDocument: 'after', overwrite: false },
      )
      .lean();

    if (!conversation) throw new NotFoundException("conversation not foupasnd");
    return toDomain(conversation);
  }

  // async addDynamicQuestion(question: QuestionDomain) {

  //       const pendingQuestionSchema = mapQuestionDomainToShcema(question);
      
  //   return this.
    
  // }

  async save(id: string, data: Partial<ConversationDomain>): Promise<ConversationDomain> {
    return this.patch(id, data);
  }

  async findAll(filter: FilterConversationDto = {}) {
    const query: Record<string, any> = {};

    if (filter.questionnaireId) {
      query.questionnaireId = filter.questionnaireId;
    }

    if (filter.channelId) {
      query.channelId = filter.channelId;
    }

    if (filter.participantId) {
      query.participantId = filter.participantId;
    }

    if (filter.status) {
      query.status = filter.status;
    }

    if (filter.search?.trim()) {
      const regex = new RegExp(filter.search.trim(), 'i');
      query.$or = [
        { participantId: filter.search.trim()},
        { questionnaireId: filter.search.trim()},
        { channelId: filter.search.trim()},
        { workflowInstanceId: filter.search.trim()},
        { status: regex },
        { state: regex },
      ].filter(Boolean);
    }

    return toDomain(await this.model.find(query).sort({ createdAt: -1 }).lean());
  }

  async delete(id: string) {
    await this.model.findByIdAndDelete(id);
  }

  async findById(id: string): Promise<ConversationDomain | null> {
    const conversation = await this.model.findById(id);
    if (!conversation) return null;
    return toDomain(conversation)
  }


  async findActiveById(id: string): Promise<ConversationDomain | null> {
    const conversation = await this.model.findOne({
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
