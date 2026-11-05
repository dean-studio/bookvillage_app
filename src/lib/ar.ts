// AR(Accelerated Reader) 정보 화면용 순수 함수. 서버·클라이언트 공용 ("use client" 없음).
// 화면에 AR 칸·배지를 그릴지는 항상 설정 ar_enabled === 'on' (isFlagOn) 으로 먼저 판단하고 여기 함수를 쓴다.

export const AR_INTERESTS = ["LG", "MG", "MG+", "UG"] as const;
export type ArInterest = (typeof AR_INTERESTS)[number];
export const AR_FIELD_KEYS = ["ar_level", "ar_points", "ar_quiz_no", "ar_interest", "word_count", "lexile"] as const;
export type ArFieldKey = (typeof AR_FIELD_KEYS)[number];

/** 입력 칸 상태(모두 문자열). 빈 문자열 = 값 없음 */
export type ArValues = {
  ar_level: string;
  ar_points: string;
  ar_quiz_no: string;
  ar_interest: string;
  word_count: string;
  lexile: string;
};

export const EMPTY_AR: ArValues = {
  ar_level: "",
  ar_points: "",
  ar_quiz_no: "",
  ar_interest: "",
  word_count: "",
  lexile: "",
};

type ArSource = {
  ar_level?: number | string | null;
  ar_points?: number | string | null;
  ar_quiz_no?: number | string | null;
  ar_interest?: string | null;
  word_count?: number | string | null;
  lexile?: string | null;
};

function toStr(v: number | string | null | undefined): string {
  return v === null || v === undefined ? "" : String(v);
}

/** DB 책 → 입력 칸 상태 */
export function arValuesFromBook(book: ArSource | null | undefined): ArValues {
  if (!book) return { ...EMPTY_AR };
  return {
    ar_level: toStr(book.ar_level),
    ar_points: toStr(book.ar_points),
    ar_quiz_no: toStr(book.ar_quiz_no),
    ar_interest: toStr(book.ar_interest),
    word_count: toStr(book.word_count),
    lexile: toStr(book.lexile),
  };
}

/**
 * FormData에 AR 칸 6개를 넣는다. 빈 칸은 ""(서버에서 null = 지우기).
 * ar_enabled 가 꺼진 화면에서는 이 함수를 부르지 않는다 → 서버로 AR 키가 아예 가지 않음.
 */
export function appendArFields(formData: FormData, v: ArValues) {
  for (const key of AR_FIELD_KEYS) {
    formData.set(key, (v[key] ?? "").trim());
  }
}

/** AR BookFinder. 검색 결과로 바로 가는 GET 주소가 공개돼 있지 않아 메인을 연다 (제목은 클립보드로 복사) */
export const AR_BOOKFIND_URL = "https://www.arbookfind.com/";

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 'BL 3.5 · 2.0 pts · Quiz #12345' — 값이 하나도 없으면 null */
export function formatArBadge(book: ArSource | null | undefined): string | null {
  if (!book) return null;
  const parts: string[] = [];
  const level = num(book.ar_level);
  const points = num(book.ar_points);
  const quiz = num(book.ar_quiz_no);
  if (level !== null) parts.push(`BL ${level.toFixed(1)}`);
  if (points !== null) parts.push(`${points.toFixed(1)} pts`);
  if (quiz !== null) parts.push(`Quiz #${quiz}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** 학생 검색 화면의 레벨 범위 칩 */
export const AR_LEVEL_RANGES: { key: string; label: string; min?: number; max?: number }[] = [
  { key: "0", label: "0점대", min: 0, max: 0.9 },
  { key: "1", label: "1점대", min: 1, max: 1.9 },
  { key: "2", label: "2점대", min: 2, max: 2.9 },
  { key: "3", label: "3점대", min: 3, max: 3.9 },
  { key: "4", label: "4점대", min: 4, max: 4.9 },
  { key: "5", label: "5점대", min: 5, max: 5.9 },
  { key: "6", label: "6 이상", min: 6 },
];

/** Interest(내용 연령대) 설명 */
export const AR_INTEREST_LABELS: Record<string, string> = {
  LG: "LG (유치~3학년)",
  MG: "MG (4~8학년)",
  "MG+": "MG+ (6학년 이상)",
  UG: "UG (9학년 이상)",
};

/**
 * 입력 칸 값 미리 확인 (화면용). 서버는 lib/validations/books.ts 의 zod 스키마로 다시 확인한다.
 * 빈 칸은 통과. 문제가 있으면 첫 번째 오류 문구, 없으면 null.
 */
export function validateArValues(v: Partial<ArValues>): string | null {
  const s = (k: ArFieldKey) => (v[k] ?? "").trim().replace(/,/g, "");
  const level = s("ar_level");
  if (level !== "") {
    const n = Number(level);
    if (!Number.isFinite(n) || n < 0 || n > 13.9) return "AR 레벨은 0~13.9 사이로 입력하세요.";
  }
  const points = s("ar_points");
  if (points !== "") {
    const n = Number(points);
    if (!Number.isFinite(n) || n < 0 || n > 9999.9) return "AR 포인트를 확인하세요.";
  }
  const quiz = s("ar_quiz_no");
  if (quiz !== "") {
    const n = Number(quiz);
    if (!Number.isInteger(n) || n < 1 || n > 2147483647) return "AR 퀴즈 번호를 확인하세요.";
  }
  const interest = (v.ar_interest ?? "").trim().toUpperCase();
  if (interest !== "" && !(AR_INTERESTS as readonly string[]).includes(interest)) {
    return "Interest는 LG, MG, MG+, UG 중 하나입니다.";
  }
  const words = s("word_count");
  if (words !== "") {
    const n = Number(words);
    if (!Number.isInteger(n) || n < 0 || n > 2147483647) return "단어 수를 확인하세요.";
  }
  if ((v.lexile ?? "").trim().length > 10) return "Lexile은 10자 이내로 입력하세요.";
  return null;
}

/** 값이 하나라도 들어 있는지 */
export function hasAnyArValue(v: Partial<ArValues>): boolean {
  return AR_FIELD_KEYS.some((k) => (v[k] ?? "").trim() !== "");
}
