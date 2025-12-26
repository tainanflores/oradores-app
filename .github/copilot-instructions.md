# AI Coding Agent Instructions for `oradores-app`

## Project Overview

- **Purpose:** PWA for managing speakers and speeches in a congregation, supporting offline use (IndexedDB) and Google Drive sync.
- **Tech Stack:** React + TypeScript, Vite, Dexie (IndexedDB), TailwindCSS, Vite PWA, Google Drive API.
- **Requirements:** See `docs/requisitos_do_sistema_de_gerenciamento_de_oradores.md` for functional, non-functional, and business rules.

## Architecture & Data Flow

- **Pages:** Located in `src/pages/` (Agenda, Oradores, Temas, Saidas, DatasEspeciais, Config).
- **Components:** Modular, in `src/components/` (modals, navigation, status bars, etc.).
- **Contexts:** App-wide state in `src/contexts/` (Config, GoogleDriveAuth).
- **Database:** IndexedDB via Dexie (`src/database.ts`). Data models: Orador, Tema, Discurso, SaidaOrador, DataEspecial. Sync/backup logic in `src/utils/` (`dbWithBackup.ts`, `googleDrive.ts`).
- **Navigation:** Bottom navigation (`src/components/navigation/BottomNavigation.tsx`) for mobile-first UX.
- **PWA:** Offline-first, installable, responsive. Service worker via Vite PWA/Workbox.

## Developer Workflows

- **Install:** `npm install`
- **Dev Server:** `npm run dev` (Vite)
- **Build:** `npm run build` (TypeScript + Vite)
- **Lint:** `npm run lint` (ESLint, see `eslint.config.js`)
- **Preview:** `npm run preview`
- **Testing:** No formal test suite detected; verify features manually via UI and data flows.
- **Debugging:** Use browser devtools; IndexedDB inspection recommended for data issues.

## Conventions & Patterns

- **TypeScript:** Strict mode (`tsconfig.app.json`), type safety enforced.
- **React:** Functional components, hooks, context for state management. Modals for CRUD operations.
- **Styling:** TailwindCSS utility classes, responsive/mobile-first layouts.
- **Data Integrity:** All changes to IndexedDB should trigger backup/sync logic (`dbSaveWithBackup`).
- **Business Rules:** Enforced in UI and data layer (e.g., blocked themes, special dates, orador constraints).
- **Accessibility:** Use semantic HTML and ARIA attributes in components.

## Integration Points

- **Google Drive:** Auth/context in `src/contexts/GoogleDriveAuthContext.tsx`, sync logic in `src/utils/googleDrive.ts`.
- **IndexedDB:** All persistent data via Dexie (`src/database.ts`).
- **PWA:** Manifest and service worker managed by Vite PWA plugin.

## Examples

- **Adding a new page:** Place in `src/pages/`, add route in `src/App.tsx`, update navigation if needed.
- **Sync logic:** Use `useSyncWithDriveOnStart` hook for initial sync.
- **Modals:** Use props for open/close state, pass callbacks for CRUD actions.

## AI Agent Guidance

- **Do not edit code unless explicitly instructed.**
- **Act as a mentor:** Explain concepts, guide through steps, provide code samples only when asked.
- **Prioritize mobile-first and offline-first design.**
- **Reference requirements and business rules from `docs/requisitos_do_sistema_de_gerenciamento_de_oradores.md`.**
- **Document any new conventions or patterns discovered.**
