export interface ParsedCurl {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  raw: string;
  queryParams: Record<string, string>;
}

export function parseCurl(curlCommand: string): ParsedCurl {
  const result: ParsedCurl = {
    method: 'GET',
    url: '',
    headers: {},
    body: '',
    raw: curlCommand,
    queryParams: {},
  };

  if (!curlCommand || typeof curlCommand !== 'string' || !curlCommand.trim()) {
    return result;
  }

  // Normalize backslash-newline and collapse spaces
  let command = curlCommand
    .trim()
    .replace(/\\\s*\n\s*/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (command.toLowerCase().startsWith('curl')) {
    command = command.substring(4).trim();
  }

  // Remove harmless flags
  command = command.replace(/--compressed\s*/gi, '');
  command = command.replace(/-[vsi]\s+/gi, '');

  // Extract HTTP method
  const methodMatch = command.match(/-X\s+(\w+)|--request\s+(\w+)/i);
  if (methodMatch) {
    result.method = (methodMatch[1] || methodMatch[2]).toUpperCase();
  }

  // Extract headers: -H 'K: V' or --header "K: V"
  const headerRegex = /-H\s+(['"])((?:(?!\1)[^\\]|\\.)*)\1|--header\s+(['"])((?:(?!\3)[^\\]|\\.)*)\3/gi;
  let headerMatch: RegExpExecArray | null;
  while ((headerMatch = headerRegex.exec(command)) !== null) {
    const headerStr = headerMatch[2] || headerMatch[4];
    const colonIndex = headerStr.indexOf(':');
    if (colonIndex > 0) {
      const key = headerStr.substring(0, colonIndex).trim();
      const value = headerStr.substring(colonIndex + 1).trim();
      result.headers[key] = value;
    }
  }

  // Extract data/body: -d, --data, --data-raw, --data-binary
  const dataRegex = /(?:-d|--data(?:-raw|-binary)?)\s+(['"])((?:(?!\1)[^\\]|\\.)*)\1/i;
  const dataMatch = command.match(dataRegex);
  if (dataMatch) {
    result.body = dataMatch[2];
    if (!methodMatch) {
      result.method = 'POST';
    }
  }

  // Extract URL
  const urlRegex = /(https?:\/\/[^\s'"]+)/gi;
  const urlMatches: string[] = [];
  let uMatch: RegExpExecArray | null;
  while ((uMatch = urlRegex.exec(command)) !== null) {
    urlMatches.push(uMatch[1]);
  }

  if (urlMatches.length > 0) {
    result.url = urlMatches[urlMatches.length - 1];
  } else {
    const domainMatch = command.match(/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s'"]*)/);
    if (domainMatch) {
      result.url = 'https://' + domainMatch[1];
    }
  }

  if (result.url) {
    try {
      const parsedUrl = new URL(result.url);
      parsedUrl.searchParams.forEach((val, key) => {
        result.queryParams[key] = val;
      });
    } catch {
      // Ignore URL parsing errors for non-standard formats
    }
  }

  return result;
}

export function toFetch(p: ParsedCurl): string {
  const opts: Record<string, unknown> = { method: p.method };
  if (Object.keys(p.headers).length) opts.headers = p.headers;
  if (p.body) {
    try {
      opts.body = JSON.parse(p.body);
    } catch {
      opts.body = p.body;
    }
  }
  const optsStr = Object.keys(opts).length > 1 || p.method !== 'GET' ? `, ${JSON.stringify(opts, null, 2)}` : '';
  return `// JavaScript fetch() equivalent\nconst response = await fetch('${p.url}'${optsStr});\nconst data = await response.json();\nconsole.log(data);`;
}

export function toPython(p: ParsedCurl): string {
  const headersStr = Object.keys(p.headers).length ? `\nheaders = ${JSON.stringify(p.headers, null, 4)}` : '';
  const dataStr = p.body ? `\ndata = ${p.body}` : '';
  const args = [
    `'${p.url}'`,
    Object.keys(p.headers).length ? 'headers=headers' : null,
    p.body ? (p.body.trim().startsWith('{') ? 'json=data' : 'data=data') : null,
  ]
    .filter(Boolean)
    .join(', ');

  return `# Python requests equivalent\nimport requests${headersStr}${dataStr}\n\nresponse = requests.${p.method.toLowerCase()}(${args})\nprint(response.json())`;
}

export type DiffStatus = 'left' | 'right' | 'diff' | 'same';

export interface HeaderDiffItem {
  key: string;
  left?: string;
  right?: string;
  status: DiffStatus;
}

export function diffHeaders(
  a: Record<string, string>,
  b: Record<string, string>
): HeaderDiffItem[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return Array.from(keys).map((key) => {
    if (!(key in b)) return { key, left: a[key], status: 'left' };
    if (!(key in a)) return { key, right: b[key], status: 'right' };
    if (a[key] !== b[key]) return { key, left: a[key], right: b[key], status: 'diff' };
    return { key, left: a[key], right: b[key], status: 'same' };
  });
}
