import assert from "node:assert/strict";
import test from "node:test";
import { annotateFindings } from "../src/annotate";
import type { AnnotationCore, AnnotationProperties } from "../src/annotate";
import type { Finding } from "../src/types";

test("emits error and warning annotations with locations", () => {
  const calls = createCoreRecorder();

  annotateFindings(
    [
      finding("error", "U+202E", 3),
      finding("warning", "U+200B", 5)
    ],
    { maxAnnotations: 10 },
    calls.core
  );

  assert.equal(calls.errors.length, 1);
  assert.equal(calls.warnings.length, 1);
  assert.equal(calls.notices.length, 0);
  assert.match(calls.errors[0].message, /U\+202E/);
  assert.deepEqual(calls.errors[0].properties, {
    title: "Potential Trojan Source character",
    file: "src/app.ts",
    startLine: 12,
    startColumn: 3,
    endLine: 12,
    endColumn: 4
  });
  assert.deepEqual(calls.warnings[0].properties, {
    title: "Potential Trojan Source character",
    file: "src/app.ts",
    startLine: 12,
    startColumn: 5,
    endLine: 12,
    endColumn: 6
  });
});

test("caps annotations and emits a truncation notice", () => {
  const calls = createCoreRecorder();

  annotateFindings(
    [
      finding("error", "U+202A", 1),
      finding("error", "U+202B", 2),
      finding("warning", "U+200B", 3)
    ],
    { maxAnnotations: 2 },
    calls.core
  );

  assert.equal(calls.errors.length, 2);
  assert.equal(calls.warnings.length, 0);
  assert.equal(calls.notices.length, 1);
  assert.match(calls.notices[0], /only the first 2 annotation/);
});

function finding(severity: Finding["severity"], codePoint: string, column: number): Finding {
  return {
    file: "src/app.ts",
    line: 12,
    column,
    codePoint,
    name: severity === "error" ? "RIGHT-TO-LEFT OVERRIDE" : "ZERO WIDTH SPACE",
    severity,
    character: severity === "error" ? "\u202E" : "\u200B"
  };
}

function createCoreRecorder(): {
  core: AnnotationCore;
  errors: Array<{ message: string; properties: AnnotationProperties }>;
  warnings: Array<{ message: string; properties: AnnotationProperties }>;
  notices: string[];
} {
  const errors: Array<{ message: string; properties: AnnotationProperties }> = [];
  const warnings: Array<{ message: string; properties: AnnotationProperties }> = [];
  const notices: string[] = [];

  const core: AnnotationCore = {
    error(message, properties) {
      errors.push({ message: String(message), properties });
    },
    warning(message, properties) {
      warnings.push({ message: String(message), properties });
    },
    notice(message) {
      notices.push(String(message));
    }
  };

  return { core, errors, warnings, notices };
}
