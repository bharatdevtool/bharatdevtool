// json-infer.js — JSON → type inference shared by the JSON-to-code pages.
// Arrays: every element is inspected. Object elements are merged into one
// interface (keys missing from some elements become optional) and mixed
// element types become a union. Extracted from json-to-typescript.html;
// tests/json-infer.test.ts keeps the TypeScript output byte-identical.

function toPascalCase(str) {
  return str
    .replace(/[_\-\s]+(.)/g, function (_, c) { return c.toUpperCase(); })
    .replace(/^(.)/, function (c) { return c.toUpperCase(); });
}

// ─── Type inference ───────────────────────────────────────────────────────
// Arrays: every element is inspected. Object elements are merged into one
// interface (keys missing from some elements become optional) and mixed
// element types become a union, e.g. (string | number)[].

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function joinUnion(types) {
  const uniq = [];
  types.forEach(function (t) { if (uniq.indexOf(t) === -1) uniq.push(t); });
  // keep null last for readability
  uniq.sort(function (a, b) { return (a === 'null') - (b === 'null'); });
  return uniq.length ? uniq.join(' | ') : 'unknown';
}

// Type for a list of sample values seen at the same position.
function inferValuesType(values, key, ctx) {
  const types = [];
  const objects = [];
  const arrays = [];
  values.forEach(function (v) {
    if (v === null) types.push('null');
    else if (typeof v === 'string') types.push('string');
    else if (typeof v === 'number') types.push('number');
    else if (typeof v === 'boolean') types.push('boolean');
    else if (Array.isArray(v)) arrays.push(v);
    else if (isPlainObject(v)) objects.push(v);
    else types.push('unknown');
  });
  if (objects.length) types.push(inferObjectType(objects, key, ctx));
  if (arrays.length) {
    const elements = [].concat.apply([], arrays);
    const el = elements.length ? inferValuesType(elements, key + 'Item', ctx) : 'unknown';
    types.push(el.indexOf(' | ') !== -1 ? '(' + el + ')[]' : el + '[]');
  }
  return joinUnion(types);
}

function inferType(value, key, ctx) {
  return inferValuesType([value], key, ctx);
}

// samples: one or more objects describing the same shape.
function inferObjectType(samples, key, ctx) {
  const base = toPascalCase(key) || 'Item';
  const body = buildInterfaceBody(samples, ctx);
  // Same name + same shape → reuse; same name + different shape → Name2, Name3…
  let name = base;
  for (let n = 2; ctx.interfaces[name] !== undefined && ctx.bodies[name] !== body; n++) name = base + n;
  if (ctx.interfaces[name] === undefined) {
    ctx.bodies[name] = body;
    ctx.interfaces[name] = renderInterface(name, body, ctx);
  }
  return name;
}

// ─── Interface builder ────────────────────────────────────────────────────

function buildInterfaceBody(samples, ctx) {
  const semi = ctx.options.semicolons ? ';' : '';
  const optionalNulls = ctx.options.optionalFields;
  const keys = [];
  samples.forEach(function (o) {
    Object.keys(o).forEach(function (k) { if (keys.indexOf(k) === -1) keys.push(k); });
  });
  return keys.map(function (key) {
    const present = samples.filter(function (o) { return Object.prototype.hasOwnProperty.call(o, key); });
    const values = present.map(function (o) { return o[key]; });
    let tsType = inferValuesType(values, key, ctx);
    const missingSometimes = present.length < samples.length;
    const hasNull = values.some(function (v) { return v === null; });
    const optional = missingSometimes || (optionalNulls && hasNull);
    if (optionalNulls && hasNull && tsType === 'null') tsType = 'null | undefined';
    const safeKey = /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
    return '  ' + safeKey + (optional ? '?' : '') + ': ' + tsType + semi;
  }).join('\n');
}

function renderInterface(name, body, ctx) {
  const header = ctx.options.useTypeAlias ? 'type ' + name + ' = {' : 'interface ' + name + ' {';
  return header + (body ? '\n' + body : '') + '\n}';
}

// ─── Main converter ───────────────────────────────────────────────────────

function convertJsonToTypeScript(jsonText, options) {
  const parsed = JSON.parse(jsonText); // throws on invalid JSON

  const rootName = toPascalCase((options.rootName || 'Root').trim()) || 'Root';
  const ctx = { interfaces: {}, bodies: {}, options: options };
  const semi = options.semicolons ? ';' : '';

  if (Array.isArray(parsed)) {
    const el = parsed.length ? inferValuesType(parsed, rootName + 'Item', ctx) : 'unknown';
    const rootType = el.indexOf(' | ') !== -1 ? '(' + el + ')[]' : el + '[]';
    const parts = ['type ' + rootName + ' = ' + rootType + semi];
    Object.keys(ctx.interfaces).forEach(function (iName) { parts.push('\n' + ctx.interfaces[iName]); });
    return parts.join('\n');
  }

  if (!isPlainObject(parsed)) {
    return '// Primitive JSON value\ntype ' + rootName + ' = ' + inferType(parsed, rootName, ctx) + semi;
  }

  // Root first: build its body (which registers nested interfaces), then list nested ones.
  const rootBody = buildInterfaceBody([parsed], ctx);
  const parts = [renderInterface(rootName, rootBody, ctx)];
  Object.keys(ctx.interfaces).forEach(function (iName) {
    if (iName !== rootName) parts.push('\n' + ctx.interfaces[iName]);
  });
  return parts.join('\n');
}

export { toPascalCase, isPlainObject, joinUnion, inferValuesType, convertJsonToTypeScript };
