import { useEffect, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { listCourses } from "../api/coursesApi.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { EmptyState, ErrorState, LoadingState } from "./LoadingState.jsx";

export default function Sidebar() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await listCourses();
        if (!cancelled) setCourses(data || []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load courses");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const displayName = user?.name || user?.email || "User";

  return (
    <aside className="sidebar">
      <h1>📘 CourseMap AI</h1>

      <div className="sidebar-user">
        <div className="sidebar-user-avatar">
          {(user?.name || user?.email || "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name" title={user?.email}>
            {displayName}
          </div>
          <button
            type="button"
            className="sidebar-logout"
            onClick={handleLogout}
            title="Log out"
          >
            Log out
          </button>
        </div>
      </div>

      <button
        type="button"
        className="new-course"
        onClick={() => navigate("/course/new")}
      >
        + New Course
      </button>

      {loading && <LoadingState message="Loading courses..." />}
      {error && <ErrorState message={error} />}

      {!loading && !error && courses.length === 0 && (
        <EmptyState message="No courses yet. Create your first one!" />
      )}

      <nav className="course-list">
        {courses.map((c) => (
          <NavLink
            key={c.id}
            to={`/course/${c.id}`}
            className={({ isActive }) =>
              `course-link${isActive || courseId === c.id ? " active" : ""}`
            }
          >
            {c.title}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}