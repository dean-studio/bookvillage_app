'use server'

import { createClient } from '@/lib/supabase/server'
import { getKSTNow, getKSTDateString } from '@/lib/date'

export async function getMyPageData() {
  const supabase = await createClient()

  // 1회만 auth 호출
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return {
      userName: '', dongHo: '',
      activeCount: 0, overdueCount: 0,
      pastCount: 0, unreportedCount: 0,
      notifCount: 0, unreadNotif: 0,
      jellyBalance: 0,
    }
  }

  const userId = user.id
  const today = getKSTDateString()
  const now = getKSTNow()
  now.setHours(0, 0, 0, 0)

  // 모든 쿼리를 병렬 실행 (auth 중복 없음)
  const [
    { data: profile },
    { data: activeRentals },
    { data: pastRentals },
    { data: dueSoonRentals },
    { data: jellyData },
  ] = await Promise.all([
    // 프로필
    supabase
      .from('profiles')
      .select('name, dong_ho, notifications_read_at')
      .eq('id', userId)
      .single(),
    // 대출 중
    supabase
      .from('rentals')
      .select('id, due_date')
      .eq('user_id', userId)
      .is('returned_at', null),
    // 반납 완료 (최근 20건) + 독서록 여부 확인용 book_id
    supabase
      .from('rentals')
      .select('id, book_id:book_id')
      .eq('user_id', userId)
      .not('returned_at', 'is', null)
      .order('returned_at', { ascending: false })
      .limit(20),
    // 반납일 임박/연체 알림용 (반납 안 된 것)
    supabase
      .from('rentals')
      .select('id, due_date, book:books(title)')
      .eq('user_id', userId)
      .is('returned_at', null)
      .order('due_date', { ascending: true }),
    // 젤리 잔액
    supabase
      .from('jelly_balances')
      .select('balance')
      .eq('user_id', userId)
      .single(),
  ])

  // 연체 계산
  const active = activeRentals ?? []
  const overdueCount = active.filter((r) => r.due_date < today).length

  // 독서록 미작성 수
  const pastBookIds = (pastRentals ?? []).map((r) => r.book_id).filter(Boolean)
  let unreportedCount = pastBookIds.length

  if (pastBookIds.length > 0) {
    const { data: reports } = await supabase
      .from('book_reports')
      .select('book_id')
      .eq('user_id', userId)
      .in('book_id', pastBookIds)
    const reportedIds = new Set((reports ?? []).map((r) => r.book_id))
    unreportedCount = pastBookIds.filter((id) => !reportedIds.has(id)).length
  }

  // 알림 수 계산 (D-3 이내 또는 연체)
  const notifications = (dueSoonRentals ?? [])
    .map((r) => {
      const dueDate = new Date(r.due_date)
      dueDate.setHours(0, 0, 0, 0)
      const diffDays = Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return { diffDays }
    })
    .filter((n) => n.diffDays <= 3)

  const readAt = profile?.notifications_read_at ? new Date(profile.notifications_read_at) : null

  return {
    userName: profile?.name ?? '',
    dongHo: profile?.dong_ho ?? '',
    activeCount: active.length,
    overdueCount,
    pastCount: (pastRentals ?? []).length,
    unreportedCount,
    notifCount: notifications.length,
    unreadNotif: readAt ? 0 : notifications.length,
    jellyBalance: jellyData?.balance ?? 0,
  }
}
