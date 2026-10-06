import { questionKey, toGlobalNumber } from "../areas.js";

export const STATUS_LABELS = { correct: "정답", wrong: "오답", skipped: "스킵", unanswered: "미응답" };

export function parseAnswerKey(input, expected) {
  const source = input.trim();
  if (!source) return { error: "정답을 입력해주세요." };
  const normalized = source.replace(/[，、]/g, ",");
  if (/[^1-5,\s]/.test(normalized)) return { error: "정답에는 1~5와 쉼표, 공백, 줄바꿈만 사용할 수 있습니다." };
  if (/,,|,\s*,/.test(normalized)) return { error: "구분자 사이에 누락된 정답이 있습니다." };
  const values = normalized.split(/[,\s]+/).filter(Boolean).map(Number);
  if (values.length < expected) return { error: `정답이 ${expected - values.length}개 부족합니다. (${values.length}/${expected})` };
  if (values.length > expected) return { error: `정답이 ${values.length - expected}개 많습니다. (${values.length}/${expected})` };
  return { values };
}

export function gradeAttempt({ sections, answers, answerKey, metrics = {}, pageMappings = {} }) {
  const questions = [];
  sections.forEach((section) => {
    for (let number = 1; number <= section.questionCount; number += 1) {
      const key = questionKey(section.id, number);
      const globalNumber = toGlobalNumber(sections, section.id, number);
      const answer = answers[key] ?? null;
      const correctAnswer = answerKey[globalNumber - 1] ?? null;
      const metric = metrics[key] ?? {};
      let status = "unanswered";
      if (answer != null) status = answer === correctAnswer ? "correct" : "wrong";
      else if (metric.visits > 0 && metric.leftUnanswered) status = "skipped";
      questions.push({ key, sectionId: section.id, number, globalNumber, answer, correctAnswer, status, pdfPage: pageMappings[key] || null, ...metric });
    }
  });
  const counts = questions.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }), {});
  const answered = (counts.correct || 0) + (counts.wrong || 0);
  return {
    questions,
    counts: { correct: counts.correct || 0, wrong: counts.wrong || 0, skipped: counts.skipped || 0, unanswered: counts.unanswered || 0 },
    responseRate: questions.length ? answered / questions.length : 0,
    accuracy: questions.length ? (counts.correct || 0) / questions.length : 0,
    answeredAccuracy: answered ? (counts.correct || 0) / answered : 0,
  };
}

export function sectionStats(result, sections) {
  return sections.map((section) => {
    const questions = result.questions.filter((item) => item.sectionId === section.id);
    const statusCounts = questions.reduce((counts, item) => {
      counts[item.status] = (counts[item.status] || 0) + 1;
      return counts;
    }, { correct: 0, wrong: 0, skipped: 0, unanswered: 0 });
    const { correct, wrong, skipped, unanswered } = statusCounts;
    const totalSeconds = questions.reduce((sum, item) => sum + (item.totalTime || 0), 0);
    return {
      ...section,
      correct,
      wrong,
      skipped,
      unanswered,
      unansweredTotal: skipped + unanswered,
      total: questions.length,
      accuracy: questions.length ? correct / questions.length : 0,
      averageTime: questions.length ? totalSeconds / questions.length : 0,
    };
  });
}

export const formatSeconds = (seconds = 0) => {
  const rounded = Math.max(0, Math.round(seconds));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
};

const csvEscape = (value) => {
  const valueText = value == null ? "" : String(value);
  return /[",\n]/.test(valueText) ? `"${valueText.replace(/"/g, '""')}"` : valueText;
};

export function recordsToCsv(records, sections) {
  const header = ["회차", "시험일", "영역", "번호", "전체번호", "내 답", "정답", "상태", "풀이시간(초)", "PDF 페이지", "재방문", "답변경수", "오답태그", "메모"];
  const rows = records.flatMap((record) => (record.result?.questions || []).map((q) => [
    record.name, record.date, sections.find((s) => s.id === q.sectionId)?.name || q.sectionId, q.number, q.globalNumber,
    q.answer, q.correctAnswer, STATUS_LABELS[q.status], q.totalTime || 0, q.pdfPage || "", Math.max(0, (q.visits || 1) - 1), q.answerChanges || 0,
    (record.review?.[q.key]?.tags || []).join("|"), record.review?.[q.key]?.memo || record.snapshots?.[q.key]?.memo || "",
  ]));
  return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}
