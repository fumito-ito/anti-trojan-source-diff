import assert from "node:assert/strict";
import test from "node:test";
import { scanAddedLine } from "../src/scanner";
import type { AddedLine } from "../src/types";

const ERROR_CODE_POINTS = [
  ["\u202A", "U+202A", "LEFT-TO-RIGHT EMBEDDING"],
  ["\u202B", "U+202B", "RIGHT-TO-LEFT EMBEDDING"],
  ["\u202C", "U+202C", "POP DIRECTIONAL FORMATTING"],
  ["\u202D", "U+202D", "LEFT-TO-RIGHT OVERRIDE"],
  ["\u202E", "U+202E", "RIGHT-TO-LEFT OVERRIDE"],
  ["\u2066", "U+2066", "LEFT-TO-RIGHT ISOLATE"],
  ["\u2067", "U+2067", "RIGHT-TO-LEFT ISOLATE"],
  ["\u2068", "U+2068", "FIRST STRONG ISOLATE"],
  ["\u2069", "U+2069", "POP DIRECTIONAL ISOLATE"]
] as const;

const WARNING_CODE_POINTS = [
  ["\u200B", "U+200B", "ZERO WIDTH SPACE"],
  ["\u200C", "U+200C", "ZERO WIDTH NON-JOINER"],
  ["\u200D", "U+200D", "ZERO WIDTH JOINER"],
  ["\uFEFF", "U+FEFF", "ZERO WIDTH NO-BREAK SPACE / BOM"],
  ["\u00AD", "U+00AD", "SOFT HYPHEN"],
  ["\u034F", "U+034F", "COMBINING GRAPHEME JOINER"],
  ["\u061C", "U+061C", "ARABIC LETTER MARK"]
] as const;

const VARIATION_SELECTOR_ERROR_CODE_POINTS = [
  ["\uFE00", "U+FE00", "VARIATION SELECTOR-1"],
  ["\uFE0F", "U+FE0F", "VARIATION SELECTOR-16"],
  ["\u{E0100}", "U+E0100", "VARIATION SELECTOR-17"],
  ["\u{E01EF}", "U+E01EF", "VARIATION SELECTOR-256"]
] as const;

const CONTROL_ERROR_CODE_POINTS = [
  ["\u0000", "U+0000", "NULL"],
  ["\u0008", "U+0008", "BACKSPACE"],
  ["\u000A", "U+000A", "LINE FEED"],
  ["\u001B", "U+001B", "ESCAPE"],
  ["\u001F", "U+001F", "INFORMATION SEPARATOR ONE"],
  ["\u007F", "U+007F", "DELETE"],
  ["\u0080", "U+0080", "PADDING CHARACTER"],
  ["\u0085", "U+0085", "NEXT LINE"],
  ["\u009B", "U+009B", "CONTROL SEQUENCE INTRODUCER"],
  ["\u009F", "U+009F", "APPLICATION PROGRAM COMMAND"]
] as const;

test("detects every error-level code point", () => {
  for (const [character, codePoint, name] of ERROR_CODE_POINTS) {
    const findings = scanAddedLine(addedLine(`x${character}y`), { includeZeroWidth: true });

    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "error");
    assert.equal(findings[0].codePoint, codePoint);
    assert.equal(findings[0].name, name);
    assert.equal(findings[0].column, 2);
  }
});

test("detects variation selectors as error-level findings", () => {
  for (const [character, codePoint, name] of VARIATION_SELECTOR_ERROR_CODE_POINTS) {
    const findings = scanAddedLine(addedLine(`x${character}y`), { includeZeroWidth: false });

    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "error");
    assert.equal(findings[0].codePoint, codePoint);
    assert.equal(findings[0].name, name);
    assert.equal(findings[0].column, 2);
  }
});

test("detects representative control characters as error-level findings", () => {
  for (const [character, codePoint, name] of CONTROL_ERROR_CODE_POINTS) {
    const findings = scanAddedLine(addedLine(`x${character}y`), { includeZeroWidth: false });

    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "error");
    assert.equal(findings[0].codePoint, codePoint);
    assert.equal(findings[0].name, name);
    assert.equal(findings[0].column, 2);
  }
});

test("does not report tab as a control-character finding", () => {
  const findings = scanAddedLine(addedLine("x\ty"), { includeZeroWidth: true });

  assert.deepEqual(findings, []);
});

test("detects every warning-level code point when enabled", () => {
  for (const [character, codePoint, name] of WARNING_CODE_POINTS) {
    const findings = scanAddedLine(addedLine(`x${character}y`), { includeZeroWidth: true });

    assert.equal(findings.length, 1);
    assert.equal(findings[0].severity, "warning");
    assert.equal(findings[0].codePoint, codePoint);
    assert.equal(findings[0].name, name);
    assert.equal(findings[0].column, 2);
  }
});

test("suppresses warning-level code points when disabled", () => {
  const findings = scanAddedLine(addedLine("a\u200Bb"), { includeZeroWidth: false });

  assert.deepEqual(findings, []);
});

test("reports 1-based columns for ASCII content", () => {
  const findings = scanAddedLine(addedLine("abc\u202Edef"), { includeZeroWidth: true });

  assert.equal(findings[0].column, 4);
});

test("counts a surrogate pair as one user-facing column", () => {
  const findings = scanAddedLine(addedLine("a😀\u202Eb"), { includeZeroWidth: true });

  assert.equal(findings[0].column, 3);
});

test("reports columns for supplementary-plane variation selectors by code point", () => {
  const findings = scanAddedLine(addedLine("a😀\u{E0100}b"), { includeZeroWidth: true });

  assert.equal(findings[0].column, 3);
});

function addedLine(content: string): AddedLine {
  return {
    file: "src/app.ts",
    line: 7,
    content
  };
}
