import type { ReactNode } from 'react'
import { Drawer } from 'vaul'

// 아래에서 올라오는 시트. 아래로 끌어내려 닫을 수 있다.
// handleOnly: 입력 폼처럼 내용을 스크롤·입력하다 실수로 닫히면 안 되는 시트는 맨 위 손잡이로만 끌어 닫는다.
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  footer,
  handleOnly = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  handleOnly?: boolean
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} handleOnly={handleOnly}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/25" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] max-w-md flex-col rounded-t-[32px] border-t-2 border-line bg-surface outline-none">
          {handleOnly ? (
            <Drawer.Handle className="!mx-auto !mt-3 !mb-0 !h-2 !w-12 shrink-0 !rounded-full !bg-partner/60 !opacity-100" />
          ) : (
            <div className="mx-auto mt-3 h-2 w-12 shrink-0 rounded-full bg-partner/60" />
          )}
          <Drawer.Title className="px-5 pt-3 pb-2 text-xl">{title}</Drawer.Title>
          <Drawer.Description className="sr-only">상세 시트</Drawer.Description>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
          {footer && <div className="shrink-0 px-5 pt-2 pb-[calc(env(safe-area-inset-bottom)+1rem)]">{footer}</div>}
          {!footer && <div className="h-[env(safe-area-inset-bottom)] shrink-0" />}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
