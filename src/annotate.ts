import * as core from "@actions/core";
import type { Finding } from "./types";

export type AnnotationOptions = {
  maxAnnotations: number;
};

const TITLE = "Potential Trojan Source character";

export function annotateFindings(findings: Finding[], options: AnnotationOptions): void {
  const annotationsToEmit = findings.slice(0, options.maxAnnotations);

  for (const finding of annotationsToEmit) {
    const message = formatMessage(finding);
    const properties: core.AnnotationProperties = {
      title: TITLE,
      file: finding.file,
      startLine: finding.line,
      startColumn: finding.column,
      endLine: finding.line,
      endColumn: finding.column + 1
    };

    if (finding.severity === "error") {
      core.error(message, properties);
    } else {
      core.warning(message, properties);
    }
  }

  if (findings.length > options.maxAnnotations) {
    core.notice(
      `Detected ${findings.length} finding(s), but emitted only the first ${options.maxAnnotations} annotation(s).`
    );
  }
}

function formatMessage(finding: Finding): string {
  return `${finding.codePoint} ${finding.name} (${finding.severity}): suspicious invisible or bidirectional control character. Remove it unless it is intentionally required.`;
}
