// Google sign-in for a desktop app: system browser + loopback redirect + PKCE.
import http from 'http'
import type { AddressInfo } from 'net'
import { randomBytes } from 'crypto'
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library'

export const GOOGLE_ENV = {
  clientId: 'GOOGLE_OAUTH_CLIENT_ID',
  clientSecret: 'GOOGLE_OAUTH_CLIENT_SECRET'
} as const

// Listing, downloading and (for "Clean up after backup") trashing files needs full Drive scope.
const SCOPES = ['https://www.googleapis.com/auth/drive']
const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000
// modelwright's ports; never listen on them.
const RESERVED_PORTS = new Set([4300, 4301])

export interface GoogleClientEnv {
  clientId?: string
  clientSecret?: string
}

export function readGoogleEnv(env: NodeJS.ProcessEnv = process.env): GoogleClientEnv {
  return {
    clientId: env[GOOGLE_ENV.clientId] || undefined,
    clientSecret: env[GOOGLE_ENV.clientSecret] || undefined
  }
}

export function missingGoogleEnv(env: GoogleClientEnv): string[] {
  const missing: string[] = []
  if (!env.clientId) missing.push(GOOGLE_ENV.clientId)
  if (!env.clientSecret) missing.push(GOOGLE_ENV.clientSecret)
  return missing
}

export function authorisedClient(env: GoogleClientEnv, refreshToken: string): OAuth2Client {
  const client = new OAuth2Client({ clientId: env.clientId, clientSecret: env.clientSecret })
  client.setCredentials({ refresh_token: refreshToken })
  return client
}

async function listenOnLoopback(server: http.Server): Promise<number> {
  for (;;) {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => resolve())
    })
    const { port } = server.address() as AddressInfo
    if (!RESERVED_PORTS.has(port)) return port
    await new Promise((resolve) => server.close(resolve))
  }
}

/** Runs the sign-in flow and resolves with a refresh token. */
export async function signInWithGoogle(
  env: GoogleClientEnv,
  openBrowser: (url: string) => Promise<void>
): Promise<string> {
  const server = http.createServer()
  try {
    const port = await listenOnLoopback(server)
    const redirectUri = `http://127.0.0.1:${port}`
    const client = new OAuth2Client({
      clientId: env.clientId,
      clientSecret: env.clientSecret,
      redirectUri
    })
    const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync()
    const state = randomBytes(16).toString('hex')

    const code = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Google sign-in timed out')),
        SIGN_IN_TIMEOUT_MS
      )
      server.on('request', (req, res) => {
        const params = new URL(req.url ?? '/', redirectUri).searchParams
        if (params.get('state') !== state) {
          res.writeHead(400).end()
          return
        }
        const error = params.get('error')
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(
          `<!doctype html><title>photobackup</title><p>${error ? 'Sign-in was cancelled.' : 'Signed in. You can close this tab and return to photobackup.'}</p>`
        )
        clearTimeout(timer)
        if (error) reject(new Error(`Google sign-in failed: ${error}`))
        else resolve(params.get('code') ?? '')
      })
    })

    await openBrowser(
      client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: SCOPES,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: CodeChallengeMethod.S256
      })
    )
    const { tokens } = await client.getToken({ code: await code, codeVerifier })
    if (!tokens.refresh_token) throw new Error('Google did not return a refresh token')
    return tokens.refresh_token
  } finally {
    server.close()
  }
}
