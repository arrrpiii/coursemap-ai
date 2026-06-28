import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { LoadingState } from "./LoadingState.jsx";

export default function ProtectedRoute({ children }) {
  const { user, token, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingState message="Checking session…" />;

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}