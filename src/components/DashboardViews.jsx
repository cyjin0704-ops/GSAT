import { useState } from "react";
import { formatSeconds, sectionStats, STATUS_LABELS } from "../utils/exam";

const DEFAULT_TAGS = ["계산 실수", "조건 누락", "시간 부족", "개념 부족", "문제 오독", "선지 비교 실수", "찍음", "풀이법 비효율", "기타"];

export function AppNav({ view, setView, hasSession }) {
  return <header className="app-nav"><button className="brand" onClick={() => setView("home")}><span>GSAT</span> PDF 실전연습</button>
    <nav><button className={view === "exam" ? "active" : ""} disabled={!hasSession} onClick={() => setView("exam")}>시험</button><button className={view === "records" ? "active" : ""} onClick={() => setView("records")}>회차 기록</button><button className={view === "wrong" ? "active" : ""} onClick={() => setView("wrong")}>오답노트</button><button className={view === "analytics" ? "active" : ""} onClick={() => setView("analytics")}>분석</button><button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}>설정</button></nav>
  </header>;
}

export function HomeView({ records, sections, session, onStart, onPdfStart, onResume, onView, onImport, onExport }) {
  const latest = records[0];
  const latestStats = latest ? sectionStats(latest.result, sections) : [];
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  return <main className="home-view"><section className="hero-card"><div><span className="eyebrow">PDF + OMR + TIMER</span><h1>GSAT 실전 연습을<br/>한 화면에서</h1><p>가지고 있는 문제집 PDF를 그대로 보면서 답안, 시간, 오답 기록을 관리하세요.</p></div>
    <div className="start-box"><h2>새 시험 시작</h2><div className="home-mode-picker"><button className="primary-large" onClick={() => setStartMenuOpen((open)=>!open)}>시험 시작 ▾</button>{startMenuOpen && <div className="home-mode-menu"><button onClick={() => onStart("real")}><b>실전 모드</b><span>수리 30분 → 추리 30분</span></button><button onClick={() => onStart("practice")}><b>연습 모드</b><span>자유 이동·일시정지 가능</span></button></div>}</div><label className="pdf-start-label">PDF 업로드 후 연습 시작<input type="file" accept="application/pdf,.pdf" hidden onChange={(e)=>onPdfStart(e.target.files[0])}/></label>{session && <button className="text-action" onClick={onResume}>진행 중인 시험 이어하기 →</button>}</div></section>
    <section className="home-grid"><div className="home-card"><h3>최근 시험</h3>{latest ? <><strong>{latest.name}</strong><p>{latest.date}</p><div className="big-stat">{latest.result.counts.correct}<small> / {latest.result.questions.length} 정답</small></div><div className="recent-section-stats">{latestStats.map((stat)=><span key={stat.id}>{stat.shortName} {Math.round(stat.accuracy*100)}%</span>)}<span>다시 풀기 {latest.result.counts.wrong + latest.result.counts.skipped}</span></div><button onClick={() => onView("records")}>회차 상세 보기</button></> : <p className="empty-copy">아직 저장된 회차가 없습니다.</p>}</div>
      <div className="home-card"><h3>빠른 메뉴</h3><button onClick={() => onView("wrong")}>오답노트 <b>{records.reduce((sum, r) => sum + (r.result?.counts.wrong || 0), 0)}</b></button><button onClick={() => onView("analytics")}>회차 분석</button><button onClick={() => onView("settings")}>시험 설정</button></div>
      <div className="home-card"><h3>데이터 백업</h3><p>시험 기록과 설정을 파일로 보관하거나 다른 브라우저로 옮길 수 있습니다.</p><div className="button-row"><button onClick={onExport}>JSON 내보내기</button><label className="button-label">JSON 가져오기<input type="file" accept="application/json" hidden onChange={(e) => onImport(e.target.files[0])}/></label></div></div></section>
  </main>;
}

export function RecordsView({ records, sections, onOpen, onDelete, onRename, onExportCsv, onExportXlsx }) {
  return <main className="page-view"><div className="page-heading"><div><span className="eyebrow">HISTORY</span><h1>회차 기록</h1></div><div className="button-row"><button onClick={onExportCsv}>CSV</button><button onClick={onExportXlsx}>XLSX</button></div></div>
    {records.length ? <div className="record-cards">{records.map((record) => { const stats = sectionStats(record.result, sections); const avg = record.result.questions.reduce((s, q) => s + (q.totalTime || 0), 0) / record.result.questions.length; return <article className="record-card" key={record.id}>
      <div><input className="record-name-input" value={record.name} onChange={(e) => onRename(record.id, e.target.value)} /><p>{record.date} · {record.pdf?.name || "PDF 없음"}</p></div><div className="record-score"><b>{record.result.counts.correct}</b><span>/{record.result.questions.length}</span></div>
      <div className="record-stats">{stats.map((s) => <span key={s.id}>{s.name} {s.correct}/{s.total}</span>)}<span>평균 {formatSeconds(avg)}</span><span>오답 {record.result.counts.wrong}</span></div>
      <div className="button-row"><button onClick={() => onOpen(record)}>결과 복원</button><button className="danger-text-btn" onClick={() => onDelete(record.id)}>삭제</button></div></article>; })}</div> : <div className="empty-state">저장된 회차가 없습니다.</div>}
  </main>;
}

export function WrongNotesView({ records, sections, customTags, onUpdateReview, onAddTag, onOpenQuestion, onRetry }) {
  const [sectionFilter, setSectionFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const tags = [...DEFAULT_TAGS, ...customTags];
  let rows = records.flatMap((record) => (record.result?.questions || []).filter((q) => ["wrong", "skipped", "unanswered"].includes(q.status)).map((q) => ({ record, q, review: record.review?.[q.key] || {} })));
  rows = rows.filter(({ q, review }) => (sectionFilter === "all" || q.sectionId === sectionFilter) && (tagFilter === "all" || review.tags?.includes(tagFilter)));
  rows.sort((a, b) => sort === "slow" ? (b.q.totalTime || 0) - (a.q.totalTime || 0) : new Date(b.record.date) - new Date(a.record.date));
  return <main className="page-view"><div className="page-heading"><div><span className="eyebrow">REVIEW</span><h1>오답노트</h1></div><div className="filters"><select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}><option value="all">모든 영역</option>{sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}><option value="all">모든 태그</option>{tags.map((t) => <option key={t}>{t}</option>)}</select><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="recent">최근순</option><option value="slow">오래 걸린 순</option></select></div></div>
    <div className="wrong-grid">{rows.map(({ record, q, review }) => <article className="wrong-card" key={`${record.id}-${q.key}`}><div className="wrong-top"><span className={`status-chip ${q.status}`}>{STATUS_LABELS[q.status]}</span><b>{sections.find((s) => s.id === q.sectionId)?.name} {q.number}번</b><span>{formatSeconds(q.totalTime)}</span></div><p>{record.name} · 내 답 {q.answer ?? "-"} / 정답 {q.correctAnswer} · PDF {q.pdfPage || "-"}p</p>
      <div className="tag-list">{tags.map((tag) => <button className={review.tags?.includes(tag) ? "active" : ""} key={tag} onClick={() => { const current = review.tags || []; onUpdateReview(record.id, q.key, { ...review, tags: current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag] }); }}>{tag}</button>)}</div>
      <textarea placeholder="오답 메모" value={review.memo || ""} onChange={(e) => onUpdateReview(record.id, q.key, { ...review, memo: e.target.value })}/><div className="button-row"><button onClick={() => onOpenQuestion(record, q)}>문제 보기</button><button onClick={() => onRetry(record, q)}>다시 풀기</button></div></article>)}</div>
    <div className="add-tag"><input id="new-tag" placeholder="직접 태그 추가"/><button onClick={() => { const input = document.getElementById("new-tag"); if (input.value.trim()) { onAddTag(input.value.trim()); input.value = ""; } }}>추가</button></div>
  </main>;
}

export function AnalyticsView({ records, sections }) {
  if (!records.length) return <main className="page-view"><div className="page-heading"><h1>회차 분석</h1></div><div className="empty-state">채점 후 저장된 회차부터 분석할 수 있습니다.</div></main>;
  const latest = records[0]; const stats = sectionStats(latest.result, sections);
  const sortedTime = [...latest.result.questions].sort((a, b) => (b.totalTime || 0) - (a.totalTime || 0));
  const slowWrong = sortedTime.filter((q) => q.status === "wrong").slice(0, 5);
  const max = Math.max(...records.map((r) => r.result.accuracy), 0.01);
  return <main className="page-view"><div className="page-heading"><div><span className="eyebrow">ANALYTICS</span><h1>결과 분석</h1></div></div>
    <div className="metric-grid"><div><span>전체 정답률</span><b>{Math.round(latest.result.accuracy * 100)}%</b></div>{stats.map((s) => <div key={s.id}><span>{s.name} 정답률</span><b>{Math.round(s.accuracy * 100)}%</b></div>)}<div><span>평균 풀이시간</span><b>{formatSeconds(latest.result.questions.reduce((sum, q) => sum + (q.totalTime || 0), 0) / latest.result.questions.length)}</b></div></div>
    <div className="analysis-grid"><section className="analysis-card"><h3>회차별 정답률 추이</h3><div className="bar-chart">{[...records].reverse().map((r) => <div key={r.id} title={`${r.name}: ${Math.round(r.result.accuracy * 100)}%`}><i style={{ height: `${r.result.accuracy / max * 100}%` }}/><span>{Math.round(r.result.accuracy * 100)}%</span></div>)}</div></section>
      <section className="analysis-card"><h3>가장 오래 걸린 문제 TOP 5</h3>{sortedTime.slice(0, 5).map((q) => <p key={q.key}><b>{sections.find((s) => s.id === q.sectionId)?.shortName} {q.number}</b><span>{formatSeconds(q.totalTime)} · {STATUS_LABELS[q.status]}</span></p>)}</section>
      <section className="analysis-card"><h3>오래 걸린 오답 TOP 5</h3>{slowWrong.map((q) => <p key={q.key}><b>{sections.find((s) => s.id === q.sectionId)?.shortName} {q.number}</b><span>{formatSeconds(q.totalTime)} · 답 변경 {q.answerChanges || 0}회</span></p>)}</section>
      <section className="analysis-card"><h3>답 변경이 잦았던 문제</h3>{[...latest.result.questions].sort((a,b) => (b.answerChanges || 0) - (a.answerChanges || 0)).slice(0,5).map((q) => <p key={q.key}><b>{sections.find((s) => s.id === q.sectionId)?.shortName} {q.number}</b><span>{q.answerChanges || 0}회 · 재방문 {Math.max(0,(q.visits || 1)-1)}회</span></p>)}</section></div>
  </main>;
}

export function SettingsView({ settings, onChange }) {
  const updateSection = (id, field, value) => onChange({ ...settings, sections: { ...settings.sections, [id]: { ...settings.sections[id], [field]: Number(value) } } });
  return <main className="page-view settings-view"><div className="page-heading"><div><span className="eyebrow">SETTINGS</span><h1>시험 설정</h1></div></div><section className="settings-card"><h2>영역 구성</h2>{[{id:"math",name:"수리논리"},{id:"reasoning",name:"추리"}].map((s) => <div className="setting-row" key={s.id}><b>{s.name}</b><label>문항 수 <input type="number" min="1" max="100" value={settings.sections[s.id].questionCount} onChange={(e) => updateSection(s.id,"questionCount",e.target.value)}/></label><label>시간 <input type="number" min="1" max="180" value={settings.sections[s.id].minutes} onChange={(e) => updateSection(s.id,"minutes",e.target.value)}/>분</label></div>)}</section>
    <section className="settings-card"><h2>점수 방식</h2><label><input type="radio" checked={settings.scoreMode === "simple"} onChange={() => onChange({...settings,scoreMode:"simple"})}/> 단순 정답 수</label><label><input type="radio" checked={settings.scoreMode === "penalty"} onChange={() => onChange({...settings,scoreMode:"penalty"})}/> 사용자 지정 감점식</label>{settings.scoreMode === "penalty" && <label>오답 1개당 <input type="number" step="0.1" value={settings.penalty} onChange={(e) => onChange({...settings,penalty:Number(e.target.value)})}/>점 감점</label>}<p className="help-text">공식 GSAT 감점식으로 단정하지 않고 사용자가 정한 값만 적용합니다.</p></section>
  </main>;
}
