import type { Api } from '../shared/api'

declare global {
  interface Window {
    /** Undefined outside Electron (e.g. modelwright's browser preview); the renderer then uses its dev mock. */
    api?: Api
  }
}
