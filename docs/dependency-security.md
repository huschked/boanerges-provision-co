# Dependency security remediation

## WEB-047 audit record

Date: September 8, 2026

The production baseline from `npm audit --omit=dev` contained 31 vulnerable packages: 2 critical, 11 high, 14 moderate, and 4 low. The remediated production and complete dependency trees both report zero known vulnerabilities. No forced audit upgrade was used.

## Finding-to-exposure map

| Baseline findings | Direct dependency path | Exposure before remediation | Resolution |
| --- | --- | --- | --- |
| `protobufjs` (critical), `@protobufjs/utf8`, `@grpc/grpc-js` | `firebase`, `firebase-admin`, and the unused `@google/genai` package | Browser Firestore serialization and server Firestore transport; the GenAI branch had no application call sites | Upgraded Firebase; patched Firebase Admin's Firestore transport; removed unused GenAI |
| `websocket-driver` (critical) | `firebase` -> Realtime Database compatibility transport | Shipped in the browser Firebase package, although this app uses Firestore rather than Realtime Database | Upgraded `firebase` to 12.18.0, resolving to patched `websocket-driver` 0.7.5 |
| `ws`, `form-data`, `@tootallnate/once` | Unused `@google/genai` and its Google/network transport chain | Installed as production code but unreachable because the application had no GenAI imports or calls | Removed `@google/genai` |
| `@google-cloud/firestore`, `google-gax`, `gaxios`, `retry-request`, `teeny-request` | `firebase-admin` -> Firestore | Server runtime: Admin queries, transactions, authentication-backed workflows, webhooks, and cron jobs | Kept Firebase Admin 13.x compatibility and overrode Firestore to patched 8.7.1 |
| `@google-cloud/storage`, `fast-xml-parser`, `fast-xml-builder`, `uuid` | Optional `firebase-admin` -> Cloud Storage branch | Installed in the server runtime; Admin Storage is not called by this application, but the vulnerable packages were still deployable | Overrode Cloud Storage to patched 8.1.0 and refreshed its transport tree |
| `body-parser`, `qs` | Direct `body-parser` and `express` | Public server request parsing, including Stripe webhook raw-body handling and API query parsing | Upgraded `body-parser` to 2.3.0 and pinned patched `qs` 6.16.0 across Express 4 |
| `ip-address`, `express-rate-limit` | Direct `express-rate-limit` | Public API rate-limit key validation | Upgraded `express-rate-limit` to 8.7.0 |
| `react-router`, `react-router-dom` | Direct `react-router-dom` | Browser storefront, checkout, success, order-status, prelaunch, and Admin routing | Upgraded React Router DOM to 7.18.3 |
| `resend`, `svix` | Direct `resend` and its webhook helper | Server transactional email and email-provider integration | Upgraded Resend to 6.26.0 |
| `vite`, `postcss`, `nanoid`, `browserslist`, `@babel/core`, `esbuild` | Vite, Tailwind Vite plugin, React Vite plugin, Autoprefixer, and TSX | Local development and production build only; these packages were incorrectly classified as production dependencies in part of the old manifest | Moved build packages to `devDependencies` and upgraded/refreshed the complete build tree |

## Compatibility decisions

- Express remains on 4.22.2. The patched `qs` override fixes the parser advisories without taking the Express 5 routing and request-semantics migration during a security patch.
- Firebase Admin remains on 13.10.0. Version 14 removes the namespace API used throughout this server (`admin.firestore`, `admin.auth`, and `admin.credential`). Its vulnerable optional transports are replaced with patched Firestore 8.7.1 and Cloud Storage 8.1.0 instead of changing hundreds of production call sites in the same release.
- Node 18 or newer is now declared because it is the common supported floor for the patched server and build dependencies.
- The package manager's install-script allowlist contains only the required scripts for Firebase utilities, protobuf code generation, and the two esbuild binaries. This keeps dependency installation reproducible without broadly permitting arbitrary package scripts.

## Verification

- `npm audit --omit=dev`: 0 vulnerabilities.
- `npm audit`: 0 vulnerabilities.
- `npm run lint`: passed.
- `npm test`: 81 passed, 0 failed.
- `npm run build`: passed with Vite 6.4.3.

After deployment, verify the real integrations that automated tests cannot exercise without production credentials: one-time checkout, subscription checkout, Stripe webhook processing, Admin Google sign-in and Firestore reads, a transactional Resend email, analytics events, and prelaunch storefront unlock/redirect behavior.

