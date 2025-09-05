import React, { useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { getAccessToken } from "../auth/getAccessToken";

type UploadTarget = {
  label: string;
  siteId: string;
  driveId: string;
  folder: string;
  enabled?: boolean;
};

type DaemonStatus = {
  last_run?: string;
  files_processed?: number;
  last_error?: string;
};

export default function AdminUploadTargetsPage() {
  const { instance } = useMsal();
  const base = (import.meta as any).env.VITE_API_BASE_URL || "http://localhost:8000";

  const [targets, setTargets] = useState<UploadTarget[]>([]);
  const [statusByLabel, setStatusByLabel] = useState<Record<string, DaemonStatus>>({});
  const [form, setForm] = useState<UploadTarget>({
    label: "",
    siteId: "",
    driveId: "",
    folder: "",
    enabled: true,
  });

  const [siteUrlInput, setSiteUrlInput] = useState("");
  const [resolving, setResolving] = useState(false);
  const [drives, setDrives] = useState<any[]>([]);
  const [folders, setFolders] = useState<{ name: string; path: string }[]>([]);

  // Small helper to attach Authorization automatically
  const apiFetch = async (path: string, init: RequestInit = {}) => {
    const token = await getAccessToken(instance);
    if (!token) throw new Error("signin_required");
    const headers = new Headers(init.headers || {});
    if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${base}${path}`, { ...init, headers });
  };

  const fetchTargets = async () => {
    const res = await apiFetch("/admin/upload-targets");
    const data = await res.json();
    setTargets(data);
  };

  const fetchStatus = async () => {
    const res = await apiFetch("/admin/upload-targets/status");
    const data = await res.json();
    setStatusByLabel(data);
  };

  useEffect(() => {
    (async () => {
      try {
        await fetchTargets();
        await fetchStatus();
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const toggleEnabled = async (label: string, next: boolean) => {
    const res = await apiFetch(
      `/admin/upload-targets/enabled?label=${encodeURIComponent(label)}&enabled=${String(next)}`,
      { method: "PATCH" }
    );
    if (res.ok) {
      await fetchTargets();
      await fetchStatus();
    } else {
      const err = await res.json();
      alert("❌ " + err.detail);
    }
  };

  const resolveSite = async () => {
    if (!siteUrlInput) {
      alert("Please paste a SharePoint site URL first.");
      return;
    }
    setResolving(true);
    try {
      const res = await apiFetch(`/graph/resolve-site?url=${encodeURIComponent(siteUrlInput)}`);
      if (!res.ok) {
        const err = await res.json();
        alert("❌ Site resolution failed: " + err.detail);
        setResolving(false);
        return;
      }
      const site = await res.json();
      const siteId = site.id;
      setForm((prev) => ({ ...prev, siteId }));

      const drivesRes = await apiFetch(`/graph/drives?siteId=${siteId}`);
      if (!drivesRes.ok) {
        const err = await drivesRes.json();
        alert("❌ Failed to load document libraries: " + err.detail);
        setDrives([]);
        setResolving(false);
        return;
      }

      const drivesData = await drivesRes.json();
      setDrives(drivesData);

      if (drivesData.length > 0) {
        const firstDriveId = drivesData[0].id;
        setForm((prev) => ({ ...prev, driveId: firstDriveId }));

        const foldersRes = await apiFetch(`/graph/folders?siteId=${siteId}&driveId=${firstDriveId}`);
        if (foldersRes.ok) {
          const folderData = await foldersRes.json();
          setFolders(folderData);
          if (folderData.length > 0) {
            setForm((prev) => ({ ...prev, folder: folderData[0].path }));
          }
        }
      }
    } catch (err) {
      console.error("❌ Unexpected error in resolveSite:", err);
      alert("❌ Unexpected error resolving site. Check console.");
    } finally {
      setResolving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const addTarget = async () => {
    const { label, siteId, driveId, folder, enabled } = form;
    if (!label || !siteId || !driveId || !folder) {
      alert("❗ All fields are required.");
      return;
    }

    const res = await apiFetch("/admin/upload-targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, siteId, driveId, folder, enabled }),
    });

    if (res.ok) {
      setForm({ label: "", siteId: "", driveId: "", folder: "", enabled: true });
      setSiteUrlInput("");
      setDrives([]);
      setFolders([]);
      await fetchTargets();
      await fetchStatus();
    } else {
      const err = await res.json();
      alert("❌ " + err.detail);
    }
  };

  const deleteTarget = async (label: string) => {
    const res = await apiFetch(`/admin/upload-targets?label=${encodeURIComponent(label)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await fetchTargets();
      await fetchStatus();
    } else {
      const err = await res.json();
      alert("❌ " + err.detail);
    }
  };

  return (
    <div className="max-w-3xl mx-auto mt-10 p-4 border rounded bg-white shadow">
      <h2 className="text-xl font-semibold mb-4">Allowed Upload Targets</h2>
      {targets.length === 0 && <p className="text-gray-500">No upload targets saved yet.</p>}

      {targets.map((t) => {
        const status = statusByLabel[t.label] || {};
        return (
          <div key={t.label} className="flex justify-between items-start border-b py-2">
            <div>
              <strong>{t.label}</strong>{" "}
              <span className={`ml-2 text-xs px-2 py-0.5 rounded ${t.enabled === false ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                {t.enabled === false ? "Disabled" : "Enabled"}
              </span>
              <br />
              <span className="text-sm text-gray-500">
                {t.siteId} → {t.driveId} → {t.folder || "/"}
              </span>

              <div className="text-xs text-gray-500 mt-1 ml-1">
                <div>🕒 Last run: {status.last_run ? new Date(status.last_run).toLocaleString() : "—"}</div>
                <div>📄 Files processed: {status.files_processed ?? "—"}</div>
                {status.last_error && <div className="text-red-500 mt-1">❌ Error: {status.last_error}</div>}
              </div>
            </div>

            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={t.enabled !== false}
                  onChange={(e) => toggleEnabled(t.label, e.target.checked)}
                />
                Enabled
              </label>
              <button onClick={() => deleteTarget(t.label)} className="text-red-600 hover:underline text-sm">
                Delete
              </button>
            </div>
          </div>
        );
      })}

      {/* Add New Target */}
      <div className="mt-8">
        <h3 className="font-semibold mb-2">Add New Upload Target</h3>
        <div className="space-y-3">
          <input
            placeholder="Friendly label (e.g. HR Docs)"
            name="label"
            value={form.label}
            onChange={handleChange}
            className="input input-bordered w-full"
          />

          <div>
            <label className="block mb-1">Paste SharePoint Site URL:</label>
            <input
              type="text"
              placeholder="https://contoso.sharepoint.com/sites/HR"
              value={siteUrlInput}
              onChange={(e) => setSiteUrlInput(e.target.value)}
              className="input input-bordered w-full"
            />
            <button onClick={resolveSite} className="btn btn-sm mt-2" disabled={resolving}>
              {resolving ? "Resolving..." : "Resolve Site"}
            </button>
          </div>

          {drives.length > 0 && (
            <select name="driveId" value={form.driveId} onChange={handleChange} className="input input-bordered w-full">
              <option value="">Select Document Library</option>
              {drives.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}

          {folders.length > 0 && (
            <select name="folder" value={form.folder} onChange={handleChange} className="input input-bordered w-full">
              {folders.map((f) => (
                <option key={f.path} value={f.path}>
                  {f.name}
                </option>
              ))}
            </select>
          )}

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="enabled"
              checked={!!form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            Enabled (include in daemon scans)
          </label>

          <button onClick={addTarget} className="btn btn-primary w-full">
            ➕ Add Upload Target
          </button>
        </div>
      </div>
    </div>
  );
}
