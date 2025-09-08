import { useMemo } from "react";

export default function GrantAccessGuide() {
  const daemonAppId = import.meta.env.VITE_DAEMON_APP_ID as string;
  const prodCallback = `${window.location.origin}/auth/callback`;

  const adminConsentUrl = useMemo(
    () =>
      `https://login.microsoftonline.com/common/adminconsent?client_id=${daemonAppId}&redirect_uri=${encodeURIComponent(
        prodCallback
      )}&state=onboarding`,
    [daemonAppId, prodCallback]
  );

  const grantJson = `{
  "roles": ["write"],
  "grantedToIdentities": [
    { "application": { "id": "${daemonAppId}" } }
  ]
}`;

  return (
    <div className="max-w-3xl mx-auto mt-10 p-6 bg-white border rounded shadow space-y-6">
      <h1 className="text-2xl font-bold">Grant Access Guide</h1>
      <p className="text-gray-600">
        DocTagger uses <code>Sites.Selected</code>. This means we only access
        SharePoint sites that you explicitly assign. Follow these steps:
      </p>

      {/* Step 1 */}
      <section>
        <h2 className="font-semibold mb-2">Step 1 — Admin Consent</h2>
        <a
          href={adminConsentUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Open Admin Consent
        </a>
        <p className="text-xs mt-2">
          API App ID: <code>{daemonAppId || "MISSING VITE_DAEMON_APP_ID"}</code>
        </p>
      </section>

      {/* Step 2 */}
      <section>
        <h2 className="font-semibold mb-2">
          Step 2 — Assign to a SharePoint site
        </h2>
        <p className="text-sm text-gray-600 mb-2">
          Use Microsoft Graph Explorer or CLI.
        </p>
        <pre className="bg-gray-900 text-green-200 p-3 rounded text-sm overflow-x-auto">
{`# Find site ID
GET https://graph.microsoft.com/v1.0/sites/{hostname}:/sites/{site-name}?$select=id,webUrl

# Grant DocTagger write access
POST https://graph.microsoft.com/v1.0/sites/{siteId}/permissions
Content-Type: application/json

${grantJson}

# Verify
GET https://graph.microsoft.com/v1.0/sites/{siteId}/permissions`}
        </pre>
      </section>

      {/* Step 3 */}
      <section>
        <h2 className="font-semibold mb-2">Step 3 — Verify in DocTagger</h2>
        <p className="text-sm text-gray-600">
          Once access is granted, DocTagger can only see those sites. Any other
          site will return a 403 error.
        </p>
      </section>
    </div>
  );
}
