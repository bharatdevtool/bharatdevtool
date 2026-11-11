import { describe, it, expect, beforeEach } from 'vitest';
import * as jf from '../public/assets/js/json-file.js';

/** A fake FileSystemFileHandle that records what is written to it. */
function fakeHandle(perm: 'granted' | 'denied' = 'granted') {
  const written: string[] = [];
  return {
    written,
    kind: 'file',
    queryPermission: async () => 'prompt',
    requestPermission: async () => perm,
    createWritable: async () => ({
      write: async (t: string) => { written.push(t); },
      close: async () => {},
    }),
  };
}

function dropEvent(text: string, name: string, handle: unknown) {
  const file = new File([text], name, { type: 'application/json' });
  return {
    dataTransfer: {
      files: [file],
      items: [{ kind: 'file', getAsFileSystemHandle: async () => handle }],
    },
  };
}

describe('JSON Formatter: save back to the opened file', () => {
  beforeEach(() => jf.forgetOpenedFile());

  it('reads a dropped file once and remembers its name and handle', async () => {
    const handle = fakeHandle();
    const text = await jf.readDroppedFile(dropEvent('{"a":1}', 'data.json', handle));
    expect(text).toBe('{"a":1}');
    expect(jf.getOpenedFile()).toEqual({ name: 'data.json', handle });
    expect(jf.canSaveInPlace()).toBe(true);
  });

  it('writes the edited JSON into the same file after permission is granted', async () => {
    const handle = fakeHandle('granted');
    await jf.readDroppedFile(dropEvent('{"a":1}', 'data.json', handle));
    expect(await jf.saveToOpenedFile('{"a":2}')).toBe('saved');
    expect(handle.written).toEqual(['{"a":2}']);
  });

  it('does not write when permission is refused', async () => {
    const handle = fakeHandle('denied');
    await jf.readDroppedFile(dropEvent('{"a":1}', 'data.json', handle));
    expect(await jf.saveToOpenedFile('{"a":2}')).toBe('cancelled');
    expect(handle.written).toEqual([]);
  });

  it('cannot save in place without a handle (Firefox, Safari, phones)', async () => {
    await jf.readDroppedFile(dropEvent('{"a":1}', 'data.json', null));
    expect(jf.getOpenedFile()?.name).toBe('data.json');
    expect(jf.canSaveInPlace()).toBe(false);
  });

  it('notifies listeners and forgets the file', async () => {
    const seen: (string | null)[] = [];
    jf.onOpenedFileChange((f: { name: string } | null) => seen.push(f ? f.name : null));
    await jf.readDroppedFile(dropEvent('{}', 'x.json', null));
    jf.forgetOpenedFile();
    expect(seen).toEqual([null, 'x.json', null]);
  });

  it('ignores drops without a file', () => {
    expect(jf.readDroppedFile({ dataTransfer: { files: [], items: [] } })).toBeNull();
  });
});
