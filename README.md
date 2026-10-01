# Mothdraw

TypeScript와 SVG로 만드는 가상의 나방 표본 도감. 현재 시드 기반 실루엣 엔진과 20개 고정 표본 비교 화면을 구현했습니다. 작업 전 [개발 가이드라인](./DEVELOPMENT.md)을 읽어주세요.

## 실행

Node.js 22.12 이상과 npm이 설치된 환경:

```sh
npm ci
npm run dev
```

현재 Mac에서는 Codex에 포함된 Node.js v24.19.0과 프로젝트 로컬 npm 10.9.2를 사용할 수 있습니다. 시스템 설정을 변경하지 않았습니다.

```sh
cd /Users/choi/dev/proj/mothdraw
./scripts/npm.sh run dev
```

이 래퍼는 일반 npm이 있으면 우선 사용합니다. Codex 런타임 경로는 이 Mac 전용이며, 다른 환경에서는 Node.js와 npm을 설치하세요. 로컬 npm은 `.tooling/`에 설치되어 버전 관리에서 제외됩니다.

## 검증

```sh
./scripts/npm.sh run check
./scripts/npm.sh test
./scripts/npm.sh run build
```

테스트는 고정 20개와 추가 200개 시드에 대해 결정성, 좌표 범위, 닫힌 윤곽, 날개 자체 교차, 뿌리 위치와 좌우 대칭을 검사합니다. esbuild는 테스트와 표본 도판 스크립트에서 TypeScript를 실행 가능한 모듈로 변환하는 개발 의존성입니다.

## 표본 비교

- `nocturne-001`부터 `nocturne-020`까지 같은 20개 시드를 유지합니다.
- 실루엣 / 구조 보기 버튼으로 형태와 앞·뒷날개 겹침을 비교합니다.
- 둥근 4, 뾰족한 3, 후퇴한 6, 물결 5, 긴 꼬리 2개입니다.
- `u`는 생성 좌표계의 너비이며 실제 생물의 물리적 길이가 아닙니다.
- 무늬, 수집 기능 및 저장 UI는 후속 단계입니다.

## 비교 도판 생성

```sh
./scripts/npm.sh run plate -- ./artifacts
```

독립 SVG 두 장을 생성합니다. 브라우저에서 열어 확인할 수 있으며 서버가 필요하지 않습니다.
