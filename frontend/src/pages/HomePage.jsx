import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { listCourses } from "../api/coursesApi.js";
import { EmptyState, ErrorState, LoadingState } from "../components/LoadingState.jsx";

const FEATURES = [
  {
    icon: "◆",
    title: "Neural Course Maps",
    desc: "Drop any syllabus. Watch Gemini parse it into a 3-level topic tree in seconds.",
    tag: "Map · Auto",
  },
  {
    icon: "✦",
    title: "AI Tutor Chat",
    desc: "Every node ships with an AI tutor that sees the full course context — not just one topic.",
    tag: "Chat · Context",
  },
  {
    icon: "⌬",
    title: "Concept Explainer",
    desc: "Ask Gemini to explain any node using the full syllabus and your saved notes as context.",
    tag: "Explain · Node",
  },
  {
    icon: "▣",
    title: "Question Forge",
    desc: "MCQs, short, long, numerical, case-study. Difficulty and type in your control.",
    tag: "Q · 5 types",
  },
  {
    icon: "◉",
    title: "Sample Paper Generator",
    desc: "Full-course, marks-aware, time-bound question papers ready in one click.",
    tag: "Paper · Full",
  },
  {
    icon: "▲",
    title: "Progress Radar",
    desc: "Track every node as pending, learning, or completed. Visualise mastery at a glance.",
    tag: "Track · Status",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  }),
};

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
      <motion.section
        className="hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="hero-grid">
          <div>
            <motion.h1
              className="hero-title"
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={0}
            >
              Turn any syllabus into a navigable neural map.
            </motion.h1>

            <motion.p
              className="hero-sub"
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={1}
            >
              CourseMap AI is an AI-assisted learning co-pilot. Drop a course
              title, paste a syllabus, and watch a topic tree, tutor chat, and
              exam-ready question papers materialise — all in seconds.
            </motion.p>

            <motion.div
              className="hero-actions"
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={2}
            >
              <Link
                to="/course/new"
                className="primary"
                style={{ textDecoration: "none" }}
              >
                + Create New Course
              </Link>
              <a href="#features" className="secondary" style={{ textDecoration: "none" }}>
                Explore features ↓
              </a>
            </motion.div>
          </div>

          <div className="hero-art">
            <div className="hero-rings" aria-hidden="true">
              <div className="hero-ring" />
              <div className="hero-ring" />
              <div className="hero-ring" />
            </div>
            <div className="hero-orb" aria-hidden="true" />
          </div>
        </div>
      </motion.section>

      <div id="features" className="section-title">
        <h2>Core capabilities</h2>
        <div className="bar" />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--text-faint)",
          }}
        >
          6 modules
        </span>
      </div>

      <div className="feature-grid">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            className="feature-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -6 }}
          >
            <div className="feature-icon">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
            <span className="feature-tag">{f.tag}</span>
          </motion.div>
        ))}
      </div>

      <div className="section-title" style={{ marginTop: 28 }}>
        <h2>Your courses</h2>
        <div className="bar" />
        <Link
          to="/course/new"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          + New
        </Link>
      </div>

      {loading && <LoadingState message="Loading courses..." />}
      {error && <ErrorState message={error} />}

      {!loading && !error && courses.length === 0 && (
        <motion.div
          className="empty"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          No courses yet. Click <strong style={{ color: "var(--cyan)" }}>+ New Course</strong> to spin up your first neural map.
        </motion.div>
      )}

      {!loading && !error && courses.length > 0 && (
        <div className="course-grid">
          {courses.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link
                to={`/course/${c.id}`}
                className="course-tile"
                style={{ display: "block", color: "inherit", textDecoration: "none" }}
              >
                <div className="course-tile-arrow">→</div>
                <div className="course-tile-title">{c.title}</div>
                <div className="course-tile-meta">
                  Course ID · {String(c.id).slice(0, 8)}…
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
