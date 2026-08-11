import type { ReactNode } from 'react'

interface ModalProps {
  children: ReactNode
  onClose?: () => void
  className?: string
}

export default function Modal({ children, className = '', onClose }: ModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100]"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose()
      }}
    >
      <div
        className={[
          'bg-bg-card rounded-xl p-6 min-w-80 max-w-[500px] flex flex-col gap-3',
          className,
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  )
}

function ModalActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 mt-2">
      {children}
    </div>
  )
}

Modal.Actions = ModalActions
