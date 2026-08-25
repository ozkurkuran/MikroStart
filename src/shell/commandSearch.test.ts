import { describe, expect, it } from "vitest";

import { searchCommands, type CommandSearchRecord } from "./commandSearch";

const records: CommandSearchRecord[] = [
  { id: "module:xrd", kind: "module", title: "XRD calculator", keywords: ["difraksiyon"] },
  { id: "note:1", kind: "note", title: "İnce film deneyi", subtitle: "not" },
  { id: "source:1", kind: "source", title: "Thin film deposition", subtitle: "Crossref" },
];

describe("searchCommands", () => {
  it("folds Turkish characters and prioritizes title prefixes", () => {
    expect(searchCommands(records, "ince").map((item) => item.id)).toEqual(["note:1"]);
    expect(searchCommands(records, "difraksiyon").map((item) => item.id)).toEqual(["module:xrd"]);
  });

  it("matches all query terms and respects the result limit", () => {
    expect(searchCommands(records, "thin crossref", 1).map((item) => item.id)).toEqual(["source:1"]);
  });
});
