// 도서 분류 (00026~00028): 연령 분류 1개 + 하위 분류 + 전집/시리즈 이름 + 교과연계 학년 여러 개
export const AGE_GROUPS = [
  { value: "age_0_3", label: "유아 0~3세" },
  { value: "age_4_7", label: "유아 4~7세" },
  { value: "infant_set", label: "유아 전집" },
  { value: "elem_1_2", label: "초등 1~2학년" },
  { value: "elem_3_4", label: "초등 3~4학년" },
  { value: "elem_5_6", label: "초등 5~6학년" },
  { value: "elem_all", label: "초등 전학년" },
  { value: "teen", label: "청소년" },
  { value: "adult", label: "일반" },
  { value: "english", label: "영어원서" },
] as const;

export type AgeGroup = (typeof AGE_GROUPS)[number]["value"];

type SubCategory = { value: string; label: string };

// 유아(0~3세, 4~7세) 하위 분류 — 교보 '유아(0~7세)' 분류 체계
export const INFANT_SUB_CATEGORIES: readonly SubCategory[] = [
  { value: "play", label: "유아놀이" },
  { value: "picture", label: "유아그림책" },
  { value: "culture", label: "유아교양" },
  { value: "study", label: "유아학습" },
  { value: "character", label: "유아캐릭터" },
];

// 일반 도서 장르 — 알라딘 분류 기준
export const ADULT_SUB_CATEGORIES: readonly SubCategory[] = [
  { value: "novel", label: "소설·시" },
  { value: "essay", label: "에세이" },
  { value: "humanities", label: "인문·사회·역사" },
  { value: "science", label: "과학" },
  { value: "selfhelp", label: "자기계발" },
  { value: "economy", label: "경제·재테크" },
  { value: "parenting", label: "육아·교육" },
  { value: "hobby", label: "취미·실용·여행" },
  { value: "religion", label: "종교" },
  { value: "etc", label: "기타" },
];

// 하위 분류가 있는 연령 분류
export const SUB_CATEGORIES_BY_AGE: Record<string, readonly SubCategory[]> = {
  age_0_3: INFANT_SUB_CATEGORIES,
  age_4_7: INFANT_SUB_CATEGORIES,
  adult: ADULT_SUB_CATEGORIES,
};

export const INFANT_AGE_GROUPS: readonly string[] = ["age_0_3", "age_4_7"];

export const TEXTBOOK_GRADES = [1, 2, 3, 4, 5, 6] as const;

export const CLASSIFICATION_SOURCES: Record<string, string> = {
  aladin: "알라딘",
  kyobo: "교보문고",
  shelf: "서가 구분",
  series: "전집 판정(제목)",
  manual: "관리자 지정",
};

export function ageGroupLabel(value: string | null | undefined): string {
  return AGE_GROUPS.find((g) => g.value === value)?.label ?? "미분류";
}

export function isAgeGroup(value: string): value is AgeGroup {
  return AGE_GROUPS.some((g) => g.value === value);
}

export function subCategoryLabel(value: string | null | undefined): string | null {
  for (const subs of Object.values(SUB_CATEGORIES_BY_AGE)) {
    const found = subs.find((c) => c.value === value);
    if (found) return found.label;
  }
  return null;
}

export function isSubCategoryOf(ageGroup: string | null | undefined, value: string): boolean {
  return !!ageGroup && (SUB_CATEGORIES_BY_AGE[ageGroup] ?? []).some((c) => c.value === value);
}

export function isSubCategory(value: string): boolean {
  return subCategoryLabel(value) !== null;
}

// 책장 재배치 검토: 현재 서가(location_group 앞부분)에 그대로 둬도 되는 분류
export const SHELF_HOME: Record<string, readonly string[]> = {
  유아: ["age_0_3", "age_4_7", "infant_set"],
  초등도서: ["elem_1_2", "elem_3_4", "elem_5_6", "elem_all"],
  고학년: ["elem_1_2", "elem_3_4", "elem_5_6", "elem_all"],
  세계사: ["elem_1_2", "elem_3_4", "elem_5_6", "elem_all"],
  일반: ["adult"],
  영어원문: ["english"],
};

// "유아C" → "유아", "초등도서H" → "초등도서"
export function shelfBase(locationGroup: string): string {
  return locationGroup.replace(/[A-Z0-9]+$/, "");
}

// 분류가 현재 서가와 맞지 않아 옮겨야 하는지 (미분류·알 수 없는 서가는 판단하지 않음)
export function needsMove(locationGroup: string, ageGroup: string | null | undefined): boolean {
  if (!ageGroup) return false;
  const home = SHELF_HOME[shelfBase(locationGroup)];
  return !!home && !home.includes(ageGroup);
}
