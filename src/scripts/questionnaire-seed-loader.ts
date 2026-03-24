import { createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

type SeedOption = {
  referenceCode: string;
  key: string;
  value: string;
  label: string;
  index: number;
  jumpToQuestionReferenceCode?: string;
  backToQuestionReferenceCode?: string;
  childQuestionnaireReferenceCode?: string;
  metadata?: Record<string, any>;
};

type SeedQuestion = {
  referenceCode: string;
  attribute?: string;
  text: string;
  description?: string;
  questionType: string;
  renderMode: string;
  processMode: string;
  index: number;
  isRequired?: boolean;
  isActive?: boolean;
  hasLink?: boolean;
  tags?: string[];
  previousQuestionReferenceCode?: string;
  nextQuestionReferenceCode?: string;
  childQuestionnaireReferenceCode?: string;
  aiConfig?: Record<string, any>;
  optionSource?: Record<string, any>;
  apiNavigation?: Record<string, any>;
  validationRules?: Record<string, any>[];
  metadata?: Record<string, any>;
  options?: SeedOption[];
};

type SeedQuestionnaire = {
  referenceCode: string;
  isDynamic: boolean;
  version: number;
  allowBackNavigation: boolean;
  allowMultipleSessions: boolean;
  processingStrategy: string;
  isActive: boolean;
  name: string;
  code: string;
  description?: string;
  introduction?: string;
  conclusion?: string;
  endPhrase?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  workflowId?: string;
  workflowCode?: string;
  startQuestionReferenceCode?: string;
  questions?: SeedQuestion[];
};

type FlatQuestionnaireRow = {
  referenceCode: string;
  name: string;
  code: string;
  description?: string;
  introduction?: string;
  conclusion?: string;
  endPhrase?: string;
  isDynamic?: string;
  version?: string;
  allowBackNavigation?: string;
  allowMultipleSessions?: string;
  processingStrategy?: string;
  isActive?: string;
  tags?: string;
  workflowId?: string;
  workflowCode?: string;
  startQuestionReferenceCode?: string;
  metadata?: string;
};

type FlatQuestionRow = {
  referenceCode: string;
  questionnaireReferenceCode: string;
  attribute?: string;
  text: string;
  description?: string;
  questionType: string;
  renderMode: string;
  processMode: string;
  index?: string;
  isRequired?: string;
  isActive?: string;
  hasLink?: string;
  tags?: string;
  previousQuestionReferenceCode?: string;
  nextQuestionReferenceCode?: string;
  childQuestionnaireReferenceCode?: string;
  aiConfig?: string;
  optionSource?: string;
  apiNavigation?: string;
  validationRules?: string;
  metadata?: string;
};

type FlatOptionRow = {
  referenceCode: string;
  questionReferenceCode: string;
  key: string;
  value: string;
  label: string;
  index?: string;
  jumpToQuestionReferenceCode?: string;
  backToQuestionReferenceCode?: string;
  childQuestionnaireReferenceCode?: string;
  metadata?: string;
};

type WorkbookRows = {
  questionnaires: FlatQuestionnaireRow[];
  questions: FlatQuestionRow[];
  options: FlatOptionRow[];
};

type LegacySeedOption = {
  key: string;
  value: string;
  label: string;
  index: number;
  jumpToQuestionId?: string;
  backToQuestionId?: string;
  childQuestionnaireId?: string;
  metadata?: Record<string, any>;
};

type LegacySeedQuestion = {
  attribute?: string;
  text: string;
  description?: string;
  questionType: string;
  renderMode: string;
  processMode: string;
  index: number;
  isRequired?: boolean;
  isActive?: boolean;
  hasLink?: boolean;
  tags?: string[];
  childQuestionnaireId?: string;
  aiConfig?: Record<string, any>;
  optionSource?: Record<string, any>;
  apiNavigation?: Record<string, any>;
  validationRules?: Record<string, any>[];
  metadata?: Record<string, any>;
  options?: LegacySeedOption[];
};

type LegacySeedQuestionnaire = {
  isDynamic: boolean;
  version: number;
  allowBackNavigation: boolean;
  allowMultipleSessions: boolean;
  processingStrategy: string;
  isActive: boolean;
  name: string;
  code: string;
  description?: string;
  introduction?: string;
  conclusion?: string;
  endPhrase?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  workflowId?: string;
  workflowCode?: string;
  questions?: LegacySeedQuestion[];
};

const CSV_FILE_NAMES = {
  questionnaires: 'questionnaires.csv',
  questions: 'questions.csv',
  options: 'options.csv',
} as const;

const GOOGLE_SHEETS_SCOPE =
  'https://www.googleapis.com/auth/spreadsheets.readonly';
const GOOGLE_SHEETS_MAX_RETRIES = 4;
const GOOGLE_SHEETS_BASE_DELAY_MS = 1000;
const GOOGLE_SHEETS_TAB_FETCH_CONCURRENCY = 3;

type SeedSource = 'auto' | 'google' | 'csv' | 'json';

export async function loadQuestionnaireSeeds(
  processRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<SeedQuestionnaire[]> {
  const source = (env.QUESTIONNAIRE_SEED_SOURCE || 'auto').toLowerCase() as SeedSource;

  if (source === 'google') {
    return normalizeWorkbookRows(await fetchSeedWorkbookFromGoogleSheets(env));
  }

  if (source === 'csv') {
    return normalizeWorkbookRows(await readWorkbookRowsFromCsv(processRoot));
  }

  if (source === 'json') {
    return readLegacySeedFile(processRoot);
  }
 
  if (hasGoogleSheetsConfig(env)) {
    return normalizeWorkbookRows(await fetchSeedWorkbookFromGoogleSheets(env));
  }

  const csvRows = await tryReadWorkbookRowsFromCsv(processRoot);
  if (csvRows) {
    return normalizeWorkbookRows(csvRows);
  }

  return readLegacySeedFile(processRoot);
}

export async function fetchSeedWorkbookFromGoogleSheets(
  env: NodeJS.ProcessEnv = process.env,
): Promise<WorkbookRows> {
  const spreadsheetId = env.QUESTIONNAIRE_GOOGLE_SHEET_ID;
  const clientEmail = env.QUESTIONNAIRE_GOOGLE_CLIENT_EMAIL;
  const privateKey = env.QUESTIONNAIRE_GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!spreadsheetId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Google Sheets configuration. Expected QUESTIONNAIRE_GOOGLE_SHEET_ID, QUESTIONNAIRE_GOOGLE_CLIENT_EMAIL, and QUESTIONNAIRE_GOOGLE_PRIVATE_KEY.',
    );
  } 
 
  const accessToken = await getGoogleAccessToken({ clientEmail, privateKey });
  const availableSheetNames = await fetchSpreadsheetSheetNames(
    spreadsheetId,
    accessToken,
  );

  const [questionnaires, sharedQuestions, sharedOptions] = await Promise.all([
    fetchSheetRows<FlatQuestionnaireRow>(
      spreadsheetId,
      'questionnaires',
      accessToken,
    ),
    fetchSheetRows<FlatQuestionRow>(spreadsheetId, 'questions', accessToken),
    fetchSheetRows<FlatOptionRow>(spreadsheetId, 'options', accessToken),
  ]);

  const questions = await fetchQuestionSpecificQuestionSheets(
    spreadsheetId,
    questionnaires,
    sharedQuestions,
    accessToken,
    availableSheetNames,
  );

  const questionSpecificOptions = await fetchQuestionSpecificOptionSheets(
    spreadsheetId,
    questions,
    sharedOptions,
    accessToken,
    availableSheetNames,
  );

  return { questionnaires, questions, options: questionSpecificOptions };
}

async function fetchQuestionSpecificQuestionSheets(
  spreadsheetId: string,
  questionnaires: FlatQuestionnaireRow[],
  sharedQuestions: FlatQuestionRow[],
  accessToken: string,
  availableSheetNames: Set<string>,
): Promise<FlatQuestionRow[]> {
  const questionsByQuestionnaireReference = new Map<string, FlatQuestionRow[]>();

  for (const question of sharedQuestions) {
    const questionnaireReferenceCode = question.questionnaireReferenceCode?.trim();
    if (!questionnaireReferenceCode) {
      continue;
    }

    const existing =
      questionsByQuestionnaireReference.get(questionnaireReferenceCode) || [];
    existing.push(question);
    questionsByQuestionnaireReference.set(questionnaireReferenceCode, existing);
  }

  const questionRows = await mapWithConcurrency(
    questionnaires,
    GOOGLE_SHEETS_TAB_FETCH_CONCURRENCY,
    async (questionnaire) => {
      const questionnaireReferenceCode = questionnaire.referenceCode?.trim();
      if (!questionnaireReferenceCode) {
        return [] as FlatQuestionRow[];
      }

      if (!availableSheetNames.has(questionnaireReferenceCode)) {
        return questionsByQuestionnaireReference.get(questionnaireReferenceCode) || [];
      }

      const dedicatedSheetRows = await tryFetchSheetRows<FlatQuestionRow>(
        spreadsheetId,
        questionnaireReferenceCode,
        accessToken,
      );

      if (dedicatedSheetRows && dedicatedSheetRows.length > 0) {
        return dedicatedSheetRows.map((row) => ({
          ...row,
          questionnaireReferenceCode:
            row.questionnaireReferenceCode?.trim() || questionnaireReferenceCode,
        }));
      }

      return questionsByQuestionnaireReference.get(questionnaireReferenceCode) || [];
    },
  );

  return questionRows.flat();
}

async function fetchQuestionSpecificOptionSheets(
  spreadsheetId: string,
  questions: FlatQuestionRow[],
  sharedOptions: FlatOptionRow[],
  accessToken: string,
  availableSheetNames: Set<string>,
): Promise<FlatOptionRow[]> {
  const optionsByQuestionReference = new Map<string, FlatOptionRow[]>();

  for (const option of sharedOptions) {
    const questionReferenceCode = option.questionReferenceCode?.trim();
    if (!questionReferenceCode) {
      continue;
    }

    const existing = optionsByQuestionReference.get(questionReferenceCode) || [];
    existing.push(option);
    optionsByQuestionReference.set(questionReferenceCode, existing);
  }

  const questionSpecificRows = await mapWithConcurrency(
    questions,
    GOOGLE_SHEETS_TAB_FETCH_CONCURRENCY,
    async (question) => {
      const questionReferenceCode = question.referenceCode?.trim();
      if (!questionReferenceCode) {
        return [] as FlatOptionRow[];
      }

      if (!availableSheetNames.has(questionReferenceCode)) {
        return optionsByQuestionReference.get(questionReferenceCode) || [];
      }

      const dedicatedSheetRows = await tryFetchSheetRows<FlatOptionRow>(
        spreadsheetId,
        questionReferenceCode,
        accessToken,
      );

      if (dedicatedSheetRows && dedicatedSheetRows.length > 0) {
        return dedicatedSheetRows.map((row) => ({
          ...row,
          questionReferenceCode:
            row.questionReferenceCode?.trim() || questionReferenceCode,
        }));
      }

      return optionsByQuestionReference.get(questionReferenceCode) || [];
    },
  );

  return questionSpecificRows.flat();
}

async function tryReadWorkbookRowsFromCsv(
  processRoot: string,
): Promise<WorkbookRows | null> {
  try {
    return await readWorkbookRowsFromCsv(processRoot);
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function readWorkbookRowsFromCsv(processRoot: string): Promise<WorkbookRows> {
  const [questionnairesRaw, questionsRaw, optionsRaw] = await Promise.all([
    readFile(join(processRoot, CSV_FILE_NAMES.questionnaires), 'utf-8'),
    readFile(join(processRoot, CSV_FILE_NAMES.questions), 'utf-8'),
    readFile(join(processRoot, CSV_FILE_NAMES.options), 'utf-8'),
  ]);

  return {
    questionnaires: parseCsv(questionnairesRaw) as FlatQuestionnaireRow[],
    questions: parseCsv(questionsRaw) as FlatQuestionRow[],
    options: parseCsv(optionsRaw) as FlatOptionRow[],
  };
}

async function readLegacySeedFile(processRoot: string): Promise<SeedQuestionnaire[]> {
  const candidates = ['seedquestionnaire.txt', 'seedquestionnaire.ai'];

  for (const fileName of candidates) {
    const fullPath = join(processRoot, fileName);
    try {
      const raw = await readFile(fullPath, 'utf-8');
      return normalizeLegacySeed(JSON.parse(raw) as LegacySeedQuestionnaire[]);
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return [];
}

function normalizeWorkbookRows(rows: WorkbookRows): SeedQuestionnaire[] {
  const optionsByQuestionReference = new Map<string, SeedOption[]>();
  for (const row of rows.options) {
    if (!row.referenceCode || !row.questionReferenceCode || !row.key) {
      continue;
    }

    const option: SeedOption = {
      referenceCode: row.referenceCode.trim(),
      key: row.key.trim(),
      value: valueOrFallback(row.value, row.label, row.key),
      label: valueOrFallback(row.label, row.value, row.key),
      index: parseNumber(row.index, 0),
      jumpToQuestionReferenceCode: normalizeOptionalString(
        row.jumpToQuestionReferenceCode,
      ),
      backToQuestionReferenceCode: normalizeOptionalString(
        row.backToQuestionReferenceCode,
      ),
      childQuestionnaireReferenceCode: normalizeOptionalString(
        row.childQuestionnaireReferenceCode,
      ),
      metadata: parseJsonObject(row.metadata),
    };

    const existing =
      optionsByQuestionReference.get(row.questionReferenceCode.trim()) || [];
    existing.push(option);
    optionsByQuestionReference.set(row.questionReferenceCode.trim(), existing);
  }

  const questionsByQuestionnaireReference = new Map<string, SeedQuestion[]>();
  for (const row of rows.questions) {
    if (!row.referenceCode || !row.questionnaireReferenceCode || !row.text) {
      continue;
    }

    const referenceCode = row.referenceCode.trim();
    const question: SeedQuestion = {
      referenceCode,
      attribute: normalizeOptionalString(row.attribute),
      text: row.text.trim(),
      description: normalizeOptionalString(row.description),
      questionType: row.questionType?.trim() || 'text',
      renderMode: row.renderMode?.trim() || 'input',
      processMode: row.processMode?.trim() || 'none',
      index: parseNumber(row.index, 0),
      isRequired: parseBoolean(row.isRequired, false),
      isActive: parseBoolean(row.isActive, true),
      hasLink: parseBoolean(row.hasLink, false),
      tags: parseStringArray(row.tags),
      previousQuestionReferenceCode: normalizeOptionalString(
        row.previousQuestionReferenceCode,
      ),
      nextQuestionReferenceCode: normalizeOptionalString(
        row.nextQuestionReferenceCode,
      ),
      childQuestionnaireReferenceCode: normalizeOptionalString(
        row.childQuestionnaireReferenceCode,
      ),
      aiConfig: parseJsonObject(row.aiConfig),
      optionSource: parseJsonObject(row.optionSource),
      apiNavigation: parseJsonObject(row.apiNavigation),
      validationRules: parseValidationArray(row.validationRules),
      metadata: parseJsonObject(row.metadata),
      options: (optionsByQuestionReference.get(referenceCode) || []).sort(
        (left, right) => left.index - right.index,
      ),
    };

    const existing =
      questionsByQuestionnaireReference.get(row.questionnaireReferenceCode.trim()) ||
      [];
    existing.push(question);
    questionsByQuestionnaireReference.set(
      row.questionnaireReferenceCode.trim(),
      existing,
    );
  }

  return rows.questionnaires
    .filter((row) => row.referenceCode && row.code && row.name)
    .map((row) => {
      const referenceCode = row.referenceCode.trim();
      const questions = (
        questionsByQuestionnaireReference.get(referenceCode) || []
      ).sort((left, right) => left.index - right.index);

      return {
        referenceCode,
        name: row.name.trim(),
        code: row.code.trim(),
        description: normalizeOptionalString(row.description),
        introduction: normalizeOptionalString(row.introduction),
        conclusion: normalizeOptionalString(row.conclusion),
        endPhrase: normalizeOptionalString(row.endPhrase) || 'STOP',
        isDynamic: parseBoolean(row.isDynamic, false),
        version: parseNumber(row.version, 1),
        allowBackNavigation: parseBoolean(row.allowBackNavigation, true),
        allowMultipleSessions: parseBoolean(row.allowMultipleSessions, false),
        processingStrategy: row.processingStrategy?.trim() || 'STATIC',
        isActive: parseBoolean(row.isActive, true),
        tags: parseStringArray(row.tags),
        workflowId: normalizeOptionalString(row.workflowId),
        workflowCode: normalizeOptionalString(row.workflowCode),
        startQuestionReferenceCode:
          normalizeOptionalString(row.startQuestionReferenceCode) ||
          questions[0]?.referenceCode,
        metadata: parseJsonObject(row.metadata),
        questions,
      };
    });
}

function normalizeLegacySeed(
  data: LegacySeedQuestionnaire[],
): SeedQuestionnaire[] {
  return data.map((item) => {
    const sortedQuestions = [...(item.questions || [])].sort(
      (left, right) => left.index - right.index,
    );

    const questions: SeedQuestion[] = sortedQuestions.map(
      (question, questionIndex) => {
        const attribute = question.attribute || buildAttribute(question.text);
        const referenceCode = `${item.code}__${attribute}`;
        const previousQuestion = sortedQuestions[questionIndex - 1];
        const nextQuestion = sortedQuestions[questionIndex + 1];

        return {
          referenceCode,
          attribute,
          text: question.text,
          description: question.description,
          questionType: question.questionType,
          renderMode: question.renderMode,
          processMode: question.processMode,
          index: question.index,
          isRequired: question.isRequired ?? false,
          isActive: question.isActive ?? true,
          hasLink: question.hasLink ?? false,
          tags: question.tags || [],
          previousQuestionReferenceCode: previousQuestion
            ? `${item.code}__${
                previousQuestion.attribute || buildAttribute(previousQuestion.text)
              }`
            : undefined,
          nextQuestionReferenceCode: nextQuestion
            ? `${item.code}__${
                nextQuestion.attribute || buildAttribute(nextQuestion.text)
              }`
            : undefined,
          childQuestionnaireReferenceCode: question.childQuestionnaireId,
          aiConfig: question.aiConfig,
          optionSource: question.optionSource,
          apiNavigation: question.apiNavigation,
          validationRules: question.validationRules || [],
          metadata: question.metadata,
          options: (question.options || [])
            .map((option) => ({
              referenceCode: `${referenceCode}__${option.key}`,
              key: option.key,
              value: option.value,
              label: option.label,
              index: option.index,
              jumpToQuestionReferenceCode: option.jumpToQuestionId,
              backToQuestionReferenceCode: option.backToQuestionId,
              childQuestionnaireReferenceCode: option.childQuestionnaireId,
              metadata: option.metadata,
            }))
            .sort((left, right) => left.index - right.index),
        };
      },
    );

    return {
      referenceCode: item.code,
      isDynamic: item.isDynamic,
      version: item.version,
      allowBackNavigation: item.allowBackNavigation,
      allowMultipleSessions: item.allowMultipleSessions,
      processingStrategy: item.processingStrategy,
      isActive: item.isActive,
      name: item.name,
      code: item.code,
      description: item.description,
      introduction: item.introduction,
      conclusion: item.conclusion,
      endPhrase: item.endPhrase || 'STOP',
      tags: item.tags || [],
      metadata: item.metadata,
      workflowId: item.workflowId,
      workflowCode: item.workflowCode,
      startQuestionReferenceCode: questions[0]?.referenceCode,
      questions,
    };
  });
}

async function fetchSheetRows<T extends Record<string, string>>(
  spreadsheetId: string,
  sheetName: string,
  accessToken: string,
): Promise<T[]> {
  const range = encodeURIComponent(`${sheetName}!A:ZZ`);
  const response = await fetchWithRetry(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    sheetName,
  );

  const payload = (await response.json()) as { values?: string[][] };
  const [headerRow = [], ...rows] = payload.values || [];
  const headers = headerRow.map((header) => header.trim());

  return rows
    .filter((row) => row.some((cell) => (cell || '').trim() !== ''))
    .map((row) => {
      const record: Record<string, string> = {};
      for (let index = 0; index < headers.length; index += 1) {
        const header = headers[index];
        if (!header) {
          continue;
        }
        record[header] = row[index] || '';
      }
      return record as T;
    });
}

async function fetchSpreadsheetSheetNames(
  spreadsheetId: string,
  accessToken: string,
): Promise<Set<string>> {
  const response = await fetchWithRetry(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    '__spreadsheet_metadata__',
  );

  const payload = (await response.json()) as {
    sheets?: Array<{ properties?: { title?: string } }>;
  };

  return new Set(
    (payload.sheets || [])
      .map((sheet) => sheet.properties?.title?.trim())
      .filter((title): title is string => Boolean(title)),
  );
}

async function tryFetchSheetRows<T extends Record<string, string>>(
  spreadsheetId: string,
  sheetName: string,
  accessToken: string,
): Promise<T[] | null> {
  try {
    return await fetchSheetRows<T>(spreadsheetId, sheetName, accessToken);
  } catch (error: any) {
    const message = String(error?.message || '');
    if (
      message.includes(`Google Sheet tab ${sheetName}`) &&
      message.includes('400')
    ) {
      return null;
    }

    throw error;
  }
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  sheetName: string,
): Promise<Response> {
  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt <= GOOGLE_SHEETS_MAX_RETRIES; attempt += 1) {
    const response = await fetch(url, init);
    if (response.ok) {
      return response;
    }

    lastResponse = response;
    if (!shouldRetryGoogleSheetsRequest(response.status) || attempt === GOOGLE_SHEETS_MAX_RETRIES) {
      throw new Error(
        `Failed to read Google Sheet tab ${sheetName}: ${response.status} ${response.statusText}`,
      );
    }

    const retryAfter = getRetryDelayMs(response, attempt);
    console.warn(
      `Google Sheets read for ${sheetName} was rate limited (${response.status}). Retrying in ${retryAfter}ms...`,
    );
    await delay(retryAfter);
  }

  throw new Error(
    `Failed to read Google Sheet tab ${sheetName}: ${lastResponse?.status} ${lastResponse?.statusText}`,
  );
}

function shouldRetryGoogleSheetsRequest(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function getRetryDelayMs(response: Response, attempt: number): number {
  const retryAfterHeader = response.headers.get('retry-after');
  if (retryAfterHeader) {
    const retryAfterSeconds = Number(retryAfterHeader);
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
      return retryAfterSeconds * 1000;
    }
  }

  return GOOGLE_SHEETS_BASE_DELAY_MS * 2 ** attempt;
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  mapper: (item: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<TOutput>(items.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    },
  );

  await Promise.all(workers);
  return results;
}

async function getGoogleAccessToken(credentials: {
  clientEmail: string;
  privateKey: string;
}): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 3600;

  const assertion = createSignedJwt(
    {
      alg: 'RS256',
      typ: 'JWT',
    },
    {
      iss: credentials.clientEmail,
      scope: GOOGLE_SHEETS_SCOPE,
      aud: 'https://oauth2.googleapis.com/token',
      exp: expiresAt,
      iat: issuedAt,
    },
    credentials.privateKey,
  );

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to obtain Google access token: ${response.status} ${response.statusText}`,
    );
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error('Google access token response did not include access_token.');
  }

  return payload.access_token;
}

function createSignedJwt(
  header: Record<string, any>,
  payload: Record<string, any>,
  privateKey: string,
): string {
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const signer = createSign('RSA-SHA256');
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign(privateKey);

  return `${unsignedToken}.${base64UrlEncode(signature)}`;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function hasGoogleSheetsConfig(env: NodeJS.ProcessEnv): boolean {
  return Boolean(
    env.QUESTIONNAIRE_GOOGLE_SHEET_ID &&
      env.QUESTIONNAIRE_GOOGLE_CLIENT_EMAIL &&
      env.QUESTIONNAIRE_GOOGLE_PRIVATE_KEY,
  );
}

function parseCsv(input: string): Record<string, string>[] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const nextChar = input[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      currentRow.push(currentValue);
      if (currentRow.some((value) => value.trim() !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentValue = '';
      continue;
    }

    currentValue += char;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue);
    if (currentRow.some((value) => value.trim() !== '')) {
      rows.push(currentRow);
    }
  }

  const [headers = [], ...dataRows] = rows;
  return dataRows.map((row) => {
    const record: Record<string, string> = {};
    for (let index = 0; index < headers.length; index += 1) {
      record[headers[index]?.trim()] = row[index] || '';
    }
    return record;
  });
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === '') {
    return fallback;
  }

  return ['true', '1', 'yes', 'y'].includes(value.trim().toLowerCase());
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (value == null || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseStringArray(value: string | undefined): string[] {
  if (!value || value.trim() === '') {
    return [];
  }

  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed)
        ? parsed.map((item) => String(item).trim()).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  }

  return trimmed
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonObject(value: string | undefined): Record<string, any> | undefined {
  if (!value || value.trim() === '') {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, any>;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function parseValidationArray(value: string | undefined): Record<string, any>[] {
  if (!value || value.trim() === '') {
    return [];
  }

  // // Try JSON first
  // try {
  //   const parsed = JSON.parse(value);
  //   if (Array.isArray(parsed)) return parsed;
  // } catch (e) {
  //   // fallback to custom parsing
  // }

  // Support comma-separated rules: "type:value:message,type2:value2:message2"
  const validations = value.split(',').map((rule) => {
    const [type, val, message] = rule.split(':');
 
    return {
      type: type?.trim(),
      value: val !== undefined ? val.trim() : null,
      message: message !== undefined ? message.trim() : null,
    };
  });  
  return validations;
}

function normalizeOptionalString(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function valueOrFallback(...values: Array<string | undefined>): string {
  for (const value of values) {
    const normalized = normalizeOptionalString(value);
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

function buildAttribute(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export type { SeedQuestionnaire, SeedQuestion, SeedOption };
