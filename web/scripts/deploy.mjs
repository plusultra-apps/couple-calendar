// Vercel 배포 스크립트: node scripts/deploy.mjs
// 처음 한 번 `npx vercel login` 으로 로그인해 두어야 한다.
// .env.local 의 공개 값(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_VAPID_PUBLIC_KEY)만 빌드 환경변수로 넘긴다.
// VITE_DEV_PASSWORD 같은 개발용 값은 넘기지 않는다.
// 배포 성공 후 매번 사용자들에게 업데이트 소식 알림을 보낸다 (--notes "바뀐 점" 으로 문구, --quiet 로 생략 — 아래).
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const PUBLIC_KEYS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_VAPID_PUBLIC_KEY', 'VITE_KAKAO_JS_KEY']
const PROJECT = 'ourcal'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)

// PC 이름이 한글이면 Vercel CLI 가 HTTP 헤더 오류로 멈춘다 → CLI 안에서만 영어 이름으로 보이게
const hostFix = fileURLToPath(new URL('./ascii-host.cjs', import.meta.url)).replaceAll('\\', '/')
process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} --require "${hostFix}"`.trim()

const run = (args) => {
  console.log(`\n$ npx vercel ${args.join(' ')}`)
  const r = spawnSync('npx', ['--yes', 'vercel', ...args], { stdio: 'inherit', shell: true })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

if (!existsSync('.vercel/project.json')) run(['link', '--yes', '--project', PROJECT])

const buildEnv = PUBLIC_KEYS.filter((k) => env[k]).flatMap((k) => ['--build-env', `${k}=${env[k]}`])
run(['deploy', '--prod', '--yes', ...buildEnv])

// 업데이트 소식 알림: 배포가 성공하면 매번, 커플이 있는 모든 사용자에게 보낸다(각자 알림 설정·조용한 시간을 따른다).
//   npm run deploy                      → 기본 문구
//   npm run deploy -- --notes "바뀐 점"  → 그 문구로
//   npm run deploy -- --quiet           → 보내지 않음 (바로 다시 고친 배포 등)
const i = process.argv.indexOf('--notes')
const notes = (i > -1 ? process.argv[i + 1]?.trim() : '') || '자잘한 부분을 다듬었어요'
if (process.argv.includes('--quiet')) {
  console.log('\n(--quiet: 업데이트 알림 보내지 않음)')
} else {
  if (!env.RELEASE_SECRET) {
    console.error('\n⚠ .env.local 에 RELEASE_SECRET 이 없어 업데이트 알림을 보내지 못했어요')
    process.exit(1)
  }
  const res = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-release-secret': env.RELEASE_SECRET },
    body: JSON.stringify({ notes }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error(`\n⚠ 업데이트 알림 실패 (${res.status})`, body)
    process.exit(1)
  }
  console.log(`\n🆕 업데이트 알림 "${notes}": ${body.total}명 중 ${body.sent}명에게 바로 보냄 (나머지는 꺼 둠·조용한 시간 → 알림함/아침에)`)
}
