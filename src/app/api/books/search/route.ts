import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchBookByISBN } from '@/lib/kakao'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  const isbn = request.nextUrl.searchParams.get('isbn')
  if (!isbn) {
    return NextResponse.json({ error: 'ISBN을 입력해주세요.' }, { status: 400 })
  }

  try {
    const book = await searchBookByISBN(isbn)
    if (!book) {
      return NextResponse.json({ error: '도서 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({
      title: book.title,
      author: book.authors.join(', '),
      publisher: book.publisher,
      cover_image: book.thumbnail,
      isbn: book.isbn,
      description: book.contents,
    })
  } catch {
    return NextResponse.json(
      { error: '카카오 API 연동 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
