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
