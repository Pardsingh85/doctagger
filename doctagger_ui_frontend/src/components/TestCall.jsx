import { useMsal } from "@azure/msal-react";
import { getAccessToken } from "../auth/getAccessToken";

export default function TestCall() {
  const { instance } = useMsal();
 const base = (import.meta.env.VITE_API_BASE_URL || "").trim();
  if (!base) { alert("VITE_API_BASE_URL not configured"); return; }


  const callApi = async () => {
    try {
      const token = await getAccessToken(instance);
      if (!token) return;

      const res = await fetch(`${base}/me-jwt`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("Request headers had Authorization:", !!token);
      console.log("Status:", res.status);
      console.log("Body:", await res.text());
    } catch (e) {
      console.error("TestCall error:", e);
    }
  };

  return <button onClick={callApi}>Test /me-jwt</button>;
}
