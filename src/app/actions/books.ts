'use server'

import { createClient } from '@/lib/supabase/server'
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

export async function createBook(formData: FormData): Promise<ActionResult<Book>> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return { success: false, error: '권한이 없습니다.' }
  }

  const raw = {
    barcode: formData.get('barcode'),
    title: formData.get('title'),
    author: formData.get('author'),
    publisher: formData.get('publisher') || undefined,
    cover_image: formData.get('cover_image') || undefined,
    description: formData.get('description') || undefined,
    location_group: formData.get('location_group'),
    location_detail: formData.get('location_detail'),
  }

  const parsed = createBookSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
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
    if (val) raw[key] = val
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

export async function deleteBook(bookId: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return { success: false, error: '권한이 없습니다.' }
  }

  const supabase = await createClient()

  // 현재 대출 중인지 확인
  const { data: activeRental } = await supabase
    .from('rentals')
    .select('id')
    .eq('book_id', bookId)
    .is('returned_at', null)
    .limit(1)
    .single()

  if (activeRental) {
    return { success: false, error: '현재 대출 중인 도서는 삭제할 수 없습니다.' }
  }

  // soft delete
  const { error } = await supabase
    .from('books')
    .update({ is_deleted: true })
    .eq('id', bookId)

  if (error) {
    return { success: false, error: '도서 삭제에 실패했습니다.' }
  }

  return { success: true }
}
