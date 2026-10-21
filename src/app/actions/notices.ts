'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from './auth'
import { getKSTDateString } from '@/lib/date'
import type { ActionResult } from '@/types'

export interface Notice {
  id: string
  title: string
  content: string
  image_url: string | null
  is_published: boolean
  /** 게시 시작일 (YYYY-MM-DD, 없으면 바로) */
  starts_on: string | null
  /** 게시 종료일 (YYYY-MM-DD, 이 날까지 보임, 없으면 계속) */
  ends_on: string | null
  created_at: string
  updated_at: string
}

const NOTICE_COLS = 'id, title, content, image_url, is_published, starts_on, ends_on, created_at, updated_at'

// 오늘(한국 날짜)이 게시 기간 안인 공지만
function inPeriod<T extends { or: (filter: string) => T }>(query: T): T {
  const today = getKSTDateString()
  return query.or(`starts_on.is.null,starts_on.lte.${today}`).or(`ends_on.is.null,ends_on.gte.${today}`)
}

// 폼의 게시 기간 읽기 (빈 칸이면 null)
function readPeriod(formData: FormData): { starts_on: string | null; ends_on: string | null; error?: string } {
  const date = (key: string) => {
    const v = String(formData.get(key) ?? '').trim()
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
  }
  const starts_on = date('starts_on')
  const ends_on = date('ends_on')
  if (starts_on && ends_on && ends_on < starts_on) {
    return { starts_on, ends_on, error: '종료일이 시작일보다 빠릅니다.' }
  }
  return { starts_on, ends_on }
}

// 공지 목록 (발행됐고 오늘이 게시 기간 안인 것만, 최신순)
export async function getNotices(): Promise<Notice[]> {
  const supabase = await createClient()
  const { data } = await inPeriod(
    supabase.from('notices').select(NOTICE_COLS).eq('is_published', true)
  ).order('created_at', { ascending: false })
  return (data ?? []) as Notice[]
}

// 관리자용: 전체 목록 (미발행 포함)
export async function getAllNotices(): Promise<Notice[]> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return []
  const { data } = await supabaseAdmin
    .from('notices')
    .select(NOTICE_COLS)
    .order('created_at', { ascending: false })
  return (data ?? []) as Notice[]
}

export async function getNoticeById(id: string): Promise<Notice | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('notices')
    .select(NOTICE_COLS)
    .eq('id', id)
    .maybeSingle()
  return (data as Notice | null) ?? null
}

export async function createNotice(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return { success: false, error: '권한이 없습니다.' }

  const title = String(formData.get('title') ?? '').trim()
  const content = String(formData.get('content') ?? '').trim()
  const image_url = String(formData.get('image_url') ?? '').trim() || null
  if (!title) return { success: false, error: '제목을 입력해주세요.' }
  const period = readPeriod(formData)
  if (period.error) return { success: false, error: period.error }

  const { error } = await supabaseAdmin.from('notices').insert({
    title,
    content,
    image_url,
    starts_on: period.starts_on,
    ends_on: period.ends_on,
    created_by: user.id,
  })
  if (error) return { success: false, error: '공지 등록에 실패했습니다.' }
  return { success: true }
}

export async function updateNotice(id: string, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return { success: false, error: '권한이 없습니다.' }

  const title = String(formData.get('title') ?? '').trim()
  const content = String(formData.get('content') ?? '').trim()
  const image_url = String(formData.get('image_url') ?? '').trim() || null
  if (!title) return { success: false, error: '제목을 입력해주세요.' }
  const period = readPeriod(formData)
  if (period.error) return { success: false, error: period.error }

  const { error } = await supabaseAdmin
    .from('notices')
    .update({ title, content, image_url, starts_on: period.starts_on, ends_on: period.ends_on })
    .eq('id', id)
  if (error) return { success: false, error: '공지 수정에 실패했습니다.' }
  return { success: true }
}

export async function deleteNotice(id: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return { success: false, error: '권한이 없습니다.' }
  const { error } = await supabaseAdmin.from('notices').delete().eq('id', id)
  if (error) return { success: false, error: '공지 삭제에 실패했습니다.' }
  return { success: true }
}

// 안 읽은 공지 수 (주민)
export async function getUnreadNoticeCount(): Promise<number> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { data: profile } = await supabase
    .from('profiles')
    .select('notices_read_at')
    .eq('id', user.id)
    .maybeSingle()

  const readAt = (profile as { notices_read_at: string | null } | null)?.notices_read_at

  let query = inPeriod(
    supabase.from('notices').select('id', { count: 'exact', head: true }).eq('is_published', true)
  )
  if (readAt) query = query.gt('created_at', readAt)

  const { count } = await query
  return count ?? 0
}

// 공지 확인 처리 (읽음 시각 갱신)
export async function markNoticesRead(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from('profiles')
    .update({ notices_read_at: new Date().toISOString() })
    .eq('id', user.id)
}
