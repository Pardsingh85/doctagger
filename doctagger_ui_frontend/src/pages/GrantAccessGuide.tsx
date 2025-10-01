// src/pages/GrantAccessGuide.tsx
import React from "react";

const GrantAccessGuide: React.FC = () => {
  // Required: daemon app (the app that has Sites.Selected etc.)
  const daemonAppId = import.meta.env.VITE_DAEMON_APP_ID as string | undefined;

  // Admin consent cannot use /common or /consumers. Use your tenant GUID/domain,
  // or default to /organizations when unset/common/consumers.
  const rawTenant = (import.meta.env.VITE_MSAL_TENANT_ID as string) || "organizations";
  const tenantSegment = ["common", "consumers"].includes(rawTenant.toLowerCase())
    ? "organizations"
    : rawTenant;

  // Redirect URI for admin consent (must also be registered on the *daemon* app)
  const adminConsentRedirect =
    (import.meta.env.VITE_ADMIN_CONSENT_REDIRECT_URI as string | undefined) ||
    `${window.location.origin}/auth/admin-consent/callback`;

  const missing: string[] = [];
  if (!daemonAppId) missing.push("VITE_DAEMON_APP_ID");

  const handleAdminConsent = () => {
    if (!daemonAppId) return;

    const url =
      `https://login.microsoftonline.com/${encodeURIComponent(tenantSegment)}/adminconsent` +
      `?client_id=${encodeURIComponent(daemonAppId)}` +
      `&redirect_uri=${encodeURIComponent(adminConsentRedirect)}` +
      `&state=doctagger_admin_consent`;

    window.location.assign(url);
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold mb-4">Grant SharePoint Access</h1>
      <p className="text-sm text-gray-600 mb-6">
        An administrator needs to grant the DocTagger <b>daemon</b> permission to access SharePoint via Microsoft Graph.
        This is a one-time step per tenant.
      </p>

      <div className="rounded-2xl border p-4 mb-6">
        <h2 className="font-medium mb-2">What this does</h2>
        <ul className="list-disc pl-6 text-sm text-gray-700 space-y-1">
          <li>Opens the Microsoft Entra admin consent screen.</li>
          <li>Uses the daemon app ID to request permissions (e.g., <code>Sites.Selected</code>).</li>
          <li>
            Returns to{" "}
            <code className="px-1 py-0.5 bg-gray-100 rounded break-all">
              {adminConsentRedirect}
            </code>
            .
          </li>
        </ul>
      </div>

      {missing.length > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-6 text-sm text-red-800">
          <b>Missing configuration:</b> {missing.join(", ")}.
          <div className="mt-2">Set these in your build environment and redeploy.</div>
        </div>
      ) : null}

      <div className="grid gap-2 text-sm">
        <div>
          <span className="font-medium">Tenant segment:</span>{" "}
          <code className="px-1 py-0.5 bg-gray-100 rounded">{tenantSegment}</code>
        </div>
        <div>
          <span className="font-medium">Daemon App ID:</span>{" "}
          <code className="px-1 py-0.5 bg-gray-100 rounded break-all">{daemonAppId || "—"}</code>
        </div>
        <div>
          <span className="font-medium">Admin Consent Redirect URI:</span>{" "}
          <code className="px-1 py-0.5 bg-gray-100 rounded break-all">
            {adminConsentRedirect}
          </code>
        </div>
      </div>

      <button
        onClick={handleAdminConsent}
        disabled={missing.length > 0}
        className="mt-6 inline-flex items-center rounded-xl px-4 py-2 border shadow-sm hover:shadow transition disabled:opacity-50"
      >
        Open Admin Consent
      </button>

      <p className="text-xs text-gray-500 mt-4">
        You’ll be redirected to Microsoft and then returned to{" "}
        <code className="px-1 py-0.5 bg-gray-100 rounded">/auth/admin-consent/callback</code>.
      </p>
    </div>
  );
};

export default GrantAccessGuide;
