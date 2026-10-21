'use server'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { hangulToLatinKeys } from '@/lib/utils'
import { getCurrentUser } from './auth'
import type { ActionResult } from '@/types'

// 폐기 도서: 도서 삭제(is_deleted)와 같은 방식으로 책장·목록에서 빼고, 삭제내역에 사유 '폐기'로 남긴다.
// location_group은 그대로 두므로 폐기 취소하면 원래 책장으로 돌아간다.
const DISPOSAL_REASON = '폐기'

async function requireAdmin() {
  const user = await getCurrentUser()
  return user && user.role === 'admin' && user.admin_status === 'approved' ? user : null
}

export type DisposedBook = {
  book_id: string
  title: string
  barcode: string
  author: string | null
  cover_image: string | null
  shelf: string
  disposed_at: string
  disposed_by: string | null
}

export type DisposalPreview = {
  status: 'ready' | 'already'
  book: DisposedBook
}

// 바코드로 책을 찾아 폐기할 수 있는지 확인 (대기 목록에 담기 전). 실제 폐기는 disposeBooks
export async function previewDisposal(rawBarcode: string): Promise<ActionResult<DisposalPreview>> {
  const admin = await requireAdmin()
  if (!admin) return { success: false, error: '권한이 없습니다.' }

  // 리더기가 한글 입력 상태로 찍은 경우(BV → ㅠㅍ) 복원
  const barcode = hangulToLatinKeys(rawBarcode).trim().toUpperCase()
  if (!barcode) return { success: false, error: '바코드를 입력해주세요.' }

  // 바코드는 삭제된 책까지 포함해 유일 → 이미 폐기된 책도 찾아서 알려줌
  const { data: book } = await supabaseAdmin
    .from('books')
    .select('id, title, barcode, author, cover_image, location_group, is_deleted')
    .eq('barcode', barcode)
    .maybeSingle()
  if (!book) return { success: false, error: `등록되지 않은 바코드예요: ${barcode}` }

  const base = {
    book_id: book.id,
    title: book.title,
    barcode: book.barcode,
    author: book.author,
    cover_image: book.cover_image,
    shelf: book.location_group,
    disposed_by: null,
  }

  if (book.is_deleted) {
    const { data: log } = await supabaseAdmin
      .from('book_deletions')
      .select('deleted_at, reason')
      .eq('book_id', book.id)
      .order('deleted_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (log?.reason === DISPOSAL_REASON) {
      return { success: true, data: { status: 'already', book: { ...base, disposed_at: log.deleted_at } } }
    }
    return { success: false, error: `이미 삭제된 책이에요: ${book.title}` }
  }

  const { data: activeRental } = await supabaseAdmin
    .from('rentals')
    .select('id')
    .eq('book_id', book.id)
    .is('returned_at', null)
    .limit(1)
    .maybeSingle()
  if (activeRental) return { success: false, error: `대출 중인 책이에요. 반납 후 폐기해주세요: ${book.title}` }

  return { success: true, data: { status: 'ready', book: { ...base, disposed_at: '' } } }
}

// 대기 목록의 책을 한 번에 폐기: 책장·목록에서 빼고(is_deleted) 삭제내역에 사유 '폐기'로 남김
export async function disposeBooks(
  bookIds: string[]
): Promise<ActionResult<{ disposed: DisposedBook[]; skipped: { title: string; reason: string }[] }>> {
  const admin = await requireAdmin()
  if (!admin) return { success: false, error: '권한이 없습니다.' }
  const ids = [...new Set(bookIds)].slice(0, 500)
  if (ids.length === 0) return { success: false, error: '폐기할 책이 없어요.' }

  // id 목록은 요청 주소 길이 제한 때문에 나눠서 조회
  type Row = { id: string; title: string; barcode: string; author: string | null; cover_image: string | null; location_group: string; is_deleted: boolean }
  const books: Row[] = []
  const rented = new Set<string>()
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150)
    const [{ data: b }, { data: r }] = await Promise.all([
      supabaseAdmin
        .from('books')
        .select('id, title, barcode, author, cover_image, location_group, is_deleted')
        .in('id', chunk),
      supabaseAdmin.from('rentals').select('book_id').in('book_id', chunk).is('returned_at', null),
    ])
    books.push(...(b ?? []))
    for (const x of r ?? []) rented.add(x.book_id)
  }

  const skipped: { title: string; reason: string }[] = []
  const targets = books.filter((b) => {
    if (b.is_deleted) skipped.push({ title: b.title, reason: '이미 삭제·폐기된 책' })
    else if (rented.has(b.id)) skipped.push({ title: b.title, reason: '대출 중' })
    else return true
    return false
  })
  if (targets.length === 0) return { success: true, data: { disposed: [], skipped } }

  for (let i = 0; i < targets.length; i += 150) {
    const { error } = await supabaseAdmin
      .from('books')
      .update({ is_deleted: true })
      .in('id', targets.slice(i, i + 150).map((b) => b.id))
    if (error) {
      // 이미 폐기된 앞부분은 되살려서 전부 실패로 처리 (기록과 상태가 어긋나지 않게)
      for (let j = 0; j < i; j += 150) {
        await supabaseAdmin.from('books').update({ is_deleted: false }).in('id', targets.slice(j, j + 150).map((b) => b.id))
      }
      return { success: false, error: '폐기 처리에 실패했습니다.' }
    }
  }

  const now = new Date().toISOString()
  await supabaseAdmin.from('book_deletions').insert(
    targets.map((b) => ({
      book_id: b.id,
      book_title: b.title,
      book_barcode: b.barcode,
      book_author: b.author,
      deleted_by: admin.id,
      deleted_at: now,
      reason: DISPOSAL_REASON,
    }))
  )

  return {
    success: true,
    data: {
      disposed: targets.map((b) => ({
        book_id: b.id,
        title: b.title,
        barcode: b.barcode,
        author: b.author,
        cover_image: b.cover_image,
        shelf: b.location_group,
        disposed_at: now,
        disposed_by: admin.name ?? null,
      })),
      skipped,
    },
  }
}

// 폐기 목록 (최근 폐기순). 폐기 취소된 책은 기록을 지우므로 나오지 않음
export async function getDisposedBooks(): Promise<DisposedBook[]> {
  if (!(await requireAdmin())) return []

  const logs: { book_id: string; deleted_at: string; profiles: { name: string } | null }[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await supabaseAdmin
      .from('book_deletions')
      .select('book_id, deleted_at, profiles:deleted_by(name)')
      .eq('reason', DISPOSAL_REASON)
      .order('deleted_at', { ascending: false })
      .range(from, from + 999)
    logs.push(...((data ?? []) as unknown as typeof logs))
    if (!data || data.length < 1000) break
  }
  if (logs.length === 0) return []

  // 책 정보(표지·책장)는 id 목록을 나눠서 조회 (요청 주소 길이 제한)
  const ids = [...new Set(logs.map((l) => l.book_id))]
  const books = new Map<string, { id: string; title: string; barcode: string; author: string | null; cover_image: string | null; location_group: string; is_deleted: boolean }>()
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabaseAdmin
      .from('books')
      .select('id, title, barcode, author, cover_image, location_group, is_deleted')
      .in('id', ids.slice(i, i + 150))
    for (const b of data ?? []) books.set(b.id, b)
  }

  const seen = new Set<string>()
  const rows: DisposedBook[] = []
  for (const l of logs) {
    const b = books.get(l.book_id)
    // 같은 책 기록이 여러 개면 최근 것만, 다른 경로로 되살아난 책은 제외
    if (!b || !b.is_deleted || seen.has(b.id)) continue
    seen.add(b.id)
    rows.push({
      book_id: b.id,
      title: b.title,
      barcode: b.barcode,
      author: b.author,
      cover_image: b.cover_image,
      shelf: b.location_group,
      disposed_at: l.deleted_at,
      disposed_by: l.profiles?.name ?? null,
    })
  }
  return rows
}

// 폐기 취소: 책을 되살리고(원래 책장 그대로) 폐기 기록을 지움
export async function cancelDisposal(bookId: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: '권한이 없습니다.' }

  const { data: book } = await supabaseAdmin
    .from('books')
    .select('id, is_deleted')
    .eq('id', bookId)
    .maybeSingle()
  if (!book) return { success: false, error: '책을 찾을 수 없습니다.' }

  if (book.is_deleted) {
    const { error } = await supabaseAdmin.from('books').update({ is_deleted: false }).eq('id', bookId)
    if (error) return { success: false, error: '폐기 취소에 실패했습니다.' }
  }

  await supabaseAdmin.from('book_deletions').delete().eq('book_id', bookId).eq('reason', DISPOSAL_REASON)
  return { success: true }
}
