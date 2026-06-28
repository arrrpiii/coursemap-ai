import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listCourses } from "../api/coursesApi.js";
import { EmptyState, ErrorState, LoadingState } from "../components/LoadingState.jsx";

export default function HomePage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Welcome to CourseMap AI</h2>
          <p>Turn any syllabus into a navigable course map with AI assistance.</p>
        </div>
        <Link to="/course/new" className="new-course">
          + New Course
        </Link>
      </div>

      {loading && <LoadingState message="Loading courses..." />}
      {error && <ErrorState message={error} />}

      {!loading && !error && courses.length === 0 && (
        <div className="card">
          <EmptyState message="No courses yet. Click '+ New Course' to create your first one." />
        </div>
      )}

      {!loading && !error && courses.length > 0 && (
        <div className="card">
          <h3>Your courses</h3>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {courses.map((c) => (
              <li key={c.id} style={{ margin: "6px 0" }}>
                <Link to={`/course/${c.id}`} style={{ color: "#2563eb" }}>
                  {c.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
