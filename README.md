# GSAT PDF 실전연습

기존 SKCT 시험창의 PDF·OMR·타이머 구조를 GSAT에 맞게 정리한 로컬 우선 연습 도구입니다. 문제를 JSON/OCR로 변환하지 않고 사용자가 가진 PDF 원본을 그대로 보면서 OMR과 타이머를 사용합니다.

## 기본 시험 구조

- 수리논리: 20문항 / 30분
- 추리: 30문항 / 30분
- 영역별 번호 및 전체 1~50 번호 지원
- 실전 모드: 일시정지 불가, 영역 자동 전환·잠금
- 연습 모드: 일시정지, 시간 변경, 영역 자유 이동
- 홈과 시험 화면의 모드 버튼을 누르면 실전/연습 메뉴가 열리며, 시험 도중에도 답안과 PDF 기록을 유지한 채 모드를 변경할 수 있음

## 주요 기능

- PDF drag & drop, 교체·삭제, 페이지 이동·직접 입력, 확대·축소, 100%, 너비/전체 맞춤, Ctrl+wheel
- 대용량 PDF 지연 렌더링, 텍스트/주석 레이어, CJK 폰트 지원
- 답 선택 시 현재 PDF 페이지 자동 연결, 수동 연결 및 오답노트에서 페이지 바로가기
- 문항별 풀이시간, 방문·재방문, 답 변경, 스킵/미응답 기록
- 엄격한 정답 붙여넣기 검증, 채점·재채점, 영역별/전체 결과
- 회차 기록, 결과 분석, 오답 태그·오답노트 메모, 오답 다시 풀기
- GSAT 시험 화면은 PDF Viewer + OMR + 타이머만 제공
- JSON 백업/복원, CSV 및 XLSX(회차요약/문항별기록/오답노트/영역별통계) 내보내기

## 저장 구조

- `localStorage`의 `gsat-exam-tool-v2`: `schemaVersion: 2`, 현재 세션, 설정, 회차, 오답 메타데이터
- IndexedDB의 `gsat-pdf-store/pdfs`: SHA-256 fingerprint를 키로 PDF blob 보관
- 기존 `skct-*` 답안·기록은 최초 실행 시 가능한 범위에서 마이그레이션

## 실행과 검증

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
```

개발 서버 기본 주소는 `http://localhost:5173/GSAT/`입니다. 프로덕션 빌드는 `dist/`에 생성됩니다.

## GitHub Pages 배포

- 저장소: `https://github.com/cyjin0704-ops/GSAT`
- 배포 주소: `https://cyjin0704-ops.github.io/GSAT/`
- Vite base path: `/GSAT/`
- `main` 브랜치에 push하면 `.github/workflows/deploy.yml`이 테스트, lint, production build 후 GitHub Pages에 자동 배포합니다.
- GitHub 저장소의 **Settings → Pages → Source**는 **GitHub Actions**로 설정합니다.

PDF 파일과 시험 데이터는 외부 서버로 전송하지 않습니다. PDF blob은 브라우저 IndexedDB에, 시험 상태와 기록은 동일 origin의 localStorage에 저장됩니다.
