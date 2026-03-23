export interface KakaoBookResult {
  title: string
  authors: string[]
  publisher: string
  thumbnail: string
  isbn: string
  contents: string
}

interface KakaoBookSearchResponse {
  documents: {
    title: string
    authors: string[]
    publisher: string
    thumbnail: string
    isbn: string
    contents: string
  }[]
  meta: {
    total_count: number
    pageable_count: number
    is_end: boolean
  }
}

export async function searchBookByISBN(isbn: string): Promise<KakaoBookResult | null> {
  const apiKey = process.env.KAKAO_REST_API_KEY
  if (!apiKey) {
    throw new Error('KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다.')
  }

  const res = await fetch(
    `https://dapi.kakao.com/v3/search/book?query=${encodeURIComponent(isbn)}&target=isbn`,
    {
      headers: { Authorization: `KakaoAK ${apiKey}` },
      next: { revalidate: 86400 },
    }
  )

  if (!res.ok) {
    throw new Error(`카카오 API 오류: ${res.status}`)
  }

  const data: KakaoBookSearchResponse = await res.json()

  if (data.documents.length === 0) {
    return null
  }

  const doc = data.documents[0]
  return {
    title: doc.title,
    authors: doc.authors,
    publisher: doc.publisher,
    thumbnail: doc.thumbnail,
    isbn: doc.isbn,
    contents: doc.contents,
  }
}
