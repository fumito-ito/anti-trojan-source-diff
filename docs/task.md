# task.md: Implementation Tasks

## Phase 0: Project bootstrap

- [ ] Create `package.json`.
- [ ] Add dependencies:
  - [ ] `@actions/core`
- [ ] Add dev dependencies:
  - [ ] `typescript`
  - [ ] `@types/node`
  - [ ] `@vercel/ncc`
  - [ ] test framework of choice, preferably Node's built-in test runner or Vitest
- [ ] Create `tsconfig.json`.
- [ ] Create `action.yml`.
- [ ] Create `src/` and `test/` directories.
- [ ] Add npm scripts:
  - [ ] `build`: compile TypeScript
  - [ ] `package`: bundle with ncc to `dist/index.js`
  - [ ] `test`: run tests
  - [ ] `lint` or `typecheck`: at least run `tsc --noEmit`

## Phase 1: Action metadata

- [ ] Implement `action.yml`.
- [ ] Inputs:
  - [ ] `diff`, optional inline unified diff text
  - [ ] `diff-file`, optional path to a unified diff file
  - [ ] `fail-on-warning`, default `false`
  - [ ] `include-zero-width`, default `true`
  - [ ] `max-annotations`, default `50`
- [ ] Outputs:
  - [ ] `error-count`
  - [ ] `warning-count`
  - [ ] `finding-count`
- [ ] Use a current GitHub-supported Node runtime in `runs.using`.
- [ ] Set `runs.main` to `dist/index.js`.

## Phase 2: Shared types

- [ ] Create `src/types.ts`.
- [ ] Define:
  - [ ] `Severity`
  - [ ] `AddedLine`
  - [ ] `Finding`

## Phase 3: Unified diff parser

- [ ] Create `src/diff.ts`.
- [ ] Implement `parseAddedLines(diffText: string): AddedLine[]`.
- [ ] Parse `+++ b/path` file headers.
- [ ] Skip `+++ /dev/null` deleted-file headers.
- [ ] Parse hunk headers with regex like:

```regex
/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/
```

- [ ] Track new-file line numbers.
- [ ] Return only added lines that start with `+` but not `+++ `.
- [ ] Treat a line exactly equal to `+` as an added empty line.
- [ ] Ignore removed lines.
- [ ] Increment new-file line numbers for context lines.
- [ ] Ignore `\ No newline at end of file` marker lines.
- [ ] Add tests for single-file diffs.
- [ ] Add tests for multi-file diffs.
- [ ] Add tests for context lines.
- [ ] Add tests for deleted files.

## Phase 4: Scanner

- [ ] Create `src/scanner.ts`.
- [ ] Add error-level policy map:
  - [ ] U+202A
  - [ ] U+202B
  - [ ] U+202C
  - [ ] U+202D
  - [ ] U+202E
  - [ ] U+2066
  - [ ] U+2067
  - [ ] U+2068
  - [ ] U+2069
- [ ] Add warning-level policy map:
  - [ ] U+200B
  - [ ] U+200C
  - [ ] U+200D
  - [ ] U+FEFF
  - [ ] U+00AD
  - [ ] U+034F
  - [ ] U+061C
- [ ] Implement `scanAddedLine(line, options)`.
- [ ] Use `for...of` iteration for Unicode code points.
- [ ] Report 1-based columns.
- [ ] Honor `includeZeroWidth`.
- [ ] Add tests for all error code points.
- [ ] Add tests for all warning code points.
- [ ] Add test for suppressed warning findings.
- [ ] Add test for column counting with normal ASCII.
- [ ] Add test for column counting after an emoji/surrogate pair.

## Phase 5: Annotation layer

- [ ] Create `src/annotate.ts`.
- [ ] Implement `annotateFindings(findings, options)`.
- [ ] Use `core.error` for error-level findings.
- [ ] Use `core.warning` for warning-level findings.
- [ ] Include file, startLine, startColumn, endLine, endColumn, and title in annotation properties.
- [ ] Cap emitted annotations at `maxAnnotations`.
- [ ] Emit `core.notice` if findings are truncated.
- [ ] Add tests using mocks/spies for `@actions/core`.

## Phase 6: Action entrypoint

- [ ] Create `src/index.ts`.
- [ ] Read inputs.
- [ ] Validate boolean inputs strictly.
- [ ] Validate `max-annotations` as a positive integer.
- [ ] Read inline `diff` or `diff-file` as UTF-8.
- [ ] Parse added lines.
- [ ] Scan added lines.
- [ ] Annotate findings.
- [ ] Set outputs.
- [ ] Fail when error count > 0.
- [ ] Fail when warning count > 0 and `fail-on-warning=true`.
- [ ] Pass otherwise.
- [ ] Add integration-style tests for pass/fail behavior.

## Phase 7: Packaging

- [ ] Build TypeScript.
- [ ] Bundle action with `ncc` to `dist/index.js`.
- [ ] Ensure `dist/index.js` is committed.
- [ ] Ensure `action.yml` points to `dist/index.js`.

## Phase 8: Example workflow and README

- [ ] Create `README.md`.
- [ ] Include a minimal PR workflow.
- [ ] Explain why `diff-file` is preferred over multiline diff input.
- [ ] Explain default severity behavior.
- [ ] Explain how to make warnings fail.
- [ ] Explain how to disable zero-width warnings.
- [ ] Explain branch protection / required status check usage at a high level.

## Phase 9: CI for this action repository

- [ ] Add `.github/workflows/ci.yml`.
- [ ] Run `npm ci`.
- [ ] Run typecheck.
- [ ] Run tests.
- [ ] Run package build.
- [ ] Verify generated `dist/index.js` is up to date, if practical.

## Suggested first implementation order for Codex

1. Implement `types.ts`, `scanner.ts`, and scanner tests.
2. Implement `diff.ts` and diff parser tests.
3. Implement `annotate.ts` with mocked `@actions/core`.
4. Implement `index.ts`.
5. Add `action.yml` and README example.
6. Bundle with `ncc`.
7. Run tests and typecheck.
