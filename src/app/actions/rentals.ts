'use server'

import { createClient } from '@/lib/supabase/server'
import { checkoutSchema, returnSchema } from '@/lib/validations/books'
import { getCurrentUser } from '@/app/actions/auth'
import type { ActionResult } from '@/types'

const MAX_ACTIVE_RENTALS = 5

interface CheckoutResult {
  id: string
  book: { title: string; barcode: string }
  user: { name: string; dong_ho: string }
  rented_at: string
  due_date: string
}

interface ReturnResult {
  book: { title: string; barcode: string }
  user: { name: string }
  location_group: string
  location_detail: string
  was_overdue: boolean
  overdue_days: number
}

export async function checkoutBook(formData: FormData): Promise<ActionResult<CheckoutResult>> {
  const admin = await getCurrentUser()
  if (!admin || admin.role !== 'admin') {
    return { success: false, error: '권한이 없습니다.' }
  }

  const raw = {
    user_id: formData.get('user_id'),
    barcode: formData.get('barcode'),
  }

  const parsed = checkoutSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { user_id, barcode } = parsed.data
  const supabase = await createClient()

  // 도서 조회
  const { data: book } = await supabase
    .from('books')
    .select('id, title, barcode, is_available')
    .eq('barcode', barcode)
    .eq('is_deleted', false)
    .single()

  if (!book) {
    return { success: false, error: '존재하지 않는 바코드입니다.' }
  }

  if (!book.is_available) {
    return { success: false, error: '이미 대출 중인 도서입니다.' }
  }

  // 주민 조회
  const { data: resident } = await supabase
    .from('profiles')
    .select('id, name, dong_ho')
    .eq('id', user_id)
    .single()

  if (!resident) {
    return { success: false, error: '존재하지 않는 주민입니다.' }
  }

  // 연체 도서 확인
  const { data: overdueRentals } = await supabase
    .from('rentals')
    .select('id')
    .eq('user_id', user_id)
    .is('returned_at', null)
    .lt('due_date', new Date().toISOString().split('T')[0])
    .limit(1)

  if (overdueRentals && overdueRentals.length > 0) {
    return { success: false, error: '해당 주민의 연체 도서가 있어 대출이 불가합니다.' }
  }

  // 최대 대출 권수 확인
  const { count } = await supabase
    .from('rentals')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user_id)
    .is('returned_at', null)

  if ((count ?? 0) >= MAX_ACTIVE_RENTALS) {
    return { success: false, error: `1인당 최대 ${MAX_ACTIVE_RENTALS}권까지 대출 가능합니다.` }
  }

  // 대출 생성
  const { data: rental, error } = await supabase
    .from('rentals')
    .insert({ book_id: book.id, user_id })
    .select('id, rented_at, due_date')
    .single()

  if (error) {
    return { success: false, error: '대출 처리에 실패했습니다.' }
  }

  return {
    success: true,
    data: {
      id: rental.id,
      book: { title: book.title, barcode: book.barcode },
      user: { name: resident.name, dong_ho: resident.dong_ho },
      rented_at: rental.rented_at,
      due_date: rental.due_date,
    },
  }
}

export async function returnBook(formData: FormData): Promise<ActionResult<ReturnResult>> {
  const admin = await getCurrentUser()
  if (!admin || admin.role !== 'admin') {
    return { success: false, error: '권한이 없습니다.' }
  }

  const raw = { barcode: formData.get('barcode') }
  const parsed = returnSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { barcode } = parsed.data
  const supabase = await createClient()

  // 도서 조회
  const { data: book } = await supabase
    .from('books')
    .select('id, title, barcode, location_group, location_detail')
    .eq('barcode', barcode)
    .eq('is_deleted', false)
    .single()

  if (!book) {
    return { success: false, error: '존재하지 않는 바코드입니다.' }
  }

  // 활성 대출 조회
  const { data: rental } = await supabase
    .from('rentals')
    .select('id, user_id, due_date')
    .eq('book_id', book.id)
    .is('returned_at', null)
    .single()

  if (!rental) {
    return { success: false, error: '대출 기록이 없는 도서입니다.' }
  }

  // 대출자 조회
  const { data: resident } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', rental.user_id)
    .single()

  // 반납 처리
  const now = new Date()
  const { error } = await supabase
    .from('rentals')
    .update({ returned_at: now.toISOString() })
    .eq('id', rental.id)

  if (error) {
    return { success: false, error: '반납 처리에 실패했습니다.' }
  }

  const dueDate = new Date(rental.due_date)
  const overdueDays = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))

  return {
    success: true,
    data: {
      book: { title: book.title, barcode: book.barcode },
      user: { name: resident?.name ?? '알 수 없음' },
      location_group: book.location_group,
      location_detail: book.location_detail,
      was_overdue: overdueDays > 0,
      overdue_days: overdueDays,
    },
  }
}

export async function getMyRentals() {
  const user = await getCurrentUser()
  if (!user) return { active_rentals: [], past_rentals: [] }

  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  // 현재 대출 중
  const { data: activeRentals } = await supabase
    .from('rentals')
    .select('id, rented_at, due_date, book:books(id, title, author, cover_image)')
    .eq('user_id', user.id)
    .is('returned_at', null)
    .order('rented_at', { ascending: false })

  // 반납 완료
  const { data: pastRentals } = await supabase
    .from('rentals')
    .select('id, rented_at, returned_at, book:books(id, title, author, cover_image)')
    .eq('user_id', user.id)
    .not('returned_at', 'is', null)
    .order('returned_at', { ascending: false })
    .limit(20)

  // 반납 완료 도서의 퀴즈/독서록 존재 여부
  const pastBookIds = (pastRentals ?? []).map((r) => (r.book as { id: string }).id)

  let quizBookIds: string[] = []
  let reportBookIds: string[] = []

  if (pastBookIds.length > 0) {
    const { data: quizzes } = await supabase
      .from('quizzes')
      .select('book_id')
      .in('book_id', pastBookIds)

    quizBookIds = [...new Set((quizzes ?? []).map((q) => q.book_id))]

    const { data: reports } = await supabase
      .from('book_reports')
      .select('book_id')
      .eq('user_id', user.id)
      .in('book_id', pastBookIds)

    reportBookIds = (reports ?? []).map((r) => r.book_id)
  }

  return {
    active_rentals: (activeRentals ?? []).map((r) => {
      const dueDate = new Date(r.due_date)
      const now = new Date()
      const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return {
        id: r.id,
        book: r.book as { id: string; title: string; author: string; cover_image: string | null },
        rented_at: r.rented_at,
        due_date: r.due_date,
        is_overdue: r.due_date < today,
        remaining_days: diffDays,
      }
    }),
    past_rentals: (pastRentals ?? []).map((r) => {
      const book = r.book as { id: string; title: string; author: string; cover_image: string | null }
      return {
        id: r.id,
        book,
        rented_at: r.rented_at,
        returned_at: r.returned_at!,
        has_quiz: quizBookIds.includes(book.id),
        has_report: reportBookIds.includes(book.id),
      }
    }),
  }
}

export async function searchResidents(query: string) {
  const admin = await getCurrentUser()
  if (!admin || admin.role !== 'admin') {
    return { success: false as const, error: '권한이 없습니다.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, dong_ho, phone_number')
    .or(`name.ilike.%${query}%,dong_ho.ilike.%${query}%`)
    .limit(10)

  if (error) {
    return { success: false as const, error: '검색에 실패했습니다.' }
  }

  return { success: true as const, data: data ?? [] }
}
