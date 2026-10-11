> **Historical snapshot (2026-10-09).** This brief was written for an earlier version of the design and is out of
> date. The app's current design is in `.design/spec.md`, and its look in the Rangefinder direction.

# photobackup: UI design brief

Paste everything below the line into Claude Design (claude.ai, the Design canvas). It's self-contained:
Claude Design can't read this repo, so the app's structure from modelwright is copied in here.

Source: `.design/flows.json` and `.design/erd.json` as of 2026-10-09. If the design changes in modelwright,
regenerate this brief from `.design/spec.md`.

---

## The ask

Explore **three distinct visual directions** for **photobackup**, a small macOS desktop app. For each direction,
design **every screen state listed below** as its own artboard, so the directions can be compared side by side.

Keep the structure fixed: the screens, states, content and actions below come from the app's interaction
design and are already built. Explore the **visual layer**: layout, hierarchy, typography, colour, spacing,
iconography, progress visualisation, and how modals sit over the main window. Don't add, remove or rename
screens, states or actions. If you think the structure should change, list those suggestions separately
instead of designing them in.

## The product

photobackup backs up one month's photos at a time from a **local folder** and **Google Drive** to **AWS S3**,
as a single zip per month (e.g. `arnautovic-photos-2026-09-vedran.zip`), usually in the cheap, slow
Glacier Deep Archive storage class. The typical user runs it once a month, on the first day of the next
month, to archive last month's photos. It should feel calm, trustworthy and quick to get through: open it,
check the month, click Back up, walk away.

## Constraints

- **Platform:** a macOS desktop app (Electron), in a single window of about **760 × 640 pt**. Design at that
  size. It should also hold up when the window is resized smaller.
- **Light and dark mode:** show at least one state of each direction in both.
- **Labels:** use the action labels exactly as written below. Each state's **primary** action must read as
  the main action, and the others as secondary.
- **Modals:** Settings and Confirm cancel are modals over the Home screen. Backup history is a full screen.
- **Accessible:** readable type, clear focus states, labelled inputs, sufficient contrast. Progress must be
  understandable without relying on colour alone.
- **Realistic sample data:** use the examples given below.

## Screens and states

### 1. Splash

Shown only while the app starts, then it moves to Home automatically.

- **Shows:** a loading indicator; credits (short text, placeholder for now)
- **Actions:** none visible (moves on by itself when loading finishes)

### 2. Home

The main window. Its state follows the backup.

#### 2a. Home › Default

Ready to back up. The items' locations come from Settings and can only be changed there; here the user just
chooses which to include and which month the backup is for.

- **Actions, in order:**
  - **Settings**: opens the Settings modal
  - **Select items to back up**: a checkbox for each item, showing its location underneath:
    - Local folder: `/Users/vedran/Pictures`
    - Google Drive: `https://drive.google.com/drive/folders/1Fam1lyPh0t0sAbCdEf`
    - An item that isn't set up can't be ticked, and shows why instead of its location, e.g.
      "Google Drive not configured". Show this variant too.
  - **Set backup month**: a month-and-year picker, defaulting to last month (e.g. September 2026)
  - **Back up** (primary): starts the backup. Disabled when nothing is selected.
  - **History**: opens Backup history

#### 2b. Home › Backup in progress

- **Shows:** a progress indicator with each stage and its % completed. The stages, in order: Downloading
  from Google Drive, Compressing, Uploading to AWS. The download stage only appears when Google Drive is
  included. Example: Downloading 100%, Compressing 100%, Uploading 42% (current).
- **Actions:** **Cancel backup** (opens Confirm cancel), **Pause backup**

#### 2c. Home › Backup paused

- **Shows:** "Backup paused"; the current stage and % completed, e.g. "Compressing: 63% completed"
- **Actions:** **Resume backup** (primary), **Cancel backup** (opens Confirm cancel)

#### 2d. Home › Backup successful

- **Shows:** confirmation of the number of items and the size backed up, e.g. "Backed up 1,284 items
  (3.4 GB)"; where it went, e.g. `s3://arnautovic-photos/arnautovic-photos-2026-09-vedran.zip`
- **Actions:** **Done** (back to Default)

#### 2e. Home › Backup failed

- **Shows:** error details, e.g. "Upload to AWS failed: The AWS Access Key Id you provided does not exist
  in our records." Also design a long error message.
- **Actions:** **Retry** (primary), **Cancel** (back to Default)

### 3. Settings (modal over Home)

- **Shows, in order:**
  - **Google drive credentials:** the sign-in status ("Signed in to Google") with a "Sign in with Google" /
    "Sign in again" button. Variant: "Google Drive not configured", with setup instructions.
  - **AWS credentials:** Access key ID (visible, e.g. `AKIAIOSFODNN7EXAMPLE`) and Secret access key
    (masked, 40 characters)
  - **Default Google drive location:** a URL field
  - **Default AWS location:** a URL field, e.g. `https://arnautovic-photos.s3.eu-west-2.amazonaws.com/`
  - **Default local folder:** a path field with a Browse… button
  - **Folder naming convention:** a pattern field, e.g. `{surname}-photos-{yyyy}-{MM}-{name}`, with the hint
    "Name (vedran) and surname (arnautovic) are sourced from the logged in user. Year and month come from
    the backup month you choose."
  - **AWS storage class:** a dropdown (Standard, Intelligent-Tiering, Standard-IA, One Zone-IA, Glacier
    Instant Retrieval, Glacier Flexible Retrieval, Glacier Deep Archive), defaulting to Glacier Deep Archive
- **Actions:** **Save** (primary), **Exit without saving**
- Also show an error variant: a field with an inline validation message, e.g. under Default AWS location.
- The form is taller than the window, so consider grouping and how it scrolls.

### 4. Confirm cancel (modal over Home)

- **Shows:** "Cancel backup?"
- **Actions:** **Cancel** (stops the backup, back to Home › Default), **Keep backing up** (back to Backup in
  progress)
- Note the wording risk: "Cancel" here *confirms* cancelling. Make the consequence obvious visually,
  without changing the labels.

### 5. Backup history

- **Shows:** past backups, each with date, size and outcome. Example rows: 1 Oct 2026, September 2026 backup,
  3.4 GB, Succeeded · 1 Sep 2026, August 2026, 2.9 GB, Succeeded · 2 Aug 2026, July 2026, Failed
  (upload error). Also design the empty state (no backups yet).
- **Actions:** **Back** (to Home › Default)

## Navigation map

- Splash → (automatically) Home › Default
- Home › Default: Settings → Settings modal; Back up → Backup in progress; History → Backup history
- Backup in progress: Cancel backup → Confirm cancel; Pause backup → Backup paused; (finishes) → Backup
  successful or Backup failed
- Backup paused: Resume backup → Backup in progress; Cancel backup → Confirm cancel
- Backup successful: Done → Home › Default
- Backup failed: Retry → Backup in progress; Cancel → Home › Default
- Settings: Save or Exit without saving → Home › Default
- Confirm cancel: Cancel → Home › Default; Keep backing up → Backup in progress
- Backup history: Back → Home › Default

## Data behind the screens (for context)

- **Config:** the app's single configuration. It has one or more **Sources**, exactly one **Destination**,
  and zero or more **Naming patterns**.
- **Source:** where photos come from. Type (local or remote), name, location (path or URL), credentials
  (optional, e.g. a Google sign-in), last backed up.
- **Destination:** always AWS. Name, location (S3 URL), credentials, storage class.
- **Naming pattern:** how the backup zip is named, e.g. `arnautovic-photos-2026-09-vedran`.

## Deliverables

1. Three named directions, each with a one-paragraph rationale.
2. For each direction, an artboard for every state above, including the variants called out: Google Drive
   not configured, the Settings validation error, the long error message, and the empty history.
3. Light and dark versions of at least Home › Default and Backup in progress for each direction.
4. A short list of suggested structural changes, if any, kept separate from the designs.
