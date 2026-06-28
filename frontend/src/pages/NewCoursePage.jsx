import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCourse } from "../api/coursesApi.js";
import { ErrorState } from "../components/LoadingState.jsx";

export default function NewCoursePage() {
  const [title, setTitle] = useState("");
  const [syllabus, setSyllabus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!title.trim() || !syllabus.trim()) {
      setError("Both course title and syllabus are required.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await createCourse(title.trim(), syllabus.trim());
      if (result && result.course && result.course.id) {
        navigate(`/course/${result.course.id}`);
      } else {
        setError("Unexpected response from the server.");
      }
    } catch (err) {
      setError(err.message || "Failed to create course");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Create a new course</h2>
          <p>
            Paste the course title and full syllabus. The AI will generate a
            clean topic/subtopic tree for you.
          </p>
        </div>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <label htmlFor="course-title">Course title</label>
        <input
          id="course-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Machine Learning"
          disabled={submitting}
        />

        <label htmlFor="course-syllabus" style={{ marginTop: 12 }}>
          Syllabus
        </label>
        <textarea
          id="course-syllabus"
          value={syllabus}
          onChange={(e) => setSyllabus(e.target.value)}
          placeholder="Paste the full syllabus here..."
          disabled={submitting}
          style={{ minHeight: 200 }}
        />

        {error && <div style={{ marginTop: 12 }}><ErrorState message={error} /></div>}

        <button
          type="submit"
          className="primary"
          disabled={submitting}
          style={{ marginTop: 16 }}
        >
          {submitting ? "Generating course map..." : "Generate Course Map"}
        </button>
      </form>
    </div>
  );
}
