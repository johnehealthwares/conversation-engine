import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Channel, ChannelDocument } from "../schemas/channel.schema";
import { ChannelDomain, ChannelType } from "../../shared/domain";
import { toDomain } from "../../shared/converters";
import { CreateChannelDto, UpdateChannelDto } from "../controllers/dto/channel.dto";
import { FilterChannelDto } from "../controllers/dto/filter-channel.dto";

@Injectable()
export class ChannelService {
  private readonly logger = new Logger(ChannelService.name);

  constructor(
    @InjectModel(Channel.name)
    private channelModel: Model<ChannelDocument>
  ) {}


  async findByType(type: string): Promise<ChannelDomain | null> {
    const result = await this.channelModel.findOne({ type }).lean().exec();
    const domain = toDomain(result);
    return domain;
  }


  async findById(channelId: string): Promise<ChannelDomain | null> {
    if (!Types.ObjectId.isValid(channelId)) {
      return null;
    }
    const channel = await this.channelModel.findById(new Types.ObjectId(channelId)).lean();
    return toDomain(channel);
  }


  async validateChannel(channelId: string): Promise<ChannelDomain> {
    this.logger.debug(`[channel:validate] Resolving channel ${channelId}`);
    const channel = await this.findById(channelId);
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    return channel;
  }

  async create(dto: CreateChannelDto): Promise<ChannelDomain> {
    this.logger.log(`[channel:create] Persisting channel type=${dto.type} name=${dto.name}`);
    const created = await this.channelModel.create(dto);
    return toDomain(created);
  }

  async findAll(filter: FilterChannelDto = {}): Promise<ChannelDomain[]> {
    const query: Record<string, any> = {};

    if (filter.type) query.type = filter.type;
    if (filter.provider) query.provider = new RegExp(filter.provider, 'i');
    if (typeof filter.isActive === 'boolean') query.isActive = filter.isActive;
    if (filter.search?.trim()) {
      const regex = new RegExp(filter.search.trim(), 'i');
      query.$or = [
        { name: regex },
        { provider: regex },
        { externalId: regex },
        { type: regex },
      ];
    }

    const channels = await this.channelModel.find(query).lean();
    return toDomain(channels);
  }

  async findOne(id: string): Promise<ChannelDomain> {
    const channel = await this.findById(id);
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    return channel;
  }

  async update(id: string, dto: UpdateChannelDto): Promise<ChannelDomain> {
    this.logger.log(`[channel:update] Updating channel ${id}`);
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Channel not found');
    }

    const updated = await this.channelModel
      .findByIdAndUpdate(new Types.ObjectId(id), { $set: dto }, { new: true })
      .lean();

    if (!updated) {
      throw new NotFoundException('Channel not found');
    }

    return toDomain(updated);
  }

  async remove(id: string): Promise<{ message: string }> {
    this.logger.warn(`[channel:remove] Removing channel ${id}`);
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Channel not found');
    }

    const deleted = await this.channelModel.findByIdAndDelete(new Types.ObjectId(id));
    if (!deleted) {
      throw new NotFoundException('Channel not found');
    }

    return { message: 'Channel deleted successfully' };
  }

  async sendMessage(channelId: string, payload: any) {
    const channel = await this.validateChannel(channelId);
    this.logger.log(`[channel:dispatch] channel=${channelId} type=${channel.type}`);

    switch (channel.type) {
      case ChannelType.MOCK:
        return this.sendMock(payload);

      case ChannelType.WHATSAPP:
        return this.sendWhatsApp(payload);

      case ChannelType.SMS:
        return this.sendSMS(payload);

      case ChannelType.WEBCHAT:
        return this.sendWebchat(payload);

      default:
        throw new BadRequestException('Unsupported channel');
    }
  }

  private async sendWhatsApp(payload: any) {
    // call whatsapp provider
    return { status: 'sent' };
  }

  private async sendMock(payload: any) {
    this.logger.log(`[channel:mock] ${JSON.stringify(payload)}`);
    return { status: 'sent' };
  }

  private async sendSMS(payload: any) {
    return { status: 'sent' };
  }

  private async sendWebchat(payload: any) {
    return { status: 'sent' };
  }
}
