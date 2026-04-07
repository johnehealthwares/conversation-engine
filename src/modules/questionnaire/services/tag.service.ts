import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateTagDto, UpdateTagDto } from '../controllers/dto/tag.dto';
import { Question } from '../schemas/question.schema';
import { Tag } from '../schemas/tag.schema';

@Injectable()
export class TagService {
  constructor(
    @InjectModel(Tag.name)
    private readonly tagModel: Model<Tag>,

    // Used for delete cascade cleanup
    @InjectModel(Question.name)
    private readonly questionModel: Model<Question>,
  ) {}

  /* ------------------ DEFAULT CRUD ------------------ */

  async create(dto: CreateTagDto) {
    return this.tagModel.create(dto);
  }

  async findAll() {
    return this.tagModel.find().lean();
  }

  async findOne(id: string) {
    const tag = await this.tagModel.findById(id).lean();
    if (!tag) throw new NotFoundException('Tag not found');
    return tag;
  }

  async update(id: string, dto: UpdateTagDto) {
    return this.patch(id, dto);
  }

  async replace(id: string, dto: UpdateTagDto) {
    const updated = await this.tagModel.findByIdAndUpdate(
      id,
      dto,
      { new: true },
    );

    if (!updated) throw new NotFoundException('Tag not found');
    return updated;
  }

  async patch(id: string, dto: UpdateTagDto) {
    const payload = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    );
    const updated = await this.tagModel.findByIdAndUpdate(
      id,
      { $set: payload },
      { new: true },
    );

    if (!updated) throw new NotFoundException('Tag not found');
    return updated;
  }

  /* ------------------ SPECIAL METHOD ------------------ */

  async ensureTagsExist(tagNames: string[]) {
    const normalized = tagNames.map(t => t.trim().toLowerCase());

    const existing = await this.tagModel.find({
      name: { $in: normalized },
    });

    const existingNames = existing.map(t => t.name);

    const toCreate = normalized.filter(
      name => !existingNames.includes(name),
    );

    if (toCreate.length) {
      await this.tagModel.insertMany(
        toCreate.map(name => ({ name })),
      );
    }

    return this.tagModel.find({
      name: { $in: normalized },
    });
  }

  /* ------------------ DELETE WITH CASCADE CLEANUP ------------------ */

  async remove(tagName: string) {
    const tag = await this.tagModel.findOne({
        name: tagName
    });
    if (!tag) throw new NotFoundException('Tag not found');


    // Remove tag string from all options.tags arrays
    await this.questionModel.updateMany(
      { 'options.tags': tagName },
      {
        $pull: { 'options.$[].tags': tagName },
      },
    );

    await tag.deleteOne();

    return { message: 'Tag deleted and references cleaned' };
  }
}
