export const DEFAULT_SECTIONS = [
  { id: "math", name: "수리논리", shortName: "수리", questionCount: 20, minutes: 30 },
  { id: "reasoning", name: "추리", shortName: "추리", questionCount: 30, minutes: 30 },
];

export const buildSections = (settings = {}) => {
  let offset = 0;
  return DEFAULT_SECTIONS.map((base) => {
    const custom = settings.sections?.[base.id] ?? {};
    const questionCount = Number(custom.questionCount) || base.questionCount;
    const minutes = Number(custom.minutes) || base.minutes;
    const section = { ...base, questionCount, minutes, start: offset + 1, end: offset + questionCount };
    offset += questionCount;
    return section;
  });
};

export const AREAS = buildSections();
export const AREA_NAMES = AREAS.map((area) => area.name);
export const QUESTIONS_PER_AREA = null;
export const questionKey = (sectionId, number) => `${sectionId}:${number}`;
export const totalQuestionCount = (sections) => sections.reduce((sum, section) => sum + section.questionCount, 0);
export const toGlobalNumber = (sections, sectionId, number) => {
  const section = sections.find((item) => item.id === sectionId);
  return section ? section.start + number - 1 : number;
};
export const fromGlobalNumber = (sections, globalNumber) => {
  const section = sections.find((item) => globalNumber >= item.start && globalNumber <= item.end);
  return section ? { sectionId: section.id, number: globalNumber - section.start + 1 } : null;
};
