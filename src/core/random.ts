/** FNV-1a seed hash followed by Mulberry32; stream labels isolate future layers. */
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
