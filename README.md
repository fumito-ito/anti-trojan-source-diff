# Anti Trojan Source Diff Action

This GitHub Action scans a unified diff file and reports newly added Trojan Source / invisible Unicode characters as GitHub annotations.

It is intentionally diff-only:

- It does not fetch pull request data.
- It does not call GitHub REST or GraphQL APIs.
- It does not run `actions/checkout` for you.
- It does not scan the whole repository.
- It does not auto-fix files or produce SARIF.

The caller workflow is responsible for checking out the repository and generating the diff file.

## Usage

```yaml
name: trojan-source

on:
  pull_request:

permissions:
  contents: read

jobs:
  trojan-source-check:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v6
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

`git diff --unified=0` is recommended because it keeps the diff small and includes only changed lines. The parser also handles unified diffs with context lines.

## Inputs

| Input | Required | Default | Description |
|---|---:|---:|---|
| `diff-file` | yes | | Path to a unified diff file. |
| `fail-on-warning` | no | `false` | Fail when warning-level findings are detected. |
| `include-zero-width` | no | `true` | Report zero-width and similar invisible characters as warnings. |
| `max-annotations` | no | `50` | Maximum number of GitHub annotations to emit. Findings are still counted after this cap. |

## Outputs

| Output | Description |
|---|---|
| `error-count` | Number of error-level findings. |
| `warning-count` | Number of warning-level findings. |
| `finding-count` | Total number of findings. |

## Detection Policy

Bidirectional formatting controls such as `U+202E RIGHT-TO-LEFT OVERRIDE` are error-level findings and fail by default.

Zero-width and similar invisible characters such as `U+200B ZERO WIDTH SPACE`, `U+200D ZERO WIDTH JOINER`, and `U+00AD SOFT HYPHEN` are warning-level findings by default. These characters can be legitimate in localized text, emoji sequences, or typography, so warnings do not fail unless configured.

To fail on warnings:

```yaml
- uses: OWNER/anti-trojan-source-diff-action@v1
  with:
    diff-file: /tmp/pr.diff
    fail-on-warning: true
```

To ignore zero-width warning-level characters:

```yaml
- uses: OWNER/anti-trojan-source-diff-action@v1
  with:
    diff-file: /tmp/pr.diff
    include-zero-width: false
```

## Development

```bash
npm ci
npm test
npm run typecheck
npm run package
```

`action.yml` points to `dist/index.js`, so run `npm run package` before committing release changes.
