// getAccessToken.js
import { msalInstance, loginRequest, usePopup } from "./msal";

// Global lock so only ONE interactive call can happen at a time.
let authLock = null;

async function interactive(account) {
  if (usePopup) {
    const res = await msalInstance.acquireTokenPopup({ ...loginRequest, account });
    return res.accessToken;
  } else {
    await msalInstance.loginRedirect({ ...loginRequest, account });
    return null; // browser will navigate
  }
}

export async function getAccessToken() {
  // If another call is already running, wait for it.
  if (authLock) return authLock;

  authLock = (async () => {
    const accounts = msalInstance.getAllAccounts();

    // First hop: no session yet
    if (accounts.length === 0) {
      if (usePopup) {
        await msalInstance.loginPopup(loginRequest);
      } else {
        await msalInstance.loginRedirect(loginRequest);
        return null;
      }
    }

    const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0];

    // Try silent first
    try {
      const res = await msalInstance.acquireTokenSilent({ ...loginRequest, account });
      return res.accessToken;
    } catch (e) {
      // If another interaction is underway, just bail; caller can retry shortly.
      if (e && e.errorCode === "interaction_in_progress") return null;
      // Otherwise fall back to interactive
      return await interactive(account);
    }
  })();

  try {
    return await authLock;
  } finally {
    authLock = null; // release lock for future calls
  }
}
