import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { ErrorState } from "../components/LoadingState.jsx";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setSubmitting(true);
    try {
      await register(email.trim(), password, trimmedName);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Failed to register");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">📘 CourseMap AI</h1>
        <p className="auth-subtitle">Create your account</p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="reg-name">Name</label>
          <input
            id="reg-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            disabled={submitting}
            autoComplete="name"
            required
          />

          <label htmlFor="reg-email" style={{ marginTop: 12 }}>Email</label>
          <input
            id="reg-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            disabled={submitting}
          />

          <label htmlFor="reg-password" style={{ marginTop: 12 }}>Password</label>
          <input
            id="reg-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            autoComplete="new-password"
            required
            minLength={6}
            disabled={submitting}
          />

          <label htmlFor="reg-confirm" style={{ marginTop: 12 }}>Confirm password</label>
          <input
            id="reg-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter password"
            autoComplete="new-password"
            required
            minLength={6}
            disabled={submitting}
          />

          {error && <div style={{ marginTop: 12 }}><ErrorState message={error} /></div>}

          <button
            type="submit"
            className="primary"
            disabled={submitting}
            style={{ width: "100%", marginTop: 16 }}
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}