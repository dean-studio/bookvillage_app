'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkoutSchema, returnSchema } from '@/lib/validations/books'
import { getCurrentUser } from '@/app/actions/auth'
import { getKSTNow, getKSTDateString, getKSTDateAfterDays } from '@/lib/date'
import { awardJellyForCheckout, awardJellyForReturn } from '@/app/actions/jelly'
import type { ActionResult } from '@/types'

async function getSettingValue(supabase: Awaited<ReturnType<typeof createClient>>, key: string, defaultValue: number): Promise<number> {
  const { data } = await supabase
    .from('library_settings')
    .select('value')
    .eq('key', key)
    .single()
  return data ? parseInt(data.value, 10) || defaultValue : defaultValue
}

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
    .select('id, title, barcode, is_available, rental_days')
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
    .lt('due_date', getKSTDateString())
    .limit(1)

  if (overdueRentals && overdueRentals.length > 0) {
    return { success: false, error: '해당 주민의 연체 도서가 있어 대출이 불가합니다.' }
  }

  // 설정값 조회
  const maxRentals = await getSettingValue(supabase, 'max_rentals', 5)
  const defaultRentalDays = await getSettingValue(supabase, 'rental_days', 14)

  // 최대 대출 권수 확인
  const { count } = await supabase
    .from('rentals')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user_id)
    .is('returned_at', null)

  if ((count ?? 0) >= maxRentals) {
    return { success: false, error: `1인당 최대 ${maxRentals}권까지 대출 가능합니다.` }
  }

  // 대출 기간: 도서별 설정 > 기본 설정
  const rentalDays = book.rental_days ?? defaultRentalDays
  const dueDateStr = getKSTDateAfterDays(rentalDays)

  // 대출 생성
  const { data: rental, error } = await supabase
    .from('rentals')
    .insert({ book_id: book.id, user_id, due_date: dueDateStr })
    .select('id, rented_at, due_date')
    .single()

  if (error) {
    return { success: false, error: '대출 처리에 실패했습니다.' }
  }

  // 젤리 지급 (대출)
  awardJellyForCheckout(user_id, book.title, book.id).catch(() => {})

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
  const now = getKSTNow()
  const { error } = await supabaseAdmin
    .from('rentals')
    .update({ returned_at: new Date().toISOString(), returned_by: admin.id })
    .eq('id', rental.id)

  if (error) {
    return { success: false, error: '반납 처리에 실패했습니다.' }
  }

  const dueDate = new Date(rental.due_date)
  const overdueDays = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))

  // 젤리 지급 (반납)
  awardJellyForReturn(rental.user_id, book.title, book.id).catch(() => {})

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

export async function getReturnedRentals(limit = 50) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return []

  const { data } = await supabaseAdmin
    .from('rentals')
    .select('id, returned_at, returned_by, due_date, book_id, user_id')
    .not('returned_at', 'is', null)
    .order('returned_at', { ascending: false })
    .limit(limit)

  if (!data || data.length === 0) return []

  // 도서 정보
  const bookIds = [...new Set(data.map((r) => r.book_id))]
  const { data: books } = await supabaseAdmin
    .from('books')
    .select('id, title, barcode')
    .in('id', bookIds)
  const bookMap = Object.fromEntries((books ?? []).map((b) => [b.id, b]))

  // 대출자 + 반납 처리자 프로필
  const userIds = [...new Set([
    ...data.map((r) => r.user_id),
    ...data.filter((r) => r.returned_by).map((r) => r.returned_by!),
  ])]
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, name, dong_ho')
    .in('id', userIds)
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

  return data.map((r) => {
    const book = bookMap[r.book_id]
    const borrower = profileMap[r.user_id]
    const returnedByProfile = r.returned_by ? profileMap[r.returned_by] : null
    const dueDate = new Date(r.due_date)
    const returnedDate = new Date(r.returned_at!)
    const overdueDays = Math.max(0, Math.floor((returnedDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))

    return {
      id: r.id,
      book_title: book?.title ?? '알 수 없음',
      book_barcode: book?.barcode ?? '',
      borrower_name: borrower?.name ?? '알 수 없음',
      borrower_dong_ho: borrower?.dong_ho ?? '',
      returned_at: r.returned_at,
      due_date: r.due_date,
      was_overdue: overdueDays > 0,
      overdue_days: overdueDays,
      returned_by_name: returnedByProfile?.name ?? null,
    }
  })
}

export async function getMyRentals() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { active_rentals: [], past_rentals: [] }

  const userId = authUser.id
  const today = getKSTDateString()

  // 현재 대출 중 + 반납 완료 병렬 조회
  const [{ data: activeRentals }, { data: pastRentals }] = await Promise.all([
    supabase
      .from('rentals')
      .select('id, rented_at, due_date, book:books(id, title, author, cover_image)')
      .eq('user_id', userId)
      .is('returned_at', null)
      .order('rented_at', { ascending: false }),
    supabase
      .from('rentals')
      .select('id, rented_at, returned_at, book:books(id, title, author, cover_image)')
      .eq('user_id', userId)
      .not('returned_at', 'is', null)
      .order('returned_at', { ascending: false })
      .limit(20),
  ])

  // 반납 완료 도서의 퀴즈/독서록 존재 여부 (병렬)
  const pastBookIds = (pastRentals ?? []).map((r) => (r.book as { id: string }).id)

  let quizBookIds: string[] = []
  let reportBookIds: string[] = []

  if (pastBookIds.length > 0) {
    const [{ data: quizzes }, { data: reports }] = await Promise.all([
      supabase
        .from('quizzes')
        .select('book_id')
        .in('book_id', pastBookIds),
      supabase
        .from('book_reports')
        .select('book_id')
        .eq('user_id', userId)
        .in('book_id', pastBookIds),
    ])

    quizBookIds = [...new Set((quizzes ?? []).map((q) => q.book_id))]
    reportBookIds = (reports ?? []).map((r) => r.book_id)
  }

  return {
    active_rentals: (activeRentals ?? []).map((r) => {
      const dueDate = new Date(r.due_date)
      const now = getKSTNow()
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

// 주민용: 바코드로 도서 정보 조회
export async function lookupBookByBarcode(barcode: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false as const, error: '로그인이 필요합니다.' }

  const { data: book } = await supabase
    .from('books')
    .select('id, title, author, cover_image, barcode, is_available, location_group, location_detail, publisher')
    .eq('barcode', barcode.trim())
    .eq('is_deleted', false)
    .single()

  if (!book) {
    return { success: false as const, error: '등록되지 않은 도서입니다.' }
  }

  // 대출 중이면 반납 예정일 조회
  let due_date: string | null = null
  if (!book.is_available) {
    const { data: rental } = await supabase
      .from('rentals')
      .select('due_date')
      .eq('book_id', book.id)
      .is('returned_at', null)
      .single()
    due_date = rental?.due_date ?? null
  }

  return {
    success: true as const,
    data: { ...book, due_date },
  }
}

export async function getActiveRentals() {
  const admin = await getCurrentUser()
  if (!admin || admin.role !== 'admin') return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('rentals')
    .select('id, rented_at, due_date, book:books(id, title, barcode, location_group), user:profiles(id, name, dong_ho, phone_number)')
    .is('returned_at', null)
    .order('due_date', { ascending: true })

  const today = getKSTNow()
  return (data ?? []).map((r) => {
    const dueDate = new Date(r.due_date)
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return {
      id: r.id,
      book: r.book as { id: string; title: string; barcode: string; location_group: string },
      user: r.user as { id: string; name: string; dong_ho: string; phone_number: string },
      rented_at: r.rented_at as string,
      due_date: r.due_date,
      d_day: diffDays,
    }
  })
}

export async function getBookRentals(bookId: string) {
  const admin = await getCurrentUser()
  if (!admin || admin.role !== 'admin') return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('rentals')
    .select('id, user_id, rented_at, due_date, returned_at, user:profiles(name, dong_ho)')
    .eq('book_id', bookId)
    .order('rented_at', { ascending: false })
    .limit(50)

  return (data ?? []).map((r) => ({
    id: r.id,
    user_id: r.user_id,
    user: r.user as { name: string; dong_ho: string },
    rented_at: r.rented_at as string,
    due_date: r.due_date,
    returned_at: r.returned_at,
  }))
}

export async function getMyNotifications() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return { notifications: [], unread_count: 0 }

  const userId = authUser.id
  const today = getKSTNow()
  today.setHours(0, 0, 0, 0)

  const [{ data: rentals }, { data: profile }] = await Promise.all([
    supabase
      .from('rentals')
      .select('id, due_date, book:books(title)')
      .eq('user_id', userId)
      .is('returned_at', null)
      .order('due_date', { ascending: true }),
    supabase
      .from('profiles')
      .select('notifications_read_at')
      .eq('id', userId)
      .single(),
  ])

  if (!rentals) return { notifications: [], unread_count: 0 }

  const readAt = profile?.notifications_read_at ? new Date(profile.notifications_read_at) : null

  const notifications = rentals
    .map((r) => {
      const dueDate = new Date(r.due_date)
      dueDate.setHours(0, 0, 0, 0)
      const diffDays = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      const book = r.book as { title: string }

      let status: 'upcoming' | 'due_today' | 'overdue'
      let days: number

      if (diffDays < 0) {
        status = 'overdue'
        days = Math.abs(diffDays)
      } else if (diffDays === 0) {
        status = 'due_today'
        days = 0
      } else {
        status = 'upcoming'
        days = diffDays
      }

      return { id: r.id, book_title: book.title, due_date: r.due_date, status, days }
    })
    .filter((n) => n.status === 'overdue' || n.status === 'due_today' || n.days <= 3)

  const unread_count = readAt
    ? notifications.length // 동적 알림이므로 상태 변경 시 새 알림으로 간주
    : notifications.length

  return { notifications, unread_count: readAt ? 0 : notifications.length }
}

export async function getMyNotificationCount() {
  const { unread_count } = await getMyNotifications()
  return unread_count
}

export async function markNotificationsRead() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('profiles')
    .update({ notifications_read_at: new Date().toISOString() })
    .eq('id', user.id)
}

// 연체 알림 발송 (앱 내 기록)
export async function sendOverdueNotification(rentalId: string, type: '7day' | '30day'): Promise<ActionResult> {
  const admin = await getCurrentUser()
  if (!admin || admin.role !== 'admin') return { success: false, error: '권한이 없습니다.' }

  // 이미 발송했는지 확인
  const { data: existing } = await supabaseAdmin
    .from('notifications')
    .select('id')
    .eq('rental_id', rentalId)
    .eq('type', type)
    .eq('status', 'sent')
    .maybeSingle()

  if (existing) return { success: false, error: '이미 발송된 알림입니다.' }

  // 앱 내 알림 기록
  const { error } = await supabaseAdmin
    .from('notifications')
    .insert({ rental_id: rentalId, type, status: 'sent', sent_at: new Date().toISOString() })

  if (error) return { success: false, error: '알림 기록에 실패했습니다.' }

  // TODO: 알리고 SMS/알림톡 발송 연동
  // - 알리고 API 키 설정 필요
  // - Vercel 고정 IP 제한 이슈 해결 필요
  // - rental_id로 사용자 연락처, 도서명 조회 후 발송

  return { success: true }
}

// 주민 셀프 대출
export async function selfCheckout(barcode: string): Promise<ActionResult<{ book_title: string; due_date: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: '로그인이 필요합니다.' }

  // 도서 조회
  const { data: book } = await supabase
    .from('books')
    .select('id, title, barcode, is_available, rental_days')
    .eq('barcode', barcode.trim())
    .eq('is_deleted', false)
    .single()

  if (!book) return { success: false, error: '등록되지 않은 도서입니다.' }
  if (!book.is_available) return { success: false, error: '이미 대출 중인 도서입니다.' }

  // 연체 도서 확인
  const { data: overdueRentals } = await supabase
    .from('rentals')
    .select('id')
    .eq('user_id', user.id)
    .is('returned_at', null)
    .lt('due_date', getKSTDateString())
    .limit(1)

  if (overdueRentals && overdueRentals.length > 0) {
    return { success: false, error: '연체 도서가 있어 대출이 불가합니다. 반납 후 이용해 주세요.' }
  }

  // 설정값 조회
  const maxRentals = await getSettingValue(supabase, 'max_rentals', 5)
  const defaultRentalDays = await getSettingValue(supabase, 'rental_days', 14)

  // 최대 대출 권수 확인
  const { count } = await supabase
    .from('rentals')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('returned_at', null)

  if ((count ?? 0) >= maxRentals) {
    return { success: false, error: `1인당 최대 ${maxRentals}권까지 대출 가능합니다.` }
  }

  const rentalDays = book.rental_days ?? defaultRentalDays
  const dueDateStr = getKSTDateAfterDays(rentalDays)

  const { error } = await supabase
    .from('rentals')
    .insert({ book_id: book.id, user_id: user.id, due_date: dueDateStr })

  if (error) return { success: false, error: '대출 처리에 실패했습니다.' }

  // 도서 상태를 대출 중으로 변경 (books UPDATE는 admin 권한 필요)
  await supabaseAdmin
    .from('books')
    .update({ is_available: false })
    .eq('id', book.id)

  // 젤리 지급 (셀프 대출)
  awardJellyForCheckout(user.id, book.title, book.id).catch(() => {})

  return {
    success: true,
    data: { book_title: book.title, due_date: dueDateStr },
  }
}

export async function getAllResidents() {
  const admin = await getCurrentUser()
  if (!admin || admin.role !== 'admin') return []

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, name, dong_ho, phone_number, role, created_at')
    .eq('role', 'resident')
    .order('created_at', { ascending: false })

  return data ?? []
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

export async function getResidentDetail(userId: string) {
  const admin = await getCurrentUser()
  if (!admin || admin.role !== 'admin') return null

  const [profileRes, activeRes, pastRes] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, name, dong_ho, phone_number, created_at')
      .eq('id', userId)
      .single(),
    supabaseAdmin
      .from('rentals')
      .select('id, rented_at, due_date, book:books(id, title, barcode)')
      .eq('user_id', userId)
      .is('returned_at', null)
      .order('due_date', { ascending: true }),
    supabaseAdmin
      .from('rentals')
      .select('id, rented_at, due_date, returned_at, book:books(id, title, barcode)')
      .eq('user_id', userId)
      .not('returned_at', 'is', null)
      .order('returned_at', { ascending: false })
      .limit(30),
  ])

  const { data: profile } = profileRes
  const { data: activeRentals } = activeRes
  const { data: pastRentals } = pastRes

  if (!profile) return null

  const today = getKSTDateString()

  return {
    profile,
    active_rentals: (activeRentals ?? []).map((r) => ({
      ...r,
      book: r.book as { id: string; title: string; barcode: string },
      is_overdue: r.due_date < today,
    })),
    past_rentals: (pastRentals ?? []).map((r) => ({
      ...r,
      book: r.book as { id: string; title: string; barcode: string },
    })),
  }
}
