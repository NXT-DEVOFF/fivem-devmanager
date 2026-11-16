/** Retire les sequences ANSI/OSC des logs avant affichage ou stockage. */
const ANSI_ESCAPE = new RegExp(
  String.raw`\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\))`,
  "g",
);

export function stripAnsi(value: string): string {
  return value.replace(ANSI_ESCAPE, "").replace(/\r/g, "");
}
