/**
 * Integration Test Fixtures
 * Contains all mock data for e2e testing
 */

import { CreateOptionDto, CreateOptionListDto } from '../modules/questionnaire/controllers/dto/option-list.dto';
import { CreateQuestionnaireDto } from '../modules/questionnaire/controllers/dto/questionnaire.dto';
import { CreateQuestionDto } from '../modules/questionnaire/controllers/dto/create-question.dto';

import {
  QuestionType,
  RenderMode,
  ProcessMode,
  ProcessingStrategy,
} from '../shared/domain';
import { Option } from '../modules/questionnaire/schemas/option.schema';

/**
 * QUESTIONNAIRE
 */

export const createQuestionnaireData = (): CreateQuestionnaireDto => ({
  name: 'Patient Health Assessment',
  code: `PATIENT_HEALTH_ASSESSMENT - ${new Date().getTime()}`,
  description: 'Basic patient demographic and health intake questionnaire',

  isDynamic: false,
  version: 1,

  allowBackNavigation: true,
  allowMultipleSessions: false,

  processingStrategy: ProcessingStrategy.STATIC,

  tags: ['healthcare', 'intake'],

  metadata: {
    category: 'healthcare',
    createdBy: 'test-suite',
  },

  isActive: true,
});

/**
 * OPTION LISTS
 */

export const statesOfNigeriaOptionsList = (): CreateOptionListDto => ({
  name: 'States of Nigeria' + `- ${new Date().getTime()}`,
  options: [
    { key: 'abia', value: 'Abia', label: 'Abia State', index: 0 },
    { key: 'adamawa', value: 'Adamawa', label: 'Adamawa State', index: 1 },
    { key: 'akwaibom', value: 'Akwa Ibom', label: 'Akwa Ibom State', index: 2 },
    { key: 'bauchi', value: 'Bauchi', label: 'Bauchi State', index: 3 },
    { key: 'bayelsa', value: 'Bayelsa', label: 'Bayelsa State', index: 4 },
  ],
  metadata: { country: 'Nigeria' },
});

export const countriesOfTheWorldOptionsList = (): CreateOptionListDto => ({
  name: 'Countries of the World' + `- ${new Date().getTime()}`,
  options: [
    { key: 'NG', value: 'Nigeria', label: 'Nigeria', index: 0 },
    { key: 'GH', value: 'Ghana', label: 'Ghana', index: 1 },
    { key: 'KE', value: 'Kenya', label: 'Kenya', index: 2 },
    { key: 'ZA', value: 'South Africa', label: 'South Africa', index: 3 },
    { key: 'US', value: 'United States', label: 'United States', index: 4 },
  ],
  metadata: { region: 'Global' },
});

export const genderOptionsList = (): CreateOptionListDto => ({
  name: 'Gender' + `- ${new Date().getTime()}`,
  options: [
    { key: 'male', value: 'Male', label: 'Male', index: 0 },
    { key: 'female', value: 'Female', label: 'Female', index: 1 },
    { key: 'other', value: 'Other', label: 'Other', index: 2 },
    {
      key: 'prefer_not_to_say',
      value: 'Prefer not to say',
      label: 'Prefer not to say',
      index: 3,
    },
  ],
  metadata: { demographic: true },
});

export const maritalStatusOptionsList = (): CreateOptionListDto => ({
  name: 'Marital Status' + `- ${new Date().getTime()}`,
  options: [
    { key: 'single', value: 'Single', label: 'Single', index: 0 },
    { key: 'married', value: 'Married', label: 'Married', index: 1 },
    { key: 'divorced', value: 'Divorced', label: 'Divorced', index: 2 },
    { key: 'widowed', value: 'Widowed', label: 'Widowed', index: 3 },
  ],
  metadata: { demographic: true },
});

export const educationLevelOptionsList = (): CreateOptionListDto => ({
  name: 'Education Level' + `- ${new Date().getTime()}`,
  options: [
    { key: 'primary', value: 'Primary School', label: 'Primary School', index: 0 },
    { key: 'secondary', value: 'Secondary School', label: 'Secondary School', index: 1 },
    { key: 'tertiary', value: 'Tertiary Education', label: 'Tertiary Education', index: 2 },
    { key: 'postgraduate', value: 'Postgraduate', label: 'Postgraduate', index: 3 },
  ],
  metadata: { demographic: true },
});

/**
 * QUESTIONS USING OPTION LISTS
 */

export const questionWithStatesList = (
  questionnaireId: string,
  statesListId: string,
): CreateQuestionDto => ({
  questionnaireId,
  text: 'Select your state of residence',
  tags: ['demographics', 'location'],
  questionType: QuestionType.SINGLE_CHOICE,
  renderMode: RenderMode.DROPDOWN,
  processMode: ProcessMode.NONE,
  index: 0,
  isRequired: true,
  isActive: true,
  optionListId: statesListId,
});

export const questionWithCountriesList = (
  questionnaireId: string,
  countriesListId: string,
): CreateQuestionDto => ({
  questionnaireId,
  text: 'Select your country',
  tags: ['demographics', 'location'],
  questionType: QuestionType.SINGLE_CHOICE,
  renderMode: RenderMode.DROPDOWN,
  processMode: ProcessMode.NONE,
  index: 1,
  isRequired: true,
  isActive: true,
  optionListId: countriesListId,
});

export const questionWithGenderList = (
  questionnaireId: string,
  genderListId: string,
): CreateQuestionDto => ({
  questionnaireId,
  text: 'What is your gender?',
  tags: ['demographics'],
  questionType: QuestionType.SINGLE_CHOICE,
  renderMode: RenderMode.RADIO,
  processMode: ProcessMode.NONE,
  index: 2,
  isRequired: true,
  isActive: true,
  optionListId: genderListId,
});

export const questionWithMaritalStatusList = (
  questionnaireId: string,
  maritalListId: string,
): CreateQuestionDto => ({
  questionnaireId,
  text: 'What is your marital status?',
  tags: ['demographics'],
  questionType: QuestionType.SINGLE_CHOICE,
  renderMode: RenderMode.DROPDOWN,
  processMode: ProcessMode.NONE,
  index: 3,
  isRequired: false,
  isActive: true,
  optionListId: maritalListId,
});

export const questionWithEducationList = (
  questionnaireId: string,
  educationListId: string,
): CreateQuestionDto => ({
  questionnaireId,
  text: 'What is your highest level of education?',
  tags: ['demographics', 'education'],
  questionType: QuestionType.SINGLE_CHOICE,
  renderMode: RenderMode.DROPDOWN,
  processMode: ProcessMode.NONE,
  index: 4,
  isRequired: false,
  isActive: true,
  optionListId: educationListId,
});

/**
 * QUESTIONS WITH EMBEDDED OPTIONS
 */

export const satisfactionQuestion = (questionnaireId: string): CreateQuestionDto => ({
  questionnaireId,
  text: 'How satisfied are you with your health?',
  tags: ['health'],
  questionType: QuestionType.SINGLE_CHOICE,
  renderMode: RenderMode.RADIO,
  processMode: ProcessMode.NONE,
  index: 7,
  isRequired: true,
  isActive: true,
  options: [
    { key: 'very_satisfied', label: 'Very Satisfied', value: 'very_satisfied', index: 0 },
    { key: 'satisfied', label: 'Satisfied', value: 'satisfied', index: 1 },
    { key: 'neutral', label: 'Neutral', value: 'neutral', index: 2 },
    { key: 'dissatisfied', label: 'Dissatisfied', value: 'dissatisfied', index: 3 },
    { key: 'very_dissatisfied', label: 'Very Dissatisfied', value: 'very_dissatisfied', index: 4 },
  ],
});

export const riskLevelQuestion = (questionnaireId: string): CreateQuestionDto => ({
  questionnaireId,
  text: 'What is your perceived health risk level?',
  tags: ['health', 'risk'],
  questionType: QuestionType.SINGLE_CHOICE,
  renderMode: RenderMode.RADIO,
  processMode: ProcessMode.NONE,
  index: 8,
  isRequired: true,
  isActive: true,
  options: [
    { key: 'low', label: 'Low', value: 'low', index: 0 },
    { key: 'moderate', label: 'Moderate', value: 'moderate', index: 1 },
    { key: 'high', label: 'High', value: 'high', index: 2 },
    { key: 'critical', label: 'Critical', value: 'critical', index: 3 },
  ],
});

export const ageGroupQuestion = (questionnaireId: string): CreateQuestionDto => ({
  questionnaireId,
  text: 'What is your age group?',
  tags: ['demographics'],
  questionType: QuestionType.SINGLE_CHOICE,
  renderMode: RenderMode.RADIO,
  processMode: ProcessMode.NONE,
  index: 9,
  isRequired: true,
  isActive: true,
  options: [
    { key: 'under_18', label: 'Under 18', value: 'under_18', index: 0 },
    { key: '18_30', label: '18-30', value: '18_30', index: 1 },
    { key: '31_50', label: '31-50', value: '31_50', index: 2 },
    { key: '51_70', label: '51-70', value: '51_70', index: 3 },
    { key: 'over_70', label: 'Over 70', value: 'over_70', index: 4 },
  ],
});


export const genderOptions: CreateOptionDto[] = [
  {
    key: 'male',
    value: 'Male',
    label: 'Male',
    index: 0,
  },
  {
    key: 'female',
    value: 'Female',
    label: 'Female',
    index: 1,
  },
  {
    key: 'other',
    value: 'Other',
    label: 'Other',
    index: 2,
  },
  {
    key: 'prefer_not_to_say',
    value: 'Prefer not to say',
    label: 'Prefer not to say',
    index: 3,
  },
];

/**
 * FACTORIES
 */

export function getAllOptionLists(): CreateOptionListDto[] {
  return [
    statesOfNigeriaOptionsList(),
    countriesOfTheWorldOptionsList(),
    genderOptionsList(),
    maritalStatusOptionsList(),
    educationLevelOptionsList(),
  ];
}

export function getAllQuestionsWithOptionLists(
  questionnaireId: string,
  optionListIds: Record<string, string>,
): CreateQuestionDto[] {
  return [
    questionWithStatesList(questionnaireId, optionListIds.states),
    questionWithCountriesList(questionnaireId, optionListIds.countries),
    questionWithGenderList(questionnaireId, optionListIds.gender),
    questionWithMaritalStatusList(questionnaireId, optionListIds.maritalStatus),
    questionWithEducationList(questionnaireId, optionListIds.education),
  ];
}

export function getAllEmbeddedQuestions(questionnaireId: string): CreateQuestionDto[] {
  return [
    satisfactionQuestion(questionnaireId),
    riskLevelQuestion(questionnaireId),
    ageGroupQuestion(questionnaireId),
  ];
}

export const createQuestionWithEmbeddedOptions = (
  questionnaireId: string,
  index: number,
  questionText: string,
  options: Array<{
    key: string;
    label: string;
    value: string;
    index: number;
  }>,
): CreateQuestionDto => ({
  questionnaireId,
  text: questionText,
  tags: ['embedded-options'],
  questionType: QuestionType.SINGLE_CHOICE,
  renderMode: RenderMode.RADIO,
  processMode: ProcessMode.NONE,
  index,
  isRequired: true,
  isActive: true,
  options: options.map((opt) => ({
    key: opt.key,
    label: opt.label,
    value: opt.value,
    index: opt.index,
  })),
});
// Example: Yes/No question
export const yesNoQuestion = (
  questionnaireId: string,
): CreateQuestionDto =>
  createQuestionWithEmbeddedOptions(
    questionnaireId,
    5,
    'Do you have any chronic conditions?',
    [
      { key: 'yes', label: 'Yes', value: 'yes', index: 0 },
      { key: 'no', label: 'No', value: 'no', index: 1 },
    ],
  );

// Example: Frequency question
export const frequencyQuestion = (
  questionnaireId: string,
): CreateQuestionDto =>
  createQuestionWithEmbeddedOptions(
    questionnaireId,
    6,
    'How often do you exercise?',
    [
      { key: 'daily', label: 'Daily', value: 'daily', index: 0 },
      { key: 'weekly', label: 'Weekly', value: 'weekly', index: 1 },
      { key: 'monthly', label: 'Monthly', value: 'monthly', index: 2 },
      { key: 'rarely', label: 'Rarely', value: 'rarely', index: 3 },
    ],
  );

  
/**
 * QUESTIONS WITH OPTION LISTS
 */

export const createQuestionWithOptionList = (
  questionnaireId: string,
  optionListId: string,
  index: number,
  text?: string,
  tags?: string[],
): CreateQuestionDto => ({
  questionnaireId,
  text: text || `Question ${index}: Select an option`,
  tags: tags || ['demographics'],
  questionType: QuestionType.SINGLE_CHOICE,
  renderMode: RenderMode.DROPDOWN,
  processMode: ProcessMode.NONE,
  index,
  isRequired: true,
  isActive: true,
  optionListId,
});
