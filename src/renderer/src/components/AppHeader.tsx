import type { ReactNode } from 'react'

/** The red dot and engraved wordmark, with an optional item on the right. */
export function AppHeader({ children }: { children?: ReactNode }): React.JSX.Element {
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-dot" aria-hidden="true" />
        <h1>photobackup</h1>
      </div>
      {children}
    </header>
  )
}
