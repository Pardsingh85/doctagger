// src/hooks/useCurrentUser.js
import { useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { getAccessToken } from "../auth/getAccessToken";

export default function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const { instance } = useMsal();

  useEffect(() => {
    const acct = instance.getActiveAccount() || instance.getAllAccounts()[0];
    if (acct && !user) {
      // fallback identity from MSAL token
      setUser({
        name: acct.name || acct.username,
        email: acct.username,
        tenantId: acct.tenantId || acct.idTokenClaims?.tid,
        isAdmin: false,
        groups: [],
      });
    }

    (async () => {
      try {
        const token = await getAccessToken(instance);
        if (!token) return;
        const base = (import.meta.env.VITE_API_BASE_URL || "").trim();
        if (!base) return;

        const res = await fetch(`${base}/me-jwt`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        setUser(await res.json()); // enrich with API response
        setError(null);
      } catch (e) {
        console.warn("User enrichment failed:", e);
        // keep MSAL fallback, just record the error
        setError(e.message || "Failed to load user");
      }
    })();
  }, [instance]);

  return { user, error };
}
