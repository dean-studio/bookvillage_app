// Open Library(https://openlibrary.org) ISBN 조회 — 영어 원서처럼 카카오에 없는 책의 기본 정보 보충용.
// 설정 isbn_fallback === 'openlibrary' 이고 카카오 결과가 없을 때만 부른다 (api/books/search/route.ts).
// 실패·타임아웃이면 null 을 돌려주고, 호출한 쪽은 기존 응답(못 찾음)을 그대로 쓴다.

export interface OpenLibraryBook {
  title: string
  author: string
  publisher: string
  cover_image: string
  isbn: string
  published_at: string
}

interface OpenLibraryDataEntry {
  title?: string
  subtitle?: string
  authors?: { name?: string }[]
  publishers?: { name?: string }[]
  publish_date?: string
  cover?: { small?: string; medium?: string; large?: string }
}

const TIMEOUT_MS = 3000

/** 'YYYY-MM-DD' 형식이면 그대로, 아니면 연도(4자리)만 ("May 1, 2007" → "2007"). 없으면 빈 문자열 */
function normalizeDate(raw: string | undefined): string {
  if (!raw) return ''
  const iso = raw.match(/^\d{4}-\d{2}-\d{2}/)
  if (iso) return iso[0]
  const y = raw.match(/\d{4}/)
  return y ? y[0] : ''
}

/** ISBN-10/13 체크 숫자 확인. 자체 바코드(BV…)·전부 0 같은 값은 외부 조회하지 않는다 */
function isValidIsbn(s: string): boolean {
  if (/^0+$/.test(s)) return false
  if (/^\d{13}$/.test(s)) {
    let sum = 0
    for (let i = 0; i < 12; i++) sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3)
    return (10 - (sum % 10)) % 10 === Number(s[12])
  }
  if (/^\d{9}[\dX]$/.test(s)) {
    let sum = 0
    for (let i = 0; i < 10; i++) sum += (s[i] === 'X' ? 10 : Number(s[i])) * (10 - i)
    return sum % 11 === 0
  }
  return false
}

export async function searchOpenLibraryByISBN(isbn: string): Promise<OpenLibraryBook | null> {
  const clean = isbn.replace(/[^0-9Xx]/g, '').toUpperCase()
  if (!isValidIsbn(clean)) return null

  try {
    const res = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${clean}&format=json&jscmd=data`,
      {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { Accept: 'application/json' },
        next: { revalidate: 86400 },
      }
    )
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, OpenLibraryDataEntry>
    const entry = data[`ISBN:${clean}`]
    if (!entry || !entry.title) return null

    const title = entry.subtitle ? `${entry.title}: ${entry.subtitle}` : entry.title
    return {
      title: title.slice(0, 200),
      author: (entry.authors ?? []).map((a) => a.name).filter(Boolean).join(', ').slice(0, 100),
      publisher: (entry.publishers ?? []).map((p) => p.name).filter(Boolean).join(', ').slice(0, 100),
      cover_image: entry.cover?.medium || entry.cover?.large || entry.cover?.small || '',
      isbn: clean,
      published_at: normalizeDate(entry.publish_date).slice(0, 20),
    }
  } catch {
    return null
  }
}
