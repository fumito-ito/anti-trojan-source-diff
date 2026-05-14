# architecture.md: Anti Trojan Source Diff Action

## Overview

This project is a small, diff-only GitHub JavaScript Action.

The action receives unified diff text directly or from a file, extracts added lines with file paths and new-file line numbers, scans those added lines for configured Unicode code points, emits GitHub annotations, sets summary outputs, and fails when required.

The action intentionally does not fetch pull request data or use GitHub APIs. This keeps it reusable and easy to test.

## Data flow

```text
caller workflow
  └─ generates unified diff text or file
       ↓
action input: diff or diff-file
       ↓
resolve diff text
       ↓
parse unified diff
       ↓
AddedLine[]
       ↓
scan each added line
       ↓
Finding[]
       ↓
emit GitHub annotations
       ↓
set outputs + fail/pass
```

## Modules

### `src/types.ts`

Owns shared types.

```ts
export type Severity = "error" | "warning";

export type AddedLine = {
  file: string;
  line: number;
  content: string;
};

export type Finding = {
  file: string;
  line: number;
  column: number;
  codePoint: string;
  name: string;
  severity: Severity;
  character: string;
};
```

### `src/diff.ts`

Owns unified diff parsing.

Public API:

```ts
export function parseAddedLines(diffText: string): AddedLine[];
```

Responsibilities:

- Track current file from `+++ b/path` headers.
- Track new-file line number from hunk headers.
- Return only added lines.
- Ignore file headers, removed lines, binary diffs, and no-newline markers.

Important edge cases:

- `+++ /dev/null` should mark the file as non-scannable.
- `+` at the start of added content means an empty added line when the line is exactly `+`.
- `+++ b/file` is a file header, not an added line.
- Hunk headers may use `+12` or `+12,3` forms.
- Context lines increment new-file line numbers.

### `src/scanner.ts`

Owns Unicode detection.

Public API:

```ts
export type ScanOptions = {
  includeZeroWidth: boolean;
};

export function scanAddedLine(line: AddedLine, options: ScanOptions): Finding[];
```

Implementation details:

- Iterate with `for...of` so surrogate pairs are treated as one code point.
- Maintain 1-based column count.
- Match code points against policy maps.
- Return warning-level findings only when `includeZeroWidth` is true.

Policy maps:

```ts
const ERROR_CODE_POINTS = new Map<number, string>([
  [0x202A, "LEFT-TO-RIGHT EMBEDDING"],
  [0x202B, "RIGHT-TO-LEFT EMBEDDING"],
  [0x202C, "POP DIRECTIONAL FORMATTING"],
  [0x202D, "LEFT-TO-RIGHT OVERRIDE"],
  [0x202E, "RIGHT-TO-LEFT OVERRIDE"],
  [0x2066, "LEFT-TO-RIGHT ISOLATE"],
  [0x2067, "RIGHT-TO-LEFT ISOLATE"],
  [0x2068, "FIRST STRONG ISOLATE"],
  [0x2069, "POP DIRECTIONAL ISOLATE"],
]);

// Also treat these ranges as error-level:
// U+0000..U+001F except U+0009: C0 control characters except tab
// U+007F: DELETE
// U+0080..U+009F: C1 control characters
// U+FE00..U+FE0F: VARIATION SELECTOR-1 through VARIATION SELECTOR-16
// U+E0100..U+E01EF: VARIATION SELECTOR-17 through VARIATION SELECTOR-256

const WARNING_CODE_POINTS = new Map<number, string>([
  [0x200B, "ZERO WIDTH SPACE"],
  [0x200C, "ZERO WIDTH NON-JOINER"],
  [0x200D, "ZERO WIDTH JOINER"],
  [0xFEFF, "ZERO WIDTH NO-BREAK SPACE / BOM"],
  [0x00AD, "SOFT HYPHEN"],
  [0x034F, "COMBINING GRAPHEME JOINER"],
  [0x061C, "ARABIC LETTER MARK"],
]);
```

### `src/annotate.ts`

Owns GitHub annotation output.

Public API:

```ts
export type AnnotationOptions = {
  maxAnnotations: number;
};

export function annotateFindings(findings: Finding[], options: AnnotationOptions): void;
```

Implementation details:

- Emit at most `maxAnnotations` annotations.
- Use `core.error` for error findings.
- Use `core.warning` for warning findings.
- If findings are truncated, emit a final `core.notice` explaining that only the first N annotations were shown.

### `src/index.ts`

Owns action orchestration.

Responsibilities:

- Read inputs via `@actions/core`.
- Validate booleans and positive integers.
- Read inline diff text or diff file.
- Call parser, scanner, annotator.
- Set outputs.
- Decide pass/fail.

Pseudo-code:

```ts
async function run(): Promise<void> {
  const failOnWarning = parseBooleanInput("fail-on-warning", false);
  const includeZeroWidth = parseBooleanInput("include-zero-width", true);
  const maxAnnotations = parsePositiveIntegerInput("max-annotations", 50);

  const diffText = await readDiffText();
  const addedLines = parseAddedLines(diffText);
  const findings = addedLines.flatMap((line) => scanAddedLine(line, { includeZeroWidth }));

  annotateFindings(findings, { maxAnnotations });

  const errorCount = findings.filter((f) => f.severity === "error").length;
  const warningCount = findings.filter((f) => f.severity === "warning").length;

  core.setOutput("error-count", String(errorCount));
  core.setOutput("warning-count", String(warningCount));
  core.setOutput("finding-count", String(findings.length));

  if (errorCount > 0 || (failOnWarning && warningCount > 0)) {
    core.setFailed(`Detected ${errorCount} error(s) and ${warningCount} warning(s).`);
  }
}
```

## Design choices

### Reference material

Use `https://github.com/nickboucher/trojan-source` as a primary background reference for Trojan Source examples and terminology.

This action still treats `docs/spec.md` as the authoritative implementation policy. Do not add code points, repository-wide scanning, language-specific parsing, API calls, or other broader behavior solely because it appears in the reference material.

### Diff file input instead of multiline string input

Passing large diffs through workflow outputs or action inputs can hit size and escaping issues. A file path keeps that path simple and robust.

Inline `diff` input is still supported for small diffs and simple workflows. If both `diff-file` and non-empty `diff` are supplied, the action fails so the scanned source is unambiguous.

### No GitHub API dependency

The action should work with diffs generated by `git diff`, `gh pr diff`, or any external tool that emits unified diff format.

### Warnings for zero-width characters

Zero-width characters can be legitimate in some languages and emoji sequences. They are useful to flag, but should not fail by default.

### Error for Bidi controls and variation selectors

Bidirectional override/isolate controls are high-risk in source code diffs and should fail by default.

Variation selectors have legitimate uses, but GlassWorm-style payloads can use invisible variation selector runs to encode bytes. This action treats newly added variation selectors as error-level findings to block that payload channel by default.

### Error for control characters

C0 and C1 control characters are not normally meaningful as literal source text and can alter terminal/editor display, copy/paste behavior, or downstream tooling. The action treats them as error-level findings, except for `U+0009 CHARACTER TABULATION` because tabs are common and valid in source diffs.

## Testing strategy

Use unit tests for pure modules and a small integration test for `index.ts` behavior.

### `diff.ts` tests

- Parses added lines from a simple diff.
- Ignores removed lines.
- Ignores context lines.
- Calculates line numbers with `--unified=0` diffs.
- Calculates line numbers with context diffs.
- Handles `+++ /dev/null`.
- Handles multiple files.

### `scanner.ts` tests

- Detects each error-level code point.
- Detects representative C0/C1 control characters as error-level findings.
- Does not report tab as a control-character finding.
- Detects each warning-level code point when enabled.
- Suppresses warning-level code points when disabled.
- Reports 1-based columns.
- Handles surrogate pairs before a suspicious character without corrupting column count.

### `annotate.ts` tests

- Emits error annotations for error findings.
- Emits warning annotations for warning findings.
- Respects `max-annotations`.

### `index.ts` tests

- Clean diff passes.
- Error finding fails.
- Warning finding passes by default.
- Warning finding fails when `fail-on-warning=true`.
- Invalid diff file fails.
