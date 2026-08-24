import { describe, expect, it } from "vitest";

import {
  notebookToMarkdown,
  referencesToBibtex,
  referencesToRis,
} from "./exporters";
import type { NotebookExportEnvelope, ReferenceRecord } from "./types";

const reference: ReferenceRecord = {
  id: "ref-1",
  type: "article",
  title: "Thin films & reproducibility",
  authors: [{ given: "Ada", family: "Researcher" }],
  publishedAt: "2026-02-01T00:00:00.000Z",
  doi: "10.1000/example",
  canonicalUrl: "https://doi.org/10.1000/example",
  retrievedAt: "2026-08-24T12:00:00.000Z",
  sourceSnapshot: {
    sourceId: "source-1",
    title: "Thin films & reproducibility",
    canonicalUrl: "https://doi.org/10.1000/example",
    retrievedAt: "2026-08-24T12:00:00.000Z",
  },
};

describe("notebook text exporters", () => {
  it("exports deterministic BibTeX and RIS citations", () => {
    expect(referencesToBibtex([reference])).toContain("@article{Researcher-2026-example");
    expect(referencesToBibtex([reference])).toContain("Thin films \\& reproducibility");
    expect(referencesToRis([reference])).toContain("DO  - 10.1000/example");
    expect(referencesToRis([reference])).toContain("AU  - Ada Researcher");
  });

  it("exports notes with linked references as Markdown", () => {
    const envelope: NotebookExportEnvelope = {
      format: "benchtab-notebook-export",
      schemaVersion: 1,
      exportedAt: "2026-08-24T12:00:00.000Z",
      data: {
        notes: [
          {
            id: "note-1",
            version: 1,
            type: "literature",
            title: "Reading note",
            markdown: "Useful result.",
            createdAt: "2026-08-24T12:00:00.000Z",
            updatedAt: "2026-08-24T12:00:00.000Z",
            tags: ["thin-film"],
            referenceIds: [reference.id],
            calculationRecordIds: [],
            sourceItemIds: [],
          },
        ],
        references: [reference],
        calculations: [],
        sourceLinks: [],
      },
    };
    const markdown = notebookToMarkdown(envelope);
    expect(markdown).toContain("# Reading note");
    expect(markdown).toContain("## References");
    expect(markdown).toContain("https://doi.org/10.1000/example");
  });
});
