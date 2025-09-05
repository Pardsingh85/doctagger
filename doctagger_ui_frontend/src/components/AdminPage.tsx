// src/components/AdminPage.tsx
import { useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { getAccessToken } from "../auth/getAccessToken";

interface FeedbackEntry {
  timestamp: string;
  user: string;
  filename: string;
  rating: string | number;
  comment: string;
}

export default function AdminPage() {
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { instance } = useMsal();

  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken(instance);
        if (!token) return; // redirect in progress

        const base = (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:8000";
        const res = await fetch(`${base}/admin/feedback`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setFeedback(await res.json());
        setError(null);
      } catch (e: any) {
        console.error(e);
        setError("Failed to load feedback.");
      }
    })();
  }, [instance]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">📊 Admin Feedback View</h1>
      {error && <p className="text-red-600 mb-4">{error}</p>}
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-2">Timestamp</th>
              <th className="p-2">User</th>
              <th className="p-2">File</th>
              <th className="p-2">Rating</th>
              <th className="p-2">Comment</th>
            </tr>
          </thead>
          <tbody>
            {feedback.map((entry, i) => (
              <tr key={i} className="border-t">
                <td className="p-2">{entry.timestamp}</td>
                <td className="p-2">{entry.user}</td>
                <td className="p-2">{entry.filename}</td>
                <td className="p-2">{entry.rating}</td>
                <td className="p-2">{entry.comment}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
