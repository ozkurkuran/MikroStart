const ADJECTIVES = [
  "amber", "azure", "brisk", "calm", "clear", "cobalt", "coral", "crisp",
  "dawn", "deep", "delta", "eager", "ember", "fair", "fast", "fresh",
  "gold", "green", "indigo", "keen", "lunar", "misty", "navy", "neat",
  "polar", "quiet", "rapid", "silver", "solar", "steady", "swift", "violet",
] as const;

const NOUNS = [
  "atom", "beam", "cell", "coil", "crystal", "disk", "film", "flux",
  "foil", "grain", "ion", "laser", "layer", "mesh", "molecule", "node",
  "phase", "probe", "pulse", "quartz", "sample", "sensor", "signal", "spark",
  "spectrum", "spot", "stack", "stage", "trace", "wafer", "wave", "wire",
] as const;

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export type RandomBytesProvider = (size: number) => Uint8Array;

export interface SampleIdOptions {
  prefix?: string;
  now?: Date | number | string;
  randomBytes?: RandomBytesProvider;
}

function defaultRandomBytes(size: number): Uint8Array {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Secure randomness is unavailable; inject a RandomBytesProvider.");
  }
  return globalThis.crypto.getRandomValues(new Uint8Array(size));
}

function sanitizePrefix(prefix: string): string {
  const sanitized = prefix
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 16);
  return sanitized || "SAMPLE";
}

function compactUtcDate(value: Date | number | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError("A valid sample date is required.");
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let accumulator = 0;
  let output = "";
  for (const byte of bytes) {
    accumulator = accumulator * 256 + byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += CROCKFORD[Math.floor(accumulator / 2 ** bits) & 31];
      accumulator %= 2 ** bits;
    }
  }
  if (bits > 0) output += CROCKFORD[(accumulator << (5 - bits)) & 31];
  return output;
}

/** Produces a readable ID with 60 random bits (10 in words, 50 in the suffix). */
export function generateSampleId(options: SampleIdOptions = {}): string {
  const bytes = (options.randomBytes ?? defaultRandomBytes)(9);
  if (!(bytes instanceof Uint8Array) || bytes.length < 9) {
    throw new RangeError("RandomBytesProvider must return at least nine bytes.");
  }
  const adjective = ADJECTIVES[bytes[0] & 31].toUpperCase();
  const noun = NOUNS[bytes[1] & 31].toUpperCase();
  const suffix = encodeBase32(bytes.slice(2, 9)).slice(0, 10);
  const date = compactUtcDate(options.now ?? Date.now());
  return `${sanitizePrefix(options.prefix ?? "SAMPLE")}-${date}-${adjective}-${noun}-${suffix}`;
}

export function generateUniqueSampleId(
  existingIds: Iterable<string>,
  options: SampleIdOptions = {},
): string {
  const existing = new Set(existingIds);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = generateSampleId(options);
    if (!existing.has(candidate)) return candidate;
  }
  throw new Error("Could not generate a unique sample ID after eight attempts.");
}
