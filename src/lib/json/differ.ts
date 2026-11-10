// lib/json/differ.ts — JSON diff algorithm

export type DiffType = 'added' | 'removed' | 'changed' | 'unchanged';

export interface DiffNode {
  key: string;
  path: string;
  type: DiffType;
  leftValue?: unknown;
  rightValue?: unknown;
  children?: DiffNode[];
}

function diffValues(left: unknown, right: unknown, path: string, key: string): DiffNode {
  if (JSON.stringify(left) === JSON.stringify(right)) {
    return { key, path, type: 'unchanged', leftValue: left, rightValue: right };
  }
  if (
    typeof left === 'object' && left !== null &&
    typeof right === 'object' && right !== null &&
    !Array.isArray(left) && !Array.isArray(right)
  ) {
    const children = diffObjects(left as Record<string, unknown>, right as Record<string, unknown>, path);
    return { key, path, type: 'changed', children };
  }
  return { key, path, type: 'changed', leftValue: left, rightValue: right };
}

function diffObjects(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
  parentPath: string,
): DiffNode[] {
  const allKeys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const nodes: DiffNode[] = [];

  for (const key of allKeys) {
    const path = parentPath ? `${parentPath}.${key}` : key;
    if (!(key in left)) {
      nodes.push({ key, path, type: 'added', rightValue: right[key] });
    } else if (!(key in right)) {
      nodes.push({ key, path, type: 'removed', leftValue: left[key] });
    } else {
      nodes.push(diffValues(left[key], right[key], path, key));
    }
  }
  return nodes;
}

/** Compute a structural diff between two JSON strings or parsed objects */
export function diffJSON(leftInput: string | unknown, rightInput: string | unknown): DiffNode[] {
  let left = leftInput;
  let right = rightInput;

  if (typeof left === 'string') {
    try {
      left = JSON.parse(left);
    } catch (err) {
      throw new Error(`Left input: ${(err as Error).message}`);
    }
  }

  if (typeof right === 'string') {
    try {
      right = JSON.parse(right);
    } catch (err) {
      throw new Error(`Right input: ${(err as Error).message}`);
    }
  }

  const isPlainObject = (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v);
  if (!isPlainObject(left) || !isPlainObject(right)) {
    return [diffValues(left, right, '', 'root')];
  }

  return diffObjects(
    left as Record<string, unknown>,
    right as Record<string, unknown>,
    '',
  );
}

/** Count changed/added/removed nodes in a diff */
export function diffStats(nodes: DiffNode[]): { added: number; removed: number; changed: number } {
  const stats = { added: 0, removed: 0, changed: 0 };
  function walk(ns: DiffNode[]) {
    for (const n of ns) {
      if (n.type === 'added') stats.added++;
      else if (n.type === 'removed') stats.removed++;
      else if (n.type === 'changed' && !n.children) stats.changed++;
      if (n.children) walk(n.children);
    }
  }
  walk(nodes);
  return stats;
}

