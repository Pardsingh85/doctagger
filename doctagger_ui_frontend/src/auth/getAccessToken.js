import { loginRequest } from "./msal";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

export async function getAccessToken(instance) {
  const account = instance.getActiveAccount() || instance.getAllAccounts()[0];
  if (!account) { await instance.loginRedirect(loginRequest); return null; }
  try {
    const res = await instance.acquireTokenSilent({ ...loginRequest, account });
    return res.accessToken;
  } catch (e) {
    const code = e?.errorCode || e?.message || "";
    const needsInteraction =
      e instanceof InteractionRequiredAuthError ||
      code.includes("interaction_required") ||
      code.includes("login_required") ||
      code.includes("consent_required") ||
      code.includes("no_tokens_found");
    if (needsInteraction) {
      await instance.acquireTokenRedirect({ ...loginRequest, account, loginHint: account?.username });
      return null;
    }
    throw e;
  }
}
