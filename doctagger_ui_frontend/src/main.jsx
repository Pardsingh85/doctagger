import React from "react";
import ReactDOM from "react-dom/client";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance, loginRequest } from "./auth/msal";
import App from "./App";
import "./index.css";

const isAdminConsentCallback =
  window.location.pathname.startsWith("/auth/admin-consent/callback");

// If we're on the admin-consent callback, there is no MSAL token flow to complete.
// Render the app without trying to process a login redirect.
if (isAdminConsentCallback) {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <MsalProvider instance={msalInstance}>
      <App />
    </MsalProvider>
  );
} else {
  msalInstance.initialize().then(async () => {
    let result = null;
    try {
      result = await msalInstance.handleRedirectPromise();
    } catch (e) {
      // no_token_request_cache_error is expected on first load without prior redirect
      console.warn("MSAL handleRedirectPromise:", e?.message || e);
    }

    if (result?.account) {
      msalInstance.setActiveAccount(result.account);
    } else {
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length) {
        msalInstance.setActiveAccount(accounts[0]);
      } else {
        // keep your redirect-only login flow if desired:
        await msalInstance.loginRedirect(loginRequest);
        return; // navigation happens
      }
    }

    ReactDOM.createRoot(document.getElementById("root")).render(
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    );
  });
}
