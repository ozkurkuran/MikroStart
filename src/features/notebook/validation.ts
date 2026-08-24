import {
  NOTEBOOK_EXPORT_FORMAT,
  NOTEBOOK_EXPORT_SCHEMA_VERSION,
  type ImportConflict,
  type ImportIssue,
  type JsonValue,
  type NotebookExportConflictIndex,
  type NotebookExportEnvelope,
  type NotebookImportPreview,
  type NoteRecord,
  type NoteType,
  type PersonName,
  type ReferenceRecord,
  type ReferenceType,
  type SavedCalculationRecord,
  type SourceItemLink,
  type SourceSnapshot,
} from "./types";

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
const MAX_ISSUES = 200;
const MAX_RECORDS_PER_COLLECTION = 50_000;
const MAX_JSON_DEPTH = 20;
const NOTE_TYPES = new Set<NoteType>([
  "free",
  "literature",
  "experiment",
  "sample",
  "calculation",
  "funding",
]);
const REFERENCE_TYPES = new Set<ReferenceType>([
  "article",
  "preprint",
  "announcement",
  "dataset",
  "web-page",
]);
const SENSITIVE_KEY = /^(?:api[-_]?key|secret|password|access[-_]?token|refresh[-_]?token|authorization)$/i;
const DANGEROUS_KEY = /^(?:__proto__|prototype|constructor)$/;

type UnknownRecord = Record<string, unknown>;

interface ValidationContext {
  issues: ImportIssue[];
  conflicts: ImportConflict[];
}

export class NotebookImportValidationError extends Error {
  public readonly preview: NotebookImportPreview;

  public constructor(preview: NotebookImportPreview) {
    super("Notebook import failed validation");
    this.name = "NotebookImportValidationError";
    this.preview = preview;
  }
}

function addIssue(
  context: ValidationContext,
  severity: ImportIssue["severity"],
  path: string,
  message: string,
): void {
  if (context.issues.length < MAX_ISSUES) {
    context.issues.push({ severity, path, message });
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordAt(
  value: unknown,
  path: string,
  context: ValidationContext,
): UnknownRecord | undefined {
  if (!isRecord(value)) {
    addIssue(context, "error", path, "Expected an object");
    return undefined;
  }
  return value;
}

function allowedKeys(
  record: UnknownRecord,
  allowed: readonly string[],
  path: string,
  context: ValidationContext,
): void {
  const allowList = new Set(allowed);
  for (const key of Object.keys(record)) {
    if (!allowList.has(key)) {
      addIssue(context, "error", `${path}.${key}`, "Unknown field");
    }
  }
}

function stringAt(
  record: UnknownRecord,
  key: string,
  path: string,
  context: ValidationContext,
  options: { required?: boolean; allowEmpty?: boolean; maxLength?: number } = {},
): string | undefined {
  const value = record[key];
  if (value === undefined) {
    if (options.required) {
      addIssue(context, "error", `${path}.${key}`, "Required field is missing");
    }
    return undefined;
  }
  if (typeof value !== "string") {
    addIssue(context, "error", `${path}.${key}`, "Expected a string");
    return undefined;
  }
  if (options.required && !options.allowEmpty && value.trim().length === 0) {
    addIssue(context, "error", `${path}.${key}`, "Must not be empty");
  }
  if (value.length > (options.maxLength ?? 10_000)) {
    addIssue(context, "error", `${path}.${key}`, "String is too long");
    return undefined;
  }
  return value;
}

function numberAt(
  record: UnknownRecord,
  key: string,
  path: string,
  context: ValidationContext,
): number | undefined {
  const value = record[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    addIssue(context, "error", `${path}.${key}`, "Expected a safe integer");
    return undefined;
  }
  return value;
}

function isoDateAt(
  record: UnknownRecord,
  key: string,
  path: string,
  context: ValidationContext,
  required = false,
): string | undefined {
  const value = stringAt(record, key, path, context, {
    required,
    maxLength: 64,
  });
  if (value !== undefined && !Number.isFinite(Date.parse(value))) {
    addIssue(context, "error", `${path}.${key}`, "Expected an ISO date-time");
    return undefined;
  }
  return value;
}

function httpsUrlAt(
  record: UnknownRecord,
  key: string,
  path: string,
  context: ValidationContext,
): string | undefined {
  const value = stringAt(record, key, path, context, {
    required: true,
    maxLength: 4_096,
  });
  if (value === undefined) {
    return undefined;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) {
      throw new Error("Unsafe URL");
    }
  } catch {
    addIssue(
      context,
      "error",
      `${path}.${key}`,
      "Expected an HTTPS URL without embedded credentials",
    );
    return undefined;
  }
  return value;
}

function stringArrayAt(
  record: UnknownRecord,
  key: string,
  path: string,
  context: ValidationContext,
  maxItems = 10_000,
): string[] | undefined {
  const value = record[key];
  if (!Array.isArray(value)) {
    addIssue(context, "error", `${path}.${key}`, "Expected an array");
    return undefined;
  }
  if (value.length > maxItems) {
    addIssue(context, "error", `${path}.${key}`, "Array has too many items");
    return undefined;
  }
  const result: string[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (typeof item !== "string" || item.length === 0 || item.length > 512) {
      addIssue(
        context,
        "error",
        `${path}.${key}[${index}]`,
        "Expected a non-empty string of at most 512 characters",
      );
      continue;
    }
    if (seen.has(item)) {
      addIssue(
        context,
        "warning",
        `${path}.${key}[${index}]`,
        "Duplicate value was removed",
      );
      continue;
    }
    seen.add(item);
    result.push(item);
  }
  return result;
}

function validatePerson(
  value: unknown,
  path: string,
  context: ValidationContext,
): PersonName | undefined {
  const record = recordAt(value, path, context);
  if (!record) return undefined;
  allowedKeys(record, ["given", "family", "literal"], path, context);
  const given = stringAt(record, "given", path, context, { maxLength: 512 });
  const family = stringAt(record, "family", path, context, { maxLength: 512 });
  const literal = stringAt(record, "literal", path, context, {
    maxLength: 1_024,
  });
  if (!given && !family && !literal) {
    addIssue(context, "error", path, "A person name must not be empty");
  }
  return {
    ...(given ? { given } : {}),
    ...(family ? { family } : {}),
    ...(literal ? { literal } : {}),
  };
}

function validatePeople(
  value: unknown,
  path: string,
  context: ValidationContext,
): PersonName[] | undefined {
  if (!Array.isArray(value) || value.length > 1_000) {
    addIssue(context, "error", path, "Expected an author array of at most 1,000 items");
    return undefined;
  }
  const result: PersonName[] = [];
  value.forEach((person, index) => {
    const validated = validatePerson(person, `${path}[${index}]`, context);
    if (validated) result.push(validated);
  });
  return result;
}

function validateSourceSnapshot(
  value: unknown,
  path: string,
  context: ValidationContext,
): SourceSnapshot | undefined {
  const record = recordAt(value, path, context);
  if (!record) return undefined;
  allowedKeys(
    record,
    [
      "sourceId",
      "connectorId",
      "sourceItemId",
      "title",
      "canonicalUrl",
      "retrievedAt",
      "contentHash",
    ],
    path,
    context,
  );
  const sourceId = stringAt(record, "sourceId", path, context, {
    required: true,
    maxLength: 512,
  });
  const connectorId = stringAt(record, "connectorId", path, context, {
    maxLength: 512,
  });
  const sourceItemId = stringAt(record, "sourceItemId", path, context, {
    maxLength: 512,
  });
  const title = stringAt(record, "title", path, context, {
    required: true,
    maxLength: 4_096,
  });
  const canonicalUrl = httpsUrlAt(record, "canonicalUrl", path, context);
  const retrievedAt = isoDateAt(record, "retrievedAt", path, context, true);
  const contentHash = stringAt(record, "contentHash", path, context, {
    maxLength: 512,
  });
  if (!sourceId || !title || !canonicalUrl || !retrievedAt) return undefined;
  return {
    sourceId,
    ...(connectorId ? { connectorId } : {}),
    ...(sourceItemId ? { sourceItemId } : {}),
    title,
    canonicalUrl,
    retrievedAt,
    ...(contentHash ? { contentHash } : {}),
  };
}

function validateNote(
  value: unknown,
  path: string,
  context: ValidationContext,
): NoteRecord | undefined {
  const record = recordAt(value, path, context);
  if (!record) return undefined;
  allowedKeys(
    record,
    [
      "id",
      "version",
      "type",
      "title",
      "markdown",
      "createdAt",
      "updatedAt",
      "tags",
      "referenceIds",
      "calculationRecordIds",
      "sourceItemIds",
    ],
    path,
    context,
  );
  const id = stringAt(record, "id", path, context, {
    required: true,
    maxLength: 512,
  });
  const version = numberAt(record, "version", path, context);
  const typeValue = stringAt(record, "type", path, context, {
    required: true,
    maxLength: 32,
  });
  const type = typeValue as NoteType | undefined;
  if (type && !NOTE_TYPES.has(type)) {
    addIssue(context, "error", `${path}.type`, "Unknown note type");
  }
  const title = stringAt(record, "title", path, context, {
    required: true,
    maxLength: 4_096,
  });
  const markdown = stringAt(record, "markdown", path, context, {
    required: true,
    allowEmpty: true,
    maxLength: 2_000_000,
  });
  const createdAt = isoDateAt(record, "createdAt", path, context, true);
  const updatedAt = isoDateAt(record, "updatedAt", path, context, true);
  const tags = stringArrayAt(record, "tags", path, context, 1_000);
  const referenceIds = stringArrayAt(record, "referenceIds", path, context);
  const calculationRecordIds = stringArrayAt(
    record,
    "calculationRecordIds",
    path,
    context,
  );
  const sourceItemIds = stringArrayAt(record, "sourceItemIds", path, context);
  if (
    !id ||
    !version ||
    version < 1 ||
    !type ||
    !NOTE_TYPES.has(type) ||
    !title ||
    markdown === undefined ||
    !createdAt ||
    !updatedAt ||
    !tags ||
    !referenceIds ||
    !calculationRecordIds ||
    !sourceItemIds
  ) {
    return undefined;
  }
  return {
    id,
    version,
    type,
    title,
    markdown,
    createdAt,
    updatedAt,
    tags,
    referenceIds,
    calculationRecordIds,
    sourceItemIds,
  };
}

function validateReference(
  value: unknown,
  path: string,
  context: ValidationContext,
): ReferenceRecord | undefined {
  const record = recordAt(value, path, context);
  if (!record) return undefined;
  allowedKeys(
    record,
    [
      "id",
      "type",
      "title",
      "authors",
      "publisherOrInstitution",
      "publishedAt",
      "doi",
      "canonicalUrl",
      "retrievedAt",
      "sourceSnapshot",
    ],
    path,
    context,
  );
  const id = stringAt(record, "id", path, context, {
    required: true,
    maxLength: 512,
  });
  const typeValue = stringAt(record, "type", path, context, {
    required: true,
    maxLength: 32,
  });
  const type = typeValue as ReferenceType | undefined;
  if (type && !REFERENCE_TYPES.has(type)) {
    addIssue(context, "error", `${path}.type`, "Unknown reference type");
  }
  const title = stringAt(record, "title", path, context, {
    required: true,
    maxLength: 4_096,
  });
  const authors = validatePeople(record.authors, `${path}.authors`, context);
  const publisherOrInstitution = stringAt(
    record,
    "publisherOrInstitution",
    path,
    context,
    { maxLength: 2_048 },
  );
  const publishedAt = isoDateAt(record, "publishedAt", path, context);
  const doi = stringAt(record, "doi", path, context, { maxLength: 512 });
  const canonicalUrl = httpsUrlAt(record, "canonicalUrl", path, context);
  const retrievedAt = isoDateAt(record, "retrievedAt", path, context, true);
  const sourceSnapshot = validateSourceSnapshot(
    record.sourceSnapshot,
    `${path}.sourceSnapshot`,
    context,
  );
  if (
    !id ||
    !type ||
    !REFERENCE_TYPES.has(type) ||
    !title ||
    !authors ||
    !canonicalUrl ||
    !retrievedAt ||
    !sourceSnapshot
  ) {
    return undefined;
  }
  return {
    id,
    type,
    title,
    authors,
    ...(publisherOrInstitution ? { publisherOrInstitution } : {}),
    ...(publishedAt ? { publishedAt } : {}),
    ...(doi ? { doi } : {}),
    canonicalUrl,
    retrievedAt,
    sourceSnapshot,
  };
}

function validateJsonValue(
  value: unknown,
  path: string,
  context: ValidationContext,
  depth = 0,
): JsonValue | undefined {
  if (depth > MAX_JSON_DEPTH) {
    addIssue(context, "error", path, "JSON value is nested too deeply");
    return undefined;
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (Number.isFinite(value)) return value;
    addIssue(context, "error", path, "Numbers must be finite");
    return undefined;
  }
  if (Array.isArray(value)) {
    if (value.length > 100_000) {
      addIssue(context, "error", path, "JSON array has too many items");
      return undefined;
    }
    const result: JsonValue[] = [];
    value.forEach((item, index) => {
      const validated = validateJsonValue(
        item,
        `${path}[${index}]`,
        context,
        depth + 1,
      );
      if (validated !== undefined) result.push(validated);
    });
    return result;
  }
  if (isRecord(value)) {
    const keys = Object.keys(value);
    if (keys.length > 10_000) {
      addIssue(context, "error", path, "JSON object has too many fields");
      return undefined;
    }
    const result: Record<string, JsonValue> = Object.create(null) as Record<
      string,
      JsonValue
    >;
    for (const key of keys) {
      if (DANGEROUS_KEY.test(key)) {
        addIssue(context, "error", `${path}.${key}`, "Unsafe field name");
        continue;
      }
      if (SENSITIVE_KEY.test(key)) {
        addIssue(
          context,
          "error",
          `${path}.${key}`,
          "Sensitive fields cannot be imported or exported",
        );
        continue;
      }
      const validated = validateJsonValue(
        value[key],
        `${path}.${key}`,
        context,
        depth + 1,
      );
      if (validated !== undefined) result[key] = validated;
    }
    return result;
  }
  addIssue(context, "error", path, "Expected a JSON-compatible value");
  return undefined;
}

function validateCalculation(
  value: unknown,
  path: string,
  context: ValidationContext,
): SavedCalculationRecord | undefined {
  const record = recordAt(value, path, context);
  if (!record) return undefined;
  allowedKeys(
    record,
    [
      "id",
      "calculatorId",
      "calculatorVersion",
      "createdAt",
      "label",
      "input",
      "output",
    ],
    path,
    context,
  );
  const id = stringAt(record, "id", path, context, {
    required: true,
    maxLength: 512,
  });
  const calculatorId = stringAt(record, "calculatorId", path, context, {
    required: true,
    maxLength: 512,
  });
  const calculatorVersion = stringAt(
    record,
    "calculatorVersion",
    path,
    context,
    { required: true, maxLength: 128 },
  );
  const createdAt = isoDateAt(record, "createdAt", path, context, true);
  const label = stringAt(record, "label", path, context, {
    maxLength: 2_048,
  });
  const input = validateJsonValue(record.input, `${path}.input`, context);
  const output = validateJsonValue(record.output, `${path}.output`, context);
  if (!id || !calculatorId || !calculatorVersion || !createdAt || input === undefined || output === undefined) {
    return undefined;
  }
  return {
    id,
    calculatorId,
    calculatorVersion,
    createdAt,
    ...(label ? { label } : {}),
    input,
    output,
  };
}

function validateSourceLink(
  value: unknown,
  path: string,
  context: ValidationContext,
): SourceItemLink | undefined {
  const record = recordAt(value, path, context);
  if (!record) return undefined;
  allowedKeys(
    record,
    ["id", "noteId", "sourceItemId", "sourceId", "referenceId", "createdAt"],
    path,
    context,
  );
  const id = stringAt(record, "id", path, context, {
    required: true,
    maxLength: 2_048,
  });
  const noteId = stringAt(record, "noteId", path, context, {
    required: true,
    maxLength: 512,
  });
  const sourceItemId = stringAt(record, "sourceItemId", path, context, {
    required: true,
    maxLength: 512,
  });
  const sourceId = stringAt(record, "sourceId", path, context, {
    required: true,
    maxLength: 512,
  });
  const referenceId = stringAt(record, "referenceId", path, context, {
    required: true,
    maxLength: 512,
  });
  const createdAt = isoDateAt(record, "createdAt", path, context, true);
  if (!id || !noteId || !sourceItemId || !sourceId || !referenceId || !createdAt) {
    return undefined;
  }
  return { id, noteId, sourceItemId, sourceId, referenceId, createdAt };
}

function validateCollection<T>(
  value: unknown,
  path: string,
  context: ValidationContext,
  validator: (item: unknown, itemPath: string, context: ValidationContext) => T | undefined,
): T[] {
  if (!Array.isArray(value)) {
    addIssue(context, "error", path, "Expected an array");
    return [];
  }
  if (value.length > MAX_RECORDS_PER_COLLECTION) {
    addIssue(context, "error", path, "Collection has too many records");
    return [];
  }
  const result: T[] = [];
  value.forEach((item, index) => {
    const validated = validator(item, `${path}[${index}]`, context);
    if (validated) result.push(validated);
  });
  return result;
}

function collectConflicts<T extends { id: string }>(
  records: readonly T[],
  entity: ImportConflict["entity"],
  existingIds: ReadonlySet<string> | undefined,
  context: ValidationContext,
): void {
  const seen = new Set<string>();
  for (const record of records) {
    if (seen.has(record.id)) {
      context.conflicts.push({
        entity,
        id: record.id,
        reason: "duplicate-in-import",
      });
    } else {
      seen.add(record.id);
    }
    if (existingIds?.has(record.id)) {
      context.conflicts.push({
        entity,
        id: record.id,
        reason: "already-exists",
      });
    }
  }
}

/**
 * Parses a backup without mutating storage. Unknown fields are rejected and the
 * returned envelope is reconstructed from allow-listed fields only.
 */
export function previewNotebookImport(
  input: string | unknown,
  existing: NotebookExportConflictIndex = {},
): NotebookImportPreview {
  const context: ValidationContext = { issues: [], conflicts: [] };
  const emptyCounts = {
    notes: 0,
    references: 0,
    calculations: 0,
    sourceLinks: 0,
  };
  let parsed: unknown = input;

  if (typeof input === "string") {
    if (new TextEncoder().encode(input).byteLength > MAX_IMPORT_BYTES) {
      addIssue(context, "error", "$", "Import exceeds the 10 MiB size limit");
      return { valid: false, counts: emptyCounts, ...context };
    }
    try {
      parsed = JSON.parse(input) as unknown;
    } catch {
      addIssue(context, "error", "$", "Import is not valid JSON");
      return { valid: false, counts: emptyCounts, ...context };
    }
  }

  const envelopeRecord = recordAt(parsed, "$", context);
  if (!envelopeRecord) {
    return { valid: false, counts: emptyCounts, ...context };
  }
  allowedKeys(
    envelopeRecord,
    ["format", "schemaVersion", "exportedAt", "appVersion", "data"],
    "$",
    context,
  );
  const format = stringAt(envelopeRecord, "format", "$", context, {
    required: true,
    maxLength: 128,
  });
  if (format !== NOTEBOOK_EXPORT_FORMAT) {
    addIssue(context, "error", "$.format", "Unsupported notebook export format");
  }
  const schemaVersion = numberAt(envelopeRecord, "schemaVersion", "$", context);
  if (schemaVersion !== NOTEBOOK_EXPORT_SCHEMA_VERSION) {
    addIssue(
      context,
      "error",
      "$.schemaVersion",
      `Unsupported schema version; expected ${NOTEBOOK_EXPORT_SCHEMA_VERSION}`,
    );
  }
  const exportedAt = isoDateAt(envelopeRecord, "exportedAt", "$", context, true);
  const appVersion = stringAt(envelopeRecord, "appVersion", "$", context, {
    maxLength: 128,
  });
  const dataRecord = recordAt(envelopeRecord.data, "$.data", context);
  if (!dataRecord) {
    return {
      valid: false,
      schemaVersion,
      counts: emptyCounts,
      ...context,
    };
  }
  allowedKeys(
    dataRecord,
    ["notes", "references", "calculations", "sourceLinks"],
    "$.data",
    context,
  );

  const notes = validateCollection(
    dataRecord.notes,
    "$.data.notes",
    context,
    validateNote,
  );
  const references = validateCollection(
    dataRecord.references,
    "$.data.references",
    context,
    validateReference,
  );
  const calculations = validateCollection(
    dataRecord.calculations,
    "$.data.calculations",
    context,
    validateCalculation,
  );
  const sourceLinks = validateCollection(
    dataRecord.sourceLinks,
    "$.data.sourceLinks",
    context,
    validateSourceLink,
  );

  collectConflicts(notes, "note", existing.noteIds, context);
  collectConflicts(references, "reference", existing.referenceIds, context);
  collectConflicts(
    calculations,
    "calculation",
    existing.calculationIds,
    context,
  );
  collectConflicts(sourceLinks, "sourceLink", existing.sourceLinkIds, context);

  const noteIds = new Set(notes.map(({ id }) => id));
  const referenceIds = new Set(references.map(({ id }) => id));
  const calculationIds = new Set(calculations.map(({ id }) => id));
  for (const note of notes) {
    for (const referenceId of note.referenceIds) {
      if (!referenceIds.has(referenceId)) {
        addIssue(
          context,
          "error",
          `$.data.notes[id=${note.id}].referenceIds`,
          `Missing reference: ${referenceId}`,
        );
      }
    }
    for (const calculationId of note.calculationRecordIds) {
      if (!calculationIds.has(calculationId)) {
        addIssue(
          context,
          "error",
          `$.data.notes[id=${note.id}].calculationRecordIds`,
          `Missing calculation: ${calculationId}`,
        );
      }
    }
  }
  for (const link of sourceLinks) {
    if (!noteIds.has(link.noteId)) {
      addIssue(
        context,
        "error",
        `$.data.sourceLinks[id=${link.id}].noteId`,
        `Missing note: ${link.noteId}`,
      );
    }
    if (!referenceIds.has(link.referenceId)) {
      addIssue(
        context,
        "error",
        `$.data.sourceLinks[id=${link.id}].referenceId`,
        `Missing reference: ${link.referenceId}`,
      );
    }
  }

  const counts = {
    notes: notes.length,
    references: references.length,
    calculations: calculations.length,
    sourceLinks: sourceLinks.length,
  };
  const valid = !context.issues.some(({ severity }) => severity === "error");
  const envelope: NotebookExportEnvelope | undefined =
    valid &&
    format === NOTEBOOK_EXPORT_FORMAT &&
    schemaVersion === NOTEBOOK_EXPORT_SCHEMA_VERSION &&
    exportedAt
      ? {
          format,
          schemaVersion,
          exportedAt,
          ...(appVersion ? { appVersion } : {}),
          data: { notes, references, calculations, sourceLinks },
        }
      : undefined;

  return {
    valid,
    schemaVersion,
    counts,
    issues: context.issues,
    conflicts: context.conflicts,
    ...(envelope ? { envelope } : {}),
  };
}

export function assertValidNotebookImport(
  input: string | unknown,
  existing?: NotebookExportConflictIndex,
): NotebookExportEnvelope {
  const preview = previewNotebookImport(input, existing);
  if (!preview.valid || !preview.envelope) {
    throw new NotebookImportValidationError(preview);
  }
  return preview.envelope;
}
