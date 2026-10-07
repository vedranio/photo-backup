import { app, shell, BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { openDb } from './db'
import { safeStorageBox } from './secrets'
import { ConfigService } from './config/service'
import { machineIdentity } from './user/identity'
import { authorisedClient, readGoogleEnv } from './google/oauth'
import { createDriveApi } from './google/drive'
import { uploadFile } from './aws/upload'
import { BackupJob } from './backup/job'
import { createPlanner, removeStaleStaging } from './backup/plan'
import { registerIpc } from './ipc'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 760,
    height: 640,
    show: false,
    autoHideMenuBar: true,
    title: 'photobackup',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/**
 * Local settings such as GOOGLE_OAUTH_CLIENT_ID, from `.env` files: the project root's in development, and
 * `<userData>/.env` always. Variables already set in the shell win.
 */
function loadEnvFiles(): void {
  const files = [
    ...(is.dev ? [join(app.getAppPath(), '.env')] : []),
    join(app.getPath('userData'), '.env')
  ]
  for (const file of files) {
    if (existsSync(file)) process.loadEnvFile(file)
  }
}

function startServices(): void {
  loadEnvFiles()
  const migrationsFolder = app.isPackaged
    ? join(process.resourcesPath, 'drizzle')
    : join(app.getAppPath(), 'drizzle')
  const db = openDb(join(app.getPath('userData'), 'photobackup.db'), migrationsFolder, {
    localFolder: app.getPath('pictures')
  })
  // Leftovers from a backup interrupted by quitting or a crash. Doesn't hold up startup.
  removeStaleStaging(app.getPath('temp'))
    .then(
      (removed) =>
        removed.length && console.log(`Removed stale backup files: ${removed.join(', ')}`)
    )
    .catch((err) => console.warn('Couldn’t remove stale backup files:', err))
  const googleEnv = (): ReturnType<typeof readGoogleEnv> => readGoogleEnv()
  const config = new ConfigService(db, safeStorageBox, googleEnv, machineIdentity)
  const job = new BackupJob(
    createPlanner({
      config: () => config.getBackupConfig(),
      drive: (refreshToken) => createDriveApi(authorisedClient(googleEnv(), refreshToken)),
      upload: uploadFile,
      trashLocal: (file) => shell.trashItem(file),
      tmpDir: app.getPath('temp')
    })
  )
  registerIpc(config, job, googleEnv)
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.photobackup.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  startServices()
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
