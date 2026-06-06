import {
  format as formatJsonc,
  applyEdits,
  parse as parseJsonc,
  printParseErrorCode,
  type ParseError,
} from "jsonc-parser";
import { parseDocument } from "yaml";

export type ResolvedSourceFormat = "json" | "yaml" | "jsonl";

function getLineColumnFromIndex(
  text: string,
  index: number,
): { line: number; column: number } {
  const safeIndex = Math.max(0, Math.min(index, text.length));
  let line = 1;
  let column = 1;

  for (let i = 0; i < safeIndex; i += 1) {
    if (text[i] === "\n") {
      line += 1;
      column = 1;
      continue;
    }
    column += 1;
  }

  return { line, column };
}

function toFriendlyParseMessage(code: ParseError["error"]): string {
  const codeName = printParseErrorCode(code);
  const friendlyByCodeName: Record<string, string> = {
    InvalidSymbol: "Invalid symbol",
    InvalidNumberFormat: "Invalid number format",
    PropertyNameExpected: "Property name expected",
    ValueExpected: "Value expected",
    ColonExpected: "Colon expected",
    CommaExpected: "Comma expected",
    CloseBraceExpected: "Missing closing }",
    CloseBracketExpected: "Missing closing ]",
    EndOfFileExpected: "Unexpected trailing content",
    InvalidCommentToken: "Invalid comment token",
    UnexpectedEndOfComment: "Unexpected end of comment",
    UnexpectedEndOfString: "Unexpected end of string",
    UnexpectedEndOfNumber: "Unexpected end of number",
    InvalidUnicode: "Invalid unicode escape",
    InvalidEscapeCharacter: "Invalid escape sequence",
    InvalidCharacter: "Invalid character",
  };

  return friendlyByCodeName[codeName] ?? codeName;
}

export function formatJson(text: string): string {
  const errors: ParseError[] = [];
  parseJsonc(text, errors, {
    allowTrailingComma: false,
    disallowComments: true,
    allowEmptyContent: false,
  });

  if (errors.length > 0) {
    const err = errors[0]!;
    const position = getLineColumnFromIndex(text, err.offset);
    const error: any = new Error(toFriendlyParseMessage(err.error));
    error.line = position.line;
    error.column = position.column;
    throw error;
  }

  const edits = formatJsonc(text, undefined, {
    insertSpaces: true,
    tabSize: 2,
    eol: "\n",
  });
  return applyEdits(text, edits);
}

export function formatYaml(text: string): string {
  const doc = parseDocument(text);
  if (doc.errors && doc.errors.length > 0) {
    const err = doc.errors[0]!;
    let line: number | null = null;
    let column: number | null = null;
    if (err.linePos && err.linePos.length > 0) {
      line = err.linePos[0].line;
      column = err.linePos[0].col;
    }
    const error: any = new Error(err.message.split("\n")[0] || "YAML parse error");
    error.line = line;
    error.column = column;
    throw error;
  }

  return doc.toString();
}

export function formatJsonl(text: string): string {
  const lines = text.split(/\r?\n/);
  const formattedLines = lines.map((line, lineIndex) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return "";
    }

    const parseErrors: ParseError[] = [];
    const parsed = parseJsonc(trimmed, parseErrors, {
      allowTrailingComma: false,
      disallowComments: true,
      allowEmptyContent: false,
    });

    if (parseErrors.length > 0) {
      const err = parseErrors[0]!;
      const error: any = new Error(
        `Line ${lineIndex + 1}: ${toFriendlyParseMessage(err.error)}`,
      );
      error.line = lineIndex + 1;
      error.column = err.offset + 1;
      throw error;
    }

    if (parsed === undefined) {
      return trimmed;
    }

    return JSON.stringify(parsed);
  });

  return formattedLines.filter((l) => l !== "").join("\n");
}

export function formatSource(
  text: string,
  formatType: ResolvedSourceFormat,
): string {
  if (formatType === "yaml") {
    return formatYaml(text);
  }

  if (formatType === "jsonl") {
    return formatJsonl(text);
  }

  return formatJson(text);
}
