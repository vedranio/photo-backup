import { contextBridge, ipcRenderer } from 'electron'
import type { Api, BackupSnapshot } from '@shared/api'
import { IPC } from '@shared/ipc'

// The renderer's only way into the main process.
const api: Api = {
  config: {
    get: () => ipcRenderer.invoke(IPC.configGet),
    save: (input) => ipcRenderer.invoke(IPC.configSave, input),
    chooseLocalFolder: () => ipcRenderer.invoke(IPC.configChooseLocalFolder)
  },
  google: {
    signIn: (client) => ipcRenderer.invoke(IPC.googleSignIn, client)
  },
  backup: {
    getStatus: () => ipcRenderer.invoke(IPC.backupGetStatus),
    start: (request) => ipcRenderer.invoke(IPC.backupStart, request),
    pause: () => ipcRenderer.invoke(IPC.backupPause),
    resume: () => ipcRenderer.invoke(IPC.backupResume),
    retry: () => ipcRenderer.invoke(IPC.backupRetry),
    cancel: () => ipcRenderer.invoke(IPC.backupCancel),
    dismiss: () => ipcRenderer.invoke(IPC.backupDismiss),
    onUpdate: (listener) => {
      const handler = (_e: Electron.IpcRendererEvent, snapshot: BackupSnapshot): void =>
        listener(snapshot)
      ipcRenderer.on(IPC.backupUpdate, handler)
      return () => ipcRenderer.removeListener(IPC.backupUpdate, handler)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
