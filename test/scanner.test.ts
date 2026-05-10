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

function addedLine(content: string): AddedLine {
  return {
    file: "src/app.ts",
    line: 7,
    content
  };
}
