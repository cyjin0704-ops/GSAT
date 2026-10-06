import { useEffect, useMemo, useRef, useState } from "react";
import { questionKey, toGlobalNumber, totalQuestionCount } from "../areas";
import { formatSeconds, parseAnswerKey, sectionStats, STATUS_LABELS } from "../utils/exam";

const CHOICES = [1, 2, 3, 4, 5];
const FILTERS = ["all", "correct", "wrong", "skipped", "unanswered"];

export default function OMRSheet({ sections, session, lockedSections, onSessionChange, onQuestionChange, onAnswer, onGrade, onFinish, onPageJump }) {
  const [grading, setGrading] = useState(Boolean(session.result));
  const [answerText, setAnswerText] = useState((session.answerKey || []).join(","));
  const [filter, setFilter] = useState("all");
  const [viewMode, setViewMode] = useState(localStorage.getItem("gsat-omr-view") || "area");
  const [mappingQuestion, setMappingQuestion] = useState(null);
  const scrollRef = useRef(null);
  const current = session.currentQuestion;
  const total = session.retryKeys?.length || totalQuestionCount(sections);

  useEffect(() => { localStorage.setItem("gsat-omr-view", viewMode); }, [viewMode]);
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTop = session.omrScrollTop || 0;
    const save = () => onSessionChange({ omrScrollTop: element.scrollTop });
    element.addEventListener("scroll", save, { passive: true });
    return () => element.removeEventListener("scroll", save);
  }, [grading]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCount = session.retryKeys ? session.retryKeys.filter((key) => session.answers[key] != null).length : Object.keys(session.answers).length;
  const currentSection = sections.find((section) => section.id === session.currentSectionId) || sections[0];
  const resultRows = useMemo(() => (session.result?.questions || []).filter((row) => filter === "all" || row.status === filter), [session.result, filter]);
  const resultGroups = useMemo(() => sections.map((section) => ({
    section,
    rows: resultRows.filter((row) => row.sectionId === section.id),
  })).filter((group) => group.rows.length), [resultRows, sections]);
  const areaResults = useMemo(() => session.result ? sectionStats(session.result, sections) : [], [session.result, sections]);

  const selectQuestion = (sectionId, number) => onQuestionChange({ sectionId, number });
  const submitGrade = () => {
    if (session.retryKeys?.length) { onGrade(session.answerKey); return; }
    const parsed = parseAnswerKey(answerText, total);
    if (parsed.error) { alert(parsed.error); return; }
    onGrade(parsed.values);
  };

  useEffect(() => {
    const handler = (event) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
      if (/^[1-5]$/.test(event.key) && !grading) { event.preventDefault(); onAnswer(current.sectionId, current.number, Number(event.key)); }
      if (event.key === "Enter" && !grading) {
        const section = sections.find((item) => item.id === current.sectionId);
        if (current.number < section.questionCount) selectQuestion(current.sectionId, current.number + 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const row = (section, number, displayNumber) => {
    const key = questionKey(section.id, number);
    const locked = lockedSections.includes(section.id);
    const selected = current.sectionId === section.id && current.number === number;
    return <div id={`omr-${key}`} className={`omr-row ${selected ? "current" : ""} ${locked ? "inactive" : ""}`} key={key}>
      <button className="question-number" disabled={locked} onClick={() => selectQuestion(section.id, number)}>{displayNumber}</button>
      <div className="choices">{CHOICES.map((choice) => <button key={choice} disabled={locked}
        className={`choice-btn ${session.answers[key] === choice ? "selected" : ""}`}
        onClick={() => { selectQuestion(section.id, number); onAnswer(section.id, number, choice); }}>{choice}</button>)}</div>
      <button className={`page-link-btn ${session.pageMappings[key] ? "mapped" : ""}`} title={session.pageMappings[key] ? `PDF ${session.pageMappings[key]}페이지` : "현재 PDF 페이지 연결"}
        onClick={() => session.pageMappings[key] ? onPageJump(session.pageMappings[key]) : setMappingQuestion(key)}>p{session.pageMappings[key] || "+"}</button>
    </div>;
  };

  return <div className="omr-sheet">
    <div className="omr-header">
      <div className="omr-header-top"><div><h2>GSAT OMR</h2><span className="current-area-badge">{currentSection.name}</span></div>
        <div className="view-mode-toggle"><button className={viewMode === "area" ? "active" : ""} onClick={() => setViewMode("area")}>영역별</button><button className={viewMode === "all" ? "active" : ""} onClick={() => setViewMode("all")}>전체 1~{total}</button></div></div>
      <div className="omr-actions"><button className="grade-btn" disabled={session.mode === "real" && session.status !== "finished"} title={session.mode === "real" && session.status !== "finished" ? "실전 시험 종료 후 채점할 수 있습니다." : ""} onClick={() => setGrading((value) => !value)}>{grading ? "답안지" : "채점"}</button>
        <button className="finish-btn" onClick={onFinish}>시험 종료</button><button className="clear-all-btn" onClick={() => window.confirm("모든 답안을 지울까요?") && onSessionChange({ answers: {}, result: null, answerKey: [] })}>초기화</button></div>
      <div className="answer-progress"><span>선택 {selectedCount}/{total}</span><div><i style={{ width: `${selectedCount / total * 100}%` }} /></div></div>
    </div>

    {grading ? <div className="grading-section">
      <h3>{session.retryKeys?.length ? "오답 재풀이 채점" : "정답 입력 · 재채점"}</h3><p className="help-text">{session.retryKeys?.length ? "기존 정답표로 재풀이 결과를 채점하고 최초 기록과 비교합니다." : `전체 ${total}개를 쉼표, 공백 또는 줄바꿈으로 붙여넣으세요. 수리 ${sections[0].questionCount}개 다음 추리 ${sections[1].questionCount}개 순서입니다.`}</p>
      {!session.retryKeys?.length && <textarea className="answer-input" rows="5" value={answerText} onChange={(e) => setAnswerText(e.target.value)} placeholder="1,2,3,4,5,..." />}
      <div className="grading-buttons"><button className="submit-grade-btn" onClick={submitGrade}>{session.result ? "재채점" : "채점하기"}</button>{!session.retryKeys?.length && <button className="clear-grade-btn" onClick={() => setAnswerText("")}>입력 지우기</button>}</div>
      {session.result && <>
        <div className="score-cards">{Object.entries(session.result.counts).map(([status, count]) => <div className={`score-card ${status}`} key={status}><b>{count}</b><span>{STATUS_LABELS[status]}</span></div>)}</div>
        <div className="rate-row"><span>응답률 <b>{Math.round(session.result.responseRate * 100)}%</b></span><span>단순 정답률 <b>{Math.round(session.result.accuracy * 100)}%</b></span><span>{session.result.scoreMode === "penalty" ? "사용자 감점 점수" : "정답 수"} <b>{session.result.score}</b></span></div>
        <section className="section-result-summary" aria-label="영역별 채점 결과">
          <h4>영역별 채점 결과</h4>
          {areaResults.map((area) => <div className="section-result-row" key={area.id}>
            <strong>{area.name}</strong>
            <span className="result-count correct">정답 {area.correct}</span>
            <span className="result-count wrong">오답 {area.wrong}</span>
            <span className="result-count unanswered" title={`스킵 ${area.skipped}개 포함`}>미응답 {area.unansweredTotal}</span>
          </div>)}
        </section>
        {session.retryOf && <div className="retry-compare">최초: {STATUS_LABELS[session.retryOf.previousStatus]} · {formatSeconds(session.retryOf.previousTime)} → 재풀이: {STATUS_LABELS[session.result.questions[0]?.status]} · {formatSeconds(session.result.questions[0]?.totalTime)}</div>}
        <div className="status-filter">{FILTERS.map((value) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "all" ? "전체" : STATUS_LABELS[value]}</button>)}</div>
        <div className="result-list">{resultGroups.map(({ section, rows }) => <section className={`result-section result-section-${section.id}`} key={section.id}>
          <h4 className="result-section-title"><span>{section.name}</span><small>1~{section.questionCount}번</small></h4>
          <div className="result-section-rows">{rows.map((item) => <button className={`result-row ${item.status}`} key={item.key} onClick={() => { onQuestionChange({ sectionId: item.sectionId, number: item.number }); if (item.pdfPage) onPageJump(item.pdfPage); }}>
            <b>{section.shortName} {item.number}</b><span>내 답 {item.answer ?? "-"} / 정답 {item.correctAnswer}</span><span>{formatSeconds(item.totalTime)}</span><em>{STATUS_LABELS[item.status]}</em>
          </button>)}</div>
        </section>)}</div>
        <button className="export-pdf-btn" onClick={() => window.print()}>오답노트 PDF로 저장</button>
      </>}
    </div> : <div className="omr-content" ref={scrollRef}>{viewMode === "area" ? sections.filter((section) => !session.retryKeys || session.retryKeys.some((key) => key.startsWith(`${section.id}:`))).map((section) => <section className="omr-area" key={section.id}>
      <h3 className="omr-area-title">{section.name} · {session.retryKeys?.length ? session.retryKeys.filter((key)=>key.startsWith(`${section.id}:`)).length : section.questionCount}문항</h3>
      {Array.from({ length: section.questionCount }, (_, index) => index + 1).filter((number) => !session.retryKeys || session.retryKeys.includes(questionKey(section.id, number))).map((number) => row(section, number, number))}</section>) : sections.flatMap((section) => Array.from({ length: section.questionCount }, (_, index) => index + 1).filter((number) => !session.retryKeys || session.retryKeys.includes(questionKey(section.id, number))).map((number) => row(section, number, toGlobalNumber(sections, section.id, number))))}</div>}

    {mappingQuestion && <div className="mini-modal"><div><p><b>현재 PDF {session.pdfPage}페이지</b>를 이 문항에 연결할까요?</p><button onClick={() => { onSessionChange({ pageMappings: { ...session.pageMappings, [mappingQuestion]: session.pdfPage } }); setMappingQuestion(null); }}>연결</button><button onClick={() => setMappingQuestion(null)}>취소</button></div></div>}
  </div>;
}
