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
  // Strip standalone -v/-s/-i flags, leaving quoted header values and bodies untouched
  command = command.replace(/'[^']*'|"(?:[^"\\]|\\.)*"|(^|\s)-[vsi](?=\s|$)/gi, (match, lead) =>
    lead === undefined ? match : lead
  );

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

  // Extract URL, ignoring URLs inside header values and request bodies
  const urlSource = command
    .replace(new RegExp(headerRegex.source, 'gi'), ' ')
    .replace(new RegExp(dataRegex.source, 'gi'), ' ');
  const urlRegex = /(https?:\/\/[^\s'"]+)/gi;
  const urlMatches: string[] = [];
  let uMatch: RegExpExecArray | null;
  while ((uMatch = urlRegex.exec(urlSource)) !== null) {
    urlMatches.push(uMatch[1]);
  }

  if (urlMatches.length > 0) {
    result.url = urlMatches[0];
  } else {
    const domainMatch = urlSource.match(/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s'"]*)/);
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
  const BODY_PLACEHOLDER = '__BODY__';
  const opts: Record<string, unknown> = { method: p.method };
  if (Object.keys(p.headers).length) opts.headers = p.headers;
  let bodyExpr = '';
  if (p.body) {
    opts.body = BODY_PLACEHOLDER;
    try {
      bodyExpr = `JSON.stringify(${JSON.stringify(JSON.parse(p.body), null, 2).replace(/\n/g, '\n  ')})`;
    } catch {
      bodyExpr = JSON.stringify(p.body);
    }
  }
  const optsStr = Object.keys(opts).length > 1 || p.method !== 'GET'
    ? `, ${JSON.stringify(opts, null, 2).replace(`"${BODY_PLACEHOLDER}"`, () => bodyExpr)}`
    : '';
  return `// JavaScript fetch() equivalent\nconst response = await fetch('${p.url}'${optsStr});\nconst data = await response.json();\nconsole.log(data);`;
}

/** Render a parsed JSON value as a Python literal (True/False/None instead of true/false/null) */
function toPythonLiteral(value: unknown, indent = ''): string {
  if (value === null) return 'None';
  if (value === true) return 'True';
  if (value === false) return 'False';
  if (typeof value === 'number' || typeof value === 'string') return JSON.stringify(value);
  const inner = indent + '    ';
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    return `[\n${value.map((v) => inner + toPythonLiteral(v, inner)).join(',\n')}\n${indent}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return '{}';
  return `{\n${entries.map(([k, v]) => `${inner}${JSON.stringify(k)}: ${toPythonLiteral(v, inner)}`).join(',\n')}\n${indent}}`;
}

export function toPython(p: ParsedCurl): string {
  const headersStr = Object.keys(p.headers).length ? `\nheaders = ${JSON.stringify(p.headers, null, 4)}` : '';
  let isJson = false;
  let dataStr = '';
  if (p.body) {
    try {
      dataStr = `\ndata = ${toPythonLiteral(JSON.parse(p.body))}`;
      isJson = true;
    } catch {
      dataStr = `\ndata = ${JSON.stringify(p.body)}`;
    }
  }
  const args = [
    `'${p.url}'`,
    Object.keys(p.headers).length ? 'headers=headers' : null,
    p.body ? (isJson ? 'json=data' : 'data=data') : null,
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
