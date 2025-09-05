import { useMsal } from "@azure/msal-react";
import { getAccessToken } from "../auth/getAccessToken";

export default function TestMeJwt() {
  const { instance } = useMsal();
  const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

  const callApi = async () => {
    try {
      const token = await getAccessToken(instance);
      if (!token) return; // redirect started

      const res = await fetch(`${base}/me-jwt`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log("Sent Authorization header?", Boolean(token));
      console.log("Status:", res.status);
      const text = await res.text();
      console.log("Body:", text);

      alert(res.ok ? "OK (200). Check console for JSON." : `HTTP ${res.status}. Check console for body.`);
    } catch (e) {
      console.error("TestMeJwt error:", e);
      alert("Error. See console.");
    }
  };

  return (
    <button onClick={callApi} style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}>
      Test /me-jwt (attach Bearer)
    </button>
  );
}
