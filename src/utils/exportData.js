import { recordsToCsv, sectionStats, STATUS_LABELS } from "./exam.js";

const download = (name, type, content) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click();
  URL.revokeObjectURL(url);
};

export function exportJson(state) {
  download(`gsat-backup-${new Date().toISOString().slice(0,10)}.json`, "application/json", JSON.stringify(state, null, 2));
}
export function exportCsv(records, sections) {
  download("gsat-question-records.csv", "text/csv;charset=utf-8", `\ufeff${recordsToCsv(records, sections)}`);
}
export async function exportXlsx(records, sections) {
  const XLSX = await import("xlsx");
  const summary = records.map((record) => ({ 회차:record.name, 시험일:record.date, 정답:record.result.counts.correct, 오답:record.result.counts.wrong, 스킵:record.result.counts.skipped, 미응답:record.result.counts.unanswered, 정답률:record.result.accuracy }));
  const detail = records.flatMap((record) => record.result.questions.map((question) => ({ 회차:record.name, 영역:sections.find((section)=>section.id===question.sectionId)?.name, 번호:question.number, 내답:question.answer, 정답:question.correctAnswer, 상태:STATUS_LABELS[question.status], 풀이시간:question.totalTime||0, PDF페이지:question.pdfPage||"", 재방문:Math.max(0,(question.visits||1)-1), 답변경수:question.answerChanges||0, 오답태그:(record.review?.[question.key]?.tags||[]).join(","), 메모:record.review?.[question.key]?.memo||"" })));
  const wrong = detail.filter((row) => row.상태 !== "정답");
  const sectionRows = records.flatMap((record) => sectionStats(record.result, sections).map((section) => ({ 회차:record.name, 영역:section.name, 정답:section.correct, 전체:section.total, 정답률:section.accuracy, 평균시간:section.averageTime })));
  const book = XLSX.utils.book_new();
  [["회차요약",summary],["문항별기록",detail],["오답노트",wrong],["영역별통계",sectionRows]].forEach(([name,data]) => XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(data),name));
  XLSX.writeFile(book,"gsat-records.xlsx");
}
