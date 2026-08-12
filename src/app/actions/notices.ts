'use server'

import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getCurrentUser } from './auth'
import type { ActionResult } from '@/types'

export interface Notice {
  id: string
  title: string
  content: string
  image_url: string | null
  is_published: boolean
  created_at: string
  updated_at: string
}

// 공지 목록 (발행된 것만, 최신순)
export async function getNotices(): Promise<Notice[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('notices')
    .select('id, title, content, image_url, is_published, created_at, updated_at')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
  return (data ?? []) as Notice[]
}

// 관리자용: 전체 목록 (미발행 포함)
export async function getAllNotices(): Promise<Notice[]> {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return []
  const { data } = await supabaseAdmin
    .from('notices')
    .select('id, title, content, image_url, is_published, created_at, updated_at')
    .order('created_at', { ascending: false })
  return (data ?? []) as Notice[]
}

export async function getNoticeById(id: string): Promise<Notice | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('notices')
    .select('id, title, content, image_url, is_published, created_at, updated_at')
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

  const { error } = await supabaseAdmin.from('notices').insert({
    title,
    content,
    image_url,
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

  const { error } = await supabaseAdmin
    .from('notices')
    .update({ title, content, image_url })
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

  let query = supabase
    .from('notices')
    .select('id', { count: 'exact', head: true })
    .eq('is_published', true)
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
