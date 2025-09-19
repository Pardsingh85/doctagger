// src/pages/GrantAccessGuide.tsx
import React from "react";

const GrantAccessGuide: React.FC = () => {
  const daemonAppId = import.meta.env.VITE_DAEMON_APP_ID as string | undefined;
  const tenantId = (import.meta.env.VITE_MSAL_TENANT_ID as string) || "common";

  // New: dedicated redirect for admin consent (falls back to sensible default)
  const adminConsentRedirect =
    (import.meta.env.VITE_ADMIN_CONSENT_REDIRECT_URI as string | undefined) ||
    `${window.location.origin}/auth/admin-consent/callback`;

  const missing: string[] = [];
  if (!daemonAppId) missing.push("VITE_DAEMON_APP_ID");
  // VITE_MSAL_TENANT_ID is optional (defaults to 'common')

  const handleAdminConsent = () => {
    if (!daemonAppId) return;

    const url =
      `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/v2.0/adminconsent` +
      `?client_id=${encodeURIComponent(daemonAppId)}` +
      `&redirect_uri=${encodeURIComponent(adminConsentRedirect)}` +
      `&state=doctagger_admin_consent`;

    window.location.assign(url);
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold mb-4">Grant SharePoint Access</h1>
      <p className="text-sm text-gray-600 mb-6">
        An administrator needs to grant the DocTagger <b>daemon</b> permission to
        access SharePoint via Microsoft Graph. This is a one-time step per tenant.
      </p>

      <div className="rounded-2xl border p-4 mb-6">
        <h2 className="font-medium mb-2">What this does</h2>
        <ul className="list-disc pl-6 text-sm text-gray-700 space-y-1">
          <li>Opens the Microsoft Entra admin consent screen.</li>
          <li>Uses the daemon app ID to request permissions (Sites.Selected).</li>
          <li>Returns to our app at <code className="px-1 py-0.5 bg-gray-100 rounded">{adminConsentRedirect}</code>.</li>
        </ul>
      </div>

      {missing.length > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-6 text-sm text-red-800">
          <b>Missing configuration:</b> {missing.join(", ")}.
          <div className="mt-2">
            Set these in your build environment and redeploy.
          </div>
        </div>
      ) : null}

      <div className="grid gap-2 text-sm">
        <div>
          <span className="font-medium">Tenant:</span>{" "}
          <code className="px-1 py-0.5 bg-gray-100 rounded">{tenantId}</code>
        </div>
        <div>
          <span className="font-medium">Daemon App ID:</span>{" "}
          <code className="px-1 py-0.5 bg-gray-100 rounded">{daemonAppId}</code>
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
