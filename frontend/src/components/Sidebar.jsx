import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { listCourses } from "../api/coursesApi.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { EmptyState, ErrorState, LoadingState } from "./LoadingState.jsx";

export default function Sidebar() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { courseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isFirstLoadRef.current) {
        setLoading(true);
      }
      setError("");
      try {
        const data = await listCourses();
        if (!cancelled) {
          setCourses(data || []);
          isFirstLoadRef.current = false;
        }
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
  }, [location.pathname]);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const displayName = user?.name || user?.email || "User";
  const initial = (user?.name || user?.email || "?").slice(0, 1).toUpperCase();

  return (
    <aside className="sidebar">
      <motion.div
        className="sidebar-brand"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="sidebar-brand-mark">C</div>
        <div className="sidebar-brand-text">
          <strong>COURSEMAP AI</strong>
        </div>
      </motion.div>

      <motion.div
        className="sidebar-user"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="sidebar-user-avatar">{initial}</div>
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
            ⤴ Log out
          </button>
        </div>
      </motion.div>

      <motion.button
        type="button"
        className="new-course"
        onClick={() => navigate("/course/new")}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <span style={{ position: "relative", zIndex: 1 }}>+ New Course</span>
      </motion.button>

      {loading && <LoadingState message="Loading courses..." />}
      {error && <ErrorState message={error} />}

      {!loading && !error && courses.length === 0 && (
        <EmptyState message="No courses yet. Create your first one!" />
      )}

      <nav className="course-list">
        <AnimatePresence>
          {!loading && courses.length > 0 && (
            <motion.div
              className="course-list-label"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              Your courses · {courses.length}
            </motion.div>
          )}
          {courses.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.4,
                delay: 0.2 + i * 0.04,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <NavLink
                to={`/course/${c.id}`}
                className={({ isActive }) =>
                  `course-link${isActive || courseId === c.id ? " active" : ""}`
                }
                title={c.title}
              >
                <span style={{ position: "relative", zIndex: 1 }}>
                  {c.title}
                </span>
              </NavLink>
            </motion.div>
          ))}
        </AnimatePresence>
      </nav>
    </aside>
  );
}
