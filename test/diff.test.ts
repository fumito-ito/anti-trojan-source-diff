import assert from "node:assert/strict";
import test from "node:test";
import { parseAddedLines } from "../src/diff";

test("parses added lines with new-file line numbers", () => {
  const diff = [
    "diff --git a/src/app.ts b/src/app.ts",
    "--- a/src/app.ts",
    "+++ b/src/app.ts",
    "@@ -10,0 +11,2 @@",
    "+const safe = true;",
    "+console.log(safe);"
  ].join("\n");

  assert.deepEqual(parseAddedLines(diff), [
    { file: "src/app.ts", line: 11, content: "const safe = true;" },
    { file: "src/app.ts", line: 12, content: "console.log(safe);" }
  ]);
});

test("ignores removed and context lines while context increments new-file lines", () => {
  const diff = [
    "diff --git a/src/app.ts b/src/app.ts",
    "--- a/src/app.ts",
    "+++ b/src/app.ts",
    "@@ -20,3 +20,4 @@",
    " const before = true;",
    "-const oldValue = false;",
    "+const newValue = true;",
    " const after = true;",
    "+const tail = true;"
  ].join("\n");

  assert.deepEqual(parseAddedLines(diff), [
    { file: "src/app.ts", line: 21, content: "const newValue = true;" },
    { file: "src/app.ts", line: 23, content: "const tail = true;" }
  ]);
});

test("ignores deleted file sections", () => {
  const diff = [
    "diff --git a/src/deleted.ts b/src/deleted.ts",
    "--- a/src/deleted.ts",
    "+++ /dev/null",
    "@@ -1,1 +0,0 @@",
    "-const oldValue = true;",
    "+const shouldNotBeScanned = true;"
  ].join("\n");

  assert.deepEqual(parseAddedLines(diff), []);
});

test("preserves paths for multiple files", () => {
  const diff = [
    "diff --git a/src/a.ts b/src/a.ts",
    "--- a/src/a.ts",
    "+++ b/src/a.ts",
    "@@ -1,0 +1,1 @@",
    "+const a = 1;",
    "diff --git a/src/b.ts b/src/b.ts",
    "--- a/src/b.ts",
    "+++ b/src/b.ts",
    "@@ -5,0 +6,1 @@",
    "+const b = 2;"
  ].join("\n");

  assert.deepEqual(parseAddedLines(diff), [
    { file: "src/a.ts", line: 1, content: "const a = 1;" },
    { file: "src/b.ts", line: 6, content: "const b = 2;" }
  ]);
});

test("handles empty added lines and no-newline markers", () => {
  const diff = [
    "diff --git a/file.txt b/file.txt",
    "--- a/file.txt",
    "+++ b/file.txt",
    "@@ -1 +1,2 @@",
    "+",
    "\\ No newline at end of file",
    "+next"
  ].join("\n");

  assert.deepEqual(parseAddedLines(diff), [
    { file: "file.txt", line: 1, content: "" },
    { file: "file.txt", line: 2, content: "next" }
  ]);
});
