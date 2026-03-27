'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createBookSchema, updateBookSchema } from '@/lib/validations/books'
import { getCurrentUser } from '@/app/actions/auth'
import type { ActionResult } from '@/types'
import type { Book } from '@/types'

interface BookListParams {
  q?: string
  available?: boolean
  page?: number
  limit?: number
}

export async function getBooks(params: BookListParams = {}) {
  const { q, available, page = 1, limit = 20 } = params
  const supabase = await createClient()
  const offset = (page - 1) * limit

  let query = supabase
    .from('books')
    .select('*', { count: 'exact' })
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (q) {
    query = query.or(`title.ilike.%${q}%,author.ilike.%${q}%`)
  }

  if (available !== undefined) {
    query = query.eq('is_available', available)
  }

  const { data: books, count, error } = await query

  if (error) {
    return { books: [], totalCount: 0, currentPage: page, totalPages: 0 }
  }

  const totalCount = count ?? 0
  return {
    books: books ?? [],
    totalCount,
    currentPage: page,
    totalPages: Math.ceil(totalCount / limit),
  }
}

export async function getBookById(bookId: string) {
  const supabase = await createClient()

  const { data: book, error } = await supabase
    .from('books')
    .select('*')
    .eq('id', bookId)
    .eq('is_deleted', false)
    .single()

  if (error || !book) return null

  const { data: ratings } = await supabase
    .from('book_ratings')
    .select('avg_rating, review_count')
    .eq('book_id', bookId)
    .single()

  return {
    ...(book as NonNullable<typeof book>),
    avg_rating: (ratings as { avg_rating: number; review_count: number } | null)?.avg_rating ?? null,
    review_count: (ratings as { avg_rating: number; review_count: number } | null)?.review_count ?? 0,
  }
}

export async function checkBarcodeExists(barcode: string): Promise<{ exists: boolean; book?: Book }> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('books')
    .select('*')
    .eq('barcode', barcode)
    .eq('is_deleted', false)
    .single()

  return { exists: !!data, book: data as Book | undefined }
}

export async function createBook(formData: FormData): Promise<ActionResult<Book>> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return { success: false, error: '권한이 없습니다.' }
  }

  const raw = {
    barcode: formData.get('barcode'),
    title: formData.get('title'),
    author: formData.get('author') || undefined,
    publisher: formData.get('publisher') || undefined,
    cover_image: formData.get('cover_image') || undefined,
    description: formData.get('description') || undefined,
    location_group: formData.get('location_group') || undefined,
    location_detail: formData.get('location_detail') || undefined,
    isbn: formData.get('isbn') || undefined,
    translators: formData.get('translators') || undefined,
    published_at: formData.get('published_at') || undefined,
    price: formData.get('price') || undefined,
    sale_price: formData.get('sale_price') || undefined,
    category: formData.get('category') || undefined,
    kakao_url: formData.get('kakao_url') || undefined,
    sale_status: formData.get('sale_status') || undefined,
    rental_days: formData.get('rental_days') ? Number(formData.get('rental_days')) : null,
  }

  const parsed = createBookSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  // Check if soft-deleted book with same barcode exists → restore it
  const { data: deletedBook } = await supabaseAdmin
    .from('books')
    .select('id')
    .eq('barcode', parsed.data.barcode)
    .eq('is_deleted', true)
    .maybeSingle()

  if (deletedBook) {
    const { data, error } = await supabaseAdmin
      .from('books')
      .update({ ...parsed.data, is_deleted: false, is_available: true })
      .eq('id', deletedBook.id)
      .select()
      .single()

    if (error) {
      return { success: false, error: '도서 복원에 실패했습니다.' }
    }
    return { success: true, data }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('books')
    .insert(parsed.data)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: '이미 등록된 바코드입니다.' }
    }
    return { success: false, error: '도서 등록에 실패했습니다.' }
  }

  return { success: true, data }
}

export async function updateBook(bookId: string, formData: FormData): Promise<ActionResult<Book>> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return { success: false, error: '권한이 없습니다.' }
  }

  const raw: Record<string, unknown> = {}
  for (const key of ['title', 'author', 'publisher', 'cover_image', 'description', 'location_group', 'location_detail']) {
    const val = formData.get(key)
    if (val !== null && val !== '') raw[key] = val
  }
  // cover_image는 빈 문자열(삭제)도 허용
  if (formData.has('cover_image')) {
    raw['cover_image'] = formData.get('cover_image') || ''
  }

  const parsed = updateBookSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('books')
    .update(parsed.data)
    .eq('id', bookId)
    .select()
    .single()

  if (error) {
    return { success: false, error: '도서 수정에 실패했습니다.' }
  }

  return { success: true, data }
}

export async function getBookDeletions(page = 1, limit = 20) {
  const supabase = await createClient()
  const offset = (page - 1) * limit

  const { data, count, error } = await supabase
    .from('book_deletions')
    .select('*, profiles:deleted_by(name)', { count: 'exact' })
    .order('deleted_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return { deletions: [], totalCount: 0 }

  return {
    deletions: (data ?? []) as (typeof data extends (infer T)[] | null ? T & { profiles: { name: string } | null } : never)[],
    totalCount: count ?? 0,
  }
}

export async function getBookRentalCount(bookId: string): Promise<{ total: number; active: number }> {
  const supabase = await createClient()
  const { count: total } = await supabase
    .from('rentals')
    .select('id', { count: 'exact', head: true })
    .eq('book_id', bookId)

  const { count: active } = await supabase
    .from('rentals')
    .select('id', { count: 'exact', head: true })
    .eq('book_id', bookId)
    .is('returned_at', null)

  return { total: total ?? 0, active: active ?? 0 }
}

export async function deleteBook(bookId: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return { success: false, error: '권한이 없습니다.' }
  }

  // 현재 대출 중인지 확인
  const { data: activeRental } = await supabaseAdmin
    .from('rentals')
    .select('id')
    .eq('book_id', bookId)
    .is('returned_at', null)
    .limit(1)
    .maybeSingle()

  if (activeRental) {
    return { success: false, error: '현재 대출 중인 도서는 삭제할 수 없습니다.' }
  }

  // Fetch book info for deletion log
  const { data: book } = await supabaseAdmin
    .from('books')
    .select('id, title, barcode, author')
    .eq('id', bookId)
    .single()

  // soft delete
  const { error } = await supabaseAdmin
    .from('books')
    .update({ is_deleted: true })
    .eq('id', bookId)

  if (error) {
    return { success: false, error: '도서 삭제에 실패했습니다.' }
  }

  // Log deletion
  if (book) {
    await supabaseAdmin.from('book_deletions').insert({
      book_id: book.id,
      book_title: book.title,
      book_barcode: book.barcode,
      book_author: book.author,
      deleted_by: user.id,
    })
  }

  return { success: true }
}

// 신작 도서 목록 (등록일 기준 + 수동 featured_until)
export async function getNewBooks(limit = 20) {
  const { data: setting } = await supabaseAdmin
    .from('library_settings')
    .select('value')
    .eq('key', 'new_book_days')
    .single()

  const newBookDays = setting ? parseInt(setting.value, 10) || 30 : 30
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - newBookDays)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabaseAdmin
    .from('books')
    .select('id, barcode, title, author, cover_image, location_group, location_detail, is_available, created_at, featured_until')
    .eq('is_deleted', false)
    .or(`created_at.gte.${cutoffStr},featured_until.gte.${today}`)
    .order('created_at', { ascending: false })
    .limit(limit)

  return data ?? []
}

// 수동 신작 지정 (featured_until 설정)
export async function setBookFeatured(bookId: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return { success: false, error: '권한이 없습니다.' }

  const { data: setting } = await supabaseAdmin
    .from('library_settings')
    .select('value')
    .eq('key', 'featured_duration_days')
    .single()

  const durationDays = setting ? parseInt(setting.value, 10) || 14 : 14
  const until = new Date()
  until.setDate(until.getDate() + durationDays)
  const untilStr = until.toISOString().split('T')[0]

  const { error } = await supabaseAdmin
    .from('books')
    .update({ featured_until: untilStr })
    .eq('id', bookId)

  if (error) return { success: false, error: '신작 지정에 실패했습니다.' }
  return { success: true }
}

// 수동 신작 해제
export async function unsetBookFeatured(bookId: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return { success: false, error: '권한이 없습니다.' }

  const { error } = await supabaseAdmin
    .from('books')
    .update({ featured_until: null })
    .eq('id', bookId)

  if (error) return { success: false, error: '신작 해제에 실패했습니다.' }
  return { success: true }
}
