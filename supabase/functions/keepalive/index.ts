// 무료 플랜 일시 정지 방지: 매일 cron 이 부른다 (x-cron-secret 인증, verify_jwt = false)
// 앱과 무관한 public.keepalive 표에만 임시 데이터 한 줄을 넣고 30일 지난 줄은 지운다. 사용자 데이터는 건드리지 않는다.
import { admin, getConfig } from '../_shared/admin.ts'
import { json, safeEqual } from '../_shared/http.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  try {
    const c = await getConfig()
    if (!safeEqual(req.headers.get('x-cron-secret'), c.cron_secret)) return json({ error: 'unauthorized' }, 401)

    const { error: insErr } = await admin.from('keepalive').insert({ note: 'mock' })
    if (insErr) throw insErr
    const { error: delErr } = await admin
      .from('keepalive')
      .delete()
      .lt('pinged_at', new Date(Date.now() - 30 * 86_400_000).toISOString())
    if (delErr) throw delErr
    const { count, error: cntErr } = await admin.from('keepalive').select('id', { count: 'exact', head: true })
    if (cntErr) throw cntErr

    console.log(`keepalive: ${count}줄`)
    return json({ ok: true, rows: count })
  } catch (e) {
    console.error('keepalive 오류', e)
    return json({ error: (e as Error).message }, 500)
  }
})
