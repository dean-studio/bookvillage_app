// 학원 모드 엑셀 일괄 등록용 순수 함수 (서버·클라이언트 공용, "use client"/"use server" 없음).
// 엑셀 파일(.xlsx)은 새 라이브러리 없이 처리하려고 CSV 파일 또는 엑셀에서 복사한 표(탭 구분)를 받는다.
// 파싱은 화면에서 하고, 서버 액션(actions/academy.ts)은 정리된 JSON 배열만 받는다.

import { hangulToLatinKeys } from "@/lib/utils";
import { hasAnyArValue, validateArValues } from "@/lib/ar";

export const MAX_IMPORT_ROWS = 500;

export type ImportKind = "books" | "ar" | "students";

export type ImportColumn = {
  key: string;
  /** 양식 머리글 */
  label: string;
  /** 머리글로 인정하는 다른 이름 (비교할 때 공백·기호·대소문자 무시) */
  aliases: string[];
  required?: boolean;
  example: string;
  maxLength: number;
};

const AR_COLUMNS: ImportColumn[] = [
  { key: "ar_level", label: "AR레벨", aliases: ["BL", "Book Level", "ATOS", "AR", "레벨", "AR 레벨", "ATOS Book Level"], example: "3.5", maxLength: 10 },
  { key: "ar_points", label: "AR포인트", aliases: ["Points", "AR Points", "포인트", "AR Pts", "Pts"], example: "2.0", maxLength: 10 },
  { key: "ar_quiz_no", label: "퀴즈번호", aliases: ["Quiz No", "Quiz", "Quiz Number", "퀴즈", "AR Quiz", "Quiz #"], example: "12345", maxLength: 12 },
  { key: "ar_interest", label: "Interest", aliases: ["IL", "Interest Level", "흥미", "관심연령"], example: "LG", maxLength: 4 },
  { key: "word_count", label: "단어수", aliases: ["Words", "Word Count", "단어"], example: "4500", maxLength: 12 },
  { key: "lexile", label: "Lexile", aliases: ["렉사일"], example: "500L", maxLength: 10 },
];

export const IMPORT_COLUMNS: Record<ImportKind, ImportColumn[]> = {
  books: [
    { key: "isbn", label: "ISBN", aliases: ["ISBN13", "ISBN10"], example: "9780064400558", maxLength: 40 },
    { key: "barcode", label: "바코드", aliases: ["Barcode", "등록번호", "자체바코드"], example: "", maxLength: 30 },
    { key: "title", label: "제목", aliases: ["도서명", "책제목", "Title", "서명"], example: "Charlotte's Web", maxLength: 200 },
    { key: "author", label: "저자", aliases: ["Author", "지은이", "작가"], example: "E. B. White", maxLength: 100 },
    { key: "publisher", label: "출판사", aliases: ["Publisher", "출판"], example: "HarperCollins", maxLength: 100 },
    { key: "shelf", label: "책장", aliases: ["서가", "책장이름", "Shelf", "위치"], example: "", maxLength: 50 },
    { key: "location_detail", label: "세부위치", aliases: ["칸", "세부 위치", "상세위치"], example: "", maxLength: 50 },
    ...AR_COLUMNS,
  ],
  ar: [
    { key: "isbn", label: "ISBN", aliases: ["ISBN13", "ISBN10"], example: "9780064400558", maxLength: 40 },
    { key: "barcode", label: "바코드", aliases: ["Barcode", "등록번호", "자체바코드"], example: "", maxLength: 30 },
    { key: "title", label: "제목", aliases: ["도서명", "책제목", "Title", "서명"], example: "Charlotte's Web", maxLength: 200 },
    // 제목으로 찾을 때만 쓴다: 적혀 있으면 저자도 맞는 책만 고른다 (선택)
    { key: "author", label: "저자", aliases: ["Author", "지은이", "작가"], example: "E. B. White", maxLength: 100 },
    ...AR_COLUMNS,
  ],
  students: [
    { key: "name", label: "이름", aliases: ["학생이름", "성명", "Name", "학생"], required: true, example: "김하늘", maxLength: 20 },
    { key: "group", label: "반", aliases: ["반이름", "클래스", "Class", "소속"], required: true, example: "Phonics A", maxLength: 20 },
    { key: "grade", label: "학년", aliases: ["Grade"], example: "3", maxLength: 4 },
    { key: "zpd_low", label: "ZPD최소", aliases: ["ZPD 하한", "ZPD하한", "ZPD Low", "ZPD Min", "레벨최소", "레벨 최소", "최소레벨"], example: "2.5", maxLength: 6 },
    { key: "zpd_high", label: "ZPD최대", aliases: ["ZPD 상한", "ZPD상한", "ZPD High", "ZPD Max", "레벨최대", "레벨 최대", "최대레벨"], example: "3.8", maxLength: 6 },
    { key: "contact_phone", label: "보호자연락처", aliases: ["보호자 휴대폰", "보호자휴대폰", "연락처", "휴대폰", "전화번호", "보호자전화"], example: "010-1234-5678", maxLength: 20 },
    { key: "memo", label: "메모", aliases: ["비고", "Memo", "참고"], example: "", maxLength: 500 },
  ],
};

export const IMPORT_KIND_LABELS: Record<ImportKind, string> = {
  books: "도서 일괄 등록",
  ar: "AR 정보 일괄 입력",
  students: "학생 일괄 등록",
};

function headerKey(s: string): string {
  return s.toLowerCase().replace(/[\s_\-.#()/:]/g, "");
}

/** 머리글 한 칸 → 칸 key (모르는 머리글이면 null) */
export function matchColumn(kind: ImportKind, header: string): string | null {
  const h = headerKey(header);
  if (!h) return null;
  for (const col of IMPORT_COLUMNS[kind]) {
    if (headerKey(col.label) === h || headerKey(col.key) === h) return col.key;
    if (col.aliases.some((a) => headerKey(a) === h)) return col.key;
  }
  return null;
}

/**
 * 파일 바이트 → 글자.
 * - BOM FF FE / FE FF 이면 UTF-16 LE / BE (엑셀 "유니코드 텍스트" 저장)
 * - UTF-8이 아니면(엑셀 "CSV(쉼표로 분리)" 기본 저장 = EUC-KR) EUC-KR로 읽는다
 */
export function decodeFileText(buf: ArrayBuffer): string {
  const head = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
  if (head.length === 2 && head[0] === 0xff && head[1] === 0xfe) return new TextDecoder("utf-16le").decode(buf);
  if (head.length === 2 && head[0] === 0xfe && head[1] === 0xff) return new TextDecoder("utf-16be").decode(buf);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    try {
      return new TextDecoder("euc-kr").decode(buf);
    } catch {
      return new TextDecoder("utf-8").decode(buf);
    }
  }
}

/**
 * CSV(쉼표) 또는 엑셀 복사본(탭) 글자 → 2차원 배열. 따옴표("…", 안의 "" = ") 처리.
 * 첫 줄에 탭이 있으면 탭 구분, 아니면 쉼표 구분.
 */
export function parseDelimited(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delim = firstLine.includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell === "") {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // 빈 줄도 남겨 둔다(엑셀 행 번호와 줄 번호를 맞추려고). mapTable 에서 건너뛴다
  return rows;
}

function isBlankRow(r: string[]): boolean {
  return !r.some((c) => c.trim() !== "");
}

export type ImportRow = { line: number; values: Record<string, string> };

export type MappedTable =
  | { ok: true; rows: ImportRow[]; columns: string[]; ignoredHeaders: string[] }
  | { ok: false; error: string };

/** 2차원 배열(내용이 있는 첫 줄 = 머리글) → 줄별 값. line 은 엑셀 행 번호(빈 줄 포함해서 센다) */
export function mapTable(kind: ImportKind, table: string[][]): MappedTable {
  const headerIdx = table.findIndex((r) => !isBlankRow(r));
  if (headerIdx < 0) return { ok: false, error: "내용이 없습니다." };
  const header = table[headerIdx];
  const keys = header.map((h) => matchColumn(kind, h));
  const columns = [...new Set(keys.filter((k): k is string => !!k))];
  if (columns.length === 0) {
    const labels = IMPORT_COLUMNS[kind].map((c) => c.label).join(", ");
    return { ok: false, error: `첫 줄에 머리글(${labels})이 있어야 합니다. 양식을 내려받아 써 주세요.` };
  }
  const missing = IMPORT_COLUMNS[kind].filter((c) => c.required && !columns.includes(c.key));
  if (missing.length > 0) {
    return { ok: false, error: `꼭 있어야 하는 칸이 없습니다: ${missing.map((c) => c.label).join(", ")}` };
  }
  if (kind !== "students" && !columns.some((k) => k === "isbn" || k === "barcode" || k === "title")) {
    return { ok: false, error: "ISBN·바코드·제목 중 하나는 있어야 합니다." };
  }
  const ignoredHeaders = header.filter((h, i) => h.trim() !== "" && !keys[i]);
  const dataRows = table
    .map((cells, idx) => ({ cells, line: idx + 1 }))
    .filter((r) => r.line > headerIdx + 1 && !isBlankRow(r.cells));
  if (dataRows.length === 0) return { ok: false, error: "머리글 아래에 내용이 없습니다." };
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return { ok: false, error: `한 번에 ${MAX_IMPORT_ROWS}줄까지 올릴 수 있습니다. (지금 ${dataRows.length}줄) 나눠서 올려 주세요.` };
  }
  const rows: ImportRow[] = dataRows.map(({ cells, line }) => {
    const values: Record<string, string> = {};
    keys.forEach((k, i) => {
      if (!k) return;
      const v = (cells[i] ?? "").trim();
      // 같은 칸이 두 번 있으면 먼저 나온 값이 비었을 때만 채운다
      if (values[k] === undefined || values[k] === "") values[k] = v;
    });
    return { line, values };
  });
  return { ok: true, rows, columns, ignoredHeaders };
}

/** 양식 CSV: 머리글 한 줄만. 예시 줄을 넣으면 지우지 않고 올려 예시 책·학생이 등록될 수 있어서 예시는 화면에만 보여 준다.
 *  엑셀에서 한글이 깨지지 않게 BOM 포함 */
export function buildTemplateCsv(kind: ImportKind): string {
  const cols = IMPORT_COLUMNS[kind];
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return "\uFEFF" + cols.map((c) => esc(c.label)).join(",") + "\r\n";
}

/** 화면에 보여 줄 예시 한 줄 (탭 구분: 엑셀에 붙여 넣기 좋게) */
export function exampleLine(kind: ImportKind): string {
  return IMPORT_COLUMNS[kind].map((c) => c.example || "(빈칸)").join(" | ");
}

/** 엑셀이 긴 숫자를 지수 표기(9.78E+12)로 바꾼 값인지 */
export function isScientificNotation(s: string): boolean {
  return /^\d+(\.\d+)?E\+\d+$/i.test(s.trim());
}

/** ISBN 정리: 숫자·X만 남기고 대문자. 10자리 또는 13자리가 아니면 null */
export function cleanIsbn(raw: string): string | null {
  const s = raw.replace(/[^0-9Xx]/g, "").toUpperCase();
  return /^\d{13}$/.test(s) || /^\d{9}[\dX]$/.test(s) ? s : null;
}

/**
 * 엑셀에 적힌 바코드 정리. 도서 등록 화면의 자체 바코드 규칙과 같다(숫자만 → BV+6자리, BV50 → BV000050).
 * 단, 10·13자리 숫자는 ISBN 바코드로 보고 그대로 둔다(일괄 등록에서는 책에 붙은 ISBN 바코드를 적는 경우가 많음).
 */
export function normalizeImportBarcode(input: string): string {
  const s = hangulToLatinKeys(input).trim();
  if (!s) return "";
  if (/^\d{10}$/.test(s) || /^\d{13}$/.test(s)) return s;
  if (/^\d+$/.test(s)) return `BV${s.padStart(6, "0")}`;
  const m = s.match(/^BV0*(\d+)$/i);
  if (m) return `BV${m[1].padStart(6, "0")}`;
  return s.toUpperCase();
}

/**
 * 엑셀이 휴대폰 번호를 숫자로 바꾸며 앞 0을 지운 값("1012345678")이면 앞에 0을 붙인다.
 * 바꿨으면 고친 값, 아니면 null.
 */
export function restorePhoneLeadingZero(raw: string): string | null {
  const s = raw.trim();
  return /^10\d{8}$/.test(s) ? `0${s}` : null;
}

/** AR 레벨 범위(ZPD) 칸 확인: 빈 칸 또는 0~13.9 */
function checkZpd(values: Record<string, string>): string | null {
  const num = (raw: string | undefined) => {
    const v = (raw ?? "").trim();
    if (v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 13.9 ? n : NaN;
  };
  const low = num(values.zpd_low);
  const high = num(values.zpd_high);
  if (Number.isNaN(low)) return "ZPD최소는 0~13.9 사이 숫자로 적어 주세요.";
  if (Number.isNaN(high)) return "ZPD최대는 0~13.9 사이 숫자로 적어 주세요.";
  if (low !== null && high !== null && low > high) return "ZPD최소가 ZPD최대보다 클 수 없습니다.";
  return null;
}

/** 줄 단위 미리 확인 (화면용). 서버에서 다시 확인한다. 문제가 없으면 null */
export function checkImportRow(kind: ImportKind, values: Record<string, string>): string | null {
  for (const col of IMPORT_COLUMNS[kind]) {
    const v = values[col.key] ?? "";
    if (col.required && !v) return `${col.label}이(가) 비어 있습니다.`;
    if (v.length > col.maxLength) return `${col.label}이(가) 너무 깁니다 (${col.maxLength}자까지).`;
    if (v && isScientificNotation(v)) {
      return `${col.label} 값이 지수 표기(${v})로 바뀌었습니다. 엑셀에서 그 칸을 '텍스트' 형식으로 바꿔 다시 저장해 주세요.`;
    }
  }
  if (kind === "books" || kind === "ar") {
    const isbn = values.isbn ?? "";
    if (isbn && !cleanIsbn(isbn)) return "ISBN은 10자리 또는 13자리여야 합니다.";
    if (!isbn && !values.barcode && !values.title) return "ISBN·바코드·제목이 모두 비어 있습니다.";
    const arError = validateArValues(values);
    if (arError) return arError;
  }
  if (kind === "ar" && !hasAnyArValue(values)) return "AR 정보 칸이 모두 비어 있습니다.";
  if (kind === "books" && !values.title && !values.isbn) return "제목이 없으면 ISBN이 있어야 합니다 (ISBN으로 책 정보를 찾음).";
  if (kind === "students") {
    const g = values.grade ?? "";
    if (g && !/^(0|[1-9]|1[0-2])$/.test(g.replace(/학년$/, "").trim())) return "학년은 0~12 숫자로 적어 주세요 (미취학은 0).";
    const zpdError = checkZpd(values);
    if (zpdError) return zpdError;
  }
  return null;
}
