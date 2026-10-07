import type { Api } from '@shared/api'
import { getForcedState } from './dev/stateOverride'

/** The preload bridge in Electron; in a plain browser (dev only), the mock bridge. */
export async function loadApi(): Promise<Api> {
  if (window.api) return window.api
  if (import.meta.env.DEV) {
    const [{ createMockApi }, { placeholderConfig, placeholderSnapshot }] = await Promise.all([
      import('./dev/mockApi'),
      import('./dev/placeholders')
    ])
    const forced = getForcedState()
    // Seed the mock with the forced state's data, so actions carry on from what's shown.
    return createMockApi({
      config: placeholderConfig(forced !== null),
      snapshot: placeholderSnapshot(forced ?? 'st_fsjlc5tb')
    })
  }
  throw new Error('The photobackup bridge is unavailable')
}
