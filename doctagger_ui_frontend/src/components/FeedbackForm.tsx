// FeedbackForm.tsx
import { useState } from "react";
import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

// 🔧 Configure these via your frontend .env (see below)
const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";
const API_SCOPES = [
  // Example: "api://<BACKEND_APP_ID>/user_impersonation"
  (import.meta as any).env?.VITE_API_SCOPE,
].filter(Boolean) as string[];

// ✅ Keep your existing types
type StatusType = "idle" | "submitting" | "success" | "error";

interface FeedbackFormProps {
  filename: string;
}

export default function FeedbackForm({ filename }: FeedbackFormProps) {
  const { instance, accounts } = useMsal();
  const account = instance.getActiveAccount() || accounts[0];

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<StatusType>("idle");

  async function getAccessToken(): Promise<string> {
    if (!account) {
      // If there's truly no signed-in account, send user through login
      await instance.loginRedirect();
      // The redirect interrupts; the function won't return a token here.
      return "";
    }
    try {
      const res = await instance.acquireTokenSilent({
        account,
        scopes: API_SCOPES,
      });
      return res.accessToken;
    } catch (err) {
      // Respect your redirect-only policy (no popups)
      if (err instanceof InteractionRequiredAuthError || true) {
        await instance.acquireTokenRedirect({
          account,
          scopes: API_SCOPES,
        });
      }
      return "";
    }
  }

  const handleSubmit = async () => {
    setStatus("submitting");
    try {
      const token = await getAccessToken();
      if (!token) {
        // We likely triggered a redirect; bail out for now.
        return;
      }

      const resp = await fetch(`${API_BASE}/feedback`, {
        method: "POST",
        // ❌ Cookies not needed for JWT-only API; avoid CORS headaches
        // credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          filename,
          rating,
          comment,
        }),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setStatus("success");
      setComment("");
    } catch (err) {
      console.error("Feedback submit failed:", err);
      setStatus("error");
    }
  };

  return (
    <div className="mt-6 space-y-3">
      <h2 className="text-lg font-semibold">Give Feedback</h2>

      <div>
        <label className="block mb-1">Rating (1–5):</label>
        <select
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="border rounded px-2 py-1"
        >
          {[1, 2, 3, 4, 5].map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block mb-1">Comment:</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="w-full border rounded px-2 py-1"
          placeholder="Tell us what you think…"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={status === "submitting"}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
      >
        {status === "submitting" ? "Sending…" : "Submit Feedback"}
      </button>

      {status === "success" && (
        <p className="text-green-600">Thanks for your feedback!</p>
      )}
      {status === "error" && (
        <p className="text-red-600">
          There was an error submitting feedback.
        </p>
      )}
    </div>
  );
}
