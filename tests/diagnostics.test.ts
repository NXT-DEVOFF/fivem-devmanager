import { describe, expect, it } from "vitest";
import {
  diagnosticCounts,
  diagnosticScore,
  groupDiagnostics,
  worstDiagnosticStatus,
  type DiagnosticCheck,
  type DiagnosticStatus,
} from "../src/lib/diagnostics";

function check(id: string, status: DiagnosticStatus, group: DiagnosticCheck["group"] = "coeur"): DiagnosticCheck {
  return { id, label: id, group, status, detail: id };
}

describe("diagnostic", () => {
  it("calcule un score pondere et ignore les controles non applicables", () => {
    expect(diagnosticScore([check("a", "ok"), check("b", "warn"), check("c", "skip")])).toBe(75);
    expect(diagnosticScore([check("a", "ok"), check("b", "fail")])).toBe(50);
    expect(diagnosticScore([check("a", "skip")])).toBe(100);
    expect(diagnosticScore([])).toBe(100);
  });

  it("retient la severite la plus grave", () => {
    expect(worstDiagnosticStatus([check("a", "ok"), check("b", "warn")])).toBe("warn");
    expect(worstDiagnosticStatus([check("a", "warn"), check("b", "fail")])).toBe("fail");
    expect(worstDiagnosticStatus([check("a", "skip")])).toBe("skip");
  });

  it("compte chaque statut", () => {
    const counts = diagnosticCounts([
      check("a", "ok"),
      check("b", "ok"),
      check("c", "warn"),
      check("d", "fail"),
      check("e", "skip"),
    ]);
    expect(counts).toEqual({ ok: 2, warn: 1, fail: 1, skip: 1 });
  });

  it("regroupe les controles dans l'ordre attendu", () => {
    const groups = groupDiagnostics([
      check("a", "ok", "activite"),
      check("b", "ok", "coeur"),
    ]);
    expect(groups.map((group) => group.id)).toEqual(["coeur", "activite"]);
  });
});
