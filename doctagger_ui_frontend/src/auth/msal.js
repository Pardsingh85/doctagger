import { PublicClientApplication } from "@azure/msal-browser";

export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_CLIENT_APP_ID,
    authority: "https://login.microsoftonline.com/organizations",
    redirectUri: "http://localhost:5173/auth/callback",
    postLogoutRedirectUri: "http://localhost:5173/",
    navigateToLoginRequestUrl: false,
  },
  cache: { cacheLocation: "localStorage", storeAuthStateInCookie: true },
  system: { allowRedirectInIframe: false },
};

export const loginRequest = {
  scopes: [`api://${import.meta.env.VITE_API_APP_ID}/access_as_user`],
  prompt: "select_account",
};

export const msalInstance = new PublicClientApplication(msalConfig);
