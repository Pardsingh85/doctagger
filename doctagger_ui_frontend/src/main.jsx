// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance, loginRequest } from "./auth/msal";
import App from "./App";
import AdminConsentCallback from "./pages/AdminConsentCallback"; // ← your TSX file
import "./index.css";

const root = document.getElementById("root");

// Detect the admin-consent callback path
const isAdminConsentCallback =
  window.location.pathname.startsWith("/auth/admin-consent/callback");

// 🔐 On the admin-consent callback, DO NOT touch MSAL at all.
// Render the standalone callback component with no MsalProvider.
if (isAdminConsentCallback) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <AdminConsentCallback />
    </React.StrictMode>
  );
} else {
  // Normal app path: initialize MSAL first, then render the app.
  msalInstance.initialize().then(async () => {
    try {
      const result = await msalInstance.handleRedirectPromise();
      if (result?.account) {
        msalInstance.setActiveAccount(result.account);
      } else {
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length) msalInstance.setActiveAccount(accounts[0]);
        else {
          await msalInstance.loginRedirect(loginRequest);
          return; // redirecting
        }
      }
    } catch (e) {
      console.warn("MSAL redirect handling:", e?.message || e);
    }

    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <MsalProvider instance={msalInstance}>
          <App />
        </MsalProvider>
      </React.StrictMode>
    );
  });
}
