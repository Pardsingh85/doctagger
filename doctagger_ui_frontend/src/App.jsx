import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from "react-router-dom";
import DashboardPage from "./components/DashboardPage";
import AdminPage from "./components/AdminPage";
import AdminUploadTargetsPage from "./pages/AdminUploadTargetsPage";
import useCurrentUser from "./hooks/useCurrentUser";
import LoginButton from "./components/LoginButton";
import AdminConsentCallback from "./pages/AdminConsentCallback";
import GrantAccessGuide from "./pages/GrantAccessGuide";


function App() {
  const { user, error } = useCurrentUser();

  if (error) {
    return <div className="p-4 text-red-600">❌ {error}</div>;
  }

  if (user === null) {
    return <div className="p-4 text-gray-600">🔄 Loading user info...</div>;
  }

  const adminGroupId = import.meta.env.VITE_ADMIN_GROUP_ID;
  const isAdmin = user?.isAdmin === true;

  console.log("👤 User groups:", user.groups);
  console.log("🛡 Admin group ID (from .env):", adminGroupId);
  console.log("✅ isAdmin:", isAdmin);


  return (
    <Router>
      <nav className="p-4 bg-gray-100 flex justify-between items-center border-b">
        <div className="flex gap-4">
          <Link to="/dashboard" className="text-blue-600 hover:underline">Dashboard</Link>
          {isAdmin && (
            <>
            <Link to="/admin/grant-access" className="text-blue-600 hover:underline">Grant Access</Link>
              <Link to="/admin" className="text-blue-600 hover:underline">Admin</Link>
              <Link to="/admin/upload-targets" className="text-blue-600 hover:underline">Upload Targets</Link>
            </>
          )}
        </div>
          <div className="flex items-center gap-3 text-sm text-gray-500">
           {user && <>Logged in as: {user.name} ({user.email})</>}
          <LoginButton />
        </div>
        <div className="text-sm text-gray-500">
          Logged in as: {user.name} ({user.email})
        </div>
      </nav>

      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/admin/upload-targets" element={<AdminUploadTargetsPage />} />
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="/auth/admin-consent/callback" element={<AdminConsentCallback />} />
        
        {/* Admin page routing, secured based on isAdmin */}
        <Route
          path="/admin/grant-access"
          element={isAdmin ? <GrantAccessGuide /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/admin"
          element={
            isAdmin ? <AdminPage /> : <Navigate to="/dashboard" />
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
