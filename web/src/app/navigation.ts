import { useLocation, useNavigate } from 'react-router-dom'

// 앱 안에서 이전 화면이 있으면 뒤로, 없으면(새로고침·알림·공유 링크로 바로 열린 경우) fallback 으로 이동한다.
// react-router 는 앱 안에서 이동한 적 없는 첫 화면의 location.key 를 'default' 로 둔다.
export function useGoBack() {
  const navigate = useNavigate()
  const location = useLocation()
  return (fallback: string = '/') => {
    if (location.key === 'default') navigate(fallback, { replace: true })
    else navigate(-1)
  }
}
