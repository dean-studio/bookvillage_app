'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkoutSchema, returnSchema } from '@/lib/validations/books'
import { getCurrentUser } from '@/app/actions/auth'
import { phoneToEmail, pinToPassword } from '@/lib/validations/auth'
import { getKSTNow, getKSTDateString, getKSTDateAfterDays } from '@/lib/date'
import { awardJellyForCheckout, awardJellyForReturn, awardJellyForCancel } from '@/app/actions/jelly'
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
    .insert({ book_id: book.id, user_id, due_date: dueDateStr, checked_out_by: admin.id })
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

// 비회원(게스트) 대출: 이름·동호수·전화번호로 게스트 프로필 확보 후 대출
export async function checkoutBookGuest(formData: FormData): Promise<ActionResult<CheckoutResult>> {
  const admin = await getCurrentUser()
  if (!admin || admin.role !== 'admin') {
    return { success: false, error: '권한이 없습니다.' }
  }

  const name = String(formData.get('name') ?? '').trim()
  const dong_ho = String(formData.get('dong_ho') ?? '').trim()
  const phoneRaw = String(formData.get('phone_number') ?? '').replace(/\D/g, '')
  const barcode = String(formData.get('barcode') ?? '').trim()
  const rentedDate = String(formData.get('rented_at') ?? '').trim() // YYYY-MM-DD (선택)

  if (!name) return { success: false, error: '이름을 입력해주세요.' }
  if (!dong_ho) return { success: false, error: '동/호수를 입력해주세요.' }
  if (!/^\d{10,11}$/.test(phoneRaw)) return { success: false, error: '전화번호를 정확히 입력해주세요.' }
  if (!barcode) return { success: false, error: '도서 바코드를 입력해주세요.' }
  if (rentedDate && !/^\d{4}-\d{2}-\d{2}$/.test(rentedDate)) {
    return { success: false, error: '대출일 형식이 올바르지 않습니다.' }
  }

  // 1) 전화번호로 기존 프로필 조회 (회원이든 이전 게스트든 기록 연결)
  let userId: string | null = null
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('phone_number', phoneRaw)
    .maybeSingle()

  if (existing) {
    userId = existing.id
    // 최신 이름/동호수로 갱신 (종이에 적은 정보 반영)
    await supabaseAdmin.from('profiles').update({ name, dong_ho }).eq('id', userId)
  } else {
    // 2) 게스트 auth 계정 + 프로필 자동 생성 (임의 비밀번호 — 본인 로그인 시 재설정/재가입)
    const randomPin = String(Math.floor(1000 + (Date.now() % 9000)))
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: phoneToEmail(phoneRaw),
      password: pinToPassword(randomPin),
      email_confirm: true,
    })
    if (authError || !authData.user) {
      return { success: false, error: '게스트 등록에 실패했습니다.' }
    }
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: authData.user.id,
      phone_number: phoneRaw,
      name,
      dong_ho,
      is_guest: true,
    })
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return { success: false, error: '게스트 프로필 생성에 실패했습니다.' }
    }
    userId = authData.user.id
  }

  // 3) 대출 처리 (게스트는 젤리 미지급 — 단순 대여/반납만 관리)
  const supabase = await createClient()

  const { data: book } = await supabase
    .from('books')
    .select('id, title, barcode, is_available, rental_days')
    .eq('barcode', barcode)
    .eq('is_deleted', false)
    .single()

  if (!book) return { success: false, error: '존재하지 않는 바코드입니다.' }
  if (!book.is_available) return { success: false, error: '이미 대출 중인 도서입니다.' }

  // 비회원은 연체/권수 제한 없이 단순 대여 처리 (관리자 수기 관리)
  const defaultRentalDays = await getSettingValue(supabase, 'rental_days', 14)
  const rentalDays = book.rental_days ?? defaultRentalDays

  // 대출일 지정 시: 그 날짜 기준으로 rented_at·due_date 계산. 미지정 시 오늘.
  let rentedAtIso: string | undefined
  let dueDateStr: string
  if (rentedDate) {
    rentedAtIso = new Date(`${rentedDate}T00:00:00+09:00`).toISOString()
    const due = new Date(`${rentedDate}T00:00:00+09:00`)
    due.setDate(due.getDate() + rentalDays)
    dueDateStr = due.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  } else {
    dueDateStr = getKSTDateAfterDays(rentalDays)
  }

  const insertRow: {
    book_id: string
    user_id: string
    due_date: string
    checked_out_by: string
    rented_at?: string
  } = {
    book_id: book.id,
    user_id: userId,
    due_date: dueDateStr,
    checked_out_by: admin.id,
  }
  if (rentedAtIso) insertRow.rented_at = rentedAtIso

  const { data: rental, error } = await supabase
    .from('rentals')
    .insert(insertRow)
    .select('id, rented_at, due_date')
    .single()

  if (error) {
    return { success: false, error: '대출 처리에 실패했습니다.' }
  }

  // 게스트는 젤리 지급 없음

  return {
    success: true,
    data: {
      id: rental.id,
      book: { title: book.title, barcode: book.barcode },
      user: { name, dong_ho },
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

export async function getReturnedRentals(params?: {
  startDate?: string // 반납일 기준
  endDate?: string
  query?: string
  page?: number
  pageSize?: number
}) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return { rows: [], totalCount: 0, page: 1, totalPages: 0 }

  const page = params?.page ?? 1
  const pageSize = params?.pageSize ?? 20

  // 검색어가 있으면 도서/대여자에서 매칭되는 id를 먼저 찾아 필터
  const kw = params?.query?.trim()
  let matchBookIds: string[] | null = null
  let matchUserIds: string[] | null = null
  if (kw) {
    const [{ data: mb }, { data: mp }] = await Promise.all([
      supabaseAdmin.from('books').select('id').or(`title.ilike.%${kw}%,barcode.ilike.%${kw}%`),
      supabaseAdmin.from('profiles').select('id').or(`name.ilike.%${kw}%,dong_ho.ilike.%${kw}%`),
    ])
    matchBookIds = (mb ?? []).map((b) => b.id)
    matchUserIds = (mp ?? []).map((p) => p.id)
  }

  let base = supabaseAdmin
    .from('rentals')
    .select('id, returned_at, returned_by, due_date, book_id, user_id', { count: 'exact' })
    .not('returned_at', 'is', null)

  if (params?.startDate) base = base.gte('returned_at', params.startDate)
  if (params?.endDate) base = base.lte('returned_at', params.endDate + 'T23:59:59')

  if (kw) {
    // 도서 또는 대여자 매칭
    const ors: string[] = []
    if (matchBookIds && matchBookIds.length) ors.push(`book_id.in.(${matchBookIds.join(',')})`)
    if (matchUserIds && matchUserIds.length) ors.push(`user_id.in.(${matchUserIds.join(',')})`)
    if (ors.length === 0) return { rows: [], totalCount: 0, page, totalPages: 0 }
    base = base.or(ors.join(','))
  }

  const from = (page - 1) * pageSize
  const { data, count } = await base
    .order('returned_at', { ascending: false })
    .range(from, from + pageSize - 1)

  if (!data || data.length === 0) {
    return { rows: [], totalCount: count ?? 0, page, totalPages: Math.ceil((count ?? 0) / pageSize) }
  }

  const bookIds = [...new Set(data.map((r) => r.book_id))]
  const userIds = [...new Set([
    ...data.map((r) => r.user_id),
    ...data.filter((r) => r.returned_by).map((r) => r.returned_by!),
  ])]
  const [{ data: books }, { data: profiles }] = await Promise.all([
    supabaseAdmin.from('books').select('id, title, barcode').in('id', bookIds),
    supabaseAdmin.from('profiles').select('id, name, dong_ho').in('id', userIds),
  ])
  const bookMap = Object.fromEntries((books ?? []).map((b) => [b.id, b]))
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

  const rows = data.map((r) => {
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

  return { rows, totalCount: count ?? 0, page, totalPages: Math.ceil((count ?? 0) / pageSize) }
}

// 기간별 대여 도서 목록 (대출일 rented_at 기준, 반납 여부 무관)
export async function getRentalsByPeriod(params?: {
  startDate?: string // YYYY-MM-DD
  endDate?: string
  query?: string
  status?: 'all' | 'active' | 'returned' // 대여중/반납완료 필터
  page?: number
  pageSize?: number
}) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return { rows: [], totalCount: 0, page: 1, totalPages: 0, activeCount: 0, returnedCount: 0, uniqueUsers: 0 }
  }

  const page = params?.page ?? 1
  const pageSize = params?.pageSize ?? 20
  const status = params?.status ?? 'all'

  // 검색어가 있으면 도서/대여자에서 매칭되는 id를 먼저 찾아 필터
  const kw = params?.query?.trim()
  let matchBookIds: string[] | null = null
  let matchUserIds: string[] | null = null
  if (kw) {
    const [{ data: mb }, { data: mp }] = await Promise.all([
      supabaseAdmin.from('books').select('id').or(`title.ilike.%${kw}%,barcode.ilike.%${kw}%`),
      supabaseAdmin.from('profiles').select('id').or(`name.ilike.%${kw}%,dong_ho.ilike.%${kw}%`),
    ])
    matchBookIds = (mb ?? []).map((b) => b.id)
    matchUserIds = (mp ?? []).map((p) => p.id)
  }

  const applyBase = <T extends { gte: (c: string, v: string) => T; lte: (c: string, v: string) => T; or: (f: string) => T; is: (c: string, v: null) => T; not: (c: string, op: string, v: null) => T }>(q: T): T => {
    let x = q
    if (params?.startDate) x = x.gte('rented_at', params.startDate)
    if (params?.endDate) x = x.lte('rented_at', params.endDate + 'T23:59:59')
    if (kw) {
      const ors: string[] = []
      if (matchBookIds && matchBookIds.length) ors.push(`book_id.in.(${matchBookIds.join(',')})`)
      if (matchUserIds && matchUserIds.length) ors.push(`user_id.in.(${matchUserIds.join(',')})`)
      // 매칭 없으면 결과 없음을 유도 (존재하지 않는 id)
      x = x.or(ors.length ? ors.join(',') : `id.eq.00000000-0000-0000-0000-000000000000`)
    }
    return x
  }

  // 상태별 카운트 (전체 기간 내)
  const countQuery = (extra?: 'active' | 'returned') => {
    let q = supabaseAdmin.from('rentals').select('id', { count: 'exact', head: true })
    q = applyBase(q as never) as never
    if (extra === 'active') q = q.is('returned_at', null)
    if (extra === 'returned') q = q.not('returned_at', 'is', null)
    return q
  }

  const [{ count: activeCount }, { count: returnedCount }] = await Promise.all([
    countQuery('active'),
    countQuery('returned'),
  ])

  // 기간 내 대여한 고유 이용자 수
  let uniqueUsers = 0
  {
    let uq = supabaseAdmin.from('rentals').select('user_id')
    uq = applyBase(uq as never) as never
    const { data: uData } = await uq.limit(20000)
    uniqueUsers = new Set((uData ?? []).map((r: { user_id: string }) => r.user_id)).size
  }

  // 목록 조회
  let base = supabaseAdmin
    .from('rentals')
    .select('id, rented_at, returned_at, due_date, book_id, user_id', { count: 'exact' })
  base = applyBase(base as never) as never
  if (status === 'active') base = base.is('returned_at', null)
  if (status === 'returned') base = base.not('returned_at', 'is', null)

  const from = (page - 1) * pageSize
  const { data, count } = await base
    .order('rented_at', { ascending: false })
    .range(from, from + pageSize - 1)

  const totalCount = count ?? 0
  if (!data || data.length === 0) {
    return { rows: [], totalCount, page, totalPages: Math.ceil(totalCount / pageSize), activeCount: activeCount ?? 0, returnedCount: returnedCount ?? 0, uniqueUsers }
  }

  const bookIds = [...new Set(data.map((r) => r.book_id))]
  const userIds = [...new Set(data.map((r) => r.user_id))]
  const [{ data: books }, { data: profiles }] = await Promise.all([
    supabaseAdmin.from('books').select('id, title, barcode').in('id', bookIds),
    supabaseAdmin.from('profiles').select('id, name, dong_ho, is_guest').in('id', userIds),
  ])
  const bookMap = Object.fromEntries((books ?? []).map((b) => [b.id, b]))
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

  const rows = data.map((r) => {
    const book = bookMap[r.book_id]
    const borrower = profileMap[r.user_id] as { name: string; dong_ho: string; is_guest?: boolean } | undefined
    return {
      id: r.id,
      book_id: r.book_id,
      user_id: r.user_id,
      book_title: book?.title ?? '알 수 없음',
      book_barcode: book?.barcode ?? '',
      borrower_name: borrower?.name ?? '알 수 없음',
      borrower_dong_ho: borrower?.dong_ho ?? '',
      is_guest: !!borrower?.is_guest,
      rented_at: r.rented_at as string,
      due_date: r.due_date,
      returned_at: r.returned_at as string | null,
    }
  })

  return { rows, totalCount, page, totalPages: Math.ceil(totalCount / pageSize), activeCount: activeCount ?? 0, returnedCount: returnedCount ?? 0, uniqueUsers }
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

// 주민 셀프 대여 취소 (대여 당일에만 가능)
export async function cancelMyRental(rentalId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: '로그인이 필요합니다.' }

  // 본인 대여 + 미반납 조회
  const { data: rental } = await supabase
    .from('rentals')
    .select('id, user_id, book_id, rented_at, returned_at')
    .eq('id', rentalId)
    .single()

  if (!rental || rental.user_id !== user.id) {
    return { success: false, error: '취소할 수 있는 대여 기록이 없습니다.' }
  }
  if (rental.returned_at) {
    return { success: false, error: '이미 반납된 도서입니다.' }
  }

  // 대여 당일에만 취소 가능 (KST 날짜 비교)
  const rentedDate = new Date(rental.rented_at as string).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  if (rentedDate !== getKSTDateString()) {
    return { success: false, error: '대여 당일에만 취소할 수 있습니다. 반납은 도서관에 문의해 주세요.' }
  }

  // 도서 제목 조회 (젤리 회수 기록용)
  const { data: book } = await supabaseAdmin
    .from('books')
    .select('title')
    .eq('id', rental.book_id)
    .maybeSingle()

  // 대여 기록 완전 삭제 (admin 권한)
  const { error } = await supabaseAdmin
    .from('rentals')
    .delete()
    .eq('id', rental.id)

  if (error) {
    return { success: false, error: '대여 취소에 실패했습니다.' }
  }

  // 도서 상태 대출 가능으로 복구 (DELETE는 트리거가 없음)
  await supabaseAdmin
    .from('books')
    .update({ is_available: true })
    .eq('id', rental.book_id)

  // 대출 시 지급한 젤리 회수
  awardJellyForCancel(user.id, book?.title ?? '', rental.book_id).catch(() => {})

  return { success: true }
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

export async function getActiveRentals(params?: {
  startDate?: string // YYYY-MM-DD (대출일 기준)
  endDate?: string
  query?: string // 대여자 이름 또는 도서명/바코드
}) {
  const admin = await getCurrentUser()
  if (!admin || admin.role !== 'admin') return []

  let q = supabaseAdmin
    .from('rentals')
    .select('id, rented_at, due_date, book_id, user_id')
    .is('returned_at', null)
    .order('due_date', { ascending: true })

  if (params?.startDate) q = q.gte('rented_at', params.startDate)
  if (params?.endDate) q = q.lte('rented_at', params.endDate + 'T23:59:59')

  const { data } = await q
  if (!data || data.length === 0) return []

  const bookIds = [...new Set(data.map((r) => r.book_id))]
  const userIds = [...new Set(data.map((r) => r.user_id))]
  const [{ data: books }, { data: profiles }] = await Promise.all([
    supabaseAdmin.from('books').select('id, title, barcode, location_group').in('id', bookIds),
    supabaseAdmin.from('profiles').select('id, name, dong_ho, phone_number, is_guest').in('id', userIds),
  ])
  const bookMap = Object.fromEntries((books ?? []).map((b) => [b.id, b]))
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

  const today = getKSTNow()
  let rows = data.map((r) => {
    const dueDate = new Date(r.due_date)
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return {
      id: r.id,
      book: (bookMap[r.book_id] ?? { id: r.book_id, title: '알 수 없음', barcode: '', location_group: '' }) as { id: string; title: string; barcode: string; location_group: string },
      user: (profileMap[r.user_id] ?? { id: r.user_id, name: '알 수 없음', dong_ho: '', phone_number: '', is_guest: false }) as { id: string; name: string; dong_ho: string; phone_number: string; is_guest: boolean },
      rented_at: r.rented_at as string,
      due_date: r.due_date,
      d_day: diffDays,
    }
  })

  const kw = params?.query?.trim().toLowerCase()
  if (kw) {
    rows = rows.filter((r) =>
      r.user.name.toLowerCase().includes(kw) ||
      r.user.dong_ho.toLowerCase().includes(kw) ||
      r.book.title.toLowerCase().includes(kw) ||
      r.book.barcode.toLowerCase().includes(kw)
    )
  }
  return rows
}

// 게스트 대출 정보 수정 (대출일/이용자 정보). 게스트만 수정 가능.
export async function updateGuestRental(formData: FormData): Promise<ActionResult> {
  const admin = await getCurrentUser()
  if (!admin || admin.role !== 'admin') {
    return { success: false, error: '권한이 없습니다.' }
  }

  const rentalId = String(formData.get('rental_id') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const dong_ho = String(formData.get('dong_ho') ?? '').trim()
  const phoneRaw = String(formData.get('phone_number') ?? '').replace(/\D/g, '')
  const rentedDate = String(formData.get('rented_at') ?? '').trim() // YYYY-MM-DD

  if (!rentalId) return { success: false, error: '대출 정보를 찾을 수 없습니다.' }
  if (!name) return { success: false, error: '이름을 입력해주세요.' }
  if (!dong_ho) return { success: false, error: '동/호수를 입력해주세요.' }
  if (!/^\d{10,11}$/.test(phoneRaw)) return { success: false, error: '전화번호를 정확히 입력해주세요.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rentedDate)) {
    return { success: false, error: '대출일 형식이 올바르지 않습니다.' }
  }

  // 대출 기록 + 이용자 조회
  const { data: rental } = await supabaseAdmin
    .from('rentals')
    .select('id, user_id, book_id, returned_at')
    .eq('id', rentalId)
    .maybeSingle()

  if (!rental) return { success: false, error: '대출 정보를 찾을 수 없습니다.' }
  if (rental.returned_at) return { success: false, error: '이미 반납된 대출은 수정할 수 없습니다.' }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, is_guest')
    .eq('id', rental.user_id)
    .maybeSingle()

  if (!profile || !profile.is_guest) {
    return { success: false, error: '비회원(게스트) 대출만 수정할 수 있습니다.' }
  }

  // 반납예정일 재계산 (도서별 rental_days 반영)
  const { data: book } = await supabaseAdmin
    .from('books')
    .select('rental_days')
    .eq('id', rental.book_id)
    .maybeSingle()
  const supabase = await createClient()
  const defaultRentalDays = await getSettingValue(supabase, 'rental_days', 14)
  const rentalDays = book?.rental_days ?? defaultRentalDays

  const rentedAtIso = new Date(`${rentedDate}T00:00:00+09:00`).toISOString()
  const due = new Date(`${rentedDate}T00:00:00+09:00`)
  due.setDate(due.getDate() + rentalDays)
  const dueDateStr = due.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })

  // 이용자 정보 갱신
  await supabaseAdmin.from('profiles').update({ name, dong_ho, phone_number: phoneRaw }).eq('id', profile.id)

  // 대출 기록 갱신
  const { error } = await supabaseAdmin
    .from('rentals')
    .update({ rented_at: rentedAtIso, due_date: dueDateStr })
    .eq('id', rentalId)

  if (error) return { success: false, error: '수정에 실패했습니다.' }

  return { success: true }
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
