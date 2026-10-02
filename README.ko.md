# Mothdraw

<p align="center">
  <a href="README.md">English</a> · <b>한국어</b>
</p>

존재하지 않는 나방을 그리는 브라우저 도구. 시드 하나가 형태와 무늬와 마모를 전부 결정하고, 윤곽부터 질감까지 그려지는 과정이 그대로 재생됩니다.

<p align="center">
  <img src="docs/drawing.svg" width="440" alt="나방 한 마리가 윤곽부터 질감까지 순서대로 그려지는 애니메이션">
  <br><sub><code>nocturne-022</code></sub>
</p>

## 실행

Node.js 22.12 이상.

```sh
npm ci
npm run dev
```

## 조작

화면에는 표본 한 마리만 둡니다. 시드와 세 가지 설정을 정하고 **그리기**를 누르면 그려지는 과정이 재생됩니다.

![같은 시드를 두 슬라이더의 양 끝에서 생성한 네 장](docs/dials.svg)

| 설정 | 하는 일 |
| --- | --- |
| **형태** | 다섯 계열(둥근·뾰족한·후퇴한·물결·긴 꼬리) 중 선택, 또는 시드에 맡김 |
| **무늬 밀도** | 날개맥, 띠, 음영, 해칭, 점, 가장자리 털의 양 |
| **기묘함** | 선 떨림, 비율 과장, 눈알무늬 크기, 몸통 털, 가장자리 손상, 날개 쌍 개수. 0이면 손상이 없고 날개는 항상 두 쌍 |

두 슬라이더의 가운데가 기준값입니다. 그리는 중에 화면을 누르거나 <kbd>Esc</kbd>를 누르면 바로 완성되고, `prefers-reduced-motion`이면 애니메이션 없이 완성본이 나옵니다. 시드와 설정은 URL 해시에 실려 링크를 열면 같은 표본이 다시 나오며, **SVG 저장**은 자립형 파일을 내려받습니다.

## 갤러리

개체마다 전체 크기, 날개 쌍 개수, 더듬이 길이, 몸통 비율이 다릅니다. 프레임은 고정이라 작은 개체는 작게 보입니다.

<p align="center">
  <img src="docs/gallery/nocturne-070.svg" width="520" alt="nocturne-070">
  <br><sub><code>nocturne-070</code></sub>
</p>

<p align="center">
  <img src="docs/gallery/nocturne-064.svg" width="520" alt="nocturne-064">
  <br><sub><code>nocturne-064</code></sub>
</p>

<p align="center">
  <img src="docs/gallery/nocturne-001.svg" width="520" alt="nocturne-001">
  <br><sub><code>nocturne-001</code></sub>
</p>

<p align="center">
  <img src="docs/gallery/nocturne-045.svg" width="520" alt="nocturne-045">
  <br><sub><code>nocturne-045</code></sub>
</p>

<p align="center">
  <img src="docs/gallery/nocturne-069.svg" width="520" alt="nocturne-069">
  <br><sub><code>nocturne-069</code></sub>
</p>
