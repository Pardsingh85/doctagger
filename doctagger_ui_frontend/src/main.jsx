import React from "react";
import ReactDOM from "react-dom/client";
import { MsalProvider } from "@azure/msal-react";
import { msalInstance, loginRequest } from "./auth/msal";
import App from "./App";
import "./index.css";

msalInstance.initialize().then(async () => {
  const result = await msalInstance.handleRedirectPromise();
  if (result?.account) {
    msalInstance.setActiveAccount(result.account);
  } else {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length) {
      msalInstance.setActiveAccount(accounts[0]);
    } else {
      await msalInstance.loginRedirect(loginRequest);
      return; // will navigate
    }
  }

  ReactDOM.createRoot(document.getElementById("root")).render(
    <MsalProvider instance={msalInstance}>
      <App />
    </MsalProvider>
  );
});
