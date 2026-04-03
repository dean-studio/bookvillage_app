import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * POST /api/setup
 *
 * 최초 설치 시 기본 관리자 계정과 도서관 설정을 생성합니다.
 * 이미 관리자가 존재하면 실행되지 않습니다.
 *
 * Body: { username, password, name }
 */
export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: '환경변수가 설정되지 않았습니다.' },
      { status: 500 }
    )
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 이미 관리자가 존재하는지 확인
  const { data: existingAdmins } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .eq('admin_status', 'approved')
    .limit(1)

  if (existingAdmins && existingAdmins.length > 0) {
    return NextResponse.json(
      { error: '이미 관리자가 존재합니다. 초기 설정은 1회만 가능합니다.' },
      { status: 409 }
    )
  }

  let body: { username?: string; password?: string; name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: '요청 본문이 올바르지 않습니다.' },
      { status: 400 }
    )
  }

  const username = body.username || 'admin'
  const password = body.password || '123456'
  const name = body.name || '관리자'

  if (password.length < 6) {
    return NextResponse.json(
      { error: '비밀번호는 6자 이상이어야 합니다.' },
      { status: 400 }
    )
  }

  const email = `${username}@admin.bookvillage.local`

  // 1. Auth 유저 생성
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    return NextResponse.json(
      { error: `관리자 계정 생성 실패: ${authError.message}` },
      { status: 500 }
    )
  }

  // 2. 프로필 생성 (approved 상태)
  if (authData.user) {
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        phone_number: `admin_${username}`,
        name,
        dong_ho: '관리자',
        role: 'admin',
        admin_status: 'approved',
      })

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: `프로필 생성 실패: ${profileError.message}` },
        { status: 500 }
      )
    }
  }

  // 3. 기본 도서관 설정 확인 및 생성
  const { data: existingSettings } = await supabaseAdmin
    .from('library_settings')
    .select('key')
    .in('key', ['max_rentals', 'rental_days', 'site_name', 'site_type', 'color_theme'])

  const existingKeys = new Set((existingSettings ?? []).map((s: { key: string }) => s.key))
  const defaultSettings = [
    { key: 'max_rentals', value: '5', description: '1인당 최대 대출 권수' },
    { key: 'rental_days', value: '14', description: '기본 대출 기간 (일)' },
    { key: 'site_name', value: '우리 도서관', description: '도서관 이름' },
    { key: 'site_type', value: 'apartment', description: '사이트 유형 (apartment/school/village)' },
    { key: 'color_theme', value: 'yellow', description: '컬러 테마' },
  ].filter((s) => !existingKeys.has(s.key))

  if (defaultSettings.length > 0) {
    await supabaseAdmin.from('library_settings').insert(defaultSettings)
  }

  return NextResponse.json({
    success: true,
    message: `관리자 '${username}' 계정이 생성되었습니다. /admin/login 에서 로그인하세요.`,
    admin: { username, name },
  })
}
