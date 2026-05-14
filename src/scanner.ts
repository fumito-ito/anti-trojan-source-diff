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

const C0_CONTROL_CODE_POINT_NAMES = new Map<number, string>([
  [0x0000, "NULL"],
  [0x0001, "START OF HEADING"],
  [0x0002, "START OF TEXT"],
  [0x0003, "END OF TEXT"],
  [0x0004, "END OF TRANSMISSION"],
  [0x0005, "ENQUIRY"],
  [0x0006, "ACKNOWLEDGE"],
  [0x0007, "BELL"],
  [0x0008, "BACKSPACE"],
  [0x000a, "LINE FEED"],
  [0x000b, "LINE TABULATION"],
  [0x000c, "FORM FEED"],
  [0x000d, "CARRIAGE RETURN"],
  [0x000e, "SHIFT OUT"],
  [0x000f, "SHIFT IN"],
  [0x0010, "DATA LINK ESCAPE"],
  [0x0011, "DEVICE CONTROL ONE"],
  [0x0012, "DEVICE CONTROL TWO"],
  [0x0013, "DEVICE CONTROL THREE"],
  [0x0014, "DEVICE CONTROL FOUR"],
  [0x0015, "NEGATIVE ACKNOWLEDGE"],
  [0x0016, "SYNCHRONOUS IDLE"],
  [0x0017, "END OF TRANSMISSION BLOCK"],
  [0x0018, "CANCEL"],
  [0x0019, "END OF MEDIUM"],
  [0x001a, "SUBSTITUTE"],
  [0x001b, "ESCAPE"],
  [0x001c, "INFORMATION SEPARATOR FOUR"],
  [0x001d, "INFORMATION SEPARATOR THREE"],
  [0x001e, "INFORMATION SEPARATOR TWO"],
  [0x001f, "INFORMATION SEPARATOR ONE"],
  [0x007f, "DELETE"]
]);

const C1_CONTROL_CODE_POINT_NAMES = new Map<number, string>([
  [0x0080, "PADDING CHARACTER"],
  [0x0081, "HIGH OCTET PRESET"],
  [0x0082, "BREAK PERMITTED HERE"],
  [0x0083, "NO BREAK HERE"],
  [0x0084, "INDEX"],
  [0x0085, "NEXT LINE"],
  [0x0086, "START OF SELECTED AREA"],
  [0x0087, "END OF SELECTED AREA"],
  [0x0088, "CHARACTER TABULATION SET"],
  [0x0089, "CHARACTER TABULATION WITH JUSTIFICATION"],
  [0x008a, "LINE TABULATION SET"],
  [0x008b, "PARTIAL LINE FORWARD"],
  [0x008c, "PARTIAL LINE BACKWARD"],
  [0x008d, "REVERSE LINE FEED"],
  [0x008e, "SINGLE SHIFT TWO"],
  [0x008f, "SINGLE SHIFT THREE"],
  [0x0090, "DEVICE CONTROL STRING"],
  [0x0091, "PRIVATE USE ONE"],
  [0x0092, "PRIVATE USE TWO"],
  [0x0093, "SET TRANSMIT STATE"],
  [0x0094, "CANCEL CHARACTER"],
  [0x0095, "MESSAGE WAITING"],
  [0x0096, "START OF GUARDED AREA"],
  [0x0097, "END OF GUARDED AREA"],
  [0x0098, "START OF STRING"],
  [0x0099, "SINGLE GRAPHIC CHARACTER INTRODUCER"],
  [0x009a, "SINGLE CHARACTER INTRODUCER"],
  [0x009b, "CONTROL SEQUENCE INTRODUCER"],
  [0x009c, "STRING TERMINATOR"],
  [0x009d, "OPERATING SYSTEM COMMAND"],
  [0x009e, "PRIVACY MESSAGE"],
  [0x009f, "APPLICATION PROGRAM COMMAND"]
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

    const errorName = getErrorCodePointName(value);
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

function getErrorCodePointName(value: number): string | undefined {
  const mappedName = ERROR_CODE_POINTS.get(value);
  if (mappedName !== undefined) {
    return mappedName;
  }

  return getVariationSelectorName(value) ?? getControlCodePointName(value);
}

function getVariationSelectorName(value: number): string | undefined {
  if (value >= 0xfe00 && value <= 0xfe0f) {
    return `VARIATION SELECTOR-${value - 0xfe00 + 1}`;
  }

  if (value >= 0xe0100 && value <= 0xe01ef) {
    return `VARIATION SELECTOR-${value - 0xe0100 + 17}`;
  }

  return undefined;
}

function getControlCodePointName(value: number): string | undefined {
  return C0_CONTROL_CODE_POINT_NAMES.get(value) ?? C1_CONTROL_CODE_POINT_NAMES.get(value);
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
