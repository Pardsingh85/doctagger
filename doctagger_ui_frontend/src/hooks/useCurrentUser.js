import { useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { getAccessToken } from "../auth/getAccessToken";

export default function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const { instance } = useMsal();

  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken(instance);
        if (!token) return; // redirect in progress
        const base = (import.meta.env.VITE_API_BASE || "").trim();
        if (!base) {
          console.warn("VITE_API_BASE not set; skipping /me-jwt");
          setUser({ name: "Signed in", email: "", isAdmin: false, groups: [] });
          return;
        }
        const res = await fetch(`${base}/me-jwt`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        setUser(await res.json());
        setError(null);
      } catch (e) {
        console.error(e);
        setError(e.message || "Failed to load user");
      }
    })();
  }, [instance]);

  return { user, error };
}
