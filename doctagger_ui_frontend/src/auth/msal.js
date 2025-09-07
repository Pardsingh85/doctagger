import { PublicClientApplication } from "@azure/msal-browser";

const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_MSAL_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_MSAL_TENANT_ID}`,
    redirectUri: import.meta.env.VITE_MSAL_REDIRECT_URI,
    postLogoutRedirectUri: import.meta.env.VITE_MSAL_POST_LOGOUT_REDIRECT_URI,
  },
  cache: { cacheLocation: "localStorage", storeAuthStateInCookie: false },
};
export const msalInstance = new PublicClientApplication(msalConfig);
export const loginRequest = {
  scopes: [import.meta.env.VITE_API_SCOPE || "User.Read"],
};
