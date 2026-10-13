'use server'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/app/actions/auth'
import { phoneToEmail } from '@/lib/validations/auth'
import { getKSTDateString } from '@/lib/date'
import type { ActionResult } from '@/types'

// 비회원(게스트) 목록·수정·합치기·삭제 (관리자 전용)

export type GuestRow = {
  id: string
  name: string
  dong_ho: string
  phone_number: string
  created_at: string
  rental_count: number
  active_count: number
  overdue_count: number
  last_rented_at: string | null
  /** 같은 동호수 + 같은 이름인 다른 비회원이 있으면 같은 키 (중복 의심) */
  dup_key: string | null
}

export type GuestRental = {
  id: string
  rented_at: string
  due_date: string
  returned_at: string | null
  book: { title: string; barcode: string }
}

async function requireAdmin() {
  const admin = await getCurrentUser()
  return admin && admin.role === 'admin' ? admin : null
}

// "101동 211호" / "101동211호" / "101-211" → "101-211" (비교용)
function dongHoKey(dongHo: string): string {
  const m = dongHo.match(/(\d+)\D+(\d+)/)
  return m ? `${m[1]}-${m[2]}` : dongHo.replace(/\s/g, '')
}

export async function getGuestList(): Promise<GuestRow[]> {
  if (!(await requireAdmin())) return []

  const { data: guests } = await supabaseAdmin
    .from('profiles')
    .select('id, name, dong_ho, phone_number, created_at')
    .eq('is_guest', true)
    .order('created_at', { ascending: false })
  if (!guests || guests.length === 0) return []

  // 대출 기록은 기본 응답 한도(1,000행)를 넘을 수 있어 나눠서 읽음
  const ids = guests.map((g) => g.id)
  const rentals: { user_id: string; rented_at: string; due_date: string; returned_at: string | null }[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await supabaseAdmin
      .from('rentals')
      .select('user_id, rented_at, due_date, returned_at')
      .in('user_id', ids)
      .order('id')
      .range(from, from + 999)
    rentals.push(...((data ?? []) as typeof rentals))
    if (!data || data.length < 1000) break
  }

  const today = getKSTDateString()
  const stats = new Map<string, { count: number; active: number; overdue: number; last: string | null }>()
  for (const r of rentals) {
    const s = stats.get(r.user_id) ?? { count: 0, active: 0, overdue: 0, last: null }
    s.count += 1
    if (!r.returned_at) {
      s.active += 1
      if (r.due_date < today) s.overdue += 1
    }
    if (!s.last || r.rented_at > s.last) s.last = r.rented_at
    stats.set(r.user_id, s)
  }

  const keyOf = (g: { name: string; dong_ho: string }) => `${dongHoKey(g.dong_ho)}|${g.name.replace(/\s/g, '')}`
  const keyCount = new Map<string, number>()
  for (const g of guests) keyCount.set(keyOf(g), (keyCount.get(keyOf(g)) ?? 0) + 1)

  const rows: GuestRow[] = guests.map((g) => {
    const s = stats.get(g.id)
    return {
      ...g,
      rental_count: s?.count ?? 0,
      active_count: s?.active ?? 0,
      overdue_count: s?.overdue ?? 0,
      last_rented_at: s?.last ?? null,
      dup_key: (keyCount.get(keyOf(g)) ?? 0) > 1 ? keyOf(g) : null,
    }
  })

  // 최근 대출순 (대출 기록 없으면 맨 뒤)
  rows.sort((a, b) => {
    if (a.last_rented_at === b.last_rented_at) return a.name.localeCompare(b.name, 'ko')
    if (!a.last_rented_at) return 1
    if (!b.last_rented_at) return -1
    return a.last_rented_at < b.last_rented_at ? 1 : -1
  })
  return rows
}

export async function getGuestRentals(guestId: string): Promise<GuestRental[]> {
  if (!(await requireAdmin())) return []

  const { data } = await supabaseAdmin
    .from('rentals')
    .select('id, rented_at, due_date, returned_at, book:books(title, barcode)')
    .eq('user_id', guestId)
    .order('rented_at', { ascending: false })
    .limit(100)

  return (data ?? []).map((r) => ({
    id: r.id,
    rented_at: r.rented_at as string,
    due_date: r.due_date,
    returned_at: r.returned_at,
    book: (r.book ?? { title: '알 수 없음', barcode: '' }) as { title: string; barcode: string },
  }))
}

async function getGuestProfile(id: string) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, name, dong_ho, phone_number, is_guest')
    .eq('id', id)
    .maybeSingle()
  return data && data.is_guest ? data : null
}

// 이름·동호수·전화번호 수정. 전화번호를 바꾸면 로그인용 이메일도 함께 바꿔서
// 다음 비회원 대출 때 새 사람이 또 생기지 않게 한다.
export async function updateGuest(input: { id: string; name: string; dong_ho: string; phone: string }): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: '권한이 없습니다.' }

  const name = input.name.trim()
  const dong_ho = input.dong_ho.trim()
  const phone = input.phone.replace(/\D/g, '')
  if (!name) return { success: false, error: '이름을 입력해주세요.' }
  if (name.length > 20) return { success: false, error: '이름은 20자까지 입력할 수 있어요.' }
  if (!dong_ho) return { success: false, error: '동/호수를 입력해주세요.' }
  if (dong_ho.length > 20) return { success: false, error: '동/호수는 20자까지 입력할 수 있어요.' }
  if (!/^\d{10,11}$/.test(phone)) return { success: false, error: '전화번호를 정확히 입력해주세요.' }

  const guest = await getGuestProfile(input.id)
  if (!guest) return { success: false, error: '비회원 정보를 찾을 수 없습니다.' }

  if (phone !== guest.phone_number) {
    const { data: other } = await supabaseAdmin
      .from('profiles')
      .select('name, dong_ho, is_guest')
      .eq('phone_number', phone)
      .maybeSingle()
    if (other) {
      const who = `${other.name}(${other.dong_ho}${other.is_guest ? '' : ', 회원'})`
      return {
        success: false,
        error: other.is_guest
          ? `이미 ${who} 님이 쓰는 번호예요. 같은 분이면 '합치기'를 써 주세요.`
          : `이미 ${who} 님이 쓰는 번호예요.`,
      }
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(guest.id, {
      email: phoneToEmail(phone),
      email_confirm: true,
    })
    if (authError) return { success: false, error: '전화번호 변경에 실패했습니다.' }
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ name, dong_ho, phone_number: phone })
    .eq('id', guest.id)
  if (error) {
    // 프로필 저장 실패 시 로그인 이메일을 원래 번호로 되돌림
    if (phone !== guest.phone_number) {
      await supabaseAdmin.auth.admin.updateUserById(guest.id, { email: phoneToEmail(guest.phone_number) })
    }
    return { success: false, error: '수정에 실패했습니다.' }
  }

  return { success: true }
}

// 같은 사람으로 보이는 두 비회원을 합침: removeId의 기록을 keepId로 옮기고 removeId는 삭제
export async function mergeGuests(keepId: string, removeId: string): Promise<ActionResult<{ moved: number }>> {
  if (!(await requireAdmin())) return { success: false, error: '권한이 없습니다.' }
  if (!keepId || !removeId || keepId === removeId) return { success: false, error: '합칠 두 사람을 골라주세요.' }

  const [keep, remove] = await Promise.all([getGuestProfile(keepId), getGuestProfile(removeId)])
  if (!keep || !remove) return { success: false, error: '비회원 정보를 찾을 수 없습니다.' }

  const { data: moved, error: moveError } = await supabaseAdmin
    .from('rentals')
    .update({ user_id: keep.id })
    .eq('user_id', remove.id)
    .select('id')
  if (moveError) return { success: false, error: '대출 기록 옮기기에 실패했습니다.' }

  // 비회원은 보통 없지만, 혹시 남은 독서록·퀴즈 기록도 함께 옮김 (삭제가 막히지 않게)
  await Promise.all([
    supabaseAdmin.from('book_reports').update({ user_id: keep.id }).eq('user_id', remove.id),
    supabaseAdmin.from('quiz_attempts').update({ user_id: keep.id }).eq('user_id', remove.id),
  ])

  // auth 계정 삭제 → 프로필은 ON DELETE CASCADE로 함께 삭제
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(remove.id)
  if (deleteError) {
    return { success: false, error: '대출 기록은 옮겼지만 중복 정보를 지우지 못했습니다. 다시 시도해주세요.' }
  }

  return { success: true, data: { moved: moved?.length ?? 0 } }
}

// 대출 기록이 하나도 없는 비회원만 삭제 (기록이 있으면 통계가 깨지므로 '합치기'로 정리)
export async function deleteGuest(id: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: '권한이 없습니다.' }

  const guest = await getGuestProfile(id)
  if (!guest) return { success: false, error: '비회원 정보를 찾을 수 없습니다.' }

  const { count } = await supabaseAdmin
    .from('rentals')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', guest.id)
  if ((count ?? 0) > 0) {
    return { success: false, error: `대출 기록 ${count}건이 있어 삭제할 수 없어요. 같은 사람이 중복된 거라면 '합치기'를 써 주세요.` }
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(guest.id)
  if (error) return { success: false, error: '삭제에 실패했습니다.' }

  return { success: true }
}
