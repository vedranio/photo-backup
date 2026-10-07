// Infers {name} and {surname} for folder naming from the user signed into the machine.
import { execFileSync } from 'child_process'
import os from 'os'
import type { Identity } from '@shared/api'
import { identityFromFullName } from '@shared/pattern'

function run(cmd: string, args: string[]): string {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', timeout: 3000 }).trim()
  } catch {
    return ''
  }
}

function fullName(username: string): string {
  switch (process.platform) {
    case 'darwin':
      return run('id', ['-F'])
    case 'linux':
      // GECOS: "Full Name,room,phone,…"
      return run('getent', ['passwd', username]).split(':')[4]?.split(',')[0] ?? ''
    case 'win32':
      return run('powershell', [
        '-NoProfile',
        '-Command',
        'Add-Type -AssemblyName System.DirectoryServices.AccountManagement; [System.DirectoryServices.AccountManagement.UserPrincipal]::Current.DisplayName'
      ])
    default:
      return ''
  }
}

let cached: Identity | undefined

export function machineIdentity(): Identity {
  if (!cached) {
    const username = os.userInfo().username
    cached = identityFromFullName(fullName(username), username)
  }
  return cached
}
