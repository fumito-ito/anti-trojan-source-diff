import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import * as core from "@actions/core";
import { run } from "../src/index";

type CoreMock = {
  getInput: typeof core.getInput;
  setOutput: typeof core.setOutput;
  setFailed: typeof core.setFailed;
  error: typeof core.error;
  warning: typeof core.warning;
  notice: typeof core.notice;
};

const mutableCore = core as unknown as CoreMock;

test("clean diff passes and sets zero counts", async () => {
  const diffFile = await writeTempDiff([
    "diff --git a/src/app.ts b/src/app.ts",
    "--- a/src/app.ts",
    "+++ b/src/app.ts",
    "@@ -1,0 +1,1 @@",
    "+const safe = true;"
  ].join("\n"));

  const calls = await withMockedCore(
    {
      "diff-file": diffFile
    },
    () => run()
  );

  assert.deepEqual(calls.outputs, {
    "error-count": "0",
    "warning-count": "0",
    "finding-count": "0"
  });
  assert.equal(calls.failed, undefined);
});

test("added bidi character produces an error and fails", async () => {
  const diffFile = await writeTempDiff([
    "diff --git a/src/app.ts b/src/app.ts",
    "--- a/src/app.ts",
    "+++ b/src/app.ts",
    "@@ -1,0 +1,1 @@",
    "+const unsafe = \"\u202E\";"
  ].join("\n"));

  const calls = await withMockedCore(
    {
      "diff-file": diffFile
    },
    () => run()
  );

  assert.equal(calls.outputs["error-count"], "1");
  assert.equal(calls.outputs["warning-count"], "0");
  assert.match(calls.failed ?? "", /Detected 1 error/);
  assert.equal(calls.errors.length, 1);
});

test("removed and context bidi characters are ignored", async () => {
  const diffFile = await writeTempDiff([
    "diff --git a/src/app.ts b/src/app.ts",
    "--- a/src/app.ts",
    "+++ b/src/app.ts",
    "@@ -1,2 +1,2 @@",
    " const existing = \"\u202E\";",
    "-const removed = \"\u202E\";",
    "+const added = \"safe\";"
  ].join("\n"));

  const calls = await withMockedCore(
    {
      "diff-file": diffFile
    },
    () => run()
  );

  assert.equal(calls.outputs["finding-count"], "0");
  assert.equal(calls.failed, undefined);
});

test("zero-width warnings are reported by default without failing", async () => {
  const diffFile = await writeTempDiff([
    "diff --git a/src/app.ts b/src/app.ts",
    "--- a/src/app.ts",
    "+++ b/src/app.ts",
    "@@ -1,0 +1,1 @@",
    "+const value = \"a\u200Bb\";"
  ].join("\n"));

  const calls = await withMockedCore(
    {
      "diff-file": diffFile
    },
    () => run()
  );

  assert.equal(calls.outputs["error-count"], "0");
  assert.equal(calls.outputs["warning-count"], "1");
  assert.equal(calls.failed, undefined);
  assert.equal(calls.warnings.length, 1);
});

test("zero-width warnings are suppressed when include-zero-width=false", async () => {
  const diffFile = await writeTempDiff([
    "diff --git a/src/app.ts b/src/app.ts",
    "--- a/src/app.ts",
    "+++ b/src/app.ts",
    "@@ -1,0 +1,1 @@",
    "+const value = \"a\u200Bb\";"
  ].join("\n"));

  const calls = await withMockedCore(
    {
      "diff-file": diffFile,
      "include-zero-width": "false"
    },
    () => run()
  );

  assert.equal(calls.outputs["finding-count"], "0");
  assert.equal(calls.failed, undefined);
});

test("warning fails only when fail-on-warning=true", async () => {
  const diffFile = await writeTempDiff([
    "diff --git a/src/app.ts b/src/app.ts",
    "--- a/src/app.ts",
    "+++ b/src/app.ts",
    "@@ -1,0 +1,1 @@",
    "+const value = \"a\u200Bb\";"
  ].join("\n"));

  const calls = await withMockedCore(
    {
      "diff-file": diffFile,
      "fail-on-warning": "true"
    },
    () => run()
  );

  assert.equal(calls.outputs["warning-count"], "1");
  assert.match(calls.failed ?? "", /0 error\(s\) and 1 warning/);
});

test("invalid inputs fail with actionable messages", async () => {
  const calls = await withMockedCore(
    {
      "diff-file": "unused.diff",
      "fail-on-warning": "yes"
    },
    () => run()
  );

  assert.match(calls.failed ?? "", /fail-on-warning/);
});

async function writeTempDiff(content: string): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "anti-trojan-source-diff-"));
  const diffFile = path.join(directory, "pr.diff");
  await fs.writeFile(diffFile, content, "utf8");
  return diffFile;
}

async function withMockedCore(
  inputs: Record<string, string>,
  callback: () => Promise<void>
): Promise<{
  outputs: Record<string, string>;
  failed: string | undefined;
  errors: string[];
  warnings: string[];
  notices: string[];
}> {
  const original = {
    getInput: mutableCore.getInput,
    setOutput: mutableCore.setOutput,
    setFailed: mutableCore.setFailed,
    error: mutableCore.error,
    warning: mutableCore.warning,
    notice: mutableCore.notice
  };
  const outputs: Record<string, string> = {};
  const errors: string[] = [];
  const warnings: string[] = [];
  const notices: string[] = [];
  let failed: string | undefined;

  mutableCore.getInput = (name, options) => {
    const value = inputs[name] ?? "";
    if (options?.required === true && value === "") {
      throw new Error(`Input required and not supplied: ${name}`);
    }

    return value;
  };
  mutableCore.setOutput = (name, value) => {
    outputs[name] = String(value);
  };
  mutableCore.setFailed = (message) => {
    failed = String(message);
  };
  mutableCore.error = (message) => {
    errors.push(String(message));
  };
  mutableCore.warning = (message) => {
    warnings.push(String(message));
  };
  mutableCore.notice = (message) => {
    notices.push(String(message));
  };

  try {
    await callback();
  } finally {
    mutableCore.getInput = original.getInput;
    mutableCore.setOutput = original.setOutput;
    mutableCore.setFailed = original.setFailed;
    mutableCore.error = original.error;
    mutableCore.warning = original.warning;
    mutableCore.notice = original.notice;
  }

  return { outputs, failed, errors, warnings, notices };
}
