import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// 튜토리얼을 봤는지 (휴대폰마다 따로)
const KEY = 'ourcal.tutorial.done'

export function isTutorialDone() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return true // 저장소를 못 쓰면 매번 뜨지 않게
  }
}

export function markTutorialDone() {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* 무시 */
  }
}

// 커플 연결 후 처음 들어오면 튜토리얼로. 알림·공유로 바로 연 화면은 막지 않는다.
export function useFirstRunTutorial() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useEffect(() => {
    if (pathname === '/' && !isTutorialDone()) navigate('/tutorial', { replace: true })
    // 처음 한 번만 확인
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
