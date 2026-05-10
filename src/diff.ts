import type { AddedLine } from "./types";

const HUNK_HEADER_PATTERN = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function parseAddedLines(diffText: string): AddedLine[] {
  const addedLines: AddedLine[] = [];
  let currentFile: string | undefined;
  let currentNewLine: number | undefined;
  let scanCurrentFile = false;

  for (const rawLine of diffText.split(/\r?\n/)) {
    if (rawLine.startsWith("+++ ")) {
      currentFile = parseNewFilePath(rawLine);
      scanCurrentFile = currentFile !== undefined;
      currentNewLine = undefined;
      continue;
    }

    const hunkMatch = HUNK_HEADER_PATTERN.exec(rawLine);
    if (hunkMatch !== null) {
      currentNewLine = Number.parseInt(hunkMatch[1], 10);
      continue;
    }

    if (rawLine.startsWith("\\ No newline at end of file")) {
      continue;
    }

    if (!scanCurrentFile || currentFile === undefined || currentNewLine === undefined) {
      continue;
    }

    if (rawLine.startsWith("+")) {
      addedLines.push({
        file: currentFile,
        line: currentNewLine,
        content: rawLine.slice(1)
      });
      currentNewLine += 1;
      continue;
    }

    if (rawLine.startsWith("-")) {
      continue;
    }

    if (rawLine.startsWith(" ")) {
      currentNewLine += 1;
    }
  }

  return addedLines;
}

function parseNewFilePath(line: string): string | undefined {
  const path = line.slice(4).split("\t", 1)[0];

  if (path === "/dev/null") {
    return undefined;
  }

  if (path.startsWith("b/")) {
    return path.slice(2);
  }

  return path;
}
