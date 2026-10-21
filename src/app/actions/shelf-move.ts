'use server'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { hangulToLatinKeys } from '@/lib/utils'
import { getCurrentUser } from './auth'
import type { ActionResult } from '@/types'

async function requireAdmin() {
  const user = await getCurrentUser()
  return !!user && user.role === 'admin' && user.admin_status === 'approved'
}

// 이동할 책장 목록 (배치도 순서)
export async function getMoveShelves() {
  if (!(await requireAdmin())) return []
  const { data: shelves } = await supabaseAdmin
    .from('shelves')
    .select('name, position_x, position_y')
    .eq('type', 'shelf')
    .order('position_y')
    .order('position_x')

  const counts: Record<string, number> = {}
  for (let from = 0; ; from += 1000) {
    const { data } = await supabaseAdmin
      .from('books')
      .select('location_group')
      .eq('is_deleted', false)
      .order('id')
      .range(from, from + 999)
    for (const b of data ?? []) counts[b.location_group] = (counts[b.location_group] ?? 0) + 1
    if (!data || data.length < 1000) break
  }

  return (shelves ?? []).map((s) => ({ name: s.name, count: counts[s.name] ?? 0, x: s.position_x, y: s.position_y }))
}

export type MoveResult = {
  /** ready: 확인 대기(카메라 미리보기), moved: 이동함, already: 이미 그 책장 */
  status: 'ready' | 'moved' | 'already'
  book: { id: string; title: string; cover_image: string | null; barcode: string }
  from: string
  to: string
}

// 바코드로 책을 찾아 선택한 책장으로 이동. previewOnly면 옮기지 않고 정보만 (카메라 확인용)
export async function moveBookToShelf(
  rawBarcode: string,
  shelf: string,
  previewOnly = false
): Promise<ActionResult<MoveResult>> {
  if (!(await requireAdmin())) return { success: false, error: '권한이 없습니다.' }

  // 리더기가 한글 입력 상태로 찍은 경우(BV → ㅠㅍ) 복원
  const barcode = hangulToLatinKeys(rawBarcode).trim().toUpperCase()
  if (!barcode) return { success: false, error: '바코드를 입력해주세요.' }
  if (!shelf) return { success: false, error: '책장을 먼저 선택해주세요.' }

  const { data: book } = await supabaseAdmin
    .from('books')
    .select('id, title, cover_image, barcode, location_group')
    .eq('barcode', barcode)
    .eq('is_deleted', false)
    .maybeSingle()

  if (!book) return { success: false, error: `등록되지 않은 바코드예요: ${barcode}` }

  const result = {
    book: { id: book.id, title: book.title, cover_image: book.cover_image, barcode: book.barcode },
    from: book.location_group,
    to: shelf,
  }

  if (book.location_group === shelf) return { success: true, data: { status: 'already', ...result } }
  if (previewOnly) return { success: true, data: { status: 'ready', ...result } }

  const { error } = await supabaseAdmin.from('books').update({ location_group: shelf }).eq('id', book.id)
  if (error) return { success: false, error: '이동에 실패했습니다.' }
  return { success: true, data: { status: 'moved', ...result } }
}

// 이동 되돌리기
export async function undoBookMove(bookId: string, previousShelf: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: '권한이 없습니다.' }
  const { error } = await supabaseAdmin.from('books').update({ location_group: previousShelf }).eq('id', bookId)
  if (error) return { success: false, error: '되돌리기에 실패했습니다.' }
  return { success: true }
}

export type MovedBook = {
  book: { id: string; title: string; cover_image: string | null; barcode: string }
  from: string
  to: string
}

// 대기 목록에 모아둔 책을 한 번에 선택한 책장으로 이동
export async function moveBooksToShelf(bookIds: string[], shelf: string): Promise<ActionResult<MovedBook[]>> {
  if (!(await requireAdmin())) return { success: false, error: '권한이 없습니다.' }
  if (!shelf) return { success: false, error: '책장을 먼저 선택해주세요.' }
  const ids = [...new Set(bookIds)].slice(0, 500)
  if (ids.length === 0) return { success: false, error: '옮길 책이 없어요.' }

  // id 목록은 요청 주소 길이 제한 때문에 나눠서 보냄
  const books: { id: string; title: string; cover_image: string | null; barcode: string; location_group: string }[] = []
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabaseAdmin
      .from('books')
      .select('id, title, cover_image, barcode, location_group')
      .in('id', ids.slice(i, i + 150))
      .eq('is_deleted', false)
    books.push(...(data ?? []))
  }
  const targets = books.filter((b) => b.location_group !== shelf)
  const moved: typeof targets = []
  for (let i = 0; i < targets.length; i += 150) {
    const chunk = targets.slice(i, i + 150)
    const { error } = await supabaseAdmin
      .from('books')
      .update({ location_group: shelf })
      .in('id', chunk.map((b) => b.id))
    if (error) {
      if (moved.length === 0) return { success: false, error: '이동에 실패했습니다.' }
      break // 일부만 옮겨졌으면 옮겨진 것만 돌려줌 (되돌리기 가능)
    }
    moved.push(...chunk)
  }

  return {
    success: true,
    data: moved.map((b) => ({
      book: { id: b.id, title: b.title, cover_image: b.cover_image, barcode: b.barcode },
      from: b.location_group,
      to: shelf,
    })),
  }
}

export type UnscannedGroup = { group: string; books: { id: string; title: string; barcode: string }[] }

// 아직 안 찍은 책: 지금 배치도에 없는 책장 이름(예전 이름)에 남아 있는 책.
// 책장 이름을 바꾼 뒤 책장마다 다시 찍으면, 끝까지 남는 책이 분실·다른 칸·폐기 확인 대상
export async function getUnscannedBooks(): Promise<UnscannedGroup[]> {
  if (!(await requireAdmin())) return []
  const { data: shelves } = await supabaseAdmin.from('shelves').select('name').eq('type', 'shelf')
  const names = new Set((shelves ?? []).map((s) => s.name))

  const groups = new Map<string, UnscannedGroup['books']>()
  for (let from = 0; ; from += 1000) {
    const { data } = await supabaseAdmin
      .from('books')
      .select('id, title, barcode, location_group')
      .eq('is_deleted', false)
      .order('id')
      .range(from, from + 999)
    for (const b of data ?? []) {
      if (names.has(b.location_group)) continue
      groups.set(b.location_group, [...(groups.get(b.location_group) ?? []), { id: b.id, title: b.title, barcode: b.barcode }])
    }
    if (!data || data.length < 1000) break
  }

  return [...groups.entries()]
    .map(([group, books]) => ({ group, books: books.sort((a, b) => a.title.localeCompare(b.title, 'ko', { numeric: true })) }))
    .sort((a, b) => a.group.localeCompare(b.group, 'ko', { numeric: true }))
}

export type ShelfBook = { id: string; title: string; barcode: string; cover_image: string | null }

// 지금 이 책장에 있는 책 (이동 완료된 책) — 가나다순
export async function getShelfBooks(shelf: string): Promise<ShelfBook[]> {
  if (!(await requireAdmin()) || !shelf) return []
  const books: ShelfBook[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await supabaseAdmin
      .from('books')
      .select('id, title, barcode, cover_image')
      .eq('location_group', shelf)
      .eq('is_deleted', false)
      .order('id')
      .range(from, from + 999)
    books.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return books.sort((a, b) => a.title.localeCompare(b.title, 'ko', { numeric: true }))
}
