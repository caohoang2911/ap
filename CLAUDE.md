# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`seedcom-app-pick` ("App Pick") is a React Native (Expo, SDK 51) warehouse/store order-fulfillment app for the Seedcom OMS. Staff use it to pick orders, bag items, scan barcodes/QR codes, print invoices and bag labels, and hand orders over for delivery. The codebase and most comments are in Vietnamese.

It is a **dev-client / bare-workflow Expo app** (native `ios/` and `android/` dirs are committed) — it is not Expo Go compatible. You must use a development build.

## Commands

Node is pinned to **22.9.0** via `.tool-versions` (asdf); the package manager is **yarn**.

```bash
# Start Metro bundler (pick the env profile)
yarn start:dev          # EAS_BUILD_PROFILE=dev   → points at oms-api-dev.seedcom.vn
yarn start:prod         # EAS_BUILD_PROFILE=prod  → points at oms-api.seedcom.vn

# Run on a connected device (requires a dev build installed)
yarn ios:dev            # iOS device, dev profile
yarn android:dev        # Android device, dev profile

# Native prebuild (regenerates ios/android from config + copies google-services)
yarn prebuild:ios:dev
yarn prebuild:android:dev

# Quality gates
yarn type-check         # tsc --noEmit (strict mode, also checkJs)
yarn lint               # prettier --check
yarn lint:fix           # prettier --write
yarn lint:eslint        # eslint src --ext .ts,.tsx
yarn lint:eslint:fix

# Cloud / local builds (EAS)
yarn build:android:dev
yarn build:ios:dev      # --auto-submit

# OTA updates (see "Updates" below)
yarn codepush:dev       # publish an expo-updates OTA bundle to dev

# Clean rebuilds when native state is broken
yarn clean:ios / yarn clean:android / yarn reset
```

There is **no test runner configured** in this project. Verify changes via `yarn type-check`, `yarn lint:eslint`, and running on a device.

Git hooks: a Husky `pre-commit` runs `lint-staged`, which runs `prettier --write` on staged files.

## Environment & build profiles

Environment is selected by the `EAS_BUILD_PROFILE` env var (`dev` vs `prod`), normalized in `app.config.ts` into `extra.env`, then read at runtime by `env.ts` (imported as `@env`).

- `app.config.ts` derives bundle IDs, app name, scheme, and `googleServicesFile` per profile. Dev and prod use **different bundle IDs / package names** that must match the committed `GoogleService-Info-*.plist` / `google-services-*.json` files.
- `env.ts` exposes the `Env` object: `API_BASE_URL`, `IS_PRODUCTION`, feature flags, etc. Import config from `@env`, not by re-reading `expo-constants`.
- `src/core/env.ts` wraps `Env` with helpers like `isDevelopment()`.

## Path aliases

Three aliases, configured in both `tsconfig.json` and `babel.config.js` (keep them in sync):

- `@/*` → `./src/*` (primary, most common)
- `~/*` → repo root (used as `~/src/...` and `~/env`)
- `@env` → `./env.ts`

## Architecture

### Routing — Expo Router (file-based)

Routes live in `src/app/`. Layout: `_layout.tsx` (root) → `(drawer)/` route group → `orders/` with detail screens keyed by `[code].tsx`. The `(drawer)` group adds no URL segment, so `/orders` and `/(drawer)/orders` are the same route.

**Never hardcode route strings.** Use the constants/builders in `src/core/constants/routes.ts` (`ROUTES.APP.ORDER_PICK(code)`, etc.).

### Order fulfillment flows

An order moves through several distinct screen families under `src/app/(drawer)/orders/`, each keyed by `[code].tsx`, each backed by its own zustand store under `src/core/store/` and (where stateful) its own components folder under `src/components/`:

- `order-pick/` — pick items against the order (scan/confirm quantities). Store: `order-pick`.
- `order-bags/` — assign picked items to bags, set bag quantities/labels. Store: `order-bag`.
- `order-invoice/` + `print-preview.tsx` — create/print invoices and bag labels. Store: `order-invoice`.
- `order-scan-to-delivery/` — scan bags to hand the order over to delivery. Store: `order-scan-to-delivery`.
- `store-start-order-scan-to-delivery/` / `store-complete-order-scan-to-delivery/` — store-side group-shipping handover (start vs complete). Stores: `store-start-order-scan-to-delivery`, `complete-order-scan-to-delivery`, plus the `*-group-shipping-progress` stores.

Order processing uses the store-picker flow and the `app-pick/` API context.

`src/app/_layout.tsx` is the composition root: it mounts all providers (`APIProvider`/react-query, gesture handler, bottom-sheet, portal, custom error boundary), runs `hydrateAuth()`/`hydrateConfig()` synchronously at module load, and gates the app behind the OTA update flow. `AuthWrapper` wires `useProtectedRoute` (auth-based redirects), `useHandleDeepLink`, and `useWatchResponse`.

### State — two layers

1. **Zustand stores** (`src/core/store/<feature>/`) hold client/UI state. Each store is created with `create(...)` then wrapped with `createSelectors` (from `src/core/utils/browser.ts`), giving auto-generated per-field hooks: `useAuth.use.status()`, `useOrderPick.use.orderPickProducts()`. Prefer these selector hooks over selecting manually. Stores expose plain functions (e.g. `signOut`, `resetOrderPick`) and some export non-hook helpers (`hydrateAuth`, `reset`).
2. **TanStack Query** (`src/api/`) owns all server state. Defaults set in `src/api/shared/api-provider.tsx`: `staleTime` 30s, `retry: 1`, no refetch-on-focus.

The auth store persists token/userInfo to MMKV via `src/core/storage.tsx` (`getItem`/`setItem`/`removeItem`).

### API layer (`src/api/`)

- `src/api/shared/client.tsx` — the single axios instance. It does a lot of cross-cutting work centrally, so add behavior here rather than per-call:
  - **Response interceptor unwraps `response.data`** — query/mutation functions receive the payload directly, not the full axios response. Watch for this when typing responses.
  - Auth: injects the `zas` token header from the auth store; detects `ERROR_AUTH_TOKEN_*` / 401 / 403 and triggers a debounced global sign-out + flash message.
  - The API returns business errors as `response.data.error` (a string) with HTTP 200; the interceptor surfaces these as flash messages (except a blacklist).
- Hooks are organized by domain: `app-pick/` (store-picker flows), `auth/`, `employee/`, `config/`, `upload/`. One file per endpoint, named `use-<verb>-<thing>.ts`.
- Order-processing endpoints use the `app-pick/` context.

### Styling — NativeWind v4

Tailwind classes via `className`. Config in `tailwind.config.js`, global stylesheet `src/ui/global.css` (wired through `metro.config.js`). Shared color tokens in `src/ui/colors.ts`. `class-variance-authority` + `tailwind-merge` (`cn` in `src/lib/utils.ts`) for variant components.

### Scanning & hardware

Barcode/QR scanning uses `react-native-vision-camera` + `@mgcrea/vision-camera-barcode-scanner`. Camera hooks have platform splits (`useCarmera.tsx` / `useCarmera.android.tsx` — Metro resolves `.android`/`.ios` extensions, see `babel.config.js`). Printing talks to label/receipt printers over TCP (`react-native-tcp-socket`) with Rongta and X-Printer print-data generators in `src/api/app-pick/`. `react-native-volume-manager` maps hardware volume keys to scanner actions.

### Updates — dual mechanism

The app runs **two** update systems, gated in order at startup (`_layout.tsx` → `useCodepush` then `useAutoUpdate`):

1. **expo-updates OTA** ("CodePush" in this repo's naming) — JS bundle updates published via `scripts/codepush-*.js` / `yarn codepush:dev`. `expo-updates` is `require`'d defensively because an OTA/native mismatch can make the native module unavailable at runtime.
2. **GitHub native update** (`useAutoUpdate`) — downloads/installs a native APK build; toggled per-platform by `NATIVE_GITHUB_UPDATE*` env flags in `env.ts`. Runs only after the OTA check completes.

### Other infra

- Firebase (`@react-native-firebase`) for auth, FCM push (`usePushNotifications`, `useSetFCMRegistrationToken`), and Crashlytics. `CrashlyticsService` (`src/core/utils/crashlytics`) is called from the axios error interceptor for 5xx.
- `patch-package` runs on `postinstall`; patched deps live in `patches/`. Don't edit `node_modules` directly.
- Deep links handled by `useHandleDeepLink` with paths in `routes.ts` (`DEEP_LINK_PATHS`).

## Further docs

Deeper feature/setup notes (mostly Vietnamese) live in `docs/`:

- `docs/environment-setup.md` — the dev/prod environment system in detail.
- `docs/camera-optimization.md` — CameraView startup-performance optimizations.
- `docs/fcm-notifications.md` — FCM push payload formats and custom-sound setup across app states (foreground/background/quit), Android + iOS.

## Conventions

- TypeScript strict mode is on (`checkJs` too) — `yarn type-check` must pass.
- Files: hooks `use-kebab-case.ts` in `src/api/`, but `useCamelCase.ts` in `src/core/hooks/`; components are `PascalCase` or kebab-case depending on folder — match the directory you're editing.
- Shared types live in `src/types/` by domain (`order-pick`, `product`, `employee`, …).
- Stable references matter in this app: several files keep module-level constants (e.g. `EMPTY_ORDER_DETAIL`, stable style objects for `@gorhom/portal`) specifically to avoid infinite render loops — don't replace them with inline `{}`/arrays.
