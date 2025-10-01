import { useEffect, useMemo, useState } from "react";

export default function AdminConsentCallback() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const ok = params.get("admin_consent") === "True";
  const tenant = params.get("tenant") ?? "";
  const state = params.get("state") ?? "";
  const error = params.get("error") ?? "";
  const errorDesc = params.get("error_description") ?? "";
  const expectedState = "doctagger_admin_consent";
  const stateOk = !state || state === expectedState;

  const [msg, setMsg] = useState(
    ok
      ? "Admin consent granted. Finalizing…"
      : error
      ? `Consent failed: ${errorDesc || error}`
      : "Consent not granted."
  );

  useEffect(() => {
    if (!stateOk) {
      setMsg("State mismatch. Please retry admin consent from the app.");
      return;
    }
    if (ok) {
      // Optional: notify backend here…

      // Redirect back to the grant page after a short pause
      const t = setTimeout(() => {
        window.location.replace("/admin/grant-access");
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [ok, stateOk]);

  return (
    <main style={{ maxWidth: 560, margin: "4rem auto", fontFamily: "system-ui", lineHeight: 1.5 }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>DocTagger — Admin Consent</h1>
      <p>{msg}</p>
      {!!tenant && <p style={{ opacity: 0.8 }}>Tenant: {tenant}</p>}
      {!!error && (
        <details style={{ marginTop: 10 }}>
          <summary>Details</summary>
          <code>{errorDesc || error}</code>
        </details>
      )}
    </main>
  );
}
