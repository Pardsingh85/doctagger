import { useEffect, useMemo, useState } from "react";

export default function AdminConsentCallback() {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const ok = params.get("admin_consent") === "True";
  const tenant = params.get("tenant");
  const state = params.get("state");
  const [msg, setMsg] = useState(ok ? "Admin consent granted. Finalizing…" : "Consent not granted.");

  useEffect(() => {
    if (!ok) return;
    // Optional: tell your backend which tenant finished consent
    // fetch("/api/onboarding/consent-complete", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ tenant, state }),
    // }).catch(() => {});
  }, [ok, tenant, state]);

  return (
    <main style={{ maxWidth: 520, margin: "4rem auto", fontFamily: "system-ui" }}>
      <h1>DocTagger — Admin Consent</h1>
      <p style={{ marginTop: 12 }}>{msg}</p>
      {tenant && <p style={{ marginTop: 8, opacity: 0.8 }}>Tenant: {tenant}</p>}
      <p style={{ marginTop: 24 }}>
        You can close this tab, or return to the app.
      </p>
    </main>
  );
}
