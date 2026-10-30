'use server'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from './auth'

// 시리즈 목록: series_name이 없는 책이 많아서 제목("이름 3: 부제")으로도 묶는다.
// 저장하지 않고 열 때마다 지금 있는 책(삭제·폐기 제외)으로 계산한다.

async function requireAdmin() {
  const user = await getCurrentUser()
  return user && user.role === 'admin' && user.admin_status === 'approved' ? user : null
}

export type SeriesBook = {
  id: string
  title: string
  volume: number | null
  shelf: string
  detail: string
  rented: boolean
  loans: number
}

export type SeriesRow = {
  key: string
  name: string
  publisher: string | null
  age_group: string | null
  shelves: string[]
  books: SeriesBook[]
  volumes: number[] // 가진 권 번호 (중복 없음, 오름차순)
  missing: number[] // 1 ~ 최고 권 사이에 없는 권
  duplicates: number[] // 2부 이상 가진 권
  rented: number
  loans: number
  borrowers: number
}

type BookRow = {
  id: string
  title: string
  publisher: string | null
  series_name: string | null
  age_group: string | null
  location_group: string
  location_detail: string
  is_available: boolean
}

const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()

// "흔한남매 22", "수염 탐정 로빈 1: 버려진 별장의 비밀"
const TITLE_VOLUME = /^(.+?)\s+(\d{1,3})\s*(?:권)?\s*(?:[:：.-]\s*.*)?$/

function classify(b: BookRow): { key: string; name: string; volume: number | null } | null {
  const title = b.title.trim()
  const series = b.series_name?.trim()
  if (series) {
    let volume: number | null = null
    const t = norm(title)
    const s = norm(series)
    if (t.startsWith(s)) {
      const m = t.slice(s.length).match(/^(\d{1,3})(?!\d)/)
      if (m) volume = Number(m[1])
    }
    if (volume === null) {
      // "게을러씨(New EQ의 천재들 17)(양장본 HardCover)"
      const m = title.match(/\(\s*[^()]*?\s(\d{1,3})\s*\)/)
      if (m) volume = Number(m[1])
    }
    return { key: s, name: series, volume }
  }
  const m = title.match(TITLE_VOLUME)
  if (!m) return null
  const name = m[1].trim().replace(/\.+$/, '')
  return { key: norm(name), name, volume: Number(m[2]) }
}

// 1000건씩 끝까지 읽기
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return rows
}

export async function getSeriesList(): Promise<SeriesRow[]> {
  if (!(await requireAdmin())) return []

  const [books, rentals] = await Promise.all([
    fetchAll<BookRow>((from, to) =>
      supabaseAdmin
        .from('books')
        .select('id, title, publisher, series_name, age_group, location_group, location_detail, is_available')
        .eq('is_deleted', false)
        .order('id')
        .range(from, to)
    ),
    fetchAll<{ book_id: string; user_id: string }>((from, to) =>
      supabaseAdmin.from('rentals').select('book_id, user_id').order('id').range(from, to)
    ),
  ])

  const loans = new Map<string, number>()
  const borrowers = new Map<string, Set<string>>()
  for (const r of rentals) {
    loans.set(r.book_id, (loans.get(r.book_id) ?? 0) + 1)
    if (!borrowers.has(r.book_id)) borrowers.set(r.book_id, new Set())
    borrowers.get(r.book_id)!.add(r.user_id)
  }

  type Group = { names: Map<string, number>; items: { volume: number | null; book: BookRow }[] }
  const groups = new Map<string, Group>()
  const loose: BookRow[] = []
  for (const b of books) {
    const c = classify(b)
    if (!c) {
      loose.push(b)
      continue
    }
    const g: Group = groups.get(c.key) ?? { names: new Map(), items: [] }
    g.names.set(c.name, (g.names.get(c.name) ?? 0) + 1)
    g.items.push({ volume: c.volume, book: b })
    groups.set(c.key, g)
  }
  // 번호 없이 등록된 1권 ("푸른 사자 와니니" + "푸른 사자 와니니 2")
  for (const b of loose) {
    const g = groups.get(norm(b.title))
    if (g && g.items.some((it) => it.volume !== null)) g.items.push({ volume: 1, book: b })
  }

  const mostCommon = (values: (string | null)[]) => {
    const counts = new Map<string, number>()
    for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v)
  }

  const rows: SeriesRow[] = []
  for (const [key, g] of groups) {
    if (g.items.length < 2) continue
    const volCount = new Map<number, number>()
    for (const it of g.items) if (it.volume !== null) volCount.set(it.volume, (volCount.get(it.volume) ?? 0) + 1)
    const volumes = [...volCount.keys()].sort((a, b) => a - b)
    const max = volumes[volumes.length - 1]
    const missing: number[] = []
    // 연도 같은 큰 숫자가 권 번호로 잡힌 경우는 빠진 권을 세지 않음
    if (volumes.length >= 2 && max <= 150) {
      for (let i = 1; i <= max; i++) if (!volCount.has(i)) missing.push(i)
    }
    const items = [...g.items].sort(
      (a, b) => (a.volume ?? Infinity) - (b.volume ?? Infinity) || a.book.title.localeCompare(b.book.title, 'ko')
    )
    const users = new Set<string>()
    for (const it of items) for (const u of borrowers.get(it.book.id) ?? []) users.add(u)

    rows.push({
      key,
      name: [...g.names.entries()].sort((a, b) => b[1] - a[1])[0][0],
      publisher: mostCommon(items.map((it) => it.book.publisher))[0] ?? null,
      age_group: mostCommon(items.map((it) => it.book.age_group))[0] ?? null,
      shelves: mostCommon(items.map((it) => it.book.location_group)),
      books: items.map((it) => ({
        id: it.book.id,
        title: it.book.title,
        volume: it.volume,
        shelf: it.book.location_group,
        detail: it.book.location_detail,
        rented: !it.book.is_available,
        loans: loans.get(it.book.id) ?? 0,
      })),
      volumes,
      missing,
      duplicates: volumes.filter((v) => (volCount.get(v) ?? 0) > 1),
      rented: items.filter((it) => !it.book.is_available).length,
      loans: items.reduce((sum, it) => sum + (loans.get(it.book.id) ?? 0), 0),
      borrowers: users.size,
    })
  }

  return rows.sort((a, b) => b.loans - a.loans || a.name.localeCompare(b.name, 'ko'))
}
