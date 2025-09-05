import React, { useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { getAccessToken } from "../auth/getAccessToken";
import FeedbackForm from "./FeedbackForm";

function DashboardPage() {
  const { instance } = useMsal();
  const base = (import.meta.env.VITE_API_BASE_URL) || "http://localhost:8000";

  const [file, setFile] = useState(null);
  const [taggingMode, setTaggingMode] = useState("Keywords");
  const [tags, setTags] = useState([]);
  const [textPreview, setTextPreview] = useState("");
  const [newTag, setNewTag] = useState("");
  const [sharepointUrl, setSharepointUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadTargets, setUploadTargets] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState("");
  const [tagCount, setTagCount] = useState(5);
  const [uploadLog, setUploadLog] = useState([]);

  // Load upload targets (admin API but UI may show read-only list)
  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken(instance);
        if (!token) return;
        const res = await fetch(`${base}/admin/upload-targets`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setUploadTargets(await res.json());
      } catch (e) {
        console.error("Error loading upload targets", e);
      }
    })();
  }, [instance, base]);

  const handleFileChange = async (e) => {
    const uploadedFile = e.target.files[0];
    setFile(uploadedFile);
    setTags([]);
    setTextPreview("");
    setSharepointUrl("");

    const formData = new FormData();
    formData.append("file", uploadedFile);
    formData.append("mode", taggingMode);
    formData.append("custom_prompt", "");
    formData.append("num_tags", tagCount);

    try {
      const token = await getAccessToken(instance);
      if (!token) return;
      const response = await fetch(`${base}/tag`, {
        method: "POST",
        body: formData,
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Tagging failed");

      const data = await response.json();
      setTextPreview(data.text || "");
      setTags(data.tags || []);
    } catch (err) {
      alert("Error during tagging: " + err.message);
    }
  };

  const handleAddTag = () => {
    const clean = newTag.trim();
    if (clean && !tags.includes(clean)) {
      setTags((prev) => [...prev, clean]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (index) => {
    setTags((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSharePointUpload = async () => {
    if (!file) return;
    if (!selectedTarget) {
      alert("❗ Please select an upload destination.");
      return;
    }

    setUploading(true);
    setSharepointUrl("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("tags", tags.join(", "));
    formData.append("upload_target_label", selectedTarget);

    try {
      const token = await getAccessToken(instance);
      if (!token) return;
      const res = await fetch(`${base}/upload-to-sharepoint`, {
        method: "POST",
        body: formData,
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      setSharepointUrl(data.item?.webUrl || "");

      const logEntry = {
        filename: file.name,
        tags,
        target: selectedTarget,
        time: new Date().toLocaleString(),
        success: res.ok,
        url: data?.item?.webUrl || "",
      };
      setUploadLog((prev) => [logEntry, ...prev]);
    } catch (err) {
      alert("❌ SharePoint upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-3xl mx-auto bg-white shadow-md rounded-xl p-6 space-y-8">
        {/* Header */}
        <header className="text-center">
          <h1 className="text-3xl font-bold text-blue-700">📎 DocTagger AI</h1>
          <p className="text-gray-600 mt-1">AI-powered document tagging for modern SharePoint environments</p>
        </header>

        {/* Upload */}
        <section>
          <h2 className="text-xl font-semibold mb-2">📤 Upload Document</h2>
          <p className="text-sm text-gray-500 mb-2">
            Upload a PDF, DOCX or TXT file to automatically extract tags and upload the document to your SharePoint library.
          </p>
          <input type="file" onChange={handleFileChange} />
        </section>

        {/* Tagging Settings */}
        <section>
          <h2 className="text-xl font-semibold mb-2">🧠 Tagging Settings</h2>
          <div className="mb-2">
            <label className="mr-2 text-sm">Choose Tagging Mode:</label>
            <select value={taggingMode} onChange={(e) => setTaggingMode(e.target.value)} className="border rounded px-2 py-1">
              <option>Keywords</option>
              <option>Topics</option>
              <option>Custom Prompt</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Number of tags to extract:</label>
            <select value={tagCount} onChange={(e) => setTagCount(Number(e.target.value))} className="border rounded px-2 py-1 w-32">
              {[3, 5, 7, 10, 15, 20].map((num) => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </div>
        </section>

        {/* Text Preview */}
        {textPreview && (
          <section>
            <h2 className="text-xl font-semibold mb-2">📄 Extracted Text Preview</h2>
            <textarea value={textPreview} readOnly className="w-full border rounded p-3 text-sm bg-gray-50 h-40 resize-none" />
          </section>
        )}

        {/* Editable Tags */}
        {tags.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-2">🏷 Review & Edit Tags</h2>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, i) => (
                <div key={i} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm flex items-center">
                  {tag}
                  <button onClick={() => handleRemoveTag(i)} className="ml-2 text-red-500 hover:text-red-700 font-bold">×</button>
                </div>
              ))}
            </div>

            <div className="mt-2 flex items-center gap-2">
              <input type="text" value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Add tag" className="border rounded px-2 py-1 text-sm" />
              <button onClick={handleAddTag} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm">+ Add Tag</button>
            </div>
          </section>
        )}

        {/* SharePoint Upload */}
        {file && (
          <section>
            <h2 className="text-xl font-semibold mb-2">📤 Upload to SharePoint</h2>

            {uploadTargets.length > 0 ? (
              <div className="mb-4">
                <label className="block mb-1 font-medium">Select Upload Destination:</label>
                <select className="border rounded px-2 py-1 w-full" value={selectedTarget} onChange={(e) => setSelectedTarget(e.target.value)}>
                  <option value="">-- Choose a destination --</option>
                  {uploadTargets.map((t) => (
                    <option key={t.label} value={t.label}>{t.label} — {t.folder}</option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No upload destinations available. Contact your admin.</p>
            )}

            <button
              className={`px-4 py-2 rounded shadow-sm transition text-white ${uploading ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"}`}
              disabled={uploading}
              onClick={handleSharePointUpload}
            >
              {uploading ? "Uploading..." : "Upload Document"}
            </button>

            {sharepointUrl && (
              <p className="mt-3 text-sm">
                ✅ Uploaded to:{" "}
                <a href={sharepointUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all block">
                  {sharepointUrl}
                </a>
              </p>
            )}
          </section>
        )}

        {/* Upload Log */}
        {uploadLog.length > 0 && (
          <section className="mt-6">
            <h2 className="text-xl font-semibold mb-2">📚 Upload History</h2>
            <div className="space-y-3">
              {uploadLog.map((entry, i) => (
                <div key={i} className="border rounded p-3 bg-gray-50">
                  <div className="flex justify-between">
                    <div className="font-medium">{entry.filename}</div>
                    <div className="text-sm text-gray-500">{entry.time}</div>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Destination: <strong>{entry.target}</strong></div>
                  <div className="flex flex-wrap gap-1 my-1">
                    {entry.tags.map((tag, j) => (
                      <span key={j} className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                  <div className="text-sm mt-1">
                    Status:{" "}
                    <span className={entry.success ? "text-green-600" : "text-red-600"}>
                      {entry.success ? "✅ Success" : "❌ Failed"}
                    </span>
                  </div>
                  {entry.url && (
                    <a href={entry.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-sm break-all block mt-1">
                      {entry.url}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;
