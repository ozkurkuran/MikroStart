import { describe, expect, it } from "vitest";

import { AiOutputValidationError } from "./types";
import { createOpaqueAiSourceId } from "./prompt";
import {
  validateGroundedDigestOutput,
  validateRerankOutput,
} from "./validation";

const localA = createOpaqueAiSourceId("doi:10.1234/local-a");
const localB = createOpaqueAiSourceId("arxiv:2608.12345");
const known = new Set([localA, localB]);

describe("validateGroundedDigestOutput", () => {
  it("accepts source-bound statements", () => {
    expect(
      validateGroundedDigestOutput(
        JSON.stringify({
          items: [
            { text: "The samples were annealed.", sourceIds: [localA] },
            {
              text: "Both records report thin films.",
              sourceIds: [localA, localB],
            },
          ],
        }),
        known,
      ),
    ).toEqual({
      items: [
        { text: "The samples were annealed.", sourceIds: [localA] },
        {
          text: "Both records report thin films.",
          sourceIds: [localA, localB],
        },
      ],
    });
  });

  it.each([
    ["unknown ID", { items: [{ text: "Claim", sourceIds: ["invented"] }] }],
    ["source-less claim", { items: [{ text: "Claim", sourceIds: [] }] }],
    [
      "generated URL",
      { items: [{ text: "See https://invented.example/paper", sourceIds: [localA] }] },
    ],
    [
      "generated DOI",
      { items: [{ text: "DOI: 10.1234/invented", sourceIds: [localA] }] },
    ],
    [
      "metadata field",
      {
        items: [
          {
            text: "Claim",
            sourceIds: [localA],
            url: "https://invented.example",
          },
        ],
      },
    ],
  ])("rejects %s", (_label, candidate) => {
    expect(() =>
      validateGroundedDigestOutput(JSON.stringify(candidate), known),
    ).toThrow(AiOutputValidationError);
  });

  it("rejects Markdown-wrapped JSON", () => {
    expect(() =>
      validateGroundedDigestOutput(
        `\`\`\`json\n{"items":[{"text":"Claim","sourceIds":["${localA}"]}]}\n\`\`\``,
        known,
      ),
    ).toThrow(AiOutputValidationError);
  });
});

describe("validateRerankOutput", () => {
  it("accepts known IDs and sorts scores descending", () => {
    expect(
      validateRerankOutput(
        JSON.stringify({
          items: [
            { sourceId: localB, score: 0.25, reason: "A weak match." },
            { sourceId: localA, score: 0.9, reason: "A strong match." },
          ],
        }),
        known,
      ).items.map(({ sourceId }) => sourceId),
    ).toEqual([localA, localB]);
  });

  it.each([
    [
      "unknown ID",
      { items: [{ sourceId: "remote", score: 0.5, reason: "Invented." }] },
    ],
    [
      "score outside range",
      { items: [{ sourceId: localA, score: 2, reason: "Too high." }] },
    ],
    [
      "generated metadata",
      {
        items: [
          {
            sourceId: localA,
            score: 0.5,
            reason: "See doi: 10.1234/fake",
          },
        ],
      },
    ],
  ])("rejects %s", (_label, candidate) => {
    expect(() => validateRerankOutput(JSON.stringify(candidate), known)).toThrow(
      AiOutputValidationError,
    );
  });
});
