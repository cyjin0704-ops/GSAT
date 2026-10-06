import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OMRSheet from "./components/OMRSheet";
import PDFViewer from "./components/PDFViewer";
import Timer from "./components/Timer";
import Tutorial from "./components/Tutorial";
import { AnalyticsView, AppNav, HomeView, RecordsView, SettingsView, WrongNotesView } from "./components/DashboardViews";
import { exportCsv, exportJson, exportXlsx } from "./utils/exportData";
import { buildSections, questionKey } from "./areas";
import { gradeAttempt } from "./utils/exam";
import { createSession, defaultState, fingerprintFile, loadState, savePdf, saveState, SCHEMA_VERSION } from "./storage";
import "./App.css";

export default function App() {
  const [state, setState] = useState(loadState);
  const [showHelp, setShowHelp] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [jumpPage, setJumpPage] = useState(null);
  const enteredAtRef = useRef(0);
  const sections = useMemo(() => buildSections(state.settings), [state.settings]);
  const session = state.session;
  const setView = (view) => setState((prev) => ({ ...prev, view }));
  const patchSession = useCallback((patch) => setState((prev) => prev.session ? ({ ...prev, session: { ...prev.session, ...patch, updatedAt: Date.now() } }) : prev), []);
  const updatePdfPage = useCallback((pdfPage) => patchSession({ pdfPage }), [patchSession]);
  const updatePdfScale = useCallback((pdfScale) => patchSession({ pdfScale }), [patchSession]);

  useEffect(() => { const id = setTimeout(() => saveState(state), 100); return () => clearTimeout(id); }, [state]);
  useEffect(() => {
    const current = session?.currentQuestion;
    const metric = current ? session.metrics?.[questionKey(current.sectionId, current.number)] : null;
    enteredAtRef.current = metric?.lastEnteredAt || Date.now();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const beforeUnload = (event) => { if (session?.timer.running) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", beforeUnload); return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [session?.timer.running]);
  useEffect(() => {
    if (state.view !== "exam") return;
    window.history.pushState({ gsatExam: true }, "");
    const onPopState = () => {
      if (session?.timer.running && !window.confirm("시험이 진행 중입니다. 홈으로 나갈까요? 현재 상태는 자동 저장됩니다.")) {
        window.history.pushState({ gsatExam: true }, ""); return;
      }
      setState((prev) => ({ ...prev, view: "home" }));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [state.view, session?.timer.running]);
  useEffect(() => {
    const handler = (event) => { if (event.key === "Escape") { setShowHelp(false); setModeMenuOpen(false); } };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  }, []);

  const start = (mode) => setState((prev) => ({ ...prev, view: "exam", session: createSession(mode, prev.settings) }));
  const changeMode = (mode) => {
    if (!session || session.mode === mode) { setModeMenuOpen(false); return; }
    if (session.timer.running && !window.confirm("진행 중인 타이머를 멈추고 모드를 변경할까요? 답안과 PDF 기록은 유지됩니다.")) return;
    const section = sections.find((item) => item.id === session.currentSectionId) || sections[0];
    patchSession({
      mode,
      status: "ready",
      lockedSections: [],
      result: null,
      timer: { running: false, sectionId: section.id, remaining: section.minutes * 60, endAt: null, warnings: [] },
    });
    setModeMenuOpen(false);
  };
  const startWithPdf = async (file) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) { alert("PDF 파일만 업로드할 수 있습니다."); return; }
    try {
      const { fingerprint, buffer } = await fingerprintFile(file);
      await savePdf({ fingerprint, name:file.name, size:file.size, lastModified:file.lastModified, blob:new Blob([buffer],{type:"application/pdf"}) });
      setState((prev) => ({ ...prev, view:"exam", session:createSession("practice",prev.settings,{ pdf:{fingerprint,name:file.name,size:file.size,lastModified:file.lastModified} }) }));
    } catch { alert("PDF를 저장하지 못했습니다."); }
  };

  const leaveQuestion = useCallback((nextQuestion) => {
    if (!session) return;
    const now = Date.now(); const current = session.currentQuestion; const key = questionKey(current.sectionId, current.number); const old = session.metrics[key] || {};
    const elapsed = Math.max(0, Math.round((now - enteredAtRef.current) / 1000));
    const metrics = { ...session.metrics, [key]: { ...old, totalTime: (old.totalTime || 0) + elapsed, lastLeftAt: now, leftUnanswered: session.answers[key] == null } };
    const nextKey = questionKey(nextQuestion.sectionId, nextQuestion.number); const nextMetric = metrics[nextKey] || {};
    metrics[nextKey] = { ...nextMetric, firstEnteredAt: nextMetric.firstEnteredAt || now, visits: (nextMetric.visits || 0) + 1, lastEnteredAt: now };
    enteredAtRef.current = now;
    patchSession({ currentQuestion: nextQuestion, currentSectionId: nextQuestion.sectionId, metrics });
    requestAnimationFrame(() => document.getElementById(`omr-${nextKey}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }, [session, patchSession]);

  const answer = (sectionId, number, choice) => {
    if (!session) return;
    const key = questionKey(sectionId, number); const previous = session.answers[key];
    const answers = { ...session.answers }; if (previous === choice) delete answers[key]; else answers[key] = choice;
    const metric = session.metrics[key] || {};
    const metrics = { ...session.metrics, [key]: { ...metric, answerChanges: previous != null && previous !== choice ? (metric.answerChanges || 0) + 1 : (metric.answerChanges || 0), answered: answers[key] != null, leftUnanswered: false } };
    const pageMappings = session.pageMappings[key] || !session.pdf ? session.pageMappings : { ...session.pageMappings, [key]: session.pdfPage };
    patchSession({ answers, metrics, pageMappings, result: null });
  };

  const saveRecord = (nextSession, result) => {
    const existing = state.records.find((record) => record.id === nextSession.id);
    const record = { id: nextSession.id, name: existing?.name || nextSession.name, date: new Date(nextSession.startedAt).toLocaleString("ko-KR"), mode: nextSession.mode, pdf: nextSession.pdf, answers: nextSession.answers, answerKey: nextSession.answerKey,
      result, metrics: nextSession.metrics, pageMappings: nextSession.pageMappings, review: existing?.review || {}, retryOf: nextSession.retryOf || null };
    setState((prev) => ({ ...prev, records: [record, ...prev.records.filter((item) => item.id !== record.id)] }));
  };
  const grade = (answerKey) => {
    let result = gradeAttempt({ sections, answers: session.answers, answerKey, metrics: session.metrics, pageMappings: session.pageMappings });
    if (session.retryKeys?.length) {
      const questions = result.questions.filter((question) => session.retryKeys.includes(question.key));
      const counts = questions.reduce((acc, question) => ({ ...acc, [question.status]: acc[question.status] + 1 }), { correct:0, wrong:0, skipped:0, unanswered:0 });
      const answered = counts.correct + counts.wrong;
      result = { questions, counts, responseRate: questions.length ? answered / questions.length : 0, accuracy: questions.length ? counts.correct / questions.length : 0, answeredAccuracy: answered ? counts.correct / answered : 0 };
    }
    result = { ...result, score: state.settings.scoreMode === "penalty" ? result.counts.correct - result.counts.wrong * state.settings.penalty : result.counts.correct, scoreMode: state.settings.scoreMode, penalty: state.settings.penalty };
    const nextSession = { ...session, answerKey, result, status: "finished", timer: { ...session.timer, running: false, endAt: null } };
    setState((prev) => ({ ...prev, session: nextSession })); saveRecord(nextSession, result);
  };
  const finish = () => {
    if (!window.confirm("시험을 종료할까요? 종료 후 정답을 입력해 채점할 수 있습니다.")) return;
    patchSession({ status: "finished", timer: { ...session.timer, running: false, endAt: null } });
  };
  const expire = () => {
    if (session.currentSectionId === sections[0].id) {
      const next = sections[1];
      patchSession({ currentSectionId: next.id, currentQuestion: { sectionId: next.id, number: 1 }, lockedSections: [...new Set([...(session.lockedSections || []), sections[0].id])], timer: { running: true, sectionId: next.id, remaining: next.minutes * 60, endAt: Date.now() + next.minutes * 60 * 1000, warnings: [] } });
      enteredAtRef.current = Date.now(); alert("수리논리 시간이 종료되었습니다. 추리 영역으로 이동합니다.");
    } else { patchSession({ status: "finished", lockedSections: sections.map((s) => s.id), timer: { ...session.timer, running: false, remaining: 0, endAt: null } }); alert("시험 시간이 종료되었습니다. 답안이 저장되었습니다."); }
  };
  const timerChange = (patch) => patchSession({ status: patch.running ? "running" : session.status, timer: { ...session.timer, ...patch } });

  const openRecord = (record, targetQuestion) => {
    const restored = createSession("practice", state.settings, { ...record, id: record.id, name: record.name, startedAt: new Date(record.date).getTime() || Date.now(), status: "finished", currentQuestion: targetQuestion || { sectionId: "math", number: 1 }, currentSectionId: targetQuestion?.sectionId || "math", pdfPage: targetQuestion ? record.pageMappings?.[questionKey(targetQuestion.sectionId,targetQuestion.number)] || 1 : 1,
      timer: { running:false,sectionId:targetQuestion?.sectionId||"math",remaining:(sections.find((s)=>s.id===(targetQuestion?.sectionId||"math"))?.minutes||30)*60,endAt:null,warnings:[] } });
    setState((prev) => ({ ...prev, session: restored, view: "exam" }));
    if (targetQuestion) setJumpPage(restored.pdfPage);
  };
  const retryQuestion = (record, question) => {
    const retry = createSession("practice", state.settings, { name:`재풀이 · ${record.name} · ${question.number}번`, retryKeys:[question.key], retryOf:{ recordId:record.id, questionKey:question.key, previousTime:question.totalTime, previousStatus:question.status }, pdf:record.pdf, pdfPage:question.pdfPage||1, currentSectionId:question.sectionId, currentQuestion:{sectionId:question.sectionId,number:question.number}, pageMappings:{[question.key]:question.pdfPage}, answerKey:record.answerKey });
    setState((prev) => ({ ...prev, session: retry, view:"exam" })); setJumpPage(question.pdfPage || 1);
  };
  const updateRecord = (id, updater) => setState((prev) => ({ ...prev, records: prev.records.map((record) => record.id === id ? (typeof updater === "function" ? updater(record) : { ...record, ...updater }) : record) }));

  const importData = async (file) => {
    if (!file) return;
    try { const parsed = JSON.parse(await file.text()); if (parsed.schemaVersion !== SCHEMA_VERSION || !Array.isArray(parsed.records)) throw new Error(); if (!window.confirm(`회차 ${parsed.records.length}개가 포함된 백업으로 현재 데이터를 복원할까요?`)) return; setState({ ...defaultState, ...parsed, view:"home" }); } catch { alert("지원하지 않거나 손상된 GSAT 백업 파일입니다."); }
  };

  const body = (() => {
    if (state.view === "home") return <HomeView records={state.records} sections={sections} session={session} onStart={start} onPdfStart={startWithPdf} onResume={() => setView("exam")} onView={setView} onImport={importData} onExport={() => exportJson(state)} />;
    if (state.view === "records") return <RecordsView records={state.records} sections={sections} onOpen={openRecord} onDelete={(id) => window.confirm("이 회차를 삭제할까요?") && setState((p)=>({...p,records:p.records.filter((r)=>r.id!==id)}))} onRename={(id,name)=>updateRecord(id,{name})} onExportCsv={()=>exportCsv(state.records,sections)} onExportXlsx={()=>exportXlsx(state.records,sections)} />;
    if (state.view === "wrong") return <WrongNotesView records={state.records} sections={sections} customTags={state.customTags} onUpdateReview={(id,key,review)=>updateRecord(id,(r)=>({...r,review:{...r.review,[key]:review}}))} onAddTag={(tag)=>setState((p)=>({...p,customTags:[...new Set([...p.customTags,tag])]}))} onOpenQuestion={(r,q)=>openRecord(r,{sectionId:q.sectionId,number:q.number})} onRetry={retryQuestion} />;
    if (state.view === "analytics") return <AnalyticsView records={state.records} sections={sections} />;
    if (state.view === "settings") return <SettingsView settings={state.settings} onChange={(settings)=>setState((p)=>({...p,settings}))} />;
    if (!session) return <HomeView records={state.records} sections={sections} onStart={start} onPdfStart={startWithPdf} onView={setView} onImport={importData} onExport={()=>exportJson(state)} />;
    return <main className="exam-shell"><div className="exam-toolbar"><div><b>{session.name}</b><div className="mode-menu-wrap"><button className={`mode-switch-btn ${session.mode}`} onClick={()=>setModeMenuOpen((open)=>!open)}>{session.mode === "real" ? "실전 모드" : "연습 모드"} ▾</button>{modeMenuOpen && <div className="mode-menu"><button className={session.mode === "real" ? "active" : ""} onClick={()=>changeMode("real")}><b>실전 모드</b><span>영역별 30분 · 일시정지 불가</span></button><button className={session.mode === "practice" ? "active" : ""} onClick={()=>changeMode("practice")}><b>연습 모드</b><span>시간 변경 · 일시정지 가능</span></button></div>}</div></div><button onClick={()=>setShowHelp(true)}>단축키 · 도움말</button><button onClick={()=>setView("home")}>홈</button></div>
      <div className="app"><div className="middle-panel"><PDFViewer pdfMeta={session.pdf} page={session.pdfPage} scale={session.pdfScale} onMetaChange={(pdf)=>patchSession({pdf})} onPageChange={updatePdfPage} onScaleChange={updatePdfScale} jumpPage={jumpPage}/></div>
        <div className="omr-container"><div className="omr-panel"><OMRSheet sections={sections} session={session} lockedSections={session.mode === "real" ? (session.status === "ready" || session.status === "finished" ? sections.map((s)=>s.id) : [...new Set([...(session.lockedSections || []), ...sections.filter((s)=>s.id!==session.currentSectionId).map((s)=>s.id)])]) : []} onSessionChange={patchSession} onQuestionChange={leaveQuestion} onAnswer={answer} onGrade={grade} onFinish={finish} onPageJump={(page)=>{setJumpPage(page);patchSession({pdfPage:page});}}/></div></div>
        <aside className="right-panel"><div className="timer-section"><Timer sections={sections} session={session} onTimerChange={timerChange} onExpire={expire}/></div><div className="timer-guide"><b>GSAT 시험 구성</b><span>수리논리 20문항 · 30분</span><span>추리 30문항 · 30분</span><small>모드는 상단 버튼에서 언제든 변경할 수 있습니다.</small></div></aside></div></main>;
  })();

  return <><AppNav view={state.view} setView={setView} hasSession={Boolean(session)}/>{body}{showHelp && <Tutorial onClose={()=>setShowHelp(false)}/>}</>;
}
