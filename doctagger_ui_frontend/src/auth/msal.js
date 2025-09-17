// msal.js
import { PublicClientApplication } from "@azure/msal-browser";

const clientId = import.meta.env.VITE_MSAL_CLIENT_ID; // GUID of DocTaggerAI-Client
const usePopup = window.location.hostname === "localhost"; // popup for localhost, redirect for SWA/prod

export const loginRequest = {
  scopes: [import.meta.env.VITE_API_SCOPE], // e.g. api://<API_GUID>/access_as_user
};

export const msalConfig = {
  auth: {
    clientId,
    authority: "https://login.microsoftonline.com/common", // multi-tenant
    redirectUri: `${window.location.origin}/auth/callback`,
    postLogoutRedirectUri: `${window.location.origin}/`,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: true,
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

// exported so other modules can decide which flow to use
export { usePopup };
