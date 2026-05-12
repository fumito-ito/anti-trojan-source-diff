# spec.md: Anti Trojan Source Diff Action

## 1. Goal

Build a small GitHub JavaScript Action that receives unified diff text, either directly or from a diff file, scans only added lines for suspicious Unicode characters used in Trojan Source-style attacks or invisible-character copy/paste attacks, emits GitHub annotations on the exact changed lines, and fails the workflow when policy requires it.

This action must not be responsible for fetching pull request data, calling GitHub APIs, checking out code, or deciding which diff to generate. The caller workflow owns diff generation.

## 2. Non-goals

- Do not implement a general-purpose repository scanner in v1.
- Do not call the GitHub REST or GraphQL API.
- Do not require `actions/checkout` inside the action.
- Do not parse source code languages semantically.
- Do not implement ESLint integration.
- Do not produce SARIF in v1.
- Do not auto-fix or rewrite files.
- Do not maintain a large allowlist system in v1.

## 3. Primary use case

A repository wants a required pull request status check that blocks newly introduced Trojan Source / invisible Unicode characters.

Caller workflow:

```yaml
name: trojan-source

on:
  pull_request:

permissions:
  contents: read

jobs:
  trojan-source-check:
    name: trojan-source-check
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Generate PR diff
        shell: bash
        run: |
          git diff --unified=0 \
            "${{ github.event.pull_request.base.sha }}" \
            "${{ github.event.pull_request.head.sha }}" \
            > /tmp/pr.diff

      - uses: OWNER/anti-trojan-source-diff-action@v1
        with:
          diff-file: /tmp/pr.diff
```

## 4. Action contract

### 4.1 Inputs

#### `diff-file`

- Required: no
- Type: string
- Meaning: path to a unified diff file.
- The action reads this file from the runner filesystem.

#### `diff`

- Required: no
- Type: string
- Meaning: unified diff text.
- Intended for small diffs passed through workflow outputs.
- Prefer `diff-file` for large diffs to avoid workflow output size and escaping limits.

Exactly one input source should be used. The action fails if both `diff-file` and non-empty `diff` are supplied. If `diff` is explicitly supplied as an empty string, the action treats it as an empty diff and succeeds with zero findings.

#### `fail-on-warning`

- Required: no
- Default: `false`
- Allowed values: `true`, `false`
- Meaning: if `true`, warning-level findings also fail the action.

#### `include-zero-width`

- Required: no
- Default: `true`
- Allowed values: `true`, `false`
- Meaning: if `true`, report warning-level zero-width and similar invisible characters.

#### `max-annotations`

- Required: no
- Default: `50`
- Allowed values: positive integer
- Meaning: maximum number of GitHub annotations emitted. The action must still count all findings and fail correctly even if annotations are capped.

### 4.2 Outputs

#### `error-count`

Number of error-level findings.

#### `warning-count`

Number of warning-level findings.

#### `finding-count`

Total number of findings.

### 4.3 Exit behavior

- Exit success when no error-level findings exist and either `fail-on-warning=false` or no warning-level findings exist.
- Exit failure when at least one error-level finding exists.
- Exit failure when `fail-on-warning=true` and at least one warning-level finding exists.
- Invalid input, unreadable diff file, or malformed action configuration should fail the action.

## 5. Detection policy

### 5.1 Error-level characters

These should fail by default because they are directly relevant to Trojan Source-style bidirectional text attacks or invisible payload encoding.

| Code point | Name |
|---|---|
| U+202A | LEFT-TO-RIGHT EMBEDDING |
| U+202B | RIGHT-TO-LEFT EMBEDDING |
| U+202C | POP DIRECTIONAL FORMATTING |
| U+202D | LEFT-TO-RIGHT OVERRIDE |
| U+202E | RIGHT-TO-LEFT OVERRIDE |
| U+2066 | LEFT-TO-RIGHT ISOLATE |
| U+2067 | RIGHT-TO-LEFT ISOLATE |
| U+2068 | FIRST STRONG ISOLATE |
| U+2069 | POP DIRECTIONAL ISOLATE |
| U+FE00..U+FE0F | VARIATION SELECTOR-1 through VARIATION SELECTOR-16 |
| U+E0100..U+E01EF | VARIATION SELECTOR-17 through VARIATION SELECTOR-256 |

Variation selectors have legitimate Unicode uses, especially for emoji and ideographic variants. In this action they are still error-level because GlassWorm-style payloads can encode bytes into long runs of invisible variation selectors and the action is intended to block newly introduced invisible code in diffs.

### 5.2 Warning-level characters

These are useful for Discord/SNS copy-paste defense, but can have legitimate uses in localized text, emoji sequences, or typography. They should warn by default and fail only when `fail-on-warning=true`.

| Code point | Name |
|---|---|
| U+200B | ZERO WIDTH SPACE |
| U+200C | ZERO WIDTH NON-JOINER |
| U+200D | ZERO WIDTH JOINER |
| U+FEFF | ZERO WIDTH NO-BREAK SPACE / BOM |
| U+00AD | SOFT HYPHEN |
| U+034F | COMBINING GRAPHEME JOINER |
| U+061C | ARABIC LETTER MARK |

If `include-zero-width=false`, warning-level characters are not reported.

### 5.3 Planned policy expansions

The current implementation intentionally covers the explicit code points listed above. The following policy expansions are planned as separate feature branches. Each branch must update this section, tests, README, and implementation together before changing behavior.

#### Additional control characters

Add detection for C0 and C1 control characters in added diff lines, excluding characters that are already structural or commonly valid in source diffs.

Initial target set:

- U+0000..U+001F, excluding U+0009 CHARACTER TABULATION.
- U+007F DELETE.
- U+0080..U+009F.

Severity: `error`.

Rationale: these characters are not normally meaningful as literal source text and can affect terminal/editor display, copy/paste behavior, or downstream tooling. Line terminators are not expected inside parsed added-line content because diff parsing splits lines before scanning.

#### Additional default-ignorable and format characters

Add warning-level detection for additional Unicode characters whose display can be absent, unstable, or context-dependent, using Unicode data as the source of truth rather than a hand-written ad hoc list.

Initial target set:

- Unicode `Default_Ignorable_Code_Point` characters not already classified as error-level.
- Unicode general category `Cf` format characters not already classified as error-level.
- Exclude characters already listed in the warning-level table from duplicate reporting.

Severity: `warning` by default; fails only when `fail-on-warning=true`.

Configuration: `include-zero-width=false` suppresses these findings for backward compatibility, even though the expanded set is broader than zero-width characters.

Rationale: many format/default-ignorable characters have legitimate uses in localized text, emoji sequences, identifiers, and typography. They are still review-worthy in source diffs because they may be invisible to reviewers.

#### Mixed-script confusable identifiers

Add warning-level detection for added-line tokens that appear to contain mixed-script homoglyph/confusable usage.

Initial target heuristic:

- Tokenize added line content into identifier-like runs of Unicode letters, marks, decimal numbers, connector punctuation, `$`, and `_`.
- For each token, report a warning when both conditions hold:
  - the token contains at least one ASCII Latin letter or digit; and
  - the token contains at least one non-ASCII character whose Unicode Technical Standard #39 confusable skeleton maps to ASCII letters, digits, or identifier punctuation.

Severity: `warning` by default; fails only when `fail-on-warning=true`.

Non-goals for the initial branch:

- Do not build a repository-wide symbol table.
- Do not compare new identifiers against all existing repository identifiers.
- Do not attempt language-specific parsing.
- Do not warn merely because a token is non-ASCII.
- Do not claim complete homoglyph protection.

Rationale: homoglyph detection has substantially higher false-positive risk than Bidi or control-character detection, especially for internationalized code and documentation. A mixed ASCII/non-ASCII token heuristic catches common attacks such as Cyrillic letters embedded in Latin-looking identifiers while avoiding broad warnings for ordinary non-ASCII text.

### 5.4 Policy references

The implemented and planned policy is based on:

- Trojan Source proof-of-concept repository: `https://github.com/nickboucher/trojan-source`
- Trojan Source paper: `https://trojansource.codes/trojan-source.pdf`
- Unicode Technical Report #36, Unicode Security Considerations: `https://www.unicode.org/reports/tr36/`
- Unicode Technical Standard #39, Unicode Security Mechanisms: `https://www.unicode.org/reports/tr39/`
- Unicode security data files, including confusables data: `https://www.unicode.org/Public/security/latest/`

## 6. Diff parsing requirements

The action scans unified diff text. It must identify added lines and their new-file line numbers.

### 6.1 Files

Handle file headers like:

```diff
diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
```

The annotation file path must use the new file path without the `b/` prefix.

Examples:

- `+++ b/src/index.ts` -> `src/index.ts`
- `+++ /dev/null` -> deleted file; skip subsequent added-line processing until a new file header appears.

### 6.2 Hunks

Handle hunk headers:

```diff
@@ -10,2 +10,3 @@ optional context
```

The parser must recover the new-file starting line. For each hunk:

- Lines beginning with `+` but not `+++ ` are additions.
- Lines beginning with `-` but not `--- ` are removals.
- Lines beginning with space are context.
- Lines beginning with `\ No newline at end of file` do not affect line numbers.

Line number update rules:

- Added line: report current new line number, then increment new line number.
- Context line: increment new line number.
- Removed line: do not increment new line number.

The caller is expected to use `git diff --unified=0`, but the parser must also work with context lines.

### 6.3 Binary diffs

Binary diff sections have no added text lines. They should be skipped without failing.

## 7. Annotation requirements

Use `@actions/core` annotation APIs, not manual `echo ::error` strings unless there is a strong reason.

For each finding within `max-annotations`:

- Error-level finding: `core.error(message, properties)`
- Warning-level finding: `core.warning(message, properties)`

Annotation properties:

```ts
{
  title: "Potential Trojan Source character",
  file: finding.file,
  startLine: finding.line,
  startColumn: finding.column,
  endLine: finding.line,
  endColumn: finding.column + 1
}
```

Messages should include:

- Code point, e.g. `U+202E`
- Unicode name
- Severity
- Short explanation
- Suggested fix: remove the character unless intentionally required

Columns should be 1-based. Use JavaScript string iteration by Unicode code point, not raw UTF-16 index, when calculating user-facing columns.

## 8. Suggested repository structure

```text
.
├── action.yml
├── package.json
├── package-lock.json
├── tsconfig.json
├── src
│   ├── index.ts
│   ├── diff.ts
│   ├── scanner.ts
│   ├── annotate.ts
│   └── types.ts
├── test
│   ├── diff.test.ts
│   ├── scanner.test.ts
│   └── fixtures
│       ├── bidi.diff
│       ├── zero-width.diff
│       └── clean.diff
└── dist
    └── index.js
```

## 9. Packaging

This must be a JavaScript Action. Use TypeScript for source code and bundle the action into `dist/index.js`.

Recommended stack:

- TypeScript
- `@actions/core`
- `@vercel/ncc` for bundling
- Node test runner or Vitest
- ESLint / Prettier optional

The committed action must include `dist/index.js`, because GitHub Actions runs the bundled file from the referenced repository/tag.

## 10. Acceptance criteria

- `action.yml` defines a JavaScript action with `runs.using` set to a current GitHub-supported Node runtime.
- The action accepts `diff-file` or `diff` and does not require GitHub API permissions.
- The action parses unified diffs and scans only added lines.
- Error-level Bidi control characters and variation selectors produce error annotations and fail the job.
- Warning-level invisible characters produce warning annotations and do not fail by default.
- `fail-on-warning=true` makes warning-level findings fail the job.
- `include-zero-width=false` suppresses warning-level invisible-character checks.
- A clean diff passes.
- A diff with only removed dangerous characters passes, because removed lines are not newly introduced.
- A diff with context lines containing dangerous characters passes unless the same character appears in an added line.
- Tests cover parsing line numbers, file paths, scanner columns, severity policy, and final fail behavior.
