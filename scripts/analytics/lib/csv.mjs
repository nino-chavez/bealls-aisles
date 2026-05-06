import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

export async function* streamCsv(path) {
  const rl = createInterface({
    input: createReadStream(path, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let header = null;
  for await (const line of rl) {
    if (!line) continue;
    const cols = parseRow(line);
    if (header === null) {
      header = cols;
      continue;
    }
    const row = {};
    for (let i = 0; i < header.length; i++) {
      row[header[i]] = cols[i] ?? '';
    }
    yield row;
  }
}

function parseRow(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}
