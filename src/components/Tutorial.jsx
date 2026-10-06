export default function Tutorial({ onClose }) {
  return <div className="tutorial-overlay" onClick={onClose}><div className="tutorial-modal" onClick={(e)=>e.stopPropagation()}><div className="tutorial-header"><h2>사용 안내 · 단축키</h2><button className="close-btn" onClick={onClose}>×</button></div><div className="tutorial-content">
    <section><h3>PDF 문제지</h3><p>PDF를 끌어 놓거나 업로드하세요. 원본을 텍스트 문제로 변환하지 않고 그대로 표시합니다. Ctrl + 마우스 휠로 확대/축소하고, 방향키로 페이지를 이동할 수 있습니다.</p></section>
    <section><h3>OMR과 페이지 연결</h3><p>답을 처음 선택하면 현재 PDF 페이지가 자동 연결됩니다. 각 문항 오른쪽의 p 버튼으로 현재 페이지를 수동 연결하거나, 연결된 페이지로 즉시 이동할 수 있습니다.</p></section>
    <section><h3>실전 / 연습 모드</h3><p>시험 화면 상단의 모드 버튼을 누르면 언제든 실전·연습 모드를 선택할 수 있습니다. 실전은 수리논리 30분, 추리 30분 순서로 진행하며 일시정지할 수 없습니다. 연습은 시간과 영역 이동이 자유롭습니다.</p></section>
    <section><h3>채점과 기록</h3><p>시험 종료 후 50개 정답을 입력하면 정답·오답·스킵·미응답을 구분합니다. 정답을 고쳐 재채점해도 답안, 시간, PDF 연결은 유지됩니다.</p></section>
    <section><h3>키보드</h3><dl className="shortcut-list"><div><dt>1~5</dt><dd>현재 문항 답 선택</dd></div><div><dt>Enter</dt><dd>다음 문항</dd></div><div><dt>← →</dt><dd>PDF 이전/다음 페이지</dd></div><div><dt>Esc</dt><dd>메뉴·안내 닫기</dd></div></dl></section>
    <section><h3>자동 저장</h3><p>답안, 타이머, 현재 위치와 기록은 브라우저에 자동 저장됩니다. PDF 원본은 IndexedDB에 보관하며, 저장이 불가능한 경우 같은 PDF를 다시 업로드하면 fingerprint로 기록을 연결합니다.</p></section>
  </div><div className="tutorial-footer"><button className="btn-primary" onClick={onClose}>닫기</button></div></div></div>;
}
