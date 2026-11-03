// Tests for JSON to TypeScript Interface Generator logic

function toPascalCase(str) {
  return str
    .replace(/[_\-\s]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, c => c.toUpperCase());
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function inferType(value, key, ctx) {
  if (value === null)           return 'null';
  if (typeof value === 'string')  return 'string';
  if (typeof value === 'number')  return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value))       return inferArrayType(value, key, ctx);
  if (typeof value === 'object')  return inferObjectType(value, key, ctx);
  return 'unknown';
}

function inferArrayType(arr, key, ctx) {
  if (arr.length === 0) return 'unknown[]';
  const elementType = inferType(arr[0], key + 'Item', ctx);
  return elementType + '[]';
}

function inferObjectType(obj, key, ctx) {
  const interfaceName = toPascalCase(key);
  if (!ctx.interfaces[interfaceName]) {
    ctx.interfaces[interfaceName] = null;
    ctx.interfaces[interfaceName] = buildInterface(obj, interfaceName, ctx);
  }
  return interfaceName;
}

function buildInterface(obj, name, ctx) {
  const semi = ctx.options.semicolons ? ';' : '';
  const useType = ctx.options.useTypeAlias;
  const optionalNulls = ctx.options.optionalFields;

  const lines = [];
  const header = useType ? 'type ' + name + ' = {' : 'interface ' + name + ' {';
  lines.push(header);

  Object.keys(obj).forEach(key => {
    const value = obj[key];
    let tsType = inferType(value, key, ctx);

    let propKey = key;
    const isOptional = optionalNulls && value === null;
    if (isOptional) {
      propKey = key + '?';
      tsType = tsType === 'null' ? 'null | undefined' : tsType + ' | null';
    }

    lines.push('  ' + propKey + ': ' + tsType + semi);
  });

  lines.push('}');
  return lines.join('\n');
}

function convertJsonToTypeScript(jsonText, options) {
  const parsed = JSON.parse(jsonText);
  const rootName = (options.rootName || 'Root').trim() || 'Root';
  const ctx = { interfaces: {}, options };

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      const semi = options.semicolons ? ';' : '';
      return 'type ' + rootName + ' = unknown[]' + semi;
    }
    if (typeof parsed[0] === 'object' && parsed[0] !== null && !Array.isArray(parsed[0])) {
      inferObjectType(parsed[0], rootName, ctx);
      const semi = options.semicolons ? ';' : '';
      const rootAlias = 'type ' + rootName + ' = ' + rootName + '[]' + semi;
      const parts = [rootAlias];
      Object.keys(ctx.interfaces).forEach(iName => {
        if (ctx.interfaces[iName]) parts.push('\n' + ctx.interfaces[iName]);
      });
      return parts.join('\n');
    }
    const semi = options.semicolons ? ';' : '';
    return 'type ' + rootName + ' = ' + inferType(parsed[0], 'item', ctx) + '[]' + semi;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    const semi = options.semicolons ? ';' : '';
    return '// Primitive JSON value\ntype ' + rootName + ' = ' + inferType(parsed, rootName, ctx) + semi;
  }

  ctx.interfaces[rootName] = buildInterface(parsed, rootName, ctx);

  const parts = [];
  if (ctx.interfaces[rootName]) parts.push(ctx.interfaces[rootName]);
  Object.keys(ctx.interfaces).forEach(iName => {
    if (iName !== rootName && ctx.interfaces[iName]) {
      parts.push('\n' + ctx.interfaces[iName]);
    }
  });
  return parts.join('\n');
}

// ─── Test harness ─────────────────────────────────────────────────────────────

export class JsonToTypeScriptTester {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.failedTests = [];
  }

  test(name, fn) {
    try {
      const result = fn();
      if (result === true) {
        this.passed++;
        console.log('  ✅ ' + name);
      } else {
        this.failed++;
        this.failedTests.push(name);
        console.log('  ❌ ' + name + ' — returned: ' + result);
      }
    } catch (err) {
      this.failed++;
      this.failedTests.push(name);
      console.log('  ❌ ' + name + ' — Error: ' + err.message);
    }
  }

  assert(actual, expected, msg) {
    if (actual === expected) return true;
    throw new Error((msg || '') + ' | expected: ' + JSON.stringify(expected) + ', got: ' + JSON.stringify(actual));
  }

  contains(actual, needle, msg) {
    if (actual.includes(needle)) return true;
    throw new Error((msg || '') + ' | expected to contain: ' + JSON.stringify(needle) + ', in: ' + JSON.stringify(actual));
  }

  runAll() {
    console.log('\nJSON to TypeScript Interface Generator Tests');
    console.log('============================================');

    const defaultOpts = { rootName: 'Root', useTypeAlias: false, optionalFields: false, semicolons: true };

    // ── Primitive types ──────────────────────────────────────────────────────

    this.test('string field → string type', () => {
      const out = convertJsonToTypeScript('{"name":"Alice"}', defaultOpts);
      return this.contains(out, 'name: string;', 'string field');
    });

    this.test('number field → number type', () => {
      const out = convertJsonToTypeScript('{"age":30}', defaultOpts);
      return this.contains(out, 'age: number;', 'number field');
    });

    this.test('float field → number type', () => {
      const out = convertJsonToTypeScript('{"score":98.5}', defaultOpts);
      return this.contains(out, 'score: number;', 'float field');
    });

    this.test('boolean field → boolean type', () => {
      const out = convertJsonToTypeScript('{"active":true}', defaultOpts);
      return this.contains(out, 'active: boolean;', 'boolean field');
    });

    this.test('null field → null type', () => {
      const out = convertJsonToTypeScript('{"data":null}', defaultOpts);
      return this.contains(out, 'data: null;', 'null field');
    });

    // ── Interface declaration ────────────────────────────────────────────────

    this.test('output starts with "interface Root {"', () => {
      const out = convertJsonToTypeScript('{"x":1}', defaultOpts);
      return this.contains(out, 'interface Root {', 'interface keyword');
    });

    this.test('interface closes with "}"', () => {
      const out = convertJsonToTypeScript('{"x":1}', defaultOpts);
      return this.assert(out.trimEnd().endsWith('}'), true, 'closing brace');
    });

    this.test('custom root name respected', () => {
      const opts = Object.assign({}, defaultOpts, { rootName: 'User' });
      const out = convertJsonToTypeScript('{"name":"Alice"}', opts);
      return this.contains(out, 'interface User {', 'custom root name');
    });

    // ── type alias option ────────────────────────────────────────────────────

    this.test('useTypeAlias produces "type Root = {"', () => {
      const opts = Object.assign({}, defaultOpts, { useTypeAlias: true });
      const out = convertJsonToTypeScript('{"x":1}', opts);
      return this.contains(out, 'type Root = {', 'type alias');
    });

    // ── Semicolons option ────────────────────────────────────────────────────

    this.test('semicolons:false omits semicolons', () => {
      const opts = Object.assign({}, defaultOpts, { semicolons: false });
      const out = convertJsonToTypeScript('{"name":"Alice"}', opts);
      return this.assert(out.includes('name: string;'), false, 'no semicolon') &&
             this.contains(out, 'name: string', 'property still present');
    });

    // ── Optional fields option ───────────────────────────────────────────────

    this.test('optionalFields marks null value as optional', () => {
      const opts = Object.assign({}, defaultOpts, { optionalFields: true });
      const out = convertJsonToTypeScript('{"data":null}', opts);
      return this.contains(out, 'data?:', 'optional marker');
    });

    // ── Nested object ────────────────────────────────────────────────────────

    this.test('nested object generates inner interface', () => {
      const json = '{"user":{"name":"Alice","age":30}}';
      const out = convertJsonToTypeScript(json, defaultOpts);
      return this.contains(out, 'interface User {', 'nested interface generated');
    });

    this.test('nested object field typed as interface name', () => {
      const json = '{"user":{"name":"Alice"}}';
      const out = convertJsonToTypeScript(json, defaultOpts);
      return this.contains(out, 'user: User;', 'nested field type');
    });

    // ── Arrays ───────────────────────────────────────────────────────────────

    this.test('string array → string[]', () => {
      const out = convertJsonToTypeScript('{"tags":["a","b"]}', defaultOpts);
      return this.contains(out, 'tags: string[];', 'string array');
    });

    this.test('number array → number[]', () => {
      const out = convertJsonToTypeScript('{"ids":[1,2,3]}', defaultOpts);
      return this.contains(out, 'ids: number[];', 'number array');
    });

    this.test('empty array → unknown[]', () => {
      const out = convertJsonToTypeScript('{"items":[]}', defaultOpts);
      return this.contains(out, 'items: unknown[];', 'empty array');
    });

    this.test('object array generates item interface', () => {
      const json = '{"projects":[{"id":1,"title":"P1"}]}';
      const out = convertJsonToTypeScript(json, defaultOpts);
      return this.contains(out, 'interface Projects', 'object array interface');
    });

    // ── Root array ───────────────────────────────────────────────────────────

    this.test('root JSON array produces type alias', () => {
      const json = '[{"id":1}]';
      const out = convertJsonToTypeScript(json, defaultOpts);
      return this.contains(out, 'type Root = Root[]', 'root array type alias');
    });

    this.test('root empty array produces unknown[]', () => {
      const json = '[]';
      const out = convertJsonToTypeScript(json, defaultOpts);
      return this.contains(out, 'unknown[]', 'empty root array');
    });

    // ── Multiple fields ──────────────────────────────────────────────────────

    this.test('multiple fields all converted', () => {
      const json = '{"a":"x","b":1,"c":true}';
      const out = convertJsonToTypeScript(json, defaultOpts);
      return this.contains(out, 'a: string;', 'field a') &&
             this.contains(out, 'b: number;', 'field b') &&
             this.contains(out, 'c: boolean;', 'field c');
    });

    // ── Invalid JSON ─────────────────────────────────────────────────────────

    this.test('invalid JSON throws SyntaxError', () => {
      try {
        convertJsonToTypeScript('{invalid}', defaultOpts);
        return false;
      } catch (e) {
        return this.assert(e instanceof SyntaxError, true, 'SyntaxError thrown');
      }
    });

    // ── PascalCase naming ────────────────────────────────────────────────────

    this.test('snake_case key generates PascalCase interface', () => {
      const json = '{"my_object":{"x":1}}';
      const out = convertJsonToTypeScript(json, defaultOpts);
      return this.contains(out, 'interface MyObject {', 'PascalCase from snake_case');
    });

    this.test('camelCase key generates PascalCase interface', () => {
      const json = '{"userProfile":{"name":"Alice"}}';
      const out = convertJsonToTypeScript(json, defaultOpts);
      return this.contains(out, 'interface UserProfile {', 'PascalCase from camelCase');
    });

    const total = this.passed + this.failed;
    console.log('\nJSON to TypeScript: ' + this.passed + '/' + total + ' tests passed');
    return { total, passed: this.passed, failed: this.failed, failedTests: this.failedTests };
  }
}
