/** FNV-1a seed hash followed by Mulberry32; stream labels isolate layers. */
export function randomStream(seed: string, stream: string): () => number {
  let state = 2166136261;
  for (const character of `${seed.normalize('NFC')}\0${stream}`) {
    state = Math.imul(state ^ character.codePointAt(0)!, 16777619);
  }
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Dice {
  /** Uniform in [0, 1). Draw order defines reproducibility, so never reorder calls. */
  unit(): number;
  range(low: number, high: number): number;
  /** Inclusive on both ends. */
  int(low: number, high: number): number;
  chance(probability: number): boolean;
  pick<Item>(values: readonly [Item, ...Item[]]): Item;
}

export function dice(seed: string, stream: string): Dice {
  const next = randomStream(seed, stream);
  return {
    unit: next,
    range: (low, high) => low + next() * (high - low),
    int: (low, high) => low + Math.floor(next() * (high - low + 1)),
    chance: probability => next() < probability,
    pick: values => values[Math.floor(next() * values.length)]!,
  };
}
