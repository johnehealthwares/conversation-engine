import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { QuestionController } from './controllers/question.controller';
import { OptionListController } from './controllers/option-list.controller';
import { QuestionnaireController } from './controllers/questionnaire.controller';
import { TagController } from './controllers/tag.controller';
import { Question, QuestionSchema } from './schemas/question.schema';
import { Option, OptionSchema } from './schemas/option.schema';
import {
  OptionList,
  OptionListSchema,
} from './schemas/option-list.schema';
import {
  Questionnaire,
  QuestionnaireSchema,
} from './schemas/questionnaire.schema';
import { Tag, TagSchema } from './schemas/tag.schema';
import { QuestionService } from './services/question.service';
import { OptionListService } from './services/option-list.service';
import { QuestionnaireService } from './services/questionnaire.service';
import { TagService } from './services/tag.service';
import { QuestionProcessorService } from './processors/question-processor.service';
import { AIProcessorService } from './processors/ai-processor.service';
import { ApiProcessorFacade } from './processors/api-processor';
import { OptionResolver } from './processors/option-resolver';
import { CreateQuestionUseCase } from './services/use-cases/create-question.use-case';
import { UpdateQuestionUseCase } from './services/use-cases/update-question.use-case';
import { QuestionMongoRepository } from './repositories/mongo/question.mongorepo';
import { QuestionRepository } from './repositories/question.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Question.name, schema: QuestionSchema },
      { name: Option.name, schema: OptionSchema },
      { name: OptionList.name, schema: OptionListSchema },
      { name: Questionnaire.name, schema: QuestionnaireSchema },
      { name: Tag.name, schema: TagSchema },
    ]),
  ],
  controllers: [
    QuestionController,
    OptionListController,
    QuestionnaireController,
    TagController,
  ],
  providers: [
    QuestionService,
    OptionListService,
    QuestionnaireService,
    TagService,
    QuestionProcessorService,
    AIProcessorService,
    ApiProcessorFacade,
    OptionResolver,
    CreateQuestionUseCase,
    UpdateQuestionUseCase,
    QuestionMongoRepository,
    {
      provide: QuestionRepository,
      useClass: QuestionMongoRepository,
    },
  ],
  exports: [
    MongooseModule,
    QuestionService,
    OptionListService,
    QuestionnaireService,
    TagService,
    QuestionProcessorService,
    AIProcessorService,
    ApiProcessorFacade,
    OptionResolver,
    CreateQuestionUseCase,
    UpdateQuestionUseCase,
    QuestionMongoRepository,
    QuestionRepository,
  ],
})
export class QuestionnaireModule {}
