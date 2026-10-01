import './style.css';
import { FAMILIES, FAMILY_LABELS, generateMoth, GENERATOR_VERSION, SPECIMEN_SEEDS, SURVEY_SEEDS, type Moth } from './generator/moth';
import { renderMoth, RENDER_MODES, type RenderMode } from './render/svg';

const MODE_LABELS: Record<RenderMode, string> = { pattern: '무늬', silhouette: '실루엣', structure: '구조' };
const PLATES = {
  plate: { seeds: SPECIMEN_SEEDS, title: 'PLATE 01', note: '무늬 연구' },
  survey: { seeds: SURVEY_SEEDS, title: 'SURVEY', note: '다양성과 스타일 일관성 점검' },
} as const;
type PlateName = keyof typeof PLATES;
const PLATE_NAMES = Object.keys(PLATES) as PlateName[];

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('앱 루트 요소를 찾을 수 없습니다.');

const buttons = (group: string, entries: readonly (readonly [string, string])[], active: string): string =>
  entries.map(([value, label]) =>
    `<button data-${group}="${value}" aria-pressed="${String(value === active)}">${label}</button>`).join('');

app.innerHTML = `
  <header><a class="brand" href="./">M<span class="brand-star">✳</span>THDRAW</a><span class="edition">FIELD NOTES / 001</span></header>
  <section class="intro"><div class="eyebrow">A STUDY OF IMAGINARY LEPIDOPTERA</div><h1>Shapes of the night<span>밤의 형태들</span></h1>
  <p>시드 하나가 형태와 무늬와 마모를 함께 결정합니다.<br>떨리는 선으로만 그리고, 날개는 종종 찢어져 있습니다.</p></section>
  <section class="toolbar" aria-label="표본 표시 설정"><div class="collection-title" id="plate-title"></div>
  <div class="controls">
  <div class="modes" role="group" aria-label="표본 수">${buttons('plate', PLATE_NAMES.map(name => [name, `${PLATES[name].seeds.length}개`] as const), 'plate')}</div>
  <div class="modes" role="group" aria-label="표현 방식">${buttons('mode', RENDER_MODES.map(name => [name, MODE_LABELS[name]] as const), 'pattern')}</div>
  </div></section>
  <section class="specimens" aria-label="시드별 나방 표본"></section>
  <footer><span>MOTHDRAW / GENERATOR ${GENERATOR_VERSION}</span><span>허구의 종을 위한 작은 자연사 도감</span><span id="family-count"></span></footer>`;

const grid = document.querySelector<HTMLElement>('.specimens')!;
const title = document.querySelector<HTMLElement>('#plate-title')!;
const familyCount = document.querySelector<HTMLElement>('#family-count')!;

// A hundred specimens are a few hundred milliseconds of work, so each plate is
// generated on first use and kept.
const cache = new Map<PlateName, readonly Moth[]>();
function specimens(name: PlateName): readonly Moth[] {
  const ready = cache.get(name);
  if (ready) return ready;
  const built = PLATES[name].seeds.map(generateMoth);
  cache.set(name, built);
  return built;
}

let mode: RenderMode = 'pattern';
let plate: PlateName = 'plate';

function render(): void {
  const moths = specimens(plate);
  const compact = plate === 'survey';
  grid.classList.toggle('compact', compact);
  title.innerHTML = `${PLATES[plate].title} <span>${PLATES[plate].note} · ${moths.length} specimens</span>`;
  grid.innerHTML = moths.map((moth, index) => `<article class="specimen">`
    + `<div class="specimen-top"><span>${String(index + 1).padStart(compact ? 3 : 2, '0')}</span><span>${FAMILY_LABELS[moth.family]}</span></div>`
    + renderMoth(moth, mode)
    + (compact ? '' : `<div class="specimen-bottom"><span>${moth.seed}</span><span>${moth.wingspan.toFixed(0)} u</span></div>`)
    + `</article>`).join('');
  familyCount.textContent = `${new Set(moths.map(moth => moth.family)).size} / ${FAMILIES.length} 형태 계열`;
}

function bind<Value extends string>(group: string, apply: (value: Value) => void): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>(`[data-${group}]`)) {
    button.addEventListener('click', () => {
      for (const peer of document.querySelectorAll(`[data-${group}]`)) peer.setAttribute('aria-pressed', String(peer === button));
      apply(button.dataset[group] as Value);
      render();
    });
  }
}
bind<RenderMode>('mode', value => { mode = value; });
bind<PlateName>('plate', value => { plate = value; });
render();
