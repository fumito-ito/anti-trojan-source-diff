# task.md: Current Task Status

This file tracks the current implementation state against `docs/spec.md`.

## Completed v1 scope

- [x] Project bootstrap
  - [x] `package.json`
  - [x] `package-lock.json`
  - [x] TypeScript configuration
  - [x] `action.yml`
  - [x] `src/` and `test/` directories
  - [x] npm scripts: `build`, `package`, `test`, `typecheck`
- [x] Runtime and packaging
  - [x] JavaScript Action using Node 24
  - [x] `action.yml` points to `dist/index.js`
  - [x] Bundling with `@vercel/ncc`
  - [x] Generated `dist` files are committed
  - [x] TypeScript uses `module: "Node16"` and `moduleResolution: "Node16"`
  - [x] `@actions/core` v3 is loaded with dynamic import at runtime
- [x] Action metadata
  - [x] Input: `diff`
  - [x] Input: `diff-file`
  - [x] Input: `fail-on-warning`
  - [x] Input: `include-zero-width`
  - [x] Input: `max-annotations`
  - [x] Output: `error-count`
  - [x] Output: `warning-count`
  - [x] Output: `finding-count`
- [x] Required module split
  - [x] `src/index.ts`
  - [x] `src/action.ts`
  - [x] `src/diff.ts`
  - [x] `src/scanner.ts`
  - [x] `src/annotate.ts`
  - [x] `src/types.ts`
- [x] Unified diff parser
  - [x] Parses `+++ b/path` file headers
  - [x] Skips `+++ /dev/null`
  - [x] Parses hunk headers
  - [x] Tracks new-file line numbers
  - [x] Scans added lines only
  - [x] Ignores removed lines
  - [x] Ignores context lines while preserving line numbers
  - [x] Handles `\ No newline at end of file`
  - [x] Supports both `--unified=0` and context diffs
- [x] Scanner
  - [x] Detects Bidi control characters as error-level findings
  - [x] Detects variation selectors as error-level findings
  - [x] Detects C0 and C1 control characters as error-level findings, excluding tab
  - [x] Detects configured zero-width and similar characters as warning-level findings
  - [x] Honors `include-zero-width=false`
  - [x] Reports 1-based line and column numbers
  - [x] Iterates strings by Unicode code point
- [x] Annotation layer
  - [x] Uses `core.error` for error-level findings
  - [x] Uses `core.warning` for warning-level findings
  - [x] Uses `core.notice` for truncation notices
  - [x] Includes file, start/end line, start/end column, and title
  - [x] Caps emitted annotations with `max-annotations`
- [x] Action orchestration
  - [x] Reads either inline `diff` or `diff-file`
  - [x] Fails when both `diff-file` and non-empty `diff` are supplied
  - [x] Treats explicit empty `diff` as an empty diff
  - [x] Validates boolean inputs strictly
  - [x] Validates `max-annotations` as a positive integer
  - [x] Sets output counts
  - [x] Fails on error-level findings
  - [x] Fails on warning-level findings only when `fail-on-warning=true`
- [x] Tests
  - [x] Clean diff passes
  - [x] Added Bidi character fails
  - [x] Removed Bidi character is ignored
  - [x] Context Bidi character is ignored
  - [x] Added variation selector fails
  - [x] Added control character fails
  - [x] Added zero-width character warns by default
  - [x] Zero-width warnings are suppressed when `include-zero-width=false`
  - [x] Warning fails only when `fail-on-warning=true`
  - [x] Multiple files preserve annotation paths
  - [x] Hunk line numbers are correct
  - [x] Scanner columns are 1-based
  - [x] Surrogate pairs count as one user-facing column
  - [x] Tab is not reported as a control-character finding
- [x] README
  - [x] Describes what the action does
  - [x] Describes intentional non-goals
  - [x] Includes minimal workflow example
  - [x] Recommends `git diff --unified=0`
  - [x] Explains error vs warning policy
  - [x] Shows `fail-on-warning: true`
  - [x] Shows `include-zero-width: false`
- [x] Repository CI
  - [x] Runs `npm ci`
  - [x] Runs `npm run typecheck`
  - [x] Runs `npm test`
  - [x] Runs `npm run package`
  - [x] Verifies generated `dist` is up to date
  - [x] Self-checks pull request diffs using this local action

## Open planned policy expansions

The following tasks are intentionally not implemented yet. Implement each item on a separate feature branch and update `docs/spec.md`, tests, README, and generated `dist` together.

### Additional default-ignorable and format characters

- [ ] Choose the Unicode data source and generation/update workflow.
- [ ] Add warning-level detection for `Default_Ignorable_Code_Point` characters not already error-level.
- [ ] Add warning-level detection for Unicode `Cf` format characters not already error-level.
- [ ] Avoid duplicate reporting for characters already listed in the existing warning policy.
- [ ] Keep `include-zero-width=false` as the suppression switch for this expanded warning set.
- [ ] Add focused tests for representative default-ignorable and format characters.
- [ ] Add tests proving existing error-level characters remain errors.
- [ ] Update README policy text.
- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run package`.

### Mixed-script confusable identifiers

- [ ] Choose the Unicode TR39 confusables data source and generation/update workflow.
- [ ] Implement identifier-like tokenization for added diff lines.
- [ ] Detect mixed ASCII and non-ASCII confusable token patterns.
- [ ] Treat findings as warning-level.
- [ ] Avoid warning on ordinary non-ASCII text without mixed-script confusable risk.
- [ ] Do not add repository-wide symbol-table analysis.
- [ ] Do not add language-specific parsing.
- [ ] Add tests for a representative Cyrillic-in-Latin-looking identifier.
- [ ] Add tests for ordinary non-ASCII text that should not warn.
- [ ] Update README policy text.
- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run package`.

## Routine verification before merging changes

Run these commands before considering an implementation change complete:

```bash
npm test
npm run typecheck
npm run package
```

For dependency updates, run `npm ci` first so local `node_modules` matches `package-lock.json`.
