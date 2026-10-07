# photobackup

A desktop app that backs up a month's photos from a local folder and Google Drive to AWS S3, as a single zip
file per month.

Each backup downloads the Drive photos, zips them together with the local folder's contents, and uploads the
zip to your S3 bucket, by default in the Glacier Deep Archive storage class. Optionally, it then moves the
originals to the trash.

Built with Electron, React and TypeScript.

## Using the app

### Backing up

1. **Select items to back up:** tick **Local folder** and/or **Google Drive**. Their locations come from
   Settings, and an item can only be ticked once it's set up.
2. **Set backup month:** defaults to last month (backups usually run at the start of the next month). The
   month names the zip.
3. Click **Back up**.
4. Optionally tick **Clean up after backup** to move the backed-up files to the trash once the upload has
   succeeded. Local files go to the macOS Trash, and Drive files to Drive's trash. Nothing is permanently
   deleted.

While it runs, each stage shows its progress: _Downloading from Google Drive_ → _Compressing_ →
_Uploading to AWS_ → _Cleaning up_. You can **Pause backup** and resume, or **Cancel backup**. If a backup
fails, the error is shown and **Retry** carries on from the stage that failed.

### Naming

The zip is named by the **Folder naming convention** in Settings, for example
`{surname}-photos-{yyyy}-{MM}-{name}`. With a backup month of September 2026, that gives
`arnautovic-photos-2026-09-vedran.zip`.

| Token                 | Value                                                                         |
| --------------------- | ----------------------------------------------------------------------------- |
| `{yyyy}`, `{MM}`      | The backup month you choose                                                   |
| `{name}`, `{surname}` | The first and last word of the full name of the user signed in to the machine |

The zip goes into the folder given in **Default AWS location**, not into a subfolder of its own.

The app **never overwrites** an existing backup. If a zip with the same name already exists in S3, the backup
fails with a message saying so, and the existing file is left alone.

### Settings

| Setting                       | What it is                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Google drive credentials      | **Sign in with Google**. Needs the OAuth client set up below.                                                      |
| AWS credentials               | The access key ID (shown) and secret access key (hidden).                                                          |
| Default Google drive location | A Drive folder's URL, e.g. `https://drive.google.com/drive/folders/…`, or its ID.                                  |
| Default AWS location          | The bucket's link from the S3 console, or an S3 URL such as `https://my-bucket.s3.eu-west-2.amazonaws.com/photos`. |
| Default local folder          | The folder to back up. Use **Browse…** to pick it.                                                                 |
| Folder naming convention      | The naming pattern, as described above.                                                                            |
| AWS storage class             | Defaults to **Glacier Deep Archive**.                                                                              |

Credentials (the Google sign-in and the AWS keys) are encrypted on your machine with the operating system's
secure storage, and never leave the app's main process.

## Setup

### Requirements

- macOS (Windows and Linux builds are configured but untested)
- Node.js 22 or later, and npm
- A Google account (for Drive) and an AWS account (for S3)

### Install and run

```bash
npm install
npm run dev
```

npm 11 asks for approval before running install scripts. The ones this app needs (Electron, esbuild and
better-sqlite3) are pre-approved in `package.json` under `allowScripts`.

### Google Drive (OAuth)

Google Drive access uses Google sign-in. There's no API key option for personal files. You create an OAuth
client once, and the app's **Sign in with Google** turns it into a long-lived sign-in.

1. **Create a project.** In the [Google Cloud console](https://console.cloud.google.com/), create a project,
   e.g. `photobackup`.
2. **Enable the API.** Go to **APIs & Services → Library**, find **Google Drive API**, and click **Enable**.
3. **Set up the consent screen.** Go to **Google Auth Platform** (called "OAuth consent screen" in older
   consoles) and click **Get started**:
   - App name `photobackup`, with your email as the support email.
   - Audience: **External**.
   - **Data access:** add the scope `https://www.googleapis.com/auth/drive`. Full Drive access is needed to
     move backed-up files to the trash.
   - **Audience → Publish app:** move the app to **In production**. In _Testing_ mode, Google expires
     sign-ins after 7 days. Unverified apps in production work fine for personal use; you'll see a
     "Google hasn't verified this app" warning when you sign in.
4. **Create the client.** Go to **Clients → Create client**, with the application type **Desktop app**.
   Copy the **Client ID** and **Client secret**.
5. **Give them to the app.** Copy `.env.example` to `.env` (which is git-ignored) and fill it in:

   ```
   GOOGLE_OAUTH_CLIENT_ID=…apps.googleusercontent.com
   GOOGLE_OAUTH_CLIENT_SECRET=…
   ```

   Or export both variables in your shell profile instead. Variables set in the shell take precedence over
   `.env`.

6. **Sign in.** Restart the app, open **Settings**, and click **Sign in with Google**. In the browser, click
   **Advanced → Go to photobackup (unsafe)** on the unverified-app warning (it's your own app), then
   **Allow**. Then set **Default Google drive location** and click **Save**.

Until both variables are set, the app shows "Google Drive not configured". You can revoke access at any time
under **Google Account → Security → Third-party apps & services**.

### AWS S3

The app needs a bucket, plus an access key for an IAM user that can only upload to it.

1. **Create a bucket.** In the S3 console, create a bucket, e.g. `arnautovic-photo-backups`, in a region near
   you. Leave **Block all public access** on.
2. **Create an upload-only IAM user.** In IAM, create a user, e.g. `photobackup`, without console access.
   Attach a policy like this, with your bucket name:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "UploadBackups",
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:AbortMultipartUpload"],
         "Resource": "arn:aws:s3:::arnautovic-photo-backups/*"
       }
     ]
   }
   ```

   The user can upload but can't read, list or delete anything, so a leaked key can't touch existing backups.
   To cover a bucket per year without editing the policy each year, use a wildcard such as
   `arn:aws:s3:::arnautovic-photos-*/*`. To limit uploads to one folder, use `…/backups/*`, and set the same
   folder in **Default AWS location**.

3. **Create an access key.** On the user's **Security credentials** tab, click **Create access key**, and
   choose **Application running outside AWS**. Copy the access key ID and the secret access key; the secret is
   shown only once.
4. **Enter them in the app.** Open **Settings**, fill in **AWS credentials** and **Default AWS location**, and
   click **Save**.

### Storage class and costs

**Glacier Deep Archive** (the default) is S3's cheapest storage, but:

- Restoring a backup takes 12–48 hours. You request the restore in the S3 console first.
- Objects are charged for at least 180 days, even if you delete them sooner.
- Retrieving data is charged per GB.

You can choose a different class in Settings.

### Disk space

While it runs, a backup needs free space for the downloaded Drive photos plus the zip, so roughly twice the
size of the Drive photos. These temporary files are deleted when the backup finishes, fails for good, or is
cancelled. Leftovers from a quit or crash are cleaned up the next time the app starts.

### Packaged app

```bash
npm run build:mac
```

A packaged app opened from Finder doesn't see shell variables or the project's `.env`. Put the Google variables
in `~/Library/Application Support/photobackup/.env` instead. Packaging hasn't been tested yet.

## Development

| Command               | What it does                                                         |
| --------------------- | -------------------------------------------------------------------- |
| `npm run dev`         | Electron app with hot reload                                         |
| `npm run dev:web`     | The UI only, in a browser at http://localhost:5173, with mock data   |
| `npm run typecheck`   | TypeScript, for the main process and the UI                          |
| `npm run lint`        | ESLint                                                               |
| `npm test`            | Vitest                                                               |
| `npm run db:generate` | Generate a database migration after changing `src/main/db/schema.ts` |

- `src/main/` holds the main process: the database, backup job, Google Drive, S3 and IPC.
- `src/renderer/` holds the UI. It talks to the main process only through the typed bridge in `src/preload/`.
- `src/shared/` holds code used by both.

The app is designed in modelwright. The design in `.design/` is the source of truth
(`.design/spec.md` is a readable summary), and design changes are applied with
`/modelwright:build-from-design`. In development, `?state=<stateId>` forces any screen state with placeholder
data, e.g. http://localhost:5173/?state=st_vublspne. See [CLAUDE.md](CLAUDE.md) for details.
