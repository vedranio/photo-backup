import { safeStorage } from 'electron'

/** Encrypts credentials at rest. They never leave the main process. */
export interface SecretBox {
  available(): boolean
  encrypt(plain: string): string
  decrypt(stored: string): string
}

export const safeStorageBox: SecretBox = {
  available: () => safeStorage.isEncryptionAvailable(),
  encrypt: (plain) => safeStorage.encryptString(plain).toString('base64'),
  decrypt: (stored) => safeStorage.decryptString(Buffer.from(stored, 'base64'))
}
