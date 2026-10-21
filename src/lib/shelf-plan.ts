// 책장 재배치안 (h2books 2026-10, A안 나이 순환형 + 청소년 2칸·일반 4칸): 책장 위치는 그대로 두고 칸마다 새 분류를 정한다.
// 같은 분류가 여러 칸이면 시리즈(전집)는 통째로, 단행본은 가나다순으로 앞 칸부터 채운다.

export type PlanZone =
  | "history" | "teen" | "adult" | "elemhi" | "elem" | "elemlo" | "set" | "kid" | "baby" | "eng" | "spare";

// name: 지금 책장 이름(배치도 위치 기준) / newName: 재배치 후 바꿀 이름(초안) / label: 들어갈 분류
// capacity: 대략 용량(권). 2026-10-06 현장 사진 기준 — 넓은 칸/좁은 칸(폭 절반), 어른 책은 두꺼워서 더 적게 들어감
export type PlanShelf = { name: string; newName: string; label: string; zone: PlanZone; capacity: number };

// 아이 책: 넓은 칸 약 300, 좁은 칸 약 150 / 어른 책: 넓은 칸 약 200, 좁은 칸 약 100
const KID_WIDE = 300;
const KID_NARROW = 150;
const ADULT_WIDE = 200;
const ADULT_NARROW = 100;
const TEEN_WIDE = 250;

// 지금 책장 → 새 이름·분류
export const SHELF_PLAN: PlanShelf[] = [
  // 왼쪽 벽: 청소년 2칸 → 일반 4칸 (출입구 쪽)
  { name: "고학년A", newName: "청소년A", label: "청소년 (가나다 앞)", zone: "teen", capacity: TEEN_WIDE },
  { name: "일반E", newName: "청소년B", label: "청소년 (가나다 뒤)", zone: "teen", capacity: TEEN_WIDE },
  { name: "일반D", newName: "자기계발경제", label: "자기계발·경제", zone: "adult", capacity: ADULT_NARROW },
  { name: "일반C", newName: "소설", label: "소설", zone: "adult", capacity: ADULT_WIDE },
  { name: "일반B", newName: "취미기타", label: "취미·여행·기타", zone: "adult", capacity: ADULT_NARROW },
  { name: "일반A", newName: "에세이인문", label: "에세이·인문", zone: "adult", capacity: ADULT_WIDE },
  // 위쪽 벽 (넓은 칸·좁은 칸이 번갈아 있음): 역사 → 단행본 → 학습만화 시리즈 → 간판 → 5~6 → 3~4 → 1~2 → 신착 (유아 쪽 모서리)
  { name: "세계사A", newName: "역사지식", label: "역사·지식 (세계사·한국사)", zone: "history", capacity: KID_WIDE },
  { name: "세계사B", newName: "초등단행본A", label: "초등 단행본", zone: "elem", capacity: KID_NARROW },
  { name: "초등도서A", newName: "초등단행본B", label: "초등 단행본", zone: "elem", capacity: KID_WIDE },
  { name: "초등도서B", newName: "초등단행본C", label: "초등 단행본", zone: "elem", capacity: KID_NARROW },
  { name: "초등도서C", newName: "초등단행본D", label: "초등 단행본", zone: "elem", capacity: KID_WIDE },
  { name: "초등도서D", newName: "초등시리즈A", label: "학습만화 시리즈", zone: "elem", capacity: KID_NARROW },
  { name: "초등도서E", newName: "초등시리즈B", label: "학습만화 시리즈", zone: "elem", capacity: KID_WIDE },
  { name: "초등도서F", newName: "초등시리즈C", label: "학습만화 시리즈", zone: "elem", capacity: KID_NARROW },
  { name: "초등도서G", newName: "초등시리즈D", label: "학습만화 시리즈", zone: "elem", capacity: KID_WIDE },
  { name: "초등도서H", newName: "초등5-6", label: "초등 5~6학년", zone: "elemhi", capacity: KID_WIDE },
  { name: "초등도서I", newName: "초등3-4", label: "초등 3~4학년", zone: "elemlo", capacity: KID_NARROW },
  { name: "초등도서J", newName: "초등1-2", label: "초등 1~2학년", zone: "elemlo", capacity: KID_WIDE },
  { name: "초등도서K", newName: "신착추천", label: "신착·추천 (표지 보이게 직접 진열)", zone: "spare", capacity: KID_NARROW },
  // 오른쪽 벽: 유아 전집 3칸 → 4~7세 단행본 (유아책상 옆). 그림책 4칸 사이에 놀이학습·교양. 용량은 사진 기준 (유아E가 가장 넓음, B·D·H는 좁은 칸)
  { name: "유아A", newName: "유아전집A", label: "유아 전집", zone: "set", capacity: 320 },
  { name: "유아B", newName: "유아전집B", label: "유아 전집", zone: "set", capacity: 130 },
  { name: "유아C", newName: "유아전집C", label: "유아 전집", zone: "set", capacity: 330 },
  { name: "유아D", newName: "유아그림책A", label: "4~7세 그림책", zone: "kid", capacity: 160 },
  { name: "유아E", newName: "유아그림책B", label: "4~7세 그림책", zone: "kid", capacity: 360 },
  { name: "유아F", newName: "유아놀이학습", label: "4~7세 놀이·학습", zone: "kid", capacity: 220 },
  { name: "유아G", newName: "유아그림책C", label: "4~7세 그림책", zone: "kid", capacity: 360 },
  { name: "유아H", newName: "유아교양", label: "4~7세 교양 · 부모 코너", zone: "kid", capacity: 150 },
  { name: "유아I", newName: "유아그림책D", label: "4~7세 그림책", zone: "kid", capacity: 320 },
  // 유아책상 앞 (사진 없음 — 용량 추정)
  { name: "영어원문", newName: "영어원서", label: "영어원서", zone: "eng", capacity: KID_WIDE },
  { name: "유아J", newName: "유아0-3", label: "0~3세 + 확인 필요 낱권", zone: "baby", capacity: 400 },
];

export const UNPLACED = "미분류";

// 차곡차곡 채울 때도 반납·신착 자리로 10%는 남김
const PACK_FILL = 0.9;
const cap = (name: string): [string, number] => [name, SHELF_PLAN.find((p) => p.name === name)!.capacity];
const SET_SHELVES = ["유아A", "유아B", "유아C"].map(cap);
const SERIES_SHELVES = ["초등도서D", "초등도서E", "초등도서F", "초등도서G"].map(cap);

export type PlanBook = {
  id: string;
  title: string;
  location_group: string;
  age_group: string | null;
  sub_category: string | null;
  series_name: string | null;
  classification_source?: string | null;
};

const byTitle = (a: PlanBook, b: PlanBook) => a.title.localeCompare(b.title, "ko", { numeric: true });

// 가나다순으로 정렬해 칸 용량 비율대로 나눔 (좁은 칸에는 그만큼 적게)
function splitEven(books: PlanBook[], shelves: string[], out: Map<string, string>) {
  const sorted = [...books].sort(byTitle);
  const caps = shelves.map((n) => cap(n)[1]);
  const total = caps.reduce((a, b) => a + b, 0);
  let idx = 0;
  let boundary = (caps[0] / total) * sorted.length;
  sorted.forEach((b, i) => {
    while (i >= boundary && idx < shelves.length - 1) {
      idx++;
      boundary += (caps[idx] / total) * sorted.length;
    }
    out.set(b.id, shelves[idx]);
  });
}

// 시리즈를 통째로 유지하며 권수가 많은 시리즈부터 A칸 → B칸 순서로 채움.
// pack: 칸 용량까지 차곡차곡 (유아 전집) / even: 칸마다 고르게 (초등 시리즈)
// 다음 시리즈가 기준을 넘으면 다음 칸으로 (마지막 칸은 넘쳐도 그대로 담음)
function splitBySeries(
  books: PlanBook[],
  shelves: [string, number][],
  out: Map<string, string>,
  mode: "pack" | "even" = "pack"
) {
  const groups = new Map<string, PlanBook[]>();
  for (const b of books) {
    const k = b.series_name ?? b.title;
    groups.set(k, [...(groups.get(k) ?? []), b]);
  }
  const names = [...groups.keys()].sort(
    (a, b) => groups.get(b)!.length - groups.get(a)!.length || a.localeCompare(b, "ko", { numeric: true })
  );
  const capTotal = shelves.reduce((n, [, c]) => n + c, 0);
  let shelfIdx = 0;
  let filled = 0;
  for (const name of names) {
    const g = groups.get(name)!;
    const over =
      mode === "pack"
        ? filled + g.length > shelves[shelfIdx][1] * PACK_FILL
        : filled + g.length / 2 > (shelves[shelfIdx][1] / capTotal) * books.length; // 용량 비율 기준, 절반 이상 넘치면 다음 칸
    if (filled > 0 && over && shelfIdx < shelves.length - 1) {
      shelfIdx++;
      filled = 0;
    }
    g.forEach((b) => out.set(b.id, shelves[shelfIdx][0]));
    filled += g.length;
  }
}

const isElem = (age: string | null) => !!age && age.startsWith("elem_");

// 책 → 새 책장 이름 (분류가 없으면 UNPLACED)
export function assignShelves(books: PlanBook[]): Map<string, string> {
  const out = new Map<string, string>();
  const pools: Record<string, PlanBook[]> = {
    teen: [], elemSeries: [], elemSingle: [], sets: [], picture: [],
  };

  for (const b of books) {
    const base = b.location_group.replace(/[A-Z0-9]+$/, "");
    const age = b.age_group;
    if (!age) out.set(b.id, UNPLACED);
    else if (age === "english") out.set(b.id, "영어원문");
    // 청소년 2칸에 가나다순으로 나눔
    else if (age === "teen") pools.teen.push(b);
    else if (age === "adult") {
      const sub = b.sub_category;
      if (sub === "novel") out.set(b.id, "일반C");
      else if (sub === "essay" || sub === "humanities" || sub === "science") out.set(b.id, "일반A");
      else if (sub === "selfhelp" || sub === "economy") out.set(b.id, "일반D");
      else if (sub === "parenting") out.set(b.id, "유아H"); // 부모 코너
      else out.set(b.id, "일반B");
    }
    // 지금 세계사 책장의 책은 학년·시리즈와 상관없이 역사·지식 칸(세계사A, 넓은 칸)으로
    else if (base === "세계사" && isElem(age)) out.set(b.id, "세계사A");
    // 학년 코너: 초등H 5~6 → I 3~4 → J 1~2 (유아 쪽으로 갈수록 어려짐)
    else if (age === "elem_5_6") out.set(b.id, "초등도서H");
    else if (age === "elem_3_4") out.set(b.id, "초등도서I");
    else if (age === "elem_1_2") out.set(b.id, "초등도서J");
    else if (age === "elem_all") (b.series_name ? pools.elemSeries : pools.elemSingle).push(b);
    else if (age === "infant_set") pools.sets.push(b);
    else if (age === "age_0_3") out.set(b.id, "유아J");
    // 서가 위치로만 추정한 4~7세(정확도 낮음)는 유아J에 모아 현장에서 확인
    else if (age === "age_4_7" && b.classification_source === "shelf") out.set(b.id, "유아J");
    else if (age === "age_4_7") {
      const sub = b.sub_category;
      if (sub === "play" || sub === "study" || sub === "character") out.set(b.id, "유아F");
      else if (sub === "culture") out.set(b.id, "유아H");
      else pools.picture.push(b);
    } else out.set(b.id, UNPLACED);
  }

  splitEven(pools.teen, ["고학년A", "일반E"], out);
  splitBySeries(pools.elemSeries, SERIES_SHELVES, out, "even");
  // 단행본: 세계사B → 초등A → 초등B → 초등C 4칸에 가나다순, 칸 용량 비율대로
  splitEven(pools.elemSingle, ["세계사B", "초등도서A", "초등도서B", "초등도서C"], out);
  splitBySeries(pools.sets, SET_SHELVES, out);
  splitEven(pools.picture, ["유아D", "유아E", "유아G", "유아I"], out);
  return out;
}
