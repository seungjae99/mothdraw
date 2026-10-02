import { normalizeOptions, type MothOptions } from '../generator/moth';

export interface Request {
  readonly seed: string;
  readonly options: MothOptions;
}

/** The hash carries the whole record, so a link reproduces the same specimen. */
export function readRequest(): Request | null {
  const params = new URLSearchParams(location.hash.slice(1));
  const seed = params.get('seed');
  if (!seed) return null;
  return {
    seed,
    options: normalizeOptions({
      family: (params.get('form') ?? undefined) as MothOptions['family'],
      density: Number(params.get('density')),
      strangeness: Number(params.get('strange')),
    }),
  };
}

export function writeRequest(request: Request): void {
  const params = new URLSearchParams({
    seed: request.seed,
    form: request.options.family,
    density: String(request.options.density),
    strange: String(request.options.strangeness),
  });
  history.replaceState(null, '', `#${params.toString()}`);
}

/** Compares two requests without caring how the hash spelled them. */
export function signature(request: Request): string {
  const { seed, options } = request;
  return [seed, options.family, options.density, options.strangeness].join(' ');
}
