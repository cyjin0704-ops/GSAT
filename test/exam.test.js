import test from "node:test";
import assert from "node:assert/strict";
import { buildSections, questionKey } from "../src/areas.js";
import { gradeAttempt, parseAnswerKey, recordsToCsv, sectionStats } from "../src/utils/exam.js";

const sections = buildSections({ sections: { math: { questionCount: 20, minutes: 30 }, reasoning: { questionCount: 30, minutes: 30 } } });

test("GSAT 기본 프리셋은 수리 20 + 추리 30이다", () => {
  assert.deepEqual(sections.map((section) => [section.name, section.questionCount, section.minutes]), [["수리논리",20,30],["추리",30,30]]);
  assert.equal(sections[1].start, 21);
  assert.equal(sections[1].end, 50);
});

test("정답 붙여넣기 형식과 개수를 엄격히 검증한다", () => {
  assert.deepEqual(parseAnswerKey("1, 2\n3 4,5", 5).values, [1,2,3,4,5]);
  assert.match(parseAnswerKey("1,2,3", 5).error, /2개 부족/);
  assert.match(parseAnswerKey("1,2,6,4,5", 5).error, /1~5/);
  assert.match(parseAnswerKey("1,,2,3,4", 5).error, /누락/);
});

test("정답·오답·스킵·미응답을 구분하고 PDF 연결과 시간을 보존한다", () => {
  const answers = { "math:1": 1, "math:2": 4 };
  const metrics = { "math:1": { visits: 1, totalTime: 12 }, "math:2": { visits: 2, totalTime: 31, answerChanges: 1 }, "math:3": { visits: 1, leftUnanswered: true, totalTime: 8 } };
  const answerKey = Array(50).fill(1);
  const result = gradeAttempt({ sections, answers, answerKey, metrics, pageMappings: { "math:2": 18 } });
  assert.deepEqual(result.counts, { correct: 1, wrong: 1, skipped: 1, unanswered: 47 });
  assert.equal(result.questions[1].pdfPage, 18);
  assert.equal(result.questions[1].totalTime, 31);
});

test("재채점은 동일 기록을 새 정답표로만 다시 계산할 수 있다", () => {
  const common = { sections, answers: { "math:1": 2 }, metrics: { "math:1": { totalTime: 42, visits: 3 } }, pageMappings: { "math:1": 7 } };
  const first = gradeAttempt({ ...common, answerKey: Array(50).fill(1) });
  const second = gradeAttempt({ ...common, answerKey: [2, ...Array(49).fill(1)] });
  assert.equal(first.questions[0].status, "wrong");
  assert.equal(second.questions[0].status, "correct");
  assert.equal(second.questions[0].totalTime, 42);
  assert.equal(second.questions[0].pdfPage, 7);
});

test("영역별 통계와 CSV 백업 열을 생성한다", () => {
  const result = gradeAttempt({ sections, answers: { [questionKey("math",1)]: 1 }, answerKey: Array(50).fill(1), metrics: {}, pageMappings: {} });
  assert.equal(sectionStats(result, sections)[0].correct, 1);
  const csv = recordsToCsv([{ name:"1회", date:"2026-10-06", result, review:{} }], sections);
  assert.match(csv, /PDF 페이지/);
  assert.match(csv, /수리논리/);
});
