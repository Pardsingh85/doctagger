import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../auth/msal";

export default function LoginButton() {
  const { instance, accounts } = useMsal();
  const signedIn = accounts.length > 0;

  const login = async () => {
    await instance.loginRedirect(loginRequest);
  };

  const logout = async () => {
    const account = instance.getActiveAccount() || instance.getAllAccounts()[0];
    await instance.logoutRedirect({
      account,
      postLogoutRedirectUri: window.location.origin,
    });
  };

  return signedIn
    ? <button onClick={logout}>Sign out</button>
    : <button onClick={login}>Sign in with Microsoft</button>;
}
