'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/app/actions/auth'
import { getKSTDateString } from '@/lib/date'

interface DashboardStats {
  summary: {
    total_rentals: number
    total_returns: number
    active_rentals: number
    overdue_count: number
    new_members: number
  }
  top_readers: {
    user_id: string
    user: { name: string; dong_ho: string }
    rental_count: number
  }[]
  popular_books: {
    book_id: string
    book: { title: string; author: string; cover_image: string | null }
    rental_count: number
  }[]
  top_reviewers: {
    user_id: string
    user: { name: string; dong_ho: string }
    report_count: number
  }[]
}

export async function getDashboardStats(
  startDate: string,
  endDate: string
): Promise<DashboardStats | null> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return null

  const supabase = await createClient()
  const today = getKSTDateString()

  // 기간 내 총 대출 수
  const { count: totalRentals } = await supabase
    .from('rentals')
    .select('id', { count: 'exact', head: true })
    .gte('rented_at', startDate)
    .lte('rented_at', endDate + 'T23:59:59')

  // 기간 내 총 반납 수
  const { count: totalReturns } = await supabase
    .from('rentals')
    .select('id', { count: 'exact', head: true })
    .not('returned_at', 'is', null)
    .gte('returned_at', startDate)
    .lte('returned_at', endDate + 'T23:59:59')

  // 현재 대출 중
  const { count: activeRentals } = await supabase
    .from('rentals')
    .select('id', { count: 'exact', head: true })
    .is('returned_at', null)

  // 현재 연체 중
  const { count: overdueCount } = await supabase
    .from('rentals')
    .select('id', { count: 'exact', head: true })
    .is('returned_at', null)
    .lt('due_date', today)

  // 기간 내 신규 가입자 수
  const { count: newMembers } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59')

  // 다독왕 TOP 10: 기간 내 대출 많은 주민
  const { data: topReadersData } = await supabase
    .from('rentals')
    .select('user_id, profiles!rentals_user_id_fkey(name, dong_ho)')
    .gte('rented_at', startDate)
    .lte('rented_at', endDate + 'T23:59:59')

  const readerCounts = new Map<string, { name: string; dong_ho: string; count: number }>()
  for (const r of topReadersData ?? []) {
    const profile = r.profiles as { name: string; dong_ho: string } | null
    if (!profile) continue
    const existing = readerCounts.get(r.user_id)
    if (existing) {
      existing.count++
    } else {
      readerCounts.set(r.user_id, { name: profile.name, dong_ho: profile.dong_ho, count: 1 })
    }
  }
  const top_readers = [...readerCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([userId, r]) => ({ user_id: userId, user: { name: r.name, dong_ho: r.dong_ho }, rental_count: r.count }))

  // 인기 도서 TOP 10: 기간 내 대출 많은 도서
  const { data: popularData } = await supabase
    .from('rentals')
    .select('book_id, books!rentals_book_id_fkey(title, author, cover_image)')
    .gte('rented_at', startDate)
    .lte('rented_at', endDate + 'T23:59:59')

  const bookCounts = new Map<string, { title: string; author: string; cover_image: string | null; count: number }>()
  for (const r of popularData ?? []) {
    const book = r.books as { title: string; author: string; cover_image: string | null } | null
    if (!book) continue
    const existing = bookCounts.get(r.book_id)
    if (existing) {
      existing.count++
    } else {
      bookCounts.set(r.book_id, { ...book, count: 1 })
    }
  }
  const popular_books = [...bookCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([bookId, b]) => ({
      book_id: bookId,
      book: { title: b.title, author: b.author, cover_image: b.cover_image },
      rental_count: b.count,
    }))

  // 우수 독서록 작성자 TOP 10
  const { data: reviewerData } = await supabase
    .from('book_reports')
    .select('user_id, profiles!book_reports_user_id_fkey(name, dong_ho)')
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59')

  const reviewerCounts = new Map<string, { name: string; dong_ho: string; count: number }>()
  for (const r of reviewerData ?? []) {
    const profile = r.profiles as { name: string; dong_ho: string } | null
    if (!profile) continue
    const existing = reviewerCounts.get(r.user_id)
    if (existing) {
      existing.count++
    } else {
      reviewerCounts.set(r.user_id, { name: profile.name, dong_ho: profile.dong_ho, count: 1 })
    }
  }
  const top_reviewers = [...reviewerCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([userId, r]) => ({ user_id: userId, user: { name: r.name, dong_ho: r.dong_ho }, report_count: r.count }))

  return {
    summary: {
      total_rentals: totalRentals ?? 0,
      total_returns: totalReturns ?? 0,
      active_rentals: activeRentals ?? 0,
      overdue_count: overdueCount ?? 0,
      new_members: newMembers ?? 0,
    },
    top_readers,
    popular_books,
    top_reviewers,
  }
}

export async function getOverdueList() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return []

  const supabase = await createClient()

  const { data } = await supabase
    .from('overdue_rentals')
    .select('*')
    .order('overdue_days', { ascending: false })

  return (data ?? []).map((r) => ({
    id: r.id,
    user_id: r.user_id,
    book_id: r.book_id,
    book: { title: r.book_title, barcode: r.book_barcode },
    user: { name: r.user_name, dong_ho: r.user_dong_ho, phone_number: r.user_phone },
    rented_at: r.rented_at,
    due_date: r.due_date,
    overdue_days: r.overdue_days,
    notified_7day: r.notified_7day,
    notified_30day: r.notified_30day,
  }))
}
