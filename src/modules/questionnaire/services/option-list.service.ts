import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OptionList } from '../schemas/option-list.schema';
import { Question } from '../schemas/question.schema';
import { CreateOptionListDto, UpdateOptionListDto } from '../controllers/dto/option-list.dto';
import { OptionListDomain } from '../../../shared/domain/option-list.domain';
import { toDomain } from '../../../shared/converters';
import { FilterOptionListDto } from '../controllers/dto/filter-option-list.dto';

@Injectable()
export class OptionListService {
  constructor(
    @InjectModel(OptionList.name)
    private readonly optionListModel: Model<OptionList>,

    // Used to check references before delete
    @InjectModel(Question.name)
    private readonly questionModel: Model<Question>,
  ) {}

  private mapDtoOptions(
    options: CreateOptionListDto['options'],
  ) {
    // convert DTO naming (optionKey, optionValue, orderIndex) -> schema names (key, value, index)
    return options.map((opt) => ({
      ...opt
    }));
  }

  async create(dto: CreateOptionListDto): Promise<OptionListDomain> {
    const data = {
      ...dto,
      options: this.mapDtoOptions(dto.options),
    };
    const result = await this.optionListModel.create(data);
    const {_id: id, ...others} = result.toObject();
    return {id: id.toString(), ...others};
  }

  async findAll(filter: FilterOptionListDto = {}) : Promise<OptionListDomain[]>{
    const query: Record<string, any> = {};

    if (filter.name) {
      query.name = new RegExp(filter.name, 'i');
    }

    if (filter.search?.trim()) {
      const regex = new RegExp(filter.search.trim(), 'i');
      query.$or = [
        { name: regex },
        { tags: regex },
        { 'options.key': regex },
        { 'options.label': regex },
        { 'options.value': regex },
      ];
    }

    const schemas: OptionList[]  = await this.optionListModel.find(query).lean();

    return schemas.map(toDomain) as OptionListDomain[]
  }

  async findOne(id: string) : Promise<OptionListDomain>{
    const schema = await this.optionListModel.findById(id).lean();
    if (!schema) throw new NotFoundException('OptionList not found');
    return {...schema, id:schema._id.toString()};
  }

  async update(id: string, dto: UpdateOptionListDto) {
    const updateData: any = { ...dto };
    if (dto.options) {
      updateData.options = this.mapDtoOptions(dto.options as any);
    }

    const updated = await this.optionListModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true },
    );

    if (!updated) throw new NotFoundException('OptionList not found');
    return updated;
  }

  async remove(id: string) {
    // Check if any question references this list
    const inUse = await this.questionModel.exists({
      optionListId: new Types.ObjectId(id),
    });
    const all = await this.questionModel.find();

    if (inUse) {
      throw new BadRequestException(
        'OptionList is currently used by one or more questions',
      );
    }

    const deleted = await this.optionListModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException('OptionList not found');

    return { message: 'OptionList deleted successfully' };
  }
}
