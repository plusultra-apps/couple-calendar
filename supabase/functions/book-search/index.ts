// 책 검색 (카카오 책 검색 API 대행)
// POST { query, page? } → { books: Book[], end: boolean }
// 카카오 REST 키는 app_config.kakao_rest_key 에 두고 브라우저에 노출하지 않는다 (장소 검색과 같은 키).
// verify_jwt = false (로그인 사용자만 쓰도록 함수 안에서 JWT 확인)
import { getConfig, userIdFromToken } from '../_shared/admin.ts'
import { bearer, corsHeaders, json } from '../_shared/http.ts'

type KakaoBook = {
  title: string
  authors: string[]
  publisher: string
  thumbnail: string
  isbn: string // "10자리 13자리" 공백 구분
  datetime: string
  url: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const userId = await userIdFromToken(bearer(req))
  if (!userId) return json({ error: 'unauthorized' }, 401)

  let body: { query?: string; page?: number }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  const query = (body.query ?? '').trim().slice(0, 100)
  if (!query) return json({ books: [], end: true })
  const page = Math.min(50, Math.max(1, Math.floor(body.page ?? 1)))

  const key = (await getConfig()).kakao_rest_key
  if (!key) return json({ error: 'kakao_key_missing' }, 503)

  const params = new URLSearchParams({ query, size: '15', page: String(page) })
  const res = await fetch(`https://dapi.kakao.com/v3/search/book?${params}`, {
    headers: { Authorization: `KakaoAK ${key}` },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) {
    console.error('kakao 책 검색 실패', res.status, await res.text())
    return json({ error: res.status === 401 || res.status === 403 ? 'kakao_key_invalid' : 'kakao_error' }, 502)
  }
  const data = (await res.json()) as { documents: KakaoBook[]; meta: { is_end: boolean } }

  return json({
    end: data.meta.is_end,
    books: data.documents.map((d) => {
      // isbn 은 "10자리 13자리" 형태. 13자리가 있으면 그걸, 없으면 10자리, 둘 다 없으면 카카오 주소로 구분한다.
      const parts = d.isbn.split(' ').filter(Boolean)
      const isbn = parts.find((p) => p.length === 13) ?? parts[0] ?? d.url
      return {
        isbn,
        title: d.title,
        authors: d.authors.join(', '),
        publisher: d.publisher,
        thumbnail: d.thumbnail,
        year: d.datetime ? d.datetime.slice(0, 4) : '',
      }
    }),
  })
})
