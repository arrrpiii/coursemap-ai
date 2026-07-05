import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createCourse } from "../api/coursesApi.js";
import { ErrorState } from "../components/LoadingState.jsx";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.55, ease: [0.16, 1, 0.3, 1] },
  }),
};

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
      <motion.div
        className="page-header"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div>
          <div className="eyebrow">// Build a new map</div>
          <h2>Create a new course</h2>
          <p>
            Paste the course title and full syllabus. The AI will generate a
            clean topic / subtopic tree for you.
          </p>
        </div>
      </motion.div>

      <motion.form
        className="card"
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
          <label htmlFor="course-title">Course title</label>
          <input
            id="course-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Machine Learning"
            disabled={submitting}
          />
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
          style={{ marginTop: 18 }}
        >
          <label htmlFor="course-syllabus">Syllabus</label>
          <textarea
            id="course-syllabus"
            value={syllabus}
            onChange={(e) => setSyllabus(e.target.value)}
            placeholder="Paste the full syllabus here..."
            disabled={submitting}
            style={{ minHeight: 240 }}
          />
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginTop: 14 }}
          >
            <ErrorState message={error} />
          </motion.div>
        )}

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={2}
          style={{ marginTop: 22 }}
        >
          <motion.button
            type="submit"
            className="primary"
            disabled={submitting}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            {submitting ? "Synthesising course map..." : "Generate Course Map →"}
          </motion.button>
        </motion.div>
      </motion.form>
    </div>
  );
}
