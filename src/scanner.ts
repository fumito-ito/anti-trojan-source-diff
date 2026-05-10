import type { AddedLine, Finding, Severity } from "./types";

export type ScanOptions = {
  includeZeroWidth: boolean;
};

const ERROR_CODE_POINTS = new Map<number, string>([
  [0x202a, "LEFT-TO-RIGHT EMBEDDING"],
  [0x202b, "RIGHT-TO-LEFT EMBEDDING"],
  [0x202c, "POP DIRECTIONAL FORMATTING"],
  [0x202d, "LEFT-TO-RIGHT OVERRIDE"],
  [0x202e, "RIGHT-TO-LEFT OVERRIDE"],
  [0x2066, "LEFT-TO-RIGHT ISOLATE"],
  [0x2067, "RIGHT-TO-LEFT ISOLATE"],
  [0x2068, "FIRST STRONG ISOLATE"],
  [0x2069, "POP DIRECTIONAL ISOLATE"]
]);

const WARNING_CODE_POINTS = new Map<number, string>([
  [0x200b, "ZERO WIDTH SPACE"],
  [0x200c, "ZERO WIDTH NON-JOINER"],
  [0x200d, "ZERO WIDTH JOINER"],
  [0xfeff, "ZERO WIDTH NO-BREAK SPACE / BOM"],
  [0x00ad, "SOFT HYPHEN"],
  [0x034f, "COMBINING GRAPHEME JOINER"],
  [0x061c, "ARABIC LETTER MARK"]
]);

export function scanAddedLine(line: AddedLine, options: ScanOptions): Finding[] {
  const findings: Finding[] = [];
  let column = 1;

  for (const character of line.content) {
    const value = character.codePointAt(0);

    if (value === undefined) {
      column += 1;
      continue;
    }

    const errorName = ERROR_CODE_POINTS.get(value);
    if (errorName !== undefined) {
      findings.push(toFinding(line, column, value, errorName, "error", character));
      column += 1;
      continue;
    }

    const warningName = WARNING_CODE_POINTS.get(value);
    if (options.includeZeroWidth && warningName !== undefined) {
      findings.push(toFinding(line, column, value, warningName, "warning", character));
    }

    column += 1;
  }

  return findings;
}

function toFinding(
  line: AddedLine,
  column: number,
  value: number,
  name: string,
  severity: Severity,
  character: string
): Finding {
  return {
    file: line.file,
    line: line.line,
    column,
    codePoint: formatCodePoint(value),
    name,
    severity,
    character
  };
}

function formatCodePoint(value: number): string {
  return `U+${value.toString(16).toUpperCase().padStart(4, "0")}`;
}
