import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Exchange, ExchangeDocument } from '../schemas/exchange.schema';
import { ExchangeDomain } from '../../shared/domain';
import { toDomain } from '../../shared/converters';

@Injectable()
export class ExchangeRepository {
  constructor(
    @InjectModel(Exchange.name)
    private readonly exchangeModel: Model<ExchangeDocument>,
  ) {}

  /**
   * Create exchange → returns domain
   */
  async create(payload: ExchangeDomain): Promise<ExchangeDomain> {
    const doc = await this.exchangeModel.create(payload as any);
    return toDomain(doc);
  }

  /**
   * Find many → domain[]
   */
  async find(query: FilterQuery<Exchange>): Promise<ExchangeDomain[]> {
    const docs = await this.exchangeModel
      .find(query)
      .sort({ createdAt: -1 })
      .lean();

    return docs.map(toDomain);
  }

  /**
   * Find one → domain
   */
  async findOne(query: FilterQuery<Exchange>): Promise<ExchangeDomain | null> {
    const doc = await this.exchangeModel.findOne(query).lean();
    return doc ? toDomain(doc) : null;
  }

  /**
   * Find by messageId
   */
  async findByMessageId(messageId: string): Promise<ExchangeDomain | null> {
    const doc = await this.exchangeModel.findOne({ messageId }).lean();
    return doc ? toDomain(doc) : null;
  }

  /**
   * Update by ID
   */
  async updateById(
    id: string,
    update: UpdateQuery<Exchange>,
  ): Promise<void> {
    await this.exchangeModel.findByIdAndUpdate(id, update);
  }

  /**
   * Update one
   */
  async updateOne(
    query: FilterQuery<Exchange>,
    update: UpdateQuery<Exchange>,
  ): Promise<void> {
    await this.exchangeModel.updateOne(query, update);
  }

  /**
   * Most recent outbound → domain
   */
  async findMostRecentOutbound(): Promise<ExchangeDomain | null> {
    const doc = await this.exchangeModel
      .findOne({ direction: 'OUTBOUND' })
      .sort({ createdAt: -1 })
      .lean();

    return doc ? toDomain(doc) : null;
  }

  /**
   * Change stream (raw — don't map)
   */
  watch() {
    return this.exchangeModel.watch();
  }
}