import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import type { SettingsField, SettingsInput } from '@shared/api'
import { STORAGE_CLASSES } from '@shared/storageClass'
import { useAppState } from '../AppState'
import { ROUTES } from '../design'
import { Modal } from '../components/Modal'

type Errors = Partial<Record<SettingsField, string>>

/** Settings › Default (st_ttcugo7w): a modal over Home. */
export function Settings(): React.JSX.Element | null {
  const { loaded, config } = useAppState()
  if (!loaded || !config) return null
  return <SettingsForm />
}

function SettingsForm(): React.JSX.Element {
  const { config, act, reloadConfig } = useAppState()
  const navigate = useNavigate()
  const local = config!.sources.find((s) => s.type === 'local')
  const remote = config!.sources.find((s) => s.type === 'remote')

  const [values, setValues] = useState({
    googleDriveLocation: remote?.location ?? '',
    awsLocation: config!.destination.location,
    localFolder: local?.location ?? '',
    folderNamingPattern: config!.folderNamingPattern,
    storageClass: config!.destination.storageClass,
    accessKeyId: config!.destination.accessKeyId,
    secretAccessKey: '',
    googleClientId: '',
    googleClientSecret: ''
  })
  // The saved secret stays in the main process; until it's edited, the field shows a mask of its length.
  const [secretEdited, setSecretEdited] = useState(false)
  const secretMask = '*'.repeat(config!.destination.secretAccessKeyLength)
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [signInError, setSignInError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)

  const set = (field: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [field]: e.target.value }))

  const { name, surname } = config!.identity

  // Exit without saving (cta_opt505gl) → Home › Default
  const exit = (): Promise<void> => act(async () => navigate(ROUTES.home))

  // Save (cta_ejautwuw, primary) → Home › Default
  const save = (e: FormEvent): Promise<void> => {
    e.preventDefault()
    return act(async (api) => {
      setSaving(true)
      const input: SettingsInput = {
        googleDriveLocation: values.googleDriveLocation,
        awsLocation: values.awsLocation,
        localFolder: values.localFolder,
        folderNamingPattern: values.folderNamingPattern,
        storageClass: values.storageClass,
        awsAccessKeyId: values.accessKeyId,
        ...(secretEdited && { awsSecretAccessKey: values.secretAccessKey }),
        ...(googleClientEntered && { googleClient: typedGoogleClient })
      }
      try {
        const result = await api.config.save(input)
        if (!result.ok) {
          setErrors(result.errors)
          return
        }
        await reloadConfig()
        navigate(ROUTES.home)
      } finally {
        setSaving(false)
      }
    })
  }

  // First-time setup: the OAuth client is typed here, then saved when signing in (or on Save).
  const typedGoogleClient = {
    clientId: values.googleClientId.trim(),
    clientSecret: values.googleClientSecret.trim()
  }
  const googleClientEntered = !!(typedGoogleClient.clientId || typedGoogleClient.clientSecret)

  const signIn = (): Promise<void> =>
    act(async (api) => {
      setSigningIn(true)
      setSignInError(null)
      try {
        const result = await api.google.signIn(
          config!.google.clientConfigured ? undefined : typedGoogleClient
        )
        if (result.ok) await reloadConfig()
        else setSignInError(result.error)
      } finally {
        setSigningIn(false)
      }
    })

  const browse = (): Promise<void> =>
    act(async (api) => {
      const folder = await api.config.chooseLocalFolder()
      if (folder) setValues((v) => ({ ...v, localFolder: folder }))
    })

  const google = config!.google
  const describedBy = (field: SettingsField, hint?: string): string | undefined =>
    [hint, errors[field] && `${field}-error`].filter(Boolean).join(' ') || undefined
  const errorFor = (field: SettingsField): React.JSX.Element | null =>
    errors[field] ? (
      <p id={`${field}-error`} className="field-error">
        {errors[field]}
      </p>
    ) : null

  return (
    <Modal title="Settings" onDismiss={exit}>
      <form className="settings" onSubmit={save} noValidate>
        <div className="settings-grid">
          <section className="settings-section" aria-labelledby="settings-source">
            <h3 id="settings-source" className="section-title">
              Source
            </h3>

            <div className="field-stack">
              {/* Google drive credentials */}
              <fieldset className="field-group">
                <legend className="label-xs">Google drive credentials</legend>
                {!google.clientConfigured ? (
                  <>
                    <div className="pair">
                      <div className="field-tight">
                        <label htmlFor="googleClientId" className="sub-label">
                          Client ID
                        </label>
                        <input
                          id="googleClientId"
                          autoComplete="off"
                          spellCheck={false}
                          placeholder="From Google Cloud"
                          value={values.googleClientId}
                          onChange={set('googleClientId')}
                          aria-invalid={!!errors.googleClient}
                          aria-describedby={describedBy('googleClient')}
                        />
                      </div>
                      <div className="field-tight">
                        <label htmlFor="googleClientSecret" className="sub-label">
                          Client secret
                        </label>
                        <input
                          id="googleClientSecret"
                          type="password"
                          autoComplete="new-password"
                          value={values.googleClientSecret}
                          onChange={set('googleClientSecret')}
                          aria-invalid={!!errors.googleClient}
                          aria-describedby={describedBy('googleClient')}
                        />
                      </div>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="btn small"
                        onClick={signIn}
                        disabled={
                          signingIn ||
                          !typedGoogleClient.clientId ||
                          !typedGoogleClient.clientSecret
                        }
                      >
                        {signingIn ? 'Waiting for Google…' : 'Sign in with Google'}
                      </button>
                    </div>
                    {errorFor('googleClient')}
                  </>
                ) : (
                  <div className="with-button">
                    <div className="field-tight">
                      <label htmlFor="googleAccount" className="sub-label">
                        Signed in as
                      </label>
                      <input
                        id="googleAccount"
                        readOnly
                        value={google.signedIn ? (google.accountName ?? 'Google account') : ''}
                        placeholder="Not signed in"
                      />
                    </div>
                    <button
                      type="button"
                      className="btn small"
                      onClick={signIn}
                      disabled={signingIn}
                    >
                      {signingIn
                        ? 'Waiting for Google…'
                        : google.signedIn
                          ? 'Sign in again'
                          : 'Sign in with Google'}
                    </button>
                  </div>
                )}
                {signInError && (
                  <p role="alert" className="field-error">
                    {signInError}
                  </p>
                )}
              </fieldset>

              {/* Default Google drive location */}
              <div className="field">
                <label htmlFor="googleDriveLocation" className="label-xs">
                  Default Google drive location
                </label>
                <input
                  id="googleDriveLocation"
                  placeholder="https://drive.google.com/drive/folders/…"
                  spellCheck={false}
                  value={values.googleDriveLocation}
                  onChange={set('googleDriveLocation')}
                  aria-invalid={!!errors.googleDriveLocation}
                  aria-describedby={describedBy('googleDriveLocation')}
                />
                {errorFor('googleDriveLocation')}
              </div>
            </div>

            {/* Default local folder */}
            <div className="field">
              <label htmlFor="localFolder" className="label-xs">
                Default local folder
              </label>
              <div className="with-button">
                <input
                  id="localFolder"
                  spellCheck={false}
                  value={values.localFolder}
                  onChange={set('localFolder')}
                  aria-invalid={!!errors.localFolder}
                  aria-describedby={describedBy('localFolder')}
                />
                <button type="button" className="btn small" onClick={browse}>
                  Browse…
                </button>
              </div>
              {errorFor('localFolder')}
            </div>
          </section>

          <section className="settings-section" aria-labelledby="settings-destination">
            <h3 id="settings-destination" className="section-title">
              Destination
            </h3>

            <div className="field-stack">
              {/* AWS credentials */}
              <fieldset className="field-group">
                <legend className="label-xs">AWS credentials</legend>
                <div className="pair">
                  <div className="field-tight">
                    <label htmlFor="accessKeyId" className="sub-label">
                      Access key ID
                    </label>
                    <input
                      id="accessKeyId"
                      autoComplete="off"
                      spellCheck={false}
                      value={values.accessKeyId}
                      onChange={set('accessKeyId')}
                      aria-invalid={!!errors.awsAccessKeyId}
                      aria-describedby={describedBy('awsAccessKeyId')}
                    />
                  </div>
                  <div className="field-tight">
                    <label htmlFor="secretAccessKey" className="sub-label">
                      Secret access key
                    </label>
                    <input
                      id="secretAccessKey"
                      type="password"
                      autoComplete="new-password"
                      value={secretEdited ? values.secretAccessKey : secretMask}
                      // Typing replaces the masked secret rather than editing the mask.
                      onFocus={(e) => !secretEdited && e.target.select()}
                      onChange={(e) => {
                        // AWS secrets never contain "*", so anything left of the mask is dropped.
                        const value = secretEdited
                          ? e.target.value
                          : e.target.value.replace(/\*/g, '')
                        setSecretEdited(true)
                        setValues((v) => ({ ...v, secretAccessKey: value }))
                      }}
                      aria-invalid={!!errors.awsSecretAccessKey}
                      aria-describedby={describedBy('awsSecretAccessKey')}
                    />
                  </div>
                </div>
                {errorFor('awsAccessKeyId')}
                {errorFor('awsSecretAccessKey')}
              </fieldset>

              {/* Default AWS location */}
              <div className="field">
                <label htmlFor="awsLocation" className="label-xs">
                  Default AWS location
                </label>
                <input
                  id="awsLocation"
                  placeholder="https://my-bucket.s3.eu-west-2.amazonaws.com/photos"
                  spellCheck={false}
                  value={values.awsLocation}
                  onChange={set('awsLocation')}
                  aria-invalid={!!errors.awsLocation}
                  aria-describedby={describedBy('awsLocation')}
                />
                {errorFor('awsLocation')}
              </div>

              {/* AWS storage class */}
              <div className="field">
                <label htmlFor="storageClass" className="label-xs">
                  AWS storage class
                </label>
                <select
                  id="storageClass"
                  value={values.storageClass}
                  onChange={set('storageClass')}
                  aria-invalid={!!errors.storageClass}
                  aria-describedby={describedBy('storageClass')}
                >
                  {STORAGE_CLASSES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {errorFor('storageClass')}
              </div>
            </div>

            {/* Folder naming convention */}
            <div className="field">
              <label htmlFor="folderNamingPattern" className="label-xs">
                Folder naming convention
              </label>
              <input
                id="folderNamingPattern"
                spellCheck={false}
                value={values.folderNamingPattern}
                onChange={set('folderNamingPattern')}
                aria-invalid={!!errors.folderNamingPattern}
                aria-describedby={describedBy('folderNamingPattern', 'pattern-hint')}
              />
              <p id="pattern-hint" className="hint">
                {surname
                  ? `Name (${name}) and surname (${surname}) are sourced from the logged in user.`
                  : `Name (${name}) is sourced from the logged in user; no surname was found.`}{' '}
                Year and month come from the backup month you choose.
              </p>
              {errorFor('folderNamingPattern')}
            </div>
          </section>
        </div>

        <div className="settings-footer">
          <button type="submit" className="btn primary" disabled={saving}>
            Save
          </button>
          <button type="button" className="btn" onClick={exit}>
            Exit without saving
          </button>
        </div>
      </form>
    </Modal>
  )
}
