'use server'

import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  AGE_GROUPS,
  TEXTBOOK_GRADES,
  SUB_CATEGORIES_BY_AGE,
  isAgeGroup,
  isSubCategory,
  isSubCategoryOf,
  needsMove,
  shelfBase,
} from '@/lib/book-classification'
import { SHELF_PLAN, UNPLACED, assignShelves, type PlanBook } from '@/lib/shelf-plan'
import { getCurrentUser } from './auth'
import type { ActionResult } from '@/types'

async function isAdmin() {
  const user = await getCurrentUser()
  return !!user && user.role === 'admin'
}

const activeBooks = () =>
  supabaseAdmin.from('books').select('id', { count: 'exact', head: true }).eq('is_deleted', false)

// 분류 현황: 전체/분류 완료/미분류 + 연령별 + 교과연계 학년별 권수
export async function getClassificationSummary() {
  if (!(await isAdmin())) return null

  const subPairs = Object.entries(SUB_CATEGORIES_BY_AGE).flatMap(([age, subs]) => subs.map((c) => [age, c.value] as const))
  const [total, unclassified, ...rest] = await Promise.all([
    activeBooks(),
    activeBooks().is('age_group', null),
    ...AGE_GROUPS.map((g) => activeBooks().eq('age_group', g.value)),
    ...TEXTBOOK_GRADES.map((g) => activeBooks().contains('textbook_grades', [g])),
    ...subPairs.map(([age, sub]) => activeBooks().eq('age_group', age).eq('sub_category', sub)),
  ])

  // 전집·시리즈별 권수 (group by 대신 이름만 받아 집계). 유아 전집과 그 외(초등 시리즈 등)로 나눔
  const { data: seriesRows } = await supabaseAdmin
    .from('books')
    .select('series_name, age_group')
    .eq('is_deleted', false)
    .not('series_name', 'is', null)
    .range(0, 9999)
  const infantSets = new Map<string, number>()
  const otherSeries = new Map<string, number>()
  for (const r of seriesRows ?? []) {
    const map = r.age_group === 'infant_set' ? infantSets : otherSeries
    map.set(r.series_name!, (map.get(r.series_name!) ?? 0) + 1)
  }
  const sortSeries = (m: Map<string, number>) =>
    [...m.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ko'))

  const ageCounts = rest.slice(0, AGE_GROUPS.length)
  const gradeCounts = rest.slice(AGE_GROUPS.length, AGE_GROUPS.length + TEXTBOOK_GRADES.length)
  const subCounts = rest.slice(AGE_GROUPS.length + TEXTBOOK_GRADES.length)
  const totalCount = total.count ?? 0
  const unclassifiedCount = unclassified.count ?? 0

  return {
    total: totalCount,
    classified: totalCount - unclassifiedCount,
    unclassified: unclassifiedCount,
    byAge: AGE_GROUPS.map((g, i) => ({ value: g.value, label: g.label, count: ageCounts[i].count ?? 0 })),
    byGrade: TEXTBOOK_GRADES.map((g, i) => ({ grade: g, count: gradeCounts[i].count ?? 0 })),
    // 하위 분류가 있는 연령별 권수: { age_0_3: [{value,label,count}], adult: [...] }
    bySub: Object.fromEntries(
      Object.entries(SUB_CATEGORIES_BY_AGE).map(([age, subs]) => [
        age,
        subs.map((c) => ({
          value: c.value,
          label: c.label,
          count: subCounts[subPairs.findIndex(([a, v]) => a === age && v === c.value)].count ?? 0,
        })),
      ])
    ) as Record<string, { value: string; label: string; count: number }[]>,
    series: sortSeries(infantSets),
    otherSeries: sortSeries(otherSeries),
  }
}

const PAGE_SIZE = 50

// 서가·분류만 가볍게 전체 조회 (약 5천 권)
async function fetchShelfRows() {
  const rows: { id: string; title: string; location_group: string; age_group: string | null }[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await supabaseAdmin
      .from('books')
      .select('id, title, location_group, age_group')
      .eq('is_deleted', false)
      .order('id')
      .range(from, from + 999)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return rows
}

// 책장별 보기: 현재 서가마다 분류별 권수 + 옮겨야 할 권수
export async function getShelfOverview() {
  if (!(await isAdmin())) return null

  const rows = await fetchShelfRows()
  const shelves = new Map<string, { name: string; base: string; total: number; moves: number; byAge: Map<string, number> }>()
  for (const r of rows) {
    const s = shelves.get(r.location_group) ?? {
      name: r.location_group,
      base: shelfBase(r.location_group),
      total: 0,
      moves: 0,
      byAge: new Map<string, number>(),
    }
    s.total++
    if (needsMove(r.location_group, r.age_group)) s.moves++
    const k = r.age_group ?? 'none'
    s.byAge.set(k, (s.byAge.get(k) ?? 0) + 1)
    shelves.set(r.location_group, s)
  }

  const list = [...shelves.values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }))
    .map((s) => ({
      name: s.name,
      base: s.base,
      total: s.total,
      moves: s.moves,
      byAge: [...s.byAge.entries()]
        .map(([age, count]) => ({ age, count, move: needsMove(s.name, age === 'none' ? null : age) }))
        .sort((a, b) => b.count - a.count),
    }))

  return { shelves: list, totalMoves: list.reduce((n, s) => n + s.moves, 0) }
}

// 분류별 도서 목록. age: 연령 값 또는 'none'(미분류) / grade: 교과연계 학년
export async function getClassifiedBooks(params: {
  /** 현재 서가 (location_group) */
  shelf?: string
  /** 옮겨야 할 책만 */
  moves?: boolean
  age?: string
  sub?: string
  series?: string
  grade?: number
  q?: string
  page?: number
}) {
  if (!(await isAdmin())) return { books: [], total: 0, pageSize: PAGE_SIZE }

  const page = Math.max(1, params.page ?? 1)

  // 옮겨야 할 책: 서가·분류를 JS로 판정한 뒤 해당 페이지 id만 조회
  let moveIds: string[] | null = null
  if (params.moves) {
    const rows = await fetchShelfRows()
    moveIds = rows
      .filter((r) => (!params.shelf || r.location_group === params.shelf) && needsMove(r.location_group, r.age_group))
      .sort((a, b) => a.location_group.localeCompare(b.location_group, 'ko', { numeric: true }) || a.title.localeCompare(b.title, 'ko'))
      .map((r) => r.id)
  }

  let query = supabaseAdmin
    .from('books')
    .select(
      'id, title, author, publisher, barcode, cover_image, location_group, location_detail, age_group, sub_category, series_name, textbook_grades, classification_source',
      { count: 'exact' }
    )
    .eq('is_deleted', false)

  if (moveIds) {
    const pageIds = moveIds.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    const { data } = await query.in('id', pageIds.length ? pageIds : ['00000000-0000-0000-0000-000000000000'])
    const order = new Map(pageIds.map((id, i) => [id, i]))
    const books = (data ?? []).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    return { books, total: moveIds.length, pageSize: PAGE_SIZE }
  }

  if (params.shelf) query = query.eq('location_group', params.shelf)
  if (params.age === 'none') query = query.is('age_group', null)
  else if (params.age && isAgeGroup(params.age)) query = query.eq('age_group', params.age)
  if (params.sub === 'none') query = query.is('sub_category', null)
  else if (params.sub && isSubCategory(params.sub)) query = query.eq('sub_category', params.sub)
  if (params.series) query = query.eq('series_name', params.series)
  if (params.grade) query = query.contains('textbook_grades', [params.grade])
  // PostgREST or() 구문 깨짐 방지
  const q = params.q?.replace(/[,()]/g, ' ').trim()
  if (q) query = query.or(`title.ilike.%${q}%,author.ilike.%${q}%,barcode.ilike.%${q}%`)

  const { data, count } = await query
    .order('location_group', { ascending: true })
    .order('title', { ascending: true })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  return { books: data ?? [], total: count ?? 0, pageSize: PAGE_SIZE }
}

// 관리자가 직접 연령 분류 지정/해제
export async function setBookAgeGroup(bookId: string, ageGroup: string | null): Promise<ActionResult> {
  if (!(await isAdmin())) return { success: false, error: '권한이 없습니다.' }
  if (ageGroup !== null && !isAgeGroup(ageGroup)) return { success: false, error: '잘못된 분류입니다.' }

  // 바뀐 연령 분류에 맞지 않는 하위 분류는 해제
  const { data: current } = await supabaseAdmin.from('books').select('sub_category').eq('id', bookId).single()
  const keepSub = !!current?.sub_category && isSubCategoryOf(ageGroup, current.sub_category)

  const { error } = await supabaseAdmin
    .from('books')
    .update({
      age_group: ageGroup,
      ...(keepSub ? {} : { sub_category: null }),
      classification_source: ageGroup ? 'manual' : null,
      classified_at: ageGroup ? new Date().toISOString() : null,
    })
    .eq('id', bookId)

  if (error) return { success: false, error: '분류 저장에 실패했습니다.' }
  return { success: true }
}

// 관리자가 직접 하위 분류 지정/해제 (유아 0~3세·4~7세, 일반)
export async function setBookSubCategory(bookId: string, subCategory: string | null): Promise<ActionResult> {
  if (!(await isAdmin())) return { success: false, error: '권한이 없습니다.' }
  if (subCategory !== null) {
    const { data: book } = await supabaseAdmin.from('books').select('age_group').eq('id', bookId).single()
    if (!isSubCategoryOf(book?.age_group, subCategory)) return { success: false, error: '잘못된 분류입니다.' }
  }

  const { error } = await supabaseAdmin
    .from('books')
    .update({ sub_category: subCategory, classification_source: 'manual', classified_at: new Date().toISOString() })
    .eq('id', bookId)

  if (error) return { success: false, error: '분류 저장에 실패했습니다.' }
  return { success: true }
}

// 관리자: 전집·시리즈 이름 변경 (오타로 갈라진 시리즈 합치기에도 사용)
export async function renameSeries(oldName: string, newName: string): Promise<ActionResult<{ count: number }>> {
  if (!(await isAdmin())) return { success: false, error: '권한이 없습니다.' }
  const name = newName.trim()
  if (!name || name.length > 100) return { success: false, error: '이름은 1~100자로 입력해주세요.' }

  const { data, error } = await supabaseAdmin
    .from('books')
    .update({ series_name: name })
    .eq('series_name', oldName)
    .select('id')

  if (error) return { success: false, error: '이름 변경에 실패했습니다.' }
  return { success: true, data: { count: data?.length ?? 0 } }
}

// ── 재배치안 ──────────────────────────────────────────────

async function fetchPlanBooks() {
  const rows: PlanBook[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await supabaseAdmin
      .from('books')
      .select('id, title, location_group, age_group, sub_category, series_name, classification_source')
      .eq('is_deleted', false)
      .order('id')
      .range(from, from + 999)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return rows
}

// 재배치안: 배치도(책장 위치) + 새 책장별 들어갈 권수 / 다른 책장에서 옮겨올 권수
export async function getShelfPlan() {
  if (!(await isAdmin())) return null

  const [books, { data: layout }] = await Promise.all([
    fetchPlanBooks(),
    supabaseAdmin.from('shelves').select('id, name, type, position_x, position_y, width, height, color'),
  ])
  const assigned = assignShelves(books)
  const stats = new Map<string, { total: number; incoming: number }>()
  for (const b of books) {
    const target = assigned.get(b.id) ?? UNPLACED
    const st = stats.get(target) ?? { total: 0, incoming: 0 }
    st.total++
    if (target !== UNPLACED && target !== b.location_group) st.incoming++
    stats.set(target, st)
  }

  return {
    layout: layout ?? [],
    shelves: SHELF_PLAN.map((p) => ({ ...p, ...(stats.get(p.name) ?? { total: 0, incoming: 0 }) })),
    unplaced: stats.get(UNPLACED)?.total ?? 0,
    totalIncoming: [...stats.entries()].filter(([k]) => k !== UNPLACED).reduce((n, [, v]) => n + v.incoming, 0),
  }
}

// 새 책장에 들어갈 책 목록 (현재 위치와 함께). target = 책장 이름 또는 UNPLACED
export async function getShelfPlanBooks(params: { target: string; incomingOnly?: boolean; page?: number; all?: boolean }) {
  if (!(await isAdmin())) return { books: [], total: 0, pageSize: PAGE_SIZE }

  const page = Math.max(1, params.page ?? 1)
  const books = await fetchPlanBooks()
  const assigned = assignShelves(books)
  const ids = books
    .filter((b) => (assigned.get(b.id) ?? UNPLACED) === params.target)
    .filter((b) => !params.incomingOnly || b.location_group !== params.target)
    // 현재 책장 순서대로 → 책장 앞에서 한 번에 꺼내 오기 쉽게
    .sort(
      (a, b) =>
        a.location_group.localeCompare(b.location_group, 'ko', { numeric: true }) ||
        (a.series_name ?? '').localeCompare(b.series_name ?? '', 'ko', { numeric: true }) ||
        a.title.localeCompare(b.title, 'ko', { numeric: true })
    )
    .map((b) => b.id)

  // all: 인쇄용 전체 목록 (id 목록이 길어 100개씩 나눠 조회)
  const pageIds = params.all ? ids : ids.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  if (pageIds.length === 0) return { books: [], total: ids.length, pageSize: PAGE_SIZE }
  const chunks = await Promise.all(
    Array.from({ length: Math.ceil(pageIds.length / 100) }, (_, i) =>
      supabaseAdmin
        .from('books')
        .select('id, title, author, barcode, cover_image, location_group, location_detail, age_group, sub_category, series_name')
        .in('id', pageIds.slice(i * 100, (i + 1) * 100))
    )
  )
  const data = chunks.flatMap((c) => c.data ?? [])
  const order = new Map(pageIds.map((id, i) => [id, i]))
  return {
    books: data.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)),
    total: ids.length,
    pageSize: PAGE_SIZE,
  }
}

// 관리자: 전집·시리즈 전체의 연령 분류를 한 번에 변경 (예: 유아 전집 → 초등 전학년)
export async function setSeriesAgeGroup(seriesName: string, ageGroup: string): Promise<ActionResult<{ count: number }>> {
  if (!(await isAdmin())) return { success: false, error: '권한이 없습니다.' }
  if (!isAgeGroup(ageGroup)) return { success: false, error: '잘못된 분류입니다.' }

  const { data, error } = await supabaseAdmin
    .from('books')
    .update({
      age_group: ageGroup,
      sub_category: null,
      classification_source: 'manual',
      classified_at: new Date().toISOString(),
    })
    .eq('series_name', seriesName)
    .eq('is_deleted', false)
    .select('id')

  if (error) return { success: false, error: '분류 변경에 실패했습니다.' }
  return { success: true, data: { count: data?.length ?? 0 } }
}
