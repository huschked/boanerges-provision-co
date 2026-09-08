type FirebaseAuthFailure = { code?: unknown; message?: unknown };

export function firebaseAuthErrorMessage(error: unknown, hostname = '') {
  const failure = error && typeof error === 'object' ? error as FirebaseAuthFailure : {};
  const code = typeof failure.code === 'string' ? failure.code : '';
  const currentHost = hostname.trim() || 'this domain';

  switch (code) {
    case 'auth/unauthorized-domain':
      return `Google sign-in is not authorized for ${currentHost}. Add this exact hostname in Firebase Authentication → Settings → Authorized domains, then retry.`;
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and retry.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled before it completed. Please retry.';
    case 'auth/network-request-failed':
      return 'Google sign-in could not reach Firebase. Check your connection and retry.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled for this Firebase project.';
    default:
      return 'Unable to start Google sign-in. Check the browser console for the Firebase error code and retry.';
  }
}
