// json-code.js — JSON → Kotlin / Swift / Dart model classes.
// Builds a language-neutral model (classes, fields, types) from one or more JSON samples,
// then prints it for each language. TypeScript output stays in json-infer.js.

import { toPascalCase } from './json-infer.js';

const INT_MAX = 2147483647;

// ─── Model ──────────────────────────────────────────────────────────────────
// Type: { k: 'string' | 'int' | 'long' | 'double' | 'bool' | 'unknown' }
//     | { k: 'object', name } | { k: 'array', of: Type }
// Field: { key, type, optional }   Class: { name, fields }

function typeOfValues(values, name, ctx) {
  let nulls = 0;
  const seen = new Set();
  const objects = [];
  const arrays = [];
  let allInt = true;
  let big = false;
  for (const v of values) {
    if (v === null) nulls++;
    else if (typeof v === 'string') seen.add('string');
    else if (typeof v === 'boolean') seen.add('bool');
    else if (typeof v === 'number') {
      seen.add('number');
      if (!Number.isInteger(v)) allInt = false;
      else if (Math.abs(v) > INT_MAX) big = true;
    } else if (Array.isArray(v)) { seen.add('array'); arrays.push(v); }
    else if (typeof v === 'object') { seen.add('object'); objects.push(v); }
  }
  const nullable = nulls > 0;
  if (seen.size !== 1) return { type: { k: 'unknown' }, nullable: nullable || seen.size === 0 };
  const only = [...seen][0];
  if (only === 'object') return { type: { k: 'object', name: classFor(objects, name, ctx) }, nullable };
  if (only === 'array') {
    const items = [].concat(...arrays);
    const el = items.length ? typeOfValues(items, name + 'Item', ctx).type : { k: 'unknown' };
    return { type: { k: 'array', of: el }, nullable };
  }
  if (only === 'number') return { type: { k: allInt ? (big ? 'long' : 'int') : 'double' }, nullable };
  return { type: { k: only }, nullable };
}

function classFor(samples, name, ctx) {
  const base = toPascalCase(name) || 'Item';
  const keys = [];
  for (const o of samples) for (const k of Object.keys(o)) if (!keys.includes(k)) keys.push(k);
  const fields = keys.map((key) => {
    const present = samples.filter((o) => Object.prototype.hasOwnProperty.call(o, key));
    const { type, nullable } = typeOfValues(present.map((o) => o[key]), key, ctx);
    return { key, type, optional: nullable || present.length < samples.length };
  });
  const sig = JSON.stringify(fields);
  let cls = base;
  for (let n = 2; ctx.sigs[cls] !== undefined && ctx.sigs[cls] !== sig; n++) cls = base + n;
  if (ctx.sigs[cls] === undefined) {
    ctx.sigs[cls] = sig;
    ctx.classes.push({ name: cls, fields });
  }
  return cls;
}

/** Parse JSON and build the model. Throws on invalid JSON. */
export function inferModel(jsonText, rootName) {
  const parsed = JSON.parse(jsonText);
  const root = toPascalCase(String(rootName || 'Root').trim()) || 'Root';
  const ctx = { classes: [], sigs: {} };
  if (Array.isArray(parsed)) {
    const el = parsed.length ? typeOfValues(parsed, root + 'Item', ctx).type : { k: 'unknown' };
    return { root, rootType: { k: 'array', of: el }, classes: ctx.classes };
  }
  if (parsed !== null && typeof parsed === 'object') {
    classFor([parsed], root, ctx);
    // the root class is registered after its children; print it first
    const i = ctx.classes.findIndex((c) => c.name === root);
    const classes = [ctx.classes[i], ...ctx.classes.filter((_, j) => j !== i)];
    return { root, rootType: { k: 'object', name: root }, classes };
  }
  return { root, rootType: typeOfValues([parsed], root, ctx).type, classes: [] };
}

// ─── Names ──────────────────────────────────────────────────────────────────

/** "first name" → firstName, "user_id" → userId, "2nd" → field2nd */
export function propName(key) {
  const words = String(key).split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (!words.length) return 'field';
  let s = words.map((w, i) => (i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w.charAt(0).toUpperCase() + w.slice(1))).join('');
  if (/^[0-9]/.test(s)) s = 'field' + s;
  return s;
}

const KOTLIN_KEYWORDS = new Set('as break class continue do else false for fun if in interface is null object package return super this throw true try typealias typeof val var when while'.split(' '));
const SWIFT_KEYWORDS = new Set('associatedtype class deinit enum extension fileprivate func import init inout internal let open operator private protocol public rethrows static struct subscript typealias var break case continue default defer do else fallthrough for guard if in repeat return switch where while as catch false is nil super self Self throw throws true try Type'.split(' '));
const DART_KEYWORDS = new Set('abstract as assert async await break case catch class const continue covariant default deferred do dynamic else enum export extends extension external factory false final finally for get if implements import in interface is late library mixin new null on operator part required rethrow return set static super switch sync this throw true try typedef var void while with yield'.split(' '));

// String literals: Kotlin and Dart interpolate `$`, so it is escaped too.
const ktStr = (k) => JSON.stringify(k).replace(/\$/g, '\\$');
const dartStr = (k) => "'" + String(k).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\$/g, '\\$').replace(/\n/g, '\\n') + "'";

// ─── Kotlin ─────────────────────────────────────────────────────────────────

function kotlinType(t, lib) {
  switch (t.k) {
    case 'string': return 'String';
    case 'int': return 'Int';
    case 'long': return 'Long';
    case 'double': return 'Double';
    case 'bool': return 'Boolean';
    case 'object': return t.name;
    case 'array': return `List<${kotlinType(t.of, lib)}>`;
    default: return lib === 'kotlinx' ? 'JsonElement' : 'Any';
  }
}

const usesUnknown = (t) => t.k === 'unknown' || (t.k === 'array' && usesUnknown(t.of));

/** lib: 'kotlinx' (default) | 'moshi' | 'gson' */
export function toKotlin(model, lib = 'kotlinx') {
  const ann = { kotlinx: (k) => `@SerialName(${ktStr(k)}) `, moshi: (k) => `@Json(name = ${ktStr(k)}) `, gson: (k) => `@SerializedName(${ktStr(k)}) ` }[lib];
  const classAnn = { kotlinx: '@Serializable\n', moshi: '@JsonClass(generateAdapter = true)\n', gson: '' }[lib];
  let renamed = false;
  let unknown = usesUnknown(model.rootType);
  const blocks = model.classes.map((c) => {
    const lines = c.fields.map((f) => {
      const name = propName(f.key);
      const id = KOTLIN_KEYWORDS.has(name) ? `\`${name}\`` : name;
      if (usesUnknown(f.type)) unknown = true;
      const a = name !== f.key ? ann(f.key) : '';
      if (a) renamed = true;
      return `    ${a}val ${id}: ${kotlinType(f.type, lib)}${f.optional ? '? = null' : ''},`;
    });
    return `${classAnn}data class ${c.name}(\n${lines.join('\n')}\n)`;
  });
  const imports = {
    kotlinx: ['kotlinx.serialization.Serializable', renamed && 'kotlinx.serialization.SerialName', unknown && 'kotlinx.serialization.json.JsonElement'],
    moshi: ['com.squareup.moshi.JsonClass', renamed && 'com.squareup.moshi.Json'],
    gson: [renamed && 'com.google.gson.annotations.SerializedName'],
  }[lib].filter(Boolean).sort();
  const head = imports.length ? imports.map((i) => `import ${i}`).join('\n') + '\n\n' : '';
  if (model.rootType.k === 'object') return head + blocks.join('\n\n') + '\n';
  const alias = `typealias ${model.root} = ${kotlinType(model.rootType, lib)}`;
  return head + [alias, ...blocks].join('\n\n') + '\n';
}

// ─── Swift ──────────────────────────────────────────────────────────────────

function swiftType(t) {
  switch (t.k) {
    case 'string': return 'String';
    case 'int': return 'Int';
    case 'long': return 'Int';
    case 'double': return 'Double';
    case 'bool': return 'Bool';
    case 'object': return t.name;
    case 'array': return `[${swiftType(t.of)}]`;
    default: return 'JSONValue';
  }
}

const SWIFT_JSON_VALUE = `/// Any JSON value, for fields whose type changes between samples.
enum JSONValue: Codable {
    case string(String), number(Double), bool(Bool), object([String: JSONValue]), array([JSONValue]), null

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let v = try? c.decode(Bool.self) { self = .bool(v) }
        else if let v = try? c.decode(Double.self) { self = .number(v) }
        else if let v = try? c.decode(String.self) { self = .string(v) }
        else if let v = try? c.decode([JSONValue].self) { self = .array(v) }
        else { self = .object(try c.decode([String: JSONValue].self)) }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let v): try c.encode(v)
        case .number(let v): try c.encode(v)
        case .bool(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .null: try c.encodeNil()
        }
    }
}`;

export function toSwift(model) {
  let unknown = usesUnknown(model.rootType);
  const blocks = model.classes.map((c) => {
    const props = [];
    const keys = [];
    let renamed = false;
    for (const f of c.fields) {
      const name = propName(f.key);
      const id = SWIFT_KEYWORDS.has(name) ? `\`${name}\`` : name;
      if (usesUnknown(f.type)) unknown = true;
      props.push(`    let ${id}: ${swiftType(f.type)}${f.optional ? '?' : ''}`);
      if (name !== f.key) renamed = true;
      keys.push(name !== f.key ? `        case ${id} = ${JSON.stringify(f.key)}` : `        case ${id}`);
    }
    const codingKeys = renamed ? `\n\n    enum CodingKeys: String, CodingKey {\n${keys.join('\n')}\n    }` : '';
    return `struct ${c.name}: Codable {\n${props.join('\n')}${codingKeys}\n}`;
  });
  const parts = ['import Foundation'];
  if (model.rootType.k !== 'object') parts.push(`typealias ${model.root} = ${swiftType(model.rootType)}`);
  parts.push(...blocks);
  if (unknown) parts.push(SWIFT_JSON_VALUE);
  return parts.join('\n\n') + '\n';
}

// ─── Dart ───────────────────────────────────────────────────────────────────

function dartType(t) {
  switch (t.k) {
    case 'string': return 'String';
    case 'int':
    case 'long': return 'int';
    case 'double': return 'double';
    case 'bool': return 'bool';
    case 'object': return t.name;
    case 'array': return `List<${dartType(t.of)}>`;
    default: return 'dynamic';
  }
}

const dartField = (name) => (DART_KEYWORDS.has(name) ? name + '_' : name);
const nullType = (t, optional) => (optional && t.k !== 'unknown' ? `${dartType(t)}?` : dartType(t));

/** Expression that reads `src` (a decoded JSON value) as type t. */
function dartFrom(t, src, optional) {
  let e;
  switch (t.k) {
    case 'object': e = `${t.name}.fromJson(${src} as Map<String, dynamic>)`; break;
    case 'array': e = `(${src} as List<dynamic>).map((e) => ${dartFrom(t.of, 'e', false)}).toList()`; break;
    case 'double': e = `(${src} as num).toDouble()`; break;
    case 'unknown': return src;
    default: e = `${src} as ${dartType(t)}`;
  }
  return optional ? `${src} == null ? null : ${e}` : e;
}

/** Expression that writes value `v` of type t back to JSON. */
function dartTo(t, v, optional) {
  const q = optional ? '?' : '';
  if (t.k === 'object') return `${v}${q}.toJson()`;
  if (t.k === 'array' && (t.of.k === 'object' || t.of.k === 'array')) return `${v}${q}.map((e) => ${dartTo(t.of, 'e', false)}).toList()`;
  return v;
}

/** style: 'plain' (default) | 'json_serializable' | 'freezed' */
export function toDart(model, style = 'plain', fileName = 'model') {
  const blocks = model.classes.map((c) => {
    const fields = c.fields.map((f) => ({ ...f, name: dartField(propName(f.key)) }));
    if (style === 'freezed') {
      const params = fields.map((f) => `    ${f.name !== f.key ? `@JsonKey(name: ${dartStr(f.key)}) ` : ''}${f.optional ? '' : 'required '}${nullType(f.type, f.optional)} ${f.name},`);
      return `@freezed\nabstract class ${c.name} with _$${c.name} {\n  const factory ${c.name}({\n${params.join('\n')}\n  }) = _${c.name};\n\n  factory ${c.name}.fromJson(Map<String, dynamic> json) => _$${c.name}FromJson(json);\n}`;
    }
    const decl = fields.map((f) => `${style === 'json_serializable' && f.name !== f.key ? `  @JsonKey(name: ${dartStr(f.key)})\n` : ''}  final ${nullType(f.type, f.optional)} ${f.name};`);
    const ctor = `  ${c.name}({${fields.length ? '\n' + fields.map((f) => `    ${f.optional ? '' : 'required '}this.${f.name},`).join('\n') + '\n  ' : ''}});`;
    if (style === 'json_serializable') {
      return `@JsonSerializable()\nclass ${c.name} {\n${decl.join('\n')}\n\n${ctor}\n\n  factory ${c.name}.fromJson(Map<String, dynamic> json) => _$${c.name}FromJson(json);\n\n  Map<String, dynamic> toJson() => _$${c.name}ToJson(this);\n}`;
    }
    const from = fields.map((f) => `        ${f.name}: ${dartFrom(f.type, `json[${dartStr(f.key)}]`, f.optional)},`);
    const to = fields.map((f) => `        ${dartStr(f.key)}: ${dartTo(f.type, f.name, f.optional)},`);
    return `class ${c.name} {\n${decl.join('\n')}\n\n${ctor}\n\n  factory ${c.name}.fromJson(Map<String, dynamic> json) => ${c.name}(\n${from.join('\n')}\n      );\n\n  Map<String, dynamic> toJson() => {\n${to.join('\n')}\n      };\n}`;
  });
  const head =
    style === 'freezed'
      ? `import 'package:freezed_annotation/freezed_annotation.dart';\n\npart '${fileName}.freezed.dart';\npart '${fileName}.g.dart';\n\n`
      : style === 'json_serializable'
        ? `import 'package:json_annotation/json_annotation.dart';\n\npart '${fileName}.g.dart';\n\n`
        : '';
  const alias = model.rootType.k !== 'object' ? [`typedef ${model.root} = ${dartType(model.rootType)};`] : [];
  return head + [...alias, ...blocks].join('\n\n') + '\n';
}

// ─── Entry point ────────────────────────────────────────────────────────────

export const CODE_LANGUAGES = {
  kotlin: { label: 'Kotlin', libs: { kotlinx: 'kotlinx.serialization', moshi: 'Moshi', gson: 'Gson' } },
  swift: { label: 'Swift', libs: { codable: 'Codable' } },
  dart: { label: 'Dart', libs: { plain: 'fromJson / toJson', json_serializable: 'json_serializable', freezed: 'freezed' } },
};

/** options: { lang: 'kotlin' | 'swift' | 'dart', lib?, rootName? } */
export function convertJsonToCode(jsonText, options) {
  const model = inferModel(jsonText, options.rootName);
  if (options.lang === 'kotlin') return toKotlin(model, options.lib || 'kotlinx');
  if (options.lang === 'swift') return toSwift(model);
  if (options.lang === 'dart') return toDart(model, options.lib || 'plain', propName(model.root).replace(/[A-Z]/g, (c) => '_' + c.toLowerCase()));
  throw new Error('Unknown language: ' + options.lang);
}
