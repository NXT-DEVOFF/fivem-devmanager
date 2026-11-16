/** Declarations minimales pour jsdiff v7 (module ESM sans types exportes). */
declare module "diff" {
  export interface Change {
    value: string;
    added?: boolean;
    removed?: boolean;
    count?: number;
  }

  export function diffLines(oldText: string, newText: string): Change[];

  export function createTwoFilesPatch(
    oldFileName: string,
    newFileName: string,
    oldStr: string,
    newStr: string,
    oldHeader?: string,
    newHeader?: string,
    options?: { context?: number },
  ): string;
}
