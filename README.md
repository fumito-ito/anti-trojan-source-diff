# Anti Trojan Source Diff Action

This GitHub Action scans unified diff text and reports newly added Trojan Source / invisible Unicode characters as GitHub annotations.

It is intentionally diff-only:

- It does not fetch pull request data.
- It does not call GitHub REST or GraphQL APIs.
- It does not run `actions/checkout` for you.
- It does not scan the whole repository.
- It does not auto-fix files or produce SARIF.

The caller workflow is responsible for checking out the repository and generating the diff.

## Usage With A Diff File

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

## Usage With Inline Diff

For small diffs, you can pass the unified diff directly through a workflow output:

```yaml
- name: Generate diff
  id: diff
  shell: bash
  run: |
    {
      echo 'diff<<EOF'
      git diff --unified=0 \
        "${{ github.event.pull_request.base.sha }}" \
        "${{ github.event.pull_request.head.sha }}"
      echo 'EOF'
    } >> "$GITHUB_OUTPUT"

- uses: OWNER/anti-trojan-source-diff-action@v1
  with:
    diff: ${{ steps.diff.outputs.diff }}
```

Prefer `diff-file` for large diffs to avoid workflow output size and escaping limits. Use only one of `diff-file` or `diff` in a single action step.

## Inputs

| Input | Required | Default | Description |
|---|---:|---:|---|
| `diff` | no | | Unified diff text to scan. Prefer `diff-file` for large diffs. |
| `diff-file` | no | | Path to a unified diff file. |
| `fail-on-warning` | no | `false` | Fail when warning-level findings are detected. |
| `include-zero-width` | no | `true` | Report zero-width, default-ignorable, and format characters as warnings. |
| `max-annotations` | no | `50` | Maximum number of GitHub annotations to emit. Findings are still counted after this cap. |

Either `diff-file` or `diff` must be provided. If both contain diff text, the action fails with an input error.

## Outputs

| Output | Description |
|---|---|
| `error-count` | Number of error-level findings. |
| `warning-count` | Number of warning-level findings. |
| `finding-count` | Total number of findings. |

## Detection Policy

Bidirectional formatting controls such as `U+202E RIGHT-TO-LEFT OVERRIDE` are error-level findings and fail by default.

Variation selectors such as `U+FE0F VARIATION SELECTOR-16` and `U+E0100 VARIATION SELECTOR-17` are also error-level findings. These characters can be used for legitimate emoji or ideographic variants, but they can also encode invisible payload bytes in GlassWorm-style attacks, so newly added variation selectors fail by default.

Control characters such as `U+0000 NULL`, `U+001B ESCAPE`, `U+007F DELETE`, and C1 controls `U+0080..U+009F` are error-level findings. `U+0009 CHARACTER TABULATION` is excluded because tabs are common and valid in source diffs.

Zero-width and similar invisible characters such as `U+200B ZERO WIDTH SPACE`, `U+200D ZERO WIDTH JOINER`, and `U+00AD SOFT HYPHEN` are warning-level findings by default. The warning policy also covers additional Unicode `Default_Ignorable_Code_Point` characters and `General_Category=Format` characters that are not already error-level findings. These characters can be legitimate in localized text, emoji sequences, identifiers, or typography, so warnings do not fail unless configured.

To fail on warnings:

```yaml
- uses: OWNER/anti-trojan-source-diff-action@v1
  with:
    diff-file: /tmp/pr.diff
    fail-on-warning: true
```

To ignore warning-level zero-width, default-ignorable, and format characters:

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

## References

- [nickboucher/trojan-source](https://github.com/nickboucher/trojan-source) for Trojan Source proof-of-concept examples and background material.
- [Trojan Source: Invisible Vulnerabilities](https://trojansource.codes/) for the related paper and disclosure material.
- [Endor Labs: Invisible Threats and the Blind Spots of Security](https://www.endorlabs.com/reports/invisible-threats-glassworm-unicode-vscode) for GlassWorm variation selector payload analysis.
- [Unicode Character Database](https://www.unicode.org/ucd/) for `Default_Ignorable_Code_Point` and `General_Category=Format` property data.
