import assert from "node:assert/strict";
import test from "node:test";
import * as core from "@actions/core";
import { annotateFindings } from "../src/annotate";
import type { Finding } from "../src/types";

type CoreMock = {
  error: typeof core.error;
  warning: typeof core.warning;
  notice: typeof core.notice;
};

const mutableCore = core as unknown as CoreMock;

test("emits error and warning annotations with locations", () => {
  const calls = withMockedCore(() => {
    annotateFindings(
      [
        finding("error", "U+202E", 3),
        finding("warning", "U+200B", 5)
      ],
      { maxAnnotations: 10 }
    );
  });

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
  const calls = withMockedCore(() => {
    annotateFindings(
      [
        finding("error", "U+202A", 1),
        finding("error", "U+202B", 2),
        finding("warning", "U+200B", 3)
      ],
      { maxAnnotations: 2 }
    );
  });

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

function withMockedCore(callback: () => void): {
  errors: Array<{ message: string; properties: core.AnnotationProperties | undefined }>;
  warnings: Array<{ message: string; properties: core.AnnotationProperties | undefined }>;
  notices: string[];
} {
  const original = {
    error: mutableCore.error,
    warning: mutableCore.warning,
    notice: mutableCore.notice
  };
  const errors: Array<{ message: string; properties: core.AnnotationProperties | undefined }> = [];
  const warnings: Array<{ message: string; properties: core.AnnotationProperties | undefined }> = [];
  const notices: string[] = [];

  mutableCore.error = (message, properties) => {
    errors.push({ message: String(message), properties });
  };
  mutableCore.warning = (message, properties) => {
    warnings.push({ message: String(message), properties });
  };
  mutableCore.notice = (message) => {
    notices.push(String(message));
  };

  try {
    callback();
  } finally {
    mutableCore.error = original.error;
    mutableCore.warning = original.warning;
    mutableCore.notice = original.notice;
  }

  return { errors, warnings, notices };
}
