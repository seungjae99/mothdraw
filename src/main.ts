import './style.css';
import { FAMILY_LABELS, FAMILIES, generateMoth, SPECIMEN_SEEDS } from './generator/moth';
import { renderMoth, type RenderMode } from './render/svg';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('앱 루트 요소를 찾을 수 없습니다.');
const specimens = SPECIMEN_SEEDS.map(generateMoth);
app.innerHTML = `
  <header><a class="brand" href="./">M<span class="brand-star">✳</span>THDRAW</a><span class="edition">FIELD NOTES / 001</span></header>
  <section class="intro"><div class="eyebrow">A STUDY OF IMAGINARY LEPIDOPTERA</div><h1>Shapes of the night<span>밤의 형태들</span></h1>
  <p>스무 개의 시드, 스무 마리의 나방.<br>무늬를 더하기 전, 날개와 몸의 균형을 관찰합니다.</p></section>
  <section class="toolbar" aria-label="표본 표시 설정"><div class="collection-title">PLATE 01 <span>실루엣 연구 · 20 specimens</span></div>
  <div class="modes" role="group" aria-label="표현 방식"><button data-mode="silhouette" aria-pressed="true">실루엣</button><button data-mode="structure" aria-pressed="false">구조 보기</button></div></section>
  <section class="specimens" aria-label="시드별 나방 표본 20개"></section>
  <footer><span>MOTHDRAW / GENERATOR 0.2.0</span><span>허구의 종을 위한 작은 자연사 도감</span><span id="family-count"></span></footer>`;
const grid = document.querySelector<HTMLElement>('.specimens')!;
function render(mode: RenderMode) {
  grid.innerHTML = specimens.map((moth, index) => `<article class="specimen"><div class="specimen-top"><span>${String(index + 1).padStart(2, '0')}</span><span>${FAMILY_LABELS[moth.family]}</span></div>${renderMoth(moth, mode)}<div class="specimen-bottom"><span>${moth.seed}</span><span>${moth.wingspan.toFixed(0)} u</span></div></article>`).join('');
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
  button.addEventListener('click', () => {
    const mode = button.dataset.mode;
    if (mode !== 'silhouette' && mode !== 'structure') return;
    for (const peer of document.querySelectorAll('[data-mode]')) peer.setAttribute('aria-pressed', String(peer === button));
    render(mode);
  });
}
document.querySelector('#family-count')!.textContent = `${new Set(specimens.map(moth => moth.family)).size} / ${FAMILIES.length} 형태 계열`;
render('silhouette');
