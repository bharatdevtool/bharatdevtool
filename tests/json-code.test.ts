import { describe, it, expect } from 'vitest';
import { convertJsonToCode, inferModel, propName } from '../public/assets/js/json-code.js';

const SAMPLE = JSON.stringify({
  id: 1,
  'first name': 'Asha',
  'user-id': 'u1',
  score: 9.5,
  big: 3000000000,
  class: 'x',
  address: { city: 'Pune' },
  tags: ['a'],
  items: [{ sku: 'a', qty: 1 }, { sku: 'b' }],
  meta: null,
  mixed: [1, 'a'],
  empty: [],
  grid: [[1, 2]],
  $price: 5,
});
const code = (lang: string, lib?: string) => convertJsonToCode(SAMPLE, { lang, lib });

type Field = { key: string; type: { k: string }; optional: boolean };
type Model = { classes: { name: string; fields: Field[] }[] };
const model = (json: string) => inferModel(json, 'Root') as unknown as Model;

describe('JSON model', () => {
  it('merges array elements and marks missing or null fields optional', () => {
    const m = model(SAMPLE);
    const items = m.classes.find((c) => c.name === 'ItemsItem');
    expect(items?.fields).toEqual([
      { key: 'sku', type: { k: 'string' }, optional: false },
      { key: 'qty', type: { k: 'int' }, optional: true },
    ]);
    expect(m.classes[0].name).toBe('Root');
  });

  it('tells int, long and double apart and turns mixed types into unknown', () => {
    const f = Object.fromEntries(model(SAMPLE).classes[0].fields.map((x) => [x.key, x.type]));
    expect(f.id.k).toBe('int');
    expect(f.big.k).toBe('long');
    expect(f.score.k).toBe('double');
    expect(f.mixed).toEqual({ k: 'array', of: { k: 'unknown' } });
    expect(f.empty).toEqual({ k: 'array', of: { k: 'unknown' } });
    expect(f.grid).toEqual({ k: 'array', of: { k: 'array', of: { k: 'int' } } });
  });

  it('makes property names from any key', () => {
    expect(propName('first name')).toBe('firstName');
    expect(propName('user_id')).toBe('userId');
    expect(propName('2nd')).toBe('field2nd');
  });
});

describe('Kotlin', () => {
  it('kotlinx.serialization: @Serializable, @SerialName for renamed keys, nullable defaults', () => {
    const k = code('kotlin', 'kotlinx');
    expect(k).toContain('import kotlinx.serialization.Serializable');
    expect(k).toContain('import kotlinx.serialization.json.JsonElement');
    expect(k).toContain('@Serializable\ndata class Root(');
    expect(k).toContain('@SerialName("first name") val firstName: String,');
    expect(k).toContain('@SerialName("\\$price") val price: Int,');
    expect(k).toContain('val big: Long,');
    expect(k).toContain('val `class`: String,');
    expect(k).toContain('val meta: JsonElement? = null,');
    expect(k).toContain('val items: List<ItemsItem>,');
    expect(k).toContain('val qty: Int? = null,');
    expect(k).toContain('val grid: List<List<Int>>,');
  });

  it('Moshi and Gson use their own annotations', () => {
    expect(code('kotlin', 'moshi')).toContain('@Json(name = "user-id") val userId: String,');
    expect(code('kotlin', 'moshi')).toContain('@JsonClass(generateAdapter = true)');
    expect(code('kotlin', 'gson')).toContain('@SerializedName("user-id") val userId: String,');
    expect(code('kotlin', 'gson')).toContain('val meta: Any? = null,');
  });

  it('uses a typealias for a root array', () => {
    expect(convertJsonToCode('[{"a":1}]', { lang: 'kotlin' })).toContain('typealias Root = List<RootItem>');
  });
});

describe('Swift', () => {
  it('Codable structs with CodingKeys only when a key is renamed', () => {
    const s = code('swift');
    expect(s).toContain('struct Root: Codable {');
    expect(s).toContain('    let firstName: String');
    expect(s).toContain('        case firstName = "first name"');
    expect(s).toContain('    let `class`: String');
    expect(s).toContain('    let qty: Int?');
    expect(s).toContain('    let mixed: [JSONValue]');
    expect(s).toContain('enum JSONValue: Codable');
    expect(s).toContain('struct Address: Codable {\n    let city: String\n}');
  });

  it('leaves out the JSONValue helper when no field needs it', () => {
    expect(convertJsonToCode('{"a":1}', { lang: 'swift' })).not.toContain('JSONValue');
  });
});

describe('Dart', () => {
  it('plain classes with fromJson/toJson, escaping $ and keywords', () => {
    const d = code('dart');
    expect(d).toContain('  final String firstName;');
    expect(d).toContain('  final String class_;');
    expect(d).toContain("        firstName: json['first name'] as String,");
    expect(d).toContain("        price: json['\\$price'] as int,");
    expect(d).toContain("        score: (json['score'] as num).toDouble(),");
    expect(d).toContain("        items: (json['items'] as List<dynamic>).map((e) => ItemsItem.fromJson(e as Map<String, dynamic>)).toList(),");
    expect(d).toContain("        address: Address.fromJson(json['address'] as Map<String, dynamic>),");
    expect(d).toContain("        qty: json['qty'] == null ? null : json['qty'] as int,");
    expect(d).toContain("        'items': items.map((e) => e.toJson()).toList(),");
    expect(d).toContain('    this.meta,');
  });

  it('json_serializable and freezed add their annotations and part files', () => {
    const js = convertJsonToCode(SAMPLE, { lang: 'dart', lib: 'json_serializable', rootName: 'UserData' });
    expect(js).toContain("part 'user_data.g.dart';");
    expect(js).toContain('@JsonSerializable()\nclass UserData {');
    expect(js).toContain("  @JsonKey(name: 'first name')\n  final String firstName;");
    const fz = code('dart', 'freezed');
    expect(fz).toContain("part 'root.freezed.dart';");
    expect(fz).toContain('abstract class Root with _$Root {');
    expect(fz).toContain("    @JsonKey(name: 'first name') required String firstName,");
    expect(fz).toContain('    int? qty,');
  });
});

it('rejects invalid JSON and unknown languages', () => {
  expect(() => convertJsonToCode('{bad', { lang: 'kotlin' })).toThrow();
  expect(() => convertJsonToCode('{}', { lang: 'cobol' })).toThrow();
});
