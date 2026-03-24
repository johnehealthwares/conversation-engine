import { InjectModel } from "@nestjs/mongoose";
import { ConversationDomain, ConversationStatus } from "../../../../shared/domain";
import { Conversation } from "../../schemas/conversation.schema";
import { isValidObjectId, Model, Types } from "mongoose";
import { toDomain } from "../../../../shared/converters";
import { NotFoundException } from "@nestjs/common";

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

  async findAll(filter) {
    return this.model.find();
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
