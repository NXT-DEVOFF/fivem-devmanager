import { describe, expect, it } from "vitest";
import { stripAnsi } from "@/lib/ansi";

describe("stripAnsi", () => {
  it("retire les couleurs et les sequences de controle", () => {
    const raw = "\u001b[38;5;30m[script:test] \u001b[0m\u001b[32m[INFO]\u001b[0m OK";
    expect(stripAnsi(raw)).toBe("[script:test] [INFO] OK");
  });

  it("retire les retours chariot des anciens logs", () => {
    expect(stripAnsi("ligne 1\rligne 2")).toBe("ligne 1ligne 2");
  });

  it("laisse le texte normal intact", () => {
    expect(stripAnsi("Chargement termine")).toBe("Chargement termine");
  });
});
