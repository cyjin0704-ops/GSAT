# Design QA

- Source visual truth: 사용자 메시지에 첨부된 채점 결과 참고 스크린샷 2장 (2026-10-07)
- Implementation screenshot: Codex Desktop의 Chrome CUA 캡처 — `http://127.0.0.1:4173/GSAT/` 채점 완료 화면 (도구 캡처로 확인, 별도 파일 미생성)
- Viewport: Chrome 창 1920 × 1080 CSS px 상당, device scale factor 2 캡처 (3840 × 2160 px)
- State: 연습 모드, 수리 3문항 응답 후 전체 50문항 채점 완료
- Source pixels: 첫 번째 참고 이미지 488 × 1019 px, 두 번째 참고 이미지 473 × 708 px
- Implementation pixels: 3840 × 2160 px 전체 화면 캡처, 앱 CSS 표시 영역 약 1920 × 1080 px
- Density normalization: 참고 이미지는 세로 부분 화면, 구현은 전체 데스크톱 화면이므로 픽셀 단위 1:1 비교 대신 채점 패널의 구성·색상·모서리·정보 위계를 중심으로 비교

## Full-view comparison evidence

- 기존 3열 시험 레이아웃을 유지하면서 가운데 OMR 열만 기존 대비 20% 축소했다.
- 축소 후에도 PDF, OMR, 타이머 패널 사이에 겹침이나 잘림이 없었다.
- 채점 입력, 전체 상태 카드, 영역별 결과, 필터, 문항별 결과의 정보 순서가 자연스럽게 유지됐다.

## Focused region comparison evidence

- 참고 화면의 초록/빨강/노랑 상태 배지를 영역별 결과 행에 적용했다.
- 정답 문항은 연녹색, 오답 문항은 연분홍색, 스킵·미응답 문항은 연노랑색 배경과 왼쪽 강조선으로 구분된다.
- 필터, 채점, 결과 행, PDF 저장 버튼 및 OMR 선택 버튼은 둥근 사각형으로 표시된다.
- 수리논리 `정답 1 / 오답 2 / 미응답 17`, 추리 `정답 0 / 오답 0 / 미응답 30`이 실제 채점 결과와 일치했다.

## Findings

- P0/P1/P2 없음.
- P3: 참고 이미지는 단일 결과 패널 중심이라 글자가 더 크지만, 구현은 PDF와 타이머를 함께 유지하는 3열 시험 화면이므로 기존 정보 밀도를 유지했다.

## Required fidelity surfaces

- Fonts and typography: 기존 앱의 글꼴·크기 체계를 유지해 주변 UI와 일관된다.
- Spacing and layout rhythm: 영역별 결과는 두 행으로 압축했고 배지 간격과 라운드를 참고 화면에 맞췄다.
- Colors and visual tokens: 초록=정답, 빨강=오답, 노랑=스킵·미응답 의미가 요약 카드와 문항 행에서 일치한다.
- Image quality and asset fidelity: 이번 변경에는 이미지 자산이 없다.
- Copy and content: `영역별 채점 결과`, `정답`, `오답`, `미응답`을 사용하며 기존 `스킵` 기능과 필터는 유지한다.

## Comparison history

- Pass 1: 영역별 집계, 상태별 색상, 둥근 버튼, OMR 20% 축소를 구현 후 같은 채점 상태에서 확인했다. 실행 화면에서 겹침·잘림·오집계가 없어 추가 P0/P1/P2 수정이 필요하지 않았다.

## Interaction checks

- 연습 시험 시작 → 답안 3개 선택 → 채점 화면 전환 → 정답 50개 붙여넣기 → 채점 완료
- 영역별 집계와 전체 집계 일치 확인
- 상태 필터 및 문항별 결과 버튼이 기존 구조로 유지됨을 확인
- 브라우저 콘솔은 네이티브 Chrome CUA에서 직접 열지 않았으며, React 렌더링 오류는 화면과 접근성 트리에 나타나지 않았다.

## Implementation checklist

- [x] 영역별 정답/오답/미응답 집계
- [x] 상태별 색상 구분
- [x] OMR 버튼 둥근 사각형 처리
- [x] OMR 열 20% 축소
- [x] 기존 스킵 판정 및 필터 유지
- [x] 단위 테스트, lint, production build 통과

final result: passed
