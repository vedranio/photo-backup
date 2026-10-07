import { useEffect, useId, useRef, type ReactNode } from 'react'

interface Props {
  title: string
  /** Esc: the modal's non-destructive way out. */
  onDismiss(): void
  children: ReactNode
}

/** A native modal <dialog>: focus is trapped inside and the page behind is inert. */
export function Modal({ title, onDismiss, children }: Props): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => dialog?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onDismiss()
      }}
    >
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  )
}
