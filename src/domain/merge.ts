import type { Conflict } from './model';
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);
export function threeWayMerge<T>(
  base: T,
  local: T,
  remote: T,
): { value: T; conflicts: Conflict[] } {
  const conflicts: Conflict[] = [];
  function merge(b: unknown, l: unknown, r: unknown, path: string[]): unknown {
    if (equal(l, r)) return structuredClone(l);
    if (equal(b, l)) return structuredClone(r);
    if (equal(b, r)) return structuredClone(l);
    if (object(b) && object(l) && object(r)) {
      const result: Record<string, unknown> = Object.create(null);
      for (const key of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)])) {
        const value = merge(b[key], l[key], r[key], [...path, key]);
        if (value !== undefined) result[key] = value;
      }
      return result;
    }
    conflicts.push({
      path,
      base: structuredClone(b),
      local: structuredClone(l),
      remote: structuredClone(r),
    });
    return structuredClone(l);
  }
  return { value: merge(base, local, remote, []) as T, conflicts };
}
export function setAtPath<T>(value: T, path: string[], next: unknown): T {
  if (path.some((p) => ['__proto__', 'constructor', 'prototype'].includes(p)))
    throw new Error('Invalid conflict path.');
  if (!path.length) return structuredClone(next) as T;
  const result = structuredClone(value);
  let current = result as Record<string, unknown>;
  for (const segment of path.slice(0, -1)) {
    if (!object(current[segment])) current[segment] = {};
    current = current[segment] as Record<string, unknown>;
  }
  if (next === undefined) delete current[path.at(-1)!];
  else current[path.at(-1)!] = structuredClone(next);
  return result;
}
