import {
  AiOutputValidationError,
  type GroundedDigestResult,
  type OpaqueAiSourceId,
  type RerankResult,
} from "./types";

const GENERATED_CITATION_PATTERN =
  /(?:https?:\/\/|www\.|\bdoi\s*:|\b10\.\d{4,9}\/[\w.()/:;-]+)/iu;
const MAX_OUTPUT_ITEMS = 50;
const MAX_TEXT_LENGTH = 8_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  const allowList = new Set(allowed);
  return Object.keys(record).every((key) => allowList.has(key));
}

function parseStrictJson(output: string): unknown {
  if (output.length === 0 || output.length > 256_000) {
    throw new AiOutputValidationError("The AI response was rejected.", [
      "Response size is outside the accepted range.",
    ]);
  }
  try {
    return JSON.parse(output) as unknown;
  } catch {
    throw new AiOutputValidationError("The AI response was rejected.", [
      "Expected one JSON object without Markdown or surrounding text.",
    ]);
  }
}

function validateGeneratedText(
  value: unknown,
  path: string,
  issues: string[],
): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(`${path} must be a non-empty string.`);
    return undefined;
  }
  const text = value.trim();
  if (text.length > MAX_TEXT_LENGTH) {
    issues.push(`${path} exceeds ${MAX_TEXT_LENGTH.toLocaleString("en-US")} characters.`);
  }
  if (GENERATED_CITATION_PATTERN.test(text)) {
    issues.push(`${path} contains generated URL or DOI metadata.`);
  }
  return text;
}

function validateKnownSourceIds(
  value: unknown,
  path: string,
  knownSourceIds: ReadonlySet<OpaqueAiSourceId>,
  issues: string[],
): OpaqueAiSourceId[] {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push(`${path} must cite at least one source ID.`);
    return [];
  }
  const result: OpaqueAiSourceId[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    if (
      typeof candidate !== "string" ||
      !knownSourceIds.has(candidate as OpaqueAiSourceId)
    ) {
      issues.push(`${path} contains an unknown source ID.`);
      continue;
    }
    if (seen.has(candidate)) {
      issues.push(`${path} contains a duplicate source ID.`);
      continue;
    }
    seen.add(candidate);
    result.push(candidate as OpaqueAiSourceId);
  }
  return result;
}

/**
 * Accepts only source-bound statements. Citation URLs and DOI metadata always
 * come from the local feed record after validation, never from model output.
 */
export function validateGroundedDigestOutput(
  output: string,
  knownSourceIds: ReadonlySet<OpaqueAiSourceId>,
): GroundedDigestResult {
  const parsed = parseStrictJson(output);
  const issues: string[] = [];
  if (!isRecord(parsed) || !hasOnlyKeys(parsed, ["items"])) {
    throw new AiOutputValidationError("The AI digest was rejected.", [
      "Root object may contain only the items field.",
    ]);
  }
  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    issues.push("items must contain at least one grounded statement.");
  } else if (parsed.items.length > MAX_OUTPUT_ITEMS) {
    issues.push(`items may contain at most ${MAX_OUTPUT_ITEMS} statements.`);
  }

  const items = Array.isArray(parsed.items)
    ? parsed.items.slice(0, MAX_OUTPUT_ITEMS).flatMap((candidate, index) => {
        const path = `items[${index}]`;
        if (!isRecord(candidate) || !hasOnlyKeys(candidate, ["text", "sourceIds"])) {
          issues.push(`${path} contains unknown or missing fields.`);
          return [];
        }
        const text = validateGeneratedText(candidate.text, `${path}.text`, issues);
        const sourceIds = validateKnownSourceIds(
          candidate.sourceIds,
          `${path}.sourceIds`,
          knownSourceIds,
          issues,
        );
        return text && sourceIds.length > 0 ? [{ text, sourceIds }] : [];
      })
    : [];

  if (issues.length > 0) {
    throw new AiOutputValidationError("The AI digest was rejected.", issues);
  }
  return { items };
}

export function validateRerankOutput(
  output: string,
  knownSourceIds: ReadonlySet<OpaqueAiSourceId>,
): RerankResult {
  const parsed = parseStrictJson(output);
  const issues: string[] = [];
  if (!isRecord(parsed) || !hasOnlyKeys(parsed, ["items"])) {
    throw new AiOutputValidationError("The AI ranking was rejected.", [
      "Root object may contain only the items field.",
    ]);
  }
  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    issues.push("items must contain at least one source-bound ranking.");
  } else if (parsed.items.length > MAX_OUTPUT_ITEMS) {
    issues.push(`items may contain at most ${MAX_OUTPUT_ITEMS} rankings.`);
  }

  const seen = new Set<string>();
  const items = Array.isArray(parsed.items)
    ? parsed.items.slice(0, MAX_OUTPUT_ITEMS).flatMap((candidate, index) => {
        const path = `items[${index}]`;
        if (
          !isRecord(candidate) ||
          !hasOnlyKeys(candidate, ["sourceId", "score", "reason"])
        ) {
          issues.push(`${path} contains unknown or missing fields.`);
          return [];
        }
        if (
          typeof candidate.sourceId !== "string" ||
          !knownSourceIds.has(candidate.sourceId as OpaqueAiSourceId)
        ) {
          issues.push(`${path}.sourceId is unknown.`);
          return [];
        }
        if (seen.has(candidate.sourceId)) {
          issues.push(`${path}.sourceId is duplicated.`);
          return [];
        }
        seen.add(candidate.sourceId);
        if (
          typeof candidate.score !== "number" ||
          !Number.isFinite(candidate.score) ||
          candidate.score < 0 ||
          candidate.score > 1
        ) {
          issues.push(`${path}.score must be a finite number from 0 through 1.`);
          return [];
        }
        const reason = validateGeneratedText(candidate.reason, `${path}.reason`, issues);
        return reason
          ? [
              {
                sourceId: candidate.sourceId as OpaqueAiSourceId,
                score: candidate.score,
                reason,
              },
            ]
          : [];
      })
    : [];

  if (issues.length > 0) {
    throw new AiOutputValidationError("The AI ranking was rejected.", issues);
  }
  return { items: items.sort((left, right) => right.score - left.score) };
}
