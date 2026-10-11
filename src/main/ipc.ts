import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { BackupRequest, GoogleClient, SettingsInput, SignInResult } from '@shared/api'
import { IPC } from '@shared/ipc'
import { validateGoogleClient, type ConfigService } from './config/service'
import type { BackupJob } from './backup/job'
import { missingGoogleEnv, signInWithGoogle } from './google/oauth'
import type { GoogleInfo } from './google/info'

export function registerIpc(config: ConfigService, job: BackupJob, googleInfo: GoogleInfo): void {
  ipcMain.handle(IPC.configGet, () =>
    googleInfo.decorate(config.getView(), config.getBackupConfig())
  )
  ipcMain.handle(IPC.configSave, (_e, input: SettingsInput) => config.save(input))
  ipcMain.handle(IPC.configChooseLocalFolder, async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const options: Electron.OpenDialogOptions = { properties: ['openDirectory', 'createDirectory'] }
    const res = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    return res.canceled ? null : (res.filePaths[0] ?? null)
  })

  ipcMain.handle(IPC.googleSignIn, async (_e, client?: GoogleClient): Promise<SignInResult> => {
    try {
      if (client) {
        const invalid = validateGoogleClient(client).googleClient
        if (invalid) return { ok: false, error: invalid }
        config.setGoogleClient(client)
      }
      const env = config.googleClient()
      if (missingGoogleEnv(env).length) {
        return { ok: false, error: 'Enter the Google OAuth client ID and secret first' }
      }
      config.setGoogleRefreshToken(await signInWithGoogle(env, (url) => shell.openExternal(url)))
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC.backupGetStatus, () => job.snapshot())
  ipcMain.handle(IPC.backupStart, (_e, request: BackupRequest) => job.start(request))
  ipcMain.handle(IPC.backupPause, () => job.pause())
  ipcMain.handle(IPC.backupResume, () => job.resume())
  ipcMain.handle(IPC.backupRetry, () => job.retry())
  ipcMain.handle(IPC.backupCancel, () => job.cancel())
  ipcMain.handle(IPC.backupDismiss, () => job.dismiss())

  job.onUpdate((snapshot) => {
    for (const win of BrowserWindow.getAllWindows())
      win.webContents.send(IPC.backupUpdate, snapshot)
  })
}
