import * as fs from "node:fs/promises";
import * as core from "@actions/core";
import { annotateFindings } from "./annotate";
import { parseAddedLines } from "./diff";
import { scanAddedLine } from "./scanner";
import type { Finding } from "./types";

export async function run(): Promise<void> {
  try {
    const failOnWarning = parseBooleanInput("fail-on-warning", false);
    const includeZeroWidth = parseBooleanInput("include-zero-width", true);
    const maxAnnotations = parsePositiveIntegerInput("max-annotations", 50);

    const diffText = await readDiffText();
    const addedLines = parseAddedLines(diffText);
    const findings = addedLines.flatMap((line) => scanAddedLine(line, { includeZeroWidth }));

    annotateFindings(findings, { maxAnnotations });

    const errorCount = countSeverity(findings, "error");
    const warningCount = countSeverity(findings, "warning");

    core.setOutput("error-count", String(errorCount));
    core.setOutput("warning-count", String(warningCount));
    core.setOutput("finding-count", String(findings.length));

    if (errorCount > 0 || (failOnWarning && warningCount > 0)) {
      core.setFailed(`Detected ${errorCount} error(s) and ${warningCount} warning(s).`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(message);
  }
}

async function readDiffText(): Promise<string> {
  const diffFile = core.getInput("diff-file");
  const diff = core.getInput("diff", { trimWhitespace: false });

  if (diffFile !== "" && diff !== "") {
    throw new Error('Use only one of "diff-file" or "diff".');
  }

  if (diffFile !== "") {
    return fs.readFile(diffFile, "utf8");
  }

  if (diff !== "" || hasRawActionInput("diff")) {
    return diff;
  }

  throw new Error('Input "diff-file" or "diff" is required.');
}

function hasRawActionInput(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(process.env, inputEnvironmentName(name));
}

function inputEnvironmentName(name: string): string {
  return `INPUT_${name.replace(/ /g, "_").toUpperCase()}`;
}

function parseBooleanInput(name: string, defaultValue: boolean): boolean {
  const rawValue = core.getInput(name);
  const value = rawValue === "" ? String(defaultValue) : rawValue;

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`Input "${name}" must be either "true" or "false".`);
}

function parsePositiveIntegerInput(name: string, defaultValue: number): number {
  const rawValue = core.getInput(name);
  const value = rawValue === "" ? String(defaultValue) : rawValue;
  const parsed = Number.parseInt(value, 10);

  if (!/^[1-9]\d*$/.test(value) || parsed < 1) {
    throw new Error(`Input "${name}" must be a positive integer.`);
  }

  return parsed;
}

function countSeverity(findings: Finding[], severity: Finding["severity"]): number {
  return findings.filter((finding) => finding.severity === severity).length;
}

if (require.main === module) {
  void run();
}
