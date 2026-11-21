# Passion Manager

Passion Manager is a modern, responsive web application and Progressive Web App (PWA) designed for youth group leaders to track member attendance, community health, demographics, and real-time multi-device synchronization.

## Features

- **Attendance Tracking**: Rapid check-in with compact date navigation, monthly calendar view, and quick member registration.
- **Member Directory**: Manage member details including contact information, birthdays, Instagram handles, GPS groups, and staff roles.
- **Community Analytics**: Track group engagement, attendance growth, at-risk members absent for 2+ weeks, and demographics.
- **Real-Time Cloud Sync**: Powered by Firebase Firestore with offline local cache persistence and leader authentication.
- **Offline First**: Full offline functionality using browser LocalStorage and Firestore offline persistence.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm`

### Installation & Local Development

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Start the local development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

3. Type-check and build for production:
   ```bash
   npm run lint
   npm run build
   ```

---

## Firebase Configuration & Sync

Passion Manager is pre-configured with Firebase Authentication and Firestore for instant multi-device synchronization:

- **Authentication**: Leaders sign in via Email/Password in **Settings > Cloud Sync**.
- **Real-Time Sync**: Shared state is stored at Firestore document path `groups/main/data/state` with real-time `onSnapshot` listeners.
- **Offline Persistence**: Configured with `persistentLocalCache()` and browser `localStorage` (`yg_members`, `yg_attendance`) so leaders can mark attendance without an active internet connection.

---

## Deploying to GitHub Pages

Passion Manager includes dynamic repository path resolution in `vite.config.ts` (`process.env.GITHUB_REPOSITORY`), making GitHub Pages deployment seamless.

### Automated Deployment with GitHub Actions

1. In your GitHub repository, navigate to **Settings** > **Pages**.
2. Under **Build and deployment** > **Source**, select **GitHub Actions**.
3. Create `.github/workflows/deploy.yml` in your repository:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: true

jobs:
  build-and-deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

4. Push to `main`. GitHub Actions will automatically build and publish your app to `https://<username>.github.io/<repo>/`.
