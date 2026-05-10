# AGENTS.md

## Project purpose

This repository implements a small GitHub JavaScript Action that scans a unified diff file for newly added Trojan Source / invisible Unicode characters, emits GitHub annotations, and fails the workflow according to policy.

The action must stay intentionally small. It receives a diff file. It does not fetch pull request data. It does not call GitHub APIs. It does not scan the whole repository.

## Non-negotiable scope rules

- Do not add GitHub API calls.
- Do not add checkout logic.
- Do not add a full repository scan mode unless explicitly requested in a later task.
- Do not implement SARIF output unless explicitly requested.
- Do not implement auto-fix behavior.
- Do not introduce a large framework.
- Do not make network calls in tests.
- Do not depend on `anti-trojan-source` CLI at runtime; implement the small scanner directly.
- Do not silently broaden the detection policy beyond `docs/spec.md`.

## Required architecture

Use this module split:

```text
src/
  index.ts       # action input/output and orchestration
  diff.ts        # unified diff parser
  scanner.ts     # Unicode detection policy
  annotate.ts    # GitHub annotation output
  types.ts       # shared types
```

Keep parsing, scanning, and annotation logic separately testable.

## Coding style

- Use TypeScript.
- Prefer small pure functions.
- Prefer explicit return types on exported functions.
- Keep errors actionable.
- Avoid clever regex-heavy implementations when a readable parser is safer.
- Use 1-based line and column numbers for annotations.
- Iterate strings by Unicode code point with `for...of` where scanner column handling matters.

## Runtime and packaging

- This is a JavaScript Action.
- `action.yml` must point to `dist/index.js`.
- Bundle with `@vercel/ncc`.
- Commit generated `dist/index.js`.
- Keep `package-lock.json` committed.

Use the current GitHub-supported Node runtime in `action.yml`. If the repository already uses a runtime, do not change it without a reason.

## Detection policy

### Error-level characters

These must fail by default:

```text
U+202A LEFT-TO-RIGHT EMBEDDING
U+202B RIGHT-TO-LEFT EMBEDDING
U+202C POP DIRECTIONAL FORMATTING
U+202D LEFT-TO-RIGHT OVERRIDE
U+202E RIGHT-TO-LEFT OVERRIDE
U+2066 LEFT-TO-RIGHT ISOLATE
U+2067 RIGHT-TO-LEFT ISOLATE
U+2068 FIRST STRONG ISOLATE
U+2069 POP DIRECTIONAL ISOLATE
```

### Warning-level characters

These must warn by default when `include-zero-width=true`:

```text
U+200B ZERO WIDTH SPACE
U+200C ZERO WIDTH NON-JOINER
U+200D ZERO WIDTH JOINER
U+FEFF ZERO WIDTH NO-BREAK SPACE / BOM
U+00AD SOFT HYPHEN
U+034F COMBINING GRAPHEME JOINER
U+061C ARABIC LETTER MARK
```

Do not add more code points without updating `docs/spec.md`, tests, and README.

## Diff parsing rules

The action scans only added lines in unified diff files.

- `+++ b/path` sets the current annotation path to `path`.
- `+++ /dev/null` means deleted file; skip scanning for that file.
- Hunk headers set the current new-file line number.
- Added lines start with `+` but not `+++ `.
- Removed lines start with `-` but not `--- `.
- Context lines start with a single space.
- Added and context lines increment the new-file line number.
- Removed lines do not increment the new-file line number.
- `\ No newline at end of file` markers do not affect line numbers.

The parser must work with both `--unified=0` diffs and diffs that contain context lines.

## Annotation rules

Use `@actions/core` APIs:

- `core.error` for error-level findings.
- `core.warning` for warning-level findings.
- `core.notice` only for summary/truncation notes.
- `core.setFailed` to fail the action.

Annotations must include:

- `title`
- `file`
- `startLine`
- `startColumn`
- `endLine`
- `endColumn`

Do not print raw `::error` workflow commands unless a test proves `@actions/core` cannot satisfy the requirement.

## Testing requirements

Before considering a task complete, run:

```bash
npm test
npm run typecheck
npm run package
```

If these scripts do not exist yet, create them.

Minimum tests:

- Clean diff passes.
- Added Bidi character produces an error finding.
- Removed Bidi character is ignored.
- Context Bidi character is ignored.
- Added zero-width character produces warning by default.
- Zero-width warnings are suppressed when `include-zero-width=false`.
- Warning fails only when `fail-on-warning=true`.
- Multiple files preserve correct annotation file paths.
- Hunk line numbers are correct.
- Scanner columns are 1-based.

## README requirements

README must include:

- What the action does.
- What the action intentionally does not do.
- Minimal workflow example.
- Recommended `git diff --unified=0` usage.
- Explanation of error vs warning policy.
- Example with `fail-on-warning: true`.
- Example with `include-zero-width: false`.

## Implementation discipline

- Make the smallest change that satisfies the current task.
- Do not rewrite working modules without cause.
- Keep public APIs stable once tests depend on them.
- When changing detection policy, update tests first.
- When changing action inputs/outputs, update `action.yml`, README, and tests together.

## Security posture

This action is a defensive security tool. Prefer false positives over silent misses for Bidi controls. Prefer warnings rather than failures for zero-width characters because legitimate use cases exist.

Never log full secrets or environment variables. The action should not need secrets.
