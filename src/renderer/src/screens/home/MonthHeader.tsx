import type { BackupSnapshot } from '@shared/api'
import { AppHeader } from '../../components/AppHeader'
import { formatMonth } from '../../format'

/** The header during and after a backup, naming the month being backed up. */
export function MonthHeader({ snapshot }: { snapshot: BackupSnapshot }): React.JSX.Element {
  return (
    <AppHeader>
      <span className="eyebrow">{formatMonth(snapshot.month)}</span>
    </AppHeader>
  )
}
