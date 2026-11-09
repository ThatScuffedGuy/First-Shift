/** A random number source in [0, 1). Tests pass a seeded one so results repeat. */
export type Rng = () => number;

export const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)];

export const between = (rng: Rng, [min, max]: readonly [number, number]): number => min + rng() * (max - min);

export function shuffle<T>(rng: Rng, list: readonly T[]): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function weighted<T extends { weight: number }>(rng: Rng, list: readonly T[]): T {
  let r = rng() * list.reduce((s, x) => s + x.weight, 0);
  for (const x of list) if ((r -= x.weight) < 0) return x;
  return list[list.length - 1];
}

/** Small seeded generator (mulberry32) for repeatable tests. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
