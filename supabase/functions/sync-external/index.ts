// 외부 캘린더(회사 일정) 동기화 (PLAN.md 2-5, 6장)
// (a) pg_cron 30분마다: x-cron-secret 인증 → 모든 캘린더
// (b) 앱 "지금 동기화": 사용자 JWT 인증 → 내 캘린더 (body.calendar_id 가 있으면 그것만)
// verify_jwt = false (인증은 함수 안에서 직접 한다)
import { admin, getConfig, userIdFromToken } from '../_shared/admin.ts'
import { bearer, corsHeaders, json, safeEqual } from '../_shared/http.ts'
import { seoulDateKey } from '../_shared/seoul.ts'
import { parseBusy } from './parse.ts'

const MAX_BYTES = 5 * 1024 * 1024
const FETCH_TIMEOUT_MS = 15_000
const PAST_DAYS = 30
const FUTURE_DAYS = 120

type Calendar = { id: string; user_id: string; ics_url: string }
type Result = { id: string; ok: boolean; count?: number; error?: string }

// 사용자에게 보여 줄 짧은 오류
class SyncError extends Error {}

// 내부망 주소로의 요청은 막는다 (사용자 입력 URL)
function checkUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw.trim().replace(/^webcal:\/\//i, 'https://'))
  } catch {
    throw new SyncError('주소 형식이 올바르지 않아요')
  }
  const host = url.hostname
  if (
    !/^https?:$/.test(url.protocol) ||
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) ||
    host.startsWith('[')
  ) {
    throw new SyncError('사용할 수 없는 주소예요')
  }
  return url
}

// 최대 5MB 까지 읽는다
async function download(url: URL): Promise<string> {
  let res: Response
  try {
    res = await fetch(url, {
      headers: { Accept: 'text/calendar, */*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch (e) {
    throw new SyncError((e as Error).name === 'TimeoutError' ? '응답이 너무 느려요' : '주소에 연결할 수 없어요')
  }
  if (!res.ok) {
    await res.body?.cancel()
    throw new SyncError(res.status === 404 ? '캘린더를 찾을 수 없어요 (주소 확인)' : `주소에 접근할 수 없어요 (HTTP ${res.status})`)
  }
  if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) {
    await res.body?.cancel()
    throw new SyncError('캘린더 파일이 너무 커요 (5MB 초과)')
  }
  const reader = res.body!.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BYTES) {
      await reader.cancel()
      throw new SyncError('캘린더 파일이 너무 커요 (5MB 초과)')
    }
    chunks.push(value)
  }
  const buf = new Uint8Array(size)
  let off = 0
  for (const c of chunks) {
    buf.set(c, off)
    off += c.byteLength
  }
  return new TextDecoder().decode(buf)
}

async function syncOne(cal: Calendar): Promise<Result> {
  try {
    const { data: owner, error: ownerError } = await admin
      .from('profiles')
      .select('couple_id')
      .eq('id', cal.user_id)
      .single()
    if (ownerError) throw ownerError

    const text = await download(checkUrl(cal.ics_url))
    if (!text.includes('BEGIN:VCALENDAR')) throw new SyncError('캘린더(ICS) 주소가 아니에요')

    const now = Date.now()
    let busy
    try {
      busy = parseBusy(
        text,
        seoulDateKey(new Date(now - PAST_DAYS * 86400_000)),
        seoulDateKey(new Date(now + FUTURE_DAYS * 86400_000)),
      )
    } catch (e) {
      console.error('ICS 해석 실패', cal.id, e)
      throw new SyncError('캘린더 내용을 읽을 수 없어요')
    }

    // 이 캘린더 분만 갈아끼운다 (제목은 저장하지 않는다)
    const { error: delError } = await admin.from('external_busy').delete().eq('calendar_id', cal.id)
    if (delError) throw delError
    const rows = busy.map((b) => ({ ...b, calendar_id: cal.id, user_id: cal.user_id, couple_id: owner.couple_id }))
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await admin.from('external_busy').insert(rows.slice(i, i + 500))
      if (error) throw error
    }

    await admin
      .from('external_calendars')
      .update({ last_synced_at: new Date().toISOString(), last_error: null })
      .eq('id', cal.id)
    return { id: cal.id, ok: true, count: rows.length }
  } catch (e) {
    const message = e instanceof SyncError ? e.message : '동기화 중 오류가 났어요'
    if (!(e instanceof SyncError)) console.error('sync 실패', cal.id, e)
    await admin.from('external_calendars').update({ last_error: message }).eq('id', cal.id)
    return { id: cal.id, ok: false, error: message }
  }
}

// 동시에 몇 개씩만 처리
async function syncAll(cals: Calendar[], concurrency = 4): Promise<Result[]> {
  const results: Result[] = []
  let i = 0
  const worker = async () => {
    while (i < cals.length) results.push(await syncOne(cals[i++]))
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, cals.length) }, worker))
  return results
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    let query = admin.from('external_calendars').select('id, user_id, ics_url')

    const cronSecret = req.headers.get('x-cron-secret')
    if (cronSecret) {
      const c = await getConfig()
      if (!safeEqual(cronSecret, c.cron_secret)) return json({ error: 'unauthorized' }, 401)
    } else {
      const userId = await userIdFromToken(bearer(req))
      if (!userId) return json({ error: 'unauthorized' }, 401)
      const body = await req.json().catch(() => ({}))
      query = query.eq('user_id', userId)
      if (typeof body?.calendar_id === 'string') query = query.eq('id', body.calendar_id)
    }

    const { data, error } = await query
    if (error) throw error
    const results = await syncAll((data ?? []) as Calendar[])
    if (cronSecret) console.log(`sync-external cron: ${results.filter((r) => r.ok).length}/${results.length} 성공`)
    return json({ results })
  } catch (e) {
    console.error('sync-external 오류', e)
    return json({ error: (e as Error).message }, 500)
  }
})
