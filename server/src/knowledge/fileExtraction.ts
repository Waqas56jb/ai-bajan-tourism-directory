/**
 * Text extraction for uploaded knowledge files.
 *
 * Supported: .txt, .md, .csv (UTF-8). PDF and DOCX are deliberately NOT accepted yet — they need
 * extra parsing libraries (e.g. pdf-parse / mammoth) and fixtures to test them reliably. Rejecting
 * them is better than pretending they were processed.
 */
export const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.csv'] as const;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export class ExtractionError extends Error {
  constructor(
    public readonly code: 'UNSUPPORTED_TYPE' | 'NOT_TEXT' | 'EMPTY' | 'TOO_LARGE',
    message: string,
  ) {
    super(message);
  }
}

export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'upload';
  return base.normalize('NFKC').replace(/[^A-Za-z0-9._ -]/g, '_').replace(/^\.+/, '').slice(0, 120) || 'upload';
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/** CSV rows become "Header: value; Header: value" lines so each row reads as a self-contained fact. */
export function csvToText(csv: string): string {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return csv;
  const headers = parseCsvLine(lines[0]);
  return lines
    .slice(1, 5001)
    .map((line) => {
      const cells = parseCsvLine(line);
      return headers
        .map((h, i) => (cells[i] ? `${h || `Column ${i + 1}`}: ${cells[i]}` : ''))
        .filter(Boolean)
        .join('; ');
    })
    .filter(Boolean)
    .join('\n\n');
}

export function extractText(fileName: string, buffer: Buffer): { text: string; mime: string } {
  if (buffer.length > MAX_UPLOAD_BYTES) throw new ExtractionError('TOO_LARGE', 'File is larger than 2 MB.');
  const ext = (fileName.match(/\.[A-Za-z0-9]+$/)?.[0] ?? '').toLowerCase();
  if (!(SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new ExtractionError('UNSUPPORTED_TYPE', `Only ${SUPPORTED_EXTENSIONS.join(', ')} files can be processed at the moment.`);
  }
  // Content check — the client-supplied MIME type is not trusted. Binary data (NUL bytes or invalid
  // UTF-8) is rejected even if the extension says .txt.
  if (buffer.includes(0)) throw new ExtractionError('NOT_TEXT', 'The file does not look like a text file.');
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new ExtractionError('NOT_TEXT', 'The file is not valid UTF-8 text.');
  }
  text = text.replace(/^﻿/, '');
  if (ext === '.csv') text = csvToText(text);
  if (!text.trim()) throw new ExtractionError('EMPTY', 'The file contains no text.');
  return { text, mime: ext === '.csv' ? 'text/csv' : ext === '.md' ? 'text/markdown' : 'text/plain' };
}
