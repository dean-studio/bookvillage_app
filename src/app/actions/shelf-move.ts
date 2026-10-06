'use server'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { hangulToLatinKeys } from '@/lib/utils'
import { SHELF_PLAN, UNPLACED, assignShelves, type PlanBook } from '@/lib/shelf-plan'
import { getCurrentUser } from './auth'
import type { ActionResult } from '@/types'

async function requireAdmin() {
  const user = await getCurrentUser()
  return !!user && user.role === 'admin' && user.admin_status === 'approved'
}

// 재배치안 자리 계산은 전체 도서가 필요해서 잠깐 캐시 (분류가 바뀌지 않는 한 결과가 같음)
let planCache: { at: number; map: Map<string, string> } | null = null
async function planTargets() {
  if (planCache && Date.now() - planCache.at < 120_000) return planCache.map
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
  planCache = { at: Date.now(), map: assignShelves(rows) }
  return planCache.map
}

// 이동할 책장 목록 (배치도 순서) + 재배치안 새 이름
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

  return (shelves ?? []).map((s) => {
    const plan = SHELF_PLAN.find((p) => p.name === s.name)
    return { name: s.name, count: counts[s.name] ?? 0, planName: plan?.newName ?? null, planLabel: plan?.label ?? null }
  })
}

export type MoveResult = {
  /** ready: 확인 대기(카메라 미리보기), moved: 이동함, already: 이미 그 책장 */
  status: 'ready' | 'moved' | 'already'
  book: { id: string; title: string; cover_image: string | null; barcode: string }
  from: string
  to: string
  /** 재배치안상 이 책의 자리 (선택한 책장과 다르면 경고용) */
  planTarget: string | null
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

  const targets = await planTargets()
  const planTarget = targets.get(book.id) ?? null
  const result = {
    book: { id: book.id, title: book.title, cover_image: book.cover_image, barcode: book.barcode },
    from: book.location_group,
    to: shelf,
    planTarget: planTarget && planTarget !== UNPLACED ? planTarget : null,
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
