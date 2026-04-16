import { Injectable, NotFoundException } from "@nestjs/common";
import { CreateQuestionDto } from "../controllers/dto/create-question.dto";
import { FilterQuestionDto } from "../controllers/dto/filter-question.dto";
import { CreateQuestionUseCase } from "./use-cases/create-question.use-case";
import { QuestionDomain } from "../../../shared/domain";
import { UpdateQuestionDto } from "../controllers/dto/update-question.dto";
import { QuestionMongoRepository } from "../repositories/mongo/question.mongorepo";
import { UpdateQuestionUseCase } from "./use-cases/update-question.use-case";
import { mapQuestionEntityToDomain } from "../../../shared/converters/question-converter";
import { AIQuestionConfig } from "../../../shared/domain/ai-question-config";
import { ValidationRule } from "../../../shared/domain/validation-rule.domain";

@Injectable()
export class QuestionService {
  constructor(
    private readonly createUseCase: CreateQuestionUseCase,
    private readonly updateUseCase: UpdateQuestionUseCase,
    private readonly repo: QuestionMongoRepository,
  ) { }

  async create(dto: CreateQuestionDto) {
    const now = new Date();
    const domain: QuestionDomain = {
      ...dto,
      id: '',
      attribute: dto.attribute || this.buildAttribute(dto.text),
      hasLink: dto.hasLink ?? false,
      tags: dto.tags || [],
      validationRules: dto.validationRules as ValidationRule[] | undefined,
      createdAt: now,
      updatedAt: now,
    };
    const question = await this.createUseCase.execute(domain);
    return mapQuestionEntityToDomain(question);
  }

  findAll(filter: FilterQuestionDto) {
    return this.repo.findAll(filter).then((questions) =>
      questions.map((question) => mapQuestionEntityToDomain(question))
    );
  }

  async findOne(id: string): Promise<QuestionDomain> {
    const schema = await this.repo.findById(id);
    if (!schema) throw new NotFoundException(`Question with id ${id} does not eist`)
    return mapQuestionEntityToDomain(schema);
  }

    async findWorkflow(id: string): Promise<QuestionDomain> {
    const schema = await this.repo.findById(id);
    if (!schema) throw new NotFoundException(`Question with id ${id} does not eist`)
    return mapQuestionEntityToDomain(schema);
  }



  async update(id: string, dto: UpdateQuestionDto): Promise<QuestionDomain> {
    return this.patch(id, dto);
  }

  async replace(id: string, dto: UpdateQuestionDto): Promise<QuestionDomain> {
    const domain: Partial<QuestionDomain> = {
      ...dto,
      questionnaireId: dto.questionnaireId?.toString(),
      validationRules: dto.validationRules as ValidationRule[] | undefined,
      options: dto.options?.map((option) => ({
        ...option
      })),
    };
    return this.updateUseCase.execute(id, domain);
  }

  async patch(id: string, dto: UpdateQuestionDto): Promise<QuestionDomain> {
    const domain: Partial<QuestionDomain> = {
      questionnaireId: dto.questionnaireId?.toString(),
      validationRules: dto.validationRules as ValidationRule[] | undefined,
      options: dto.options?.map((option) => ({
        ...option
      })),
    };
    Object.entries(dto).forEach(([key, value]) => {
      if (value !== undefined) {
        (domain as Record<string, unknown>)[key] = value;
      }
    });
    return this.updateUseCase.execute(id, domain);
  }

  delete(id: string) {
    return this.repo.delete(id);
  }

  private buildAttribute(text: string): string {
    return text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }
}
