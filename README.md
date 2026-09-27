# Exam

A family app to create questions, run exams and follow learning progress.
Angular 22 + Angular Material, with Firebase Authentication and Cloud Firestore.

- **Today** – daily activity and a 7-day trend
- **Create Question** – a simple form for multiple choice, true/false, short answer and essay questions
- **Upload** – bulk import questions from Excel, with a template and a preview to fix errors
- **Exams** – build, take (timer, auto-save), auto-mark, mark essays, import paper results
- **Progress** – scores over time, strengths and subjects to practise
- **Report** – per-exam results and question analysis, export to Excel
- **Categories** – categories and their subjects

Light and dark themes, installable on phones (PWA).

## Project layout

```
src/app/core/infrastructure   the only code that talks to Firebase
src/app/core/state            AppState: signals holding all data, plus the actions that change it
src/app/core/analytics        numbers for the dashboards
src/app/pages/…               one folder per page
src/app/shared/…              question form, charts, avatar, logo
```

## Private settings (never committed)

The Firebase config and the family list live in `src/environments/environment.local.ts`,
which is git-ignored. The build always uses that file.

1. Copy `src/environments/environment.ts` to `src/environments/environment.local.ts`.
2. Paste the web app config from Firebase Console → Project settings → Your apps.
3. List each family member (name + email). In Firebase Console → Authentication, enable
   **Email/Password** and add each member with a **6-digit PIN** as the password.

## Security rules

`firestore.rules.example` shows the rules. Copy it to `firestore.rules` (git-ignored), put the
family emails in `family()`, then paste it into Firebase Console → Firestore Database → Rules → **Publish**.

## Run locally

```bash
npm install
npm start
```

Open http://localhost:4200.

## Deploy to GitHub Pages

A workflow (`.github/workflows/deploy.yml`) builds and publishes on every push to `main`.

1. Repository → Settings → Secrets and variables → Actions → **New repository secret**:
   name `FIREBASE_ENVIRONMENT`, value = the full contents of `environment.local.ts`.
2. Repository → Settings → Pages → Source: **GitHub Actions**.
3. Firebase Console → Authentication → Settings → **Authorized domains** → add `<your-user>.github.io`.
4. Push to `main` (or run the workflow by hand from the Actions tab).
