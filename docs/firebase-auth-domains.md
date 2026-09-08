# Firebase Google sign-in domains

The Admin portal uses Firebase Authentication's Google popup flow. The web configuration intentionally keeps the Firebase-managed authentication handler:

- Firebase project: `boanerges-provision-co`
- `authDomain`: `boanerges-provision-co.firebaseapp.com`
- Production application origin: `https://www.boanergesprovisions.com`
- Root redirect origin: `https://boanergesprovisions.com`

Do not replace `authDomain` with the Vercel-hosted storefront domain. This project is not using Firebase Hosting as a custom authentication host.

## Firebase Console configuration

Open **Firebase Console → boanerges-provision-co → Authentication → Settings → Authorized domains**. Add each exact hostname that can open the Admin portal; enter hostnames only, with no scheme, path, port, or wildcard:

- `www.boanergesprovisions.com`
- `boanergesprovisions.com`
- `boanerges-provision-co.vercel.app` if the stable Vercel project domain is used for testing
- Any specific Vercel preview hostname that must support Admin testing
- `localhost` only when local Firebase Authentication testing is actively required

Firebase authorization applies to the hostname that opened `/admin`, even when another domain redirects to the canonical site. Vercel's unique preview hostnames cannot be covered by a broad wildcard in Firebase's authorized-domain list; authorize only previews that need Admin access and remove obsolete ones.

Confirm **Authentication → Sign-in method → Google** remains enabled. Adding an authorized domain does not grant Admin access: the signed-in Firebase user must still have `users/{uid}.role == "admin"` in Firestore.

## Deployment URL configuration

Set Vercel's Production `APP_URL` to the canonical origin:

```text
https://www.boanergesprovisions.com
```

Do not include a trailing slash. `APP_URL` controls Stripe return URLs and signed links in transactional email; it does not authorize Firebase Authentication by itself. After changing a Vercel environment variable, redeploy the application.

The Firebase API key and `authDomain` in `firebase-applet-config.json` are browser configuration, not server secrets. The service-account value remains server-only.

## Troubleshooting

| Symptom or Firebase code | Resolution |
| --- | --- |
| `auth/unauthorized-domain` | Add the exact hostname currently shown in the browser address bar to Firebase Authorized domains. |
| `auth/operation-not-allowed` | Enable the Google provider under Authentication → Sign-in method. |
| `auth/popup-blocked` | Allow pop-ups for the storefront hostname and retry. |
| Popup succeeds, then the portal says access is unauthorized | Verify the signed-in user's Firebase UID and the Firestore `users/{uid}.role` value. |
| Popup shows a redirect or origin mismatch | Confirm the app still uses `boanerges-provision-co.firebaseapp.com` as `authDomain`. Only configure a custom OAuth handler if intentionally migrating to a Firebase Hosting custom auth domain. |
| Admin works on one hostname but not another | Authorize both hostnames independently; root and `www` are different Firebase authorized domains. |

## Production verification

1. Open a fresh private window at `https://www.boanergesprovisions.com/admin`.
2. Confirm the Admin login page is reachable through the prelaunch gate exception.
3. Select **Sign in with Google** and complete the popup using the approved Admin account.
4. Confirm the dashboard loads and refreshes products, orders, and audience data.
5. Navigate to the storefront, use browser Back, and refresh `/admin`; confirm a fresh Google sign-in is required.
6. Repeat on the root hostname only if it can serve `/admin` without first redirecting to `www`.
7. If a stable Vercel project or preview hostname is retained for Admin testing, repeat there and confirm it is explicitly listed in Firebase.
