import { useAppState } from '../../AppState'
import { HOME_STATE_FOR, STATES, type HomeStateId } from '../../design'
import { DefaultState } from './DefaultState'
import { InProgressState } from './InProgressState'
import { SuccessfulState } from './SuccessfulState'
import { FailedState } from './FailedState'
import { PausedState } from './PausedState'

const HOME_STATES = new Set<string>([
  STATES.homeDefault,
  STATES.homeInProgress,
  STATES.homeSuccessful,
  STATES.homeFailed,
  STATES.homePaused
])

/** Home (scr_6lfsw3cs). Its state follows the backup job; a dev `?state=` override wins. */
export function Home(): React.JSX.Element | null {
  const { loaded, snapshot, forced } = useAppState()
  if (!loaded || !snapshot) return null
  const state: HomeStateId =
    forced && HOME_STATES.has(forced) ? (forced as HomeStateId) : HOME_STATE_FOR[snapshot.status]

  return (
    <main className="screen">
      {state === STATES.homeDefault && <DefaultState />}
      {state === STATES.homeInProgress && <InProgressState snapshot={snapshot} />}
      {state === STATES.homeSuccessful && <SuccessfulState snapshot={snapshot} />}
      {state === STATES.homeFailed && <FailedState snapshot={snapshot} />}
      {state === STATES.homePaused && <PausedState snapshot={snapshot} />}
    </main>
  )
}
