import './style.css';
import {
  DEFAULT_OPTIONS, FAMILIES, FAMILY_LABELS, generateMoth, GENERATOR_VERSION,
  normalizeOptions, type FamilyChoice, type Moth,
} from './generator/moth';
import { renderMoth } from './render/svg';
import { drawMoth, type Drawing } from './ui/draw';
import { readRequest, signature, writeRequest, type Request } from './ui/location';

const SEED_WORDS = ['nocturne', 'vesper', 'umbra', 'tenebra', 'cinder', 'noctua', 'velvet', 'ashen', 'lumen', 'hollow'];

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('앱 루트 요소를 찾을 수 없습니다.');

app.innerHTML = `
  <header><span class="brand">M<span class="brand-star">✳</span>THDRAW</span><span class="edition">GENERATOR ${GENERATOR_VERSION}</span></header>
  <div class="figure" id="figure" title="눌러서 바로 완성"></div>
  <p class="status" id="status" aria-live="polite"></p>
  <form class="console" autocomplete="off">
    <div class="field seed">
      <label for="seed">시드</label>
      <input id="seed" name="seed" type="text" maxlength="160" placeholder="아무 문자열" required>
    </div>
    <div class="field">
      <label for="form">형태</label>
      <select id="form" name="form">
        <option value="any">시드에 맡김</option>
        ${FAMILIES.map(family => `<option value="${family}">${FAMILY_LABELS[family]}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label for="density">무늬 밀도 <output for="density" id="density-value"></output></label>
      <input id="density" name="density" type="range" min="0" max="1" step="0.01">
    </div>
    <div class="field">
      <label for="strange">기묘함 <output for="strange" id="strange-value"></output></label>
      <input id="strange" name="strange" type="range" min="0" max="1" step="0.01">
    </div>
    <div class="actions">
      <button type="submit" class="primary">그리기</button>
      <button type="button" id="shuffle">무작위 시드</button>
      <button type="button" id="replay">다시 그리기</button>
      <button type="button" id="save">SVG 저장</button>
    </div>
  </form>`;

const form = app.querySelector<HTMLFormElement>('.console')!;
const seedInput = app.querySelector<HTMLInputElement>('#seed')!;
const formSelect = app.querySelector<HTMLSelectElement>('#form')!;
const densityInput = app.querySelector<HTMLInputElement>('#density')!;
const strangeInput = app.querySelector<HTMLInputElement>('#strange')!;
const densityValue = app.querySelector<HTMLOutputElement>('#density-value')!;
const strangeValue = app.querySelector<HTMLOutputElement>('#strange-value')!;
const figure = app.querySelector<HTMLElement>('#figure')!;
const status = app.querySelector<HTMLElement>('#status')!;
const saveButton = app.querySelector<HTMLButtonElement>('#save')!;

function randomSeed(): string {
  const word = SEED_WORDS[Math.floor(Math.random() * SEED_WORDS.length)]!;
  return `${word}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
}

function showDials(): void {
  densityValue.textContent = Number(densityInput.value).toFixed(2);
  strangeValue.textContent = Number(strangeInput.value).toFixed(2);
}

function currentRequest(): Request {
  return {
    seed: seedInput.value.trim() || randomSeed(),
    options: normalizeOptions({
      family: formSelect.value as FamilyChoice,
      density: Number(densityInput.value),
      strangeness: Number(strangeInput.value),
    }),
  };
}

function fillControls(request: Request): void {
  seedInput.value = request.seed;
  formSelect.value = request.options.family;
  densityInput.value = String(request.options.density);
  strangeInput.value = String(request.options.strangeness);
  showDials();
}

let drawing: Drawing | null = null;
let current: Moth | null = null;
let shown = '';

/** Only the newest request is on screen; an older drawing is dropped mid-stroke. */
function draw(request: Request): void {
  let moth: Moth;
  try {
    moth = generateMoth(request.seed, request.options);
  } catch (failure) {
    status.textContent = failure instanceof Error ? failure.message : '시드를 확인해주세요.';
    return;
  }
  drawing?.cancel();
  current = moth;
  shown = signature(request);
  writeRequest(request);
  status.textContent = `${moth.seed} · ${FAMILY_LABELS[moth.family]} · ${moth.wingspan.toFixed(0)} u`
    + (moth.torn.some(Boolean) ? ' · 손상' : '');
  saveButton.disabled = true;
  drawing = drawMoth(figure, moth, () => { saveButton.disabled = false; });
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const request = currentRequest();
  fillControls(request);
  draw(request);
});
app.querySelector<HTMLButtonElement>('#shuffle')!.addEventListener('click', () => {
  seedInput.value = randomSeed();
  draw(currentRequest());
});
app.querySelector<HTMLButtonElement>('#replay')!.addEventListener('click', () => {
  if (current) draw({ seed: current.seed, options: current.options });
});
// Skipping the rest of the drawing, by pointer or by key.
figure.addEventListener('click', () => drawing?.finish());
window.addEventListener('keydown', event => {
  if (event.key === 'Escape') drawing?.finish();
});
for (const dial of [densityInput, strangeInput]) dial.addEventListener('input', showDials);

saveButton.addEventListener('click', () => {
  if (!current) return;
  const file = new Blob([renderMoth(current, 'pattern')], { type: 'image/svg+xml' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = `mothdraw-${current.seed}.svg`;
  link.click();
  URL.revokeObjectURL(link.href);
});

// A hash edited by hand or reached from a link redraws; our own writes do not.
window.addEventListener('hashchange', () => {
  const request = readRequest();
  if (!request || signature(request) === shown) return;
  fillControls(request);
  draw(request);
});

const initial = readRequest() ?? { seed: randomSeed(), options: DEFAULT_OPTIONS };
fillControls(initial);
draw(initial);
