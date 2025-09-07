// msal.js
import { PublicClientApplication } from "@azure/msal-browser";

const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_MSAL_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_MSAL_TENANT_ID}`,
    redirectUri: "/auth/callback",          // ← use a path, not a full URL
    postLogoutRedirectUri: "/auth/callback" // ← same here
  },
  cache: { cacheLocation: "localStorage", storeAuthStateInCookie: false },
};
export const msalInstance = new PublicClientApplication(msalConfig);
export const loginRequest = {
  scopes: [import.meta.env.VITE_API_SCOPE || "User.Read"],
};
