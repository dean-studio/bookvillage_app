'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/app/actions/auth'
import type { ActionResult, BookReport } from '@/types'
import { z } from 'zod'

const createReportSchema = z.object({
  book_id: z.string().uuid(),
  rating: z.coerce.number().int().min(1, '평점은 1~5 사이여야 합니다.').max(5),
  review: z
    .string()
    .min(10, '독서록은 10자 이상 작성해주세요.')
    .max(2000, '독서록은 2000자 이내여야 합니다.'),
})

const updateReportSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  review: z.string().min(10).max(2000).optional(),
})

export async function getBookReports(bookId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('book_reports')
    .select('id, rating, review, created_at, profiles!book_reports_user_id_fkey(name, dong_ho)')
    .eq('book_id', bookId)
    .order('created_at', { ascending: false })

  if (error) return { reports: [], avg_rating: null, total_count: 0 }

  const reports = data ?? []
  const total_count = reports.length
  const avg_rating =
    total_count > 0
      ? Math.round((reports.reduce((sum, r) => sum + r.rating, 0) / total_count) * 10) / 10
      : null

  return {
    reports: reports.map((r) => ({
      id: r.id,
      user: r.profiles as { name: string; dong_ho: string },
      rating: r.rating,
      review: r.review,
      created_at: r.created_at,
    })),
    avg_rating,
    total_count,
  }
}

export async function createBookReport(formData: FormData): Promise<ActionResult<BookReport>> {
  const user = await getCurrentUser()
  if (!user) {
    return { success: false, error: '로그인이 필요합니다.' }
  }

  const raw = {
    book_id: formData.get('book_id'),
    rating: formData.get('rating'),
    review: formData.get('review'),
  }

  const parsed = createReportSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { book_id, rating, review } = parsed.data
  const supabase = await createClient()

  // 반납 이력 확인
  const { data: returnedRental } = await supabase
    .from('rentals')
    .select('id')
    .eq('book_id', book_id)
    .eq('user_id', user.id)
    .not('returned_at', 'is', null)
    .limit(1)
    .single()

  if (!returnedRental) {
    return { success: false, error: '해당 도서를 반납한 이력이 없습니다.' }
  }

  const { data, error } = await supabase
    .from('book_reports')
    .insert({ book_id, user_id: user.id, rating, review })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: '이미 독서록을 작성하셨습니다.' }
    }
    return { success: false, error: '독서록 작성에 실패했습니다.' }
  }

  return { success: true, data }
}

export async function updateBookReport(
  reportId: string,
  formData: FormData
): Promise<ActionResult<BookReport>> {
  const user = await getCurrentUser()
  if (!user) {
    return { success: false, error: '로그인이 필요합니다.' }
  }

  const raw: Record<string, unknown> = {}
  const rating = formData.get('rating')
  const review = formData.get('review')
  if (rating) raw.rating = rating
  if (review) raw.review = review

  const parsed = updateReportSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('book_reports')
    .update(parsed.data)
    .eq('id', reportId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return { success: false, error: '독서록 수정에 실패했습니다.' }
  }

  return { success: true, data }
}

export async function deleteBookReport(reportId: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) {
    return { success: false, error: '로그인이 필요합니다.' }
  }

  const supabase = await createClient()

  // RLS가 본인 또는 관리자만 삭제 허용
  const { error } = await supabase
    .from('book_reports')
    .delete()
    .eq('id', reportId)

  if (error) {
    return { success: false, error: '독서록 삭제에 실패했습니다.' }
  }

  return { success: true }
}
