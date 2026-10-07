export const IPC = {
  configGet: 'config:get',
  configSave: 'config:save',
  configChooseLocalFolder: 'config:choose-local-folder',
  googleSignIn: 'google:sign-in',
  backupGetStatus: 'backup:get-status',
  backupStart: 'backup:start',
  backupPause: 'backup:pause',
  backupResume: 'backup:resume',
  backupRetry: 'backup:retry',
  backupCancel: 'backup:cancel',
  backupDismiss: 'backup:dismiss',
  backupUpdate: 'backup:update'
} as const
