import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { zipSync, unzipSync, strToU8 } from 'fflate';
import { inspectZip, readEntry, crc32, FLAG_DATA_DESCRIPTOR } from '@/lib/lottie/zipInspect';
import { diagnoseLottie, repairLottie, normalizePath, sha256Hex } from '@/lib/lottie/fixer';
import { scanLottieFeatures } from '@/lib/lottie/features';
import { extractDotLottie } from '@/lib/lottie/dotLottie';
import type { LottieAnimation } from '@/lib/lottie/types';
import { buildZip, buildFigmaLottie } from './helpers/figmaZip';

// A tiny valid PNG-ish payload (content doesn't matter to the zip layer)
const png = (seed: number, size = 64) => Uint8Array.from({ length: size }, (_, i) => (i * 31 + seed) & 0xff);

function animationWithImages(names: string[]): LottieAnimation {
  return {
    v: '5.7.0',
    fr: 60,
    ip: 0,
    op: 180,
    w: 375,
    h: 66,
    nm: 'Test',
    ddd: 0,
    assets: names.map((n, i) => ({ id: `image_${i}`, w: 10, h: 10, u: '/images/', p: n, e: 0 })),
    layers: names.map((_, i) => ({ ind: i + 1, ty: 2 as const, refId: `image_${i}`, ip: 0, op: 180, st: 0, ks: {} })),
  };
}

const enc = (o: unknown) => strToU8(JSON.stringify(o));

function figmaFixture() {
  const anim = animationWithImages(['asset_1.png', 'asset_2.png']);
  const images = [
    { name: 'asset_1.png', data: png(1, 2048) },
    { name: 'asset_2.png', data: png(2, 512) },
  ];
  return { anim, images, bytes: buildFigmaLottie(enc(anim), images) };
}

describe('zipInspect', () => {
  it('computes standard CRC-32', () => {
    expect(crc32(strToU8('123456789'))).toBe(0xcbf43926);
  });

  it('flags Figma STORED + data descriptor entries as Android-breaking', () => {
    const { bytes } = figmaFixture();
    const z = inspectZip(bytes);
    expect(z.ok).toBe(true);
    expect(z.entries.map((e) => e.name)).toEqual([
      'manifest.json',
      'animations/animation.json',
      'images/asset_1.png',
      'images/asset_2.png',
    ]);
    for (const e of z.entries) expect(e.local!.flag).toBe(0x0808);
    const png1 = z.entries.find((e) => e.name === 'images/asset_1.png')!;
    expect(png1.status).toBe('android-breaking');
    expect(png1.local!.compressedSize).toBe(0);
    expect(png1.central.size).toBe(2048);
    const json = z.entries.find((e) => e.name === 'animations/animation.json')!;
    expect(json.central.method).toBe(8);
    expect(json.status).toBe('android-risky');
  });

  it('reads entries using central sizes even when local sizes are zero', () => {
    const { bytes, images } = figmaFixture();
    const z = inspectZip(bytes);
    const entry = z.entries.find((e) => e.name === 'images/asset_1.png')!;
    const read = readEntry(bytes, entry);
    expect(read.ok).toBe(true);
    expect(read.data).toEqual(images[0].data);
  });

  it('reports a standard fflate zip as ok', () => {
    const bytes = zipSync({ 'manifest.json': strToU8('{}'), 'animations/a.json': strToU8('{"layers":[]}') });
    const z = inspectZip(bytes);
    expect(z.ok).toBe(true);
    expect(z.entries.every((e) => e.status === 'ok')).toBe(true);
  });

  it('detects local/central mismatches', () => {
    const bytes = buildZip(
      [{ name: 'animations/a.json', data: strToU8('{"layers":[]}'), method: 0, localOverride: { size: 3 } }],
      { descriptor: false }
    );
    expect(inspectZip(bytes).entries[0].status).toBe('mismatch');
  });

  it('never throws on corrupt input', () => {
    const { bytes } = figmaFixture();
    expect(inspectZip(bytes.subarray(0, bytes.length - 10)).ok).toBe(false);
    expect(inspectZip(bytes.subarray(0, 200)).ok).toBe(false);
    expect(inspectZip(new Uint8Array(0)).ok).toBe(false);
    expect(inspectZip(Uint8Array.from({ length: 5000 }, (_, i) => (i * 7) & 0xff)).ok).toBe(false);
    const random = Uint8Array.from({ length: 5000 }, (_, i) => (i * 13 + 5) & 0xff);
    random.set([0x50, 0x4b, 0x03, 0x04], 0);
    expect(inspectZip(random).ok).toBe(false);
  });

  it('rejects ZIP64 and encrypted archives', () => {
    const zip64 = buildZip([{ name: 'a.json', data: strToU8('{}') }], { zip64: true });
    const z = inspectZip(zip64);
    expect(z.ok).toBe(false);
    expect(z.zip64).toBe(true);

    const encrypted = buildZip([{ name: 'animations/a.json', data: strToU8('{}'), flag: 0x0001 }], { descriptor: false });
    expect(inspectZip(encrypted).entries[0].status).toBe('unsupported');
    const d = diagnoseLottie(encrypted, 'enc.lottie');
    expect(d.fatal).toMatch(/Encrypted/);
    expect(d.verdict.android).toBe('unsupported');
  });
});

describe('diagnoseLottie', () => {
  it('says a Figma .lottie will fail on Android but is fine on iOS/web', () => {
    const { bytes } = figmaFixture();
    const d = diagnoseLottie(bytes, 'generic_rewards.lottie');
    expect(d.fatal).toBeUndefined();
    expect(d.generator).toBe('Figma');
    expect(d.verdict.android).toBe('fail');
    expect(d.verdict.ios).toBe('ok');
    expect(d.verdict.web).toBe('ok');
    expect(d.issues.some((i) => i.id === 'zip-descriptor-stored' && i.fix === 'auto')).toBe(true);
    expect(d.stats).toMatchObject({ width: 375, height: 66, fps: 60, durationSeconds: 3, imageCount: 2 });
  });

  it('reports "no fix needed" for a standard (LottieFiles-style) .lottie', () => {
    const anim = animationWithImages(['img_0.png']);
    const bytes = zipSync({
      'manifest.json': enc({ version: '1', generator: 'LottieFiles', animations: [{ id: 'anim' }] }),
      'animations/anim.json': enc(anim),
      'images/img_0.png': png(3),
    });
    const d = diagnoseLottie(bytes, 'ok.lottie');
    expect(d.verdict.android).toBe('ok');
    expect(d.autoFixCount).toBe(0);
  });

  it('detects themes/state machines that Android would load instead of the animation', () => {
    const anim = animationWithImages([]);
    const bytes = zipSync({
      'manifest.json': enc({ version: '2', animations: [{ id: 'main' }], themes: [{ id: 'dark' }] }),
      'a/main.json': enc(anim),
      't/dark.json': enc({ rules: [] }),
    });
    const d = diagnoseLottie(bytes, 'v2.lottie');
    expect(d.formatVersion).toBe('2');
    expect(d.issues.find((i) => i.id === 'android-json-order')?.severity).toBe('error');
    expect(d.verdict.android).toBe('fail');

    const fixed = repairLottie(bytes, 'v2.lottie');
    expect(fixed.ok).toBe(true);
    expect(fixed.verification!.androidReadsAnimation).toBe(true);
    const names = inspectZip(fixed.bytes!).entries.map((e) => e.name);
    expect(names).toEqual(['manifest.json', 't/dark.json', 'a/main.json']);
  });

  it('finds missing images by file name and Android-specific image problems', () => {
    const anim = animationWithImages(['present.png', 'missing.png', 'Upper.PNG']);
    const bytes = zipSync({
      'manifest.json': enc({ animations: [{ id: 'animation' }] }),
      'animations/animation.json': enc(anim),
      'images/present.png': png(1),
      'images/Upper.PNG': png(2),
    });
    const d = diagnoseLottie(bytes, 'x.lottie');
    expect(d.issues.find((i) => i.id === 'image-missing')?.message).toContain('missing.png');
    expect(d.issues.find((i) => i.id === 'image-ext-case')?.platforms).toEqual(['android']);
  });

  it('flags a BOM, backslash paths, junk and a missing manifest as auto-fixable', () => {
    const anim = enc(animationWithImages([]));
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...anim]);
    const bytes = buildZip(
      [
        { name: 'animations\\animation.json', data: withBom },
        { name: '__MACOSX/._animation.json', data: png(9, 10) },
        { name: 'images/', data: new Uint8Array(0) },
      ],
      { descriptor: false }
    );
    const d = diagnoseLottie(bytes, 'messy.lottie');
    const ids = d.issues.map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(['json-bom', 'zip-paths', 'zip-junk', 'zip-directories', 'manifest-missing']));
    for (const id of ['json-bom', 'zip-paths', 'zip-junk', 'manifest-missing']) {
      expect(d.issues.find((i) => i.id === id)!.fix).toBe('auto');
    }
  });

  it('handles a plain JSON Lottie and corrupt input without throwing', () => {
    const d = diagnoseLottie(enc(animationWithImages([])), 'anim.json');
    expect(d.kind).toBe('json');
    expect(d.fatal).toBeUndefined();
    expect(diagnoseLottie(strToU8('{"nope":1}'), 'x.json').fatal).toMatch(/not a Lottie/);
    expect(diagnoseLottie(strToU8('<html>'), 'x.json').fatal).toMatch(/web page/);
    const { bytes } = figmaFixture();
    expect(diagnoseLottie(bytes.subarray(0, 300), 'cut.lottie').fatal).toBeTruthy();
  });
});

describe('repairLottie', () => {
  it('re-packs a Figma .lottie with no data descriptors and identical content', async () => {
    const { bytes } = figmaFixture();
    const result = repairLottie(bytes, 'generic_rewards.lottie');
    expect(result.ok).toBe(true);
    expect(result.fileName).toBe('generic_rewards.lottie');
    expect(result.verification).toMatchObject({
      noDescriptors: true,
      headersMatch: true,
      contentIdentical: true,
      androidReadsAnimation: true,
    });
    expect(result.verification!.modifiedEntries).toEqual([]);

    const out = inspectZip(result.bytes!);
    expect(out.entries.every((e) => (e.local!.flag & FLAG_DATA_DESCRIPTOR) === 0)).toBe(true);
    expect(out.entries.every((e) => e.status === 'ok')).toBe(true);

    // Same names and byte-identical contents (fflate reads via the central directory)
    const before = unzipSync(bytes);
    const after = unzipSync(result.bytes!);
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
    for (const name of Object.keys(before)) expect(after[name]).toEqual(before[name]);

    // Images stored, JSON deflated
    expect(out.entries.find((e) => e.name.endsWith('.png'))!.central.method).toBe(0);
    expect(out.entries.find((e) => e.name.endsWith('animation.json'))!.central.method).toBe(8);

    // Deterministic output
    const again = repairLottie(bytes, 'generic_rewards.lottie');
    expect(await sha256Hex(again.bytes!)).toBe(await sha256Hex(result.bytes!));

    // The repaired file is now clean
    const d = diagnoseLottie(result.bytes!, 'generic_rewards.lottie');
    expect(d.verdict.android).toBe('ok');
    expect(d.autoFixCount).toBe(0);

    // And still opens in the site's dotLottie reader
    expect(extractDotLottie(result.bytes!).success).toBe(true);
  });

  it('drops junk and folder entries, normalises paths, strips the BOM and adds a manifest', () => {
    const anim = enc(animationWithImages([]));
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...anim]);
    const bytes = buildZip([
      { name: 'animations\\animation.json', data: withBom },
      { name: '__MACOSX/._animation.json', data: png(9, 10) },
      { name: '.DS_Store', data: png(8, 10) },
      { name: 'images/', data: new Uint8Array(0) },
    ]);
    const result = repairLottie(bytes, 'messy.lottie');
    expect(result.ok).toBe(true);
    const files = unzipSync(result.bytes!);
    expect(Object.keys(files)).toEqual(['manifest.json', 'animations/animation.json']);
    expect(files['animations/animation.json']).toEqual(anim);
    expect(JSON.parse(new TextDecoder().decode(files['manifest.json'])).animations).toEqual([{ id: 'animation' }]);
    expect(result.verification!.modifiedEntries).toEqual(['manifest.json', 'animations/animation.json']);
  });

  it('wraps a JSON Lottie into a valid .lottie, bundling supplied images', () => {
    const anim = enc(animationWithImages(['img_0.png']));
    const img = png(4, 300);
    const result = repairLottie(anim, 'hero.json', { extraFiles: [{ name: 'img_0.png', data: img }] });
    expect(result.ok).toBe(true);
    expect(result.fileName).toBe('hero.lottie');
    const files = unzipSync(result.bytes!);
    expect(files['animations/animation.json']).toEqual(anim);
    expect(files['images/img_0.png']).toEqual(img);
    expect(diagnoseLottie(result.bytes!, 'hero.lottie').verdict.android).toBe('ok');
  });

  it('converts a v2 archive to the v1 layout on request', () => {
    const anim = enc(animationWithImages(['p.png']));
    const bytes = zipSync({
      'manifest.json': enc({ version: '2', animations: [{ id: 'main' }], themes: [{ id: 't1' }] }),
      'a/main.json': anim,
      'i/p.png': png(5),
      't/t1.json': enc({}),
    });
    const result = repairLottie(bytes, 'v2.lottie', { toV1: true });
    expect(result.ok).toBe(true);
    const files = unzipSync(result.bytes!);
    expect(Object.keys(files)).toEqual(['manifest.json', 'animations/main.json', 'images/p.png']);
    expect(JSON.parse(new TextDecoder().decode(files['manifest.json']))).toMatchObject({ version: '1.0', animations: [{ id: 'main' }] });
  });

  it('refuses archives it cannot read', () => {
    const { bytes } = figmaFixture();
    expect(repairLottie(bytes.subarray(0, 300), 'cut.lottie').ok).toBe(false);
    const zip64 = buildZip([{ name: 'a.json', data: strToU8('{}') }], { zip64: true });
    expect(repairLottie(zip64, 'z.lottie').ok).toBe(false);
  });

  it('repairs every bundled sample animation without changing content', () => {
    const dir = path.join(process.cwd(), 'public/samples/lottie');
    for (const file of ['heart-hi.lottie', 'cat-waiting.lottie']) {
      const bytes = new Uint8Array(readFileSync(path.join(dir, file)));
      const result = repairLottie(bytes, file);
      expect(result.ok, file).toBe(true);
      expect(result.verification!.contentIdentical, file).toBe(true);
    }
  });
});

describe('scanLottieFeatures', () => {
  it('finds features with limited mobile support', () => {
    const anim: LottieAnimation = {
      v: '5.7.0',
      fr: 30,
      ip: 0,
      op: 30,
      w: 100,
      h: 100,
      layers: [
        {
          ty: 4,
          ip: 0,
          op: 30,
          ddd: 1,
          bm: 3,
          tt: 3,
          ef: [{ ty: 5 }],
          masksProperties: [{ mode: 'f' }],
          shapes: [{ ty: 'gr', it: [{ ty: 'mm', mm: 1 }] }],
          ks: { o: { a: 0, k: 100, x: 'value * 2' } },
        },
        { ty: 5, ip: 0, op: 30 },
      ],
      fonts: { list: [{ fFamily: 'Inter' }] },
    };
    const ids = scanLottieFeatures(anim).map((f) => f.id);
    expect(ids).toEqual(
      expect.arrayContaining(['merge-paths', 'expressions', 'effects', 'blend-modes', '3d-layers', 'luma-mattes', 'mask-modes', 'text-fonts'])
    );
    expect(scanLottieFeatures(anim, { bundledFonts: ['Inter'] }).some((f) => f.id === 'text-fonts')).toBe(false);
  });

  it('returns nothing for a plain shape animation', () => {
    expect(scanLottieFeatures(animationWithImages([]))).toEqual([]);
  });
});

describe('normalizePath', () => {
  it('converts backslashes and strips leading ./ and /', () => {
    expect(normalizePath('.\\animations\\a.json')).toBe('animations/a.json');
    expect(normalizePath('/images/x.png')).toBe('images/x.png');
  });
});
