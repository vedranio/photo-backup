// Ids from .design/flows.json, and where each screen lives.
import type { JobStatus } from '@shared/api'

export const ROUTES = {
  splash: '/splash',
  home: '/home',
  settings: '/settings',
  confirmCancel: '/confirm-cancel'
} as const

export const STATES = {
  splash: 'st_ki442ws8',
  homeDefault: 'st_fsjlc5tb',
  homeInProgress: 'st_5ttst55w',
  homeSuccessful: 'st_uh8cvm18',
  homeFailed: 'st_vublspne',
  homePaused: 'st_vuryip8b',
  settings: 'st_ttcugo7w',
  confirmCancel: 'st_fjos0gua'
} as const

export type StateId = (typeof STATES)[keyof typeof STATES]

export const STATE_ROUTE: Record<StateId, string> = {
  [STATES.splash]: ROUTES.splash,
  [STATES.homeDefault]: ROUTES.home,
  [STATES.homeInProgress]: ROUTES.home,
  [STATES.homeSuccessful]: ROUTES.home,
  [STATES.homeFailed]: ROUTES.home,
  [STATES.homePaused]: ROUTES.home,
  [STATES.settings]: ROUTES.settings,
  [STATES.confirmCancel]: ROUTES.confirmCancel
}

export const isStateId = (id: string): id is StateId => id in STATE_ROUTE

export type HomeStateId =
  | typeof STATES.homeDefault
  | typeof STATES.homeInProgress
  | typeof STATES.homeSuccessful
  | typeof STATES.homeFailed
  | typeof STATES.homePaused

/** Home's state comes from the backup job's status. */
export const HOME_STATE_FOR: Record<JobStatus, HomeStateId> = {
  idle: STATES.homeDefault,
  running: STATES.homeInProgress,
  succeeded: STATES.homeSuccessful,
  failed: STATES.homeFailed,
  paused: STATES.homePaused
}
