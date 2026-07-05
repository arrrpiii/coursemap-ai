import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteCourse, getCourseTree } from "../api/coursesApi.js";
import {
  generateSamplePaper,
  listPreviousSamplePapers,
} from "../api/aiApi.js";
import AiOutputPanel from "../components/AiOutputPanel.jsx";
import { ErrorState, LoadingState } from "../components/LoadingState.jsx";

function formatTimestamp(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  } catch (_) {
    return iso;
  }
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] },
  }),
};

export default function CourseMainPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [totalMarks, setTotalMarks] = useState(100);
  const [duration, setDuration] = useState(180);
  const [difficulty, setDifficulty] = useState("mixed");
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [paperOutput, setPaperOutput] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  const [history, setHistory] = useState([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [historyExpandedId, setHistoryExpandedId] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const data = await listPreviousSamplePapers(courseId);
      setHistory(data && data.papers ? data.papers : []);
    } catch (_) {
      // silent
    } finally {
      setHistoryLoading(false);
    }
  }

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await getCourseTree(courseId);
        if (!cancelled) setCourse(data && data.course);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load course");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  async function handleGenerate(e) {
    e.preventDefault();
    setGenerating(true);
    setGenError("");
    setPaperOutput(null);
    try {
      const result = await generateSamplePaper(courseId, {
        totalMarks: Number(totalMarks),
        durationMinutes: Number(duration),
        difficulty,
        includeAnswers,
      });
      setPaperOutput(result);
      loadHistory();
    } catch (err) {
      setGenError(err.message || "Failed to generate paper");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteCourse(courseId);
      navigate("/");
    } catch (err) {
      setDeleteError(err.message || "Failed to delete course");
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  if (loading) return <LoadingState message="Loading course..." />;
  if (error) return <ErrorState message={error} />;
  if (!course) return <ErrorState message="Course not found." />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="breadcrumb">
        <Link to={`/course/${courseId}`}>← Back to tree</Link>
      </div>

      <div className="page-header">
        <div>
          <div className="eyebrow">// Course command center</div>
          <h2>{course.title}</h2>
          <p>Course-level workspace. Generate a full sample question paper.</p>
        </div>
        <div className="row">
          {!confirmingDelete ? (
            <button
              type="button"
              className="danger-secondary"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete course
            </button>
          ) : (
            <div className="row">
              <span className="danger-text">
                Delete this course and ALL its data?
              </span>
              <button
                type="button"
                className="secondary"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-primary"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Yes, delete forever"}
              </button>
            </div>
          )}
        </div>
      </div>

      {deleteError && <ErrorState message={deleteError} />}

      <motion.div
        className="card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <h3>Syllabus</h3>
        <div className="syllabus-box">{course.syllabus || "(no syllabus)"}</div>
      </motion.div>

      {history.length > 0 && (
        <motion.div
          className={`collapsible-card${historyExpanded ? " expanded" : ""}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
        >
          <button
            type="button"
            className="collapsible-header"
            onClick={() => setHistoryExpanded((v) => !v)}
            aria-expanded={historyExpanded}
          >
            <div className="collapsible-header-left">
              <span className="collapsible-chevron" aria-hidden="true">▾</span>
              <span className="collapsible-title">Previous sample papers</span>
            </div>
            <span className="collapsible-count">{history.length}</span>
          </button>

          <div className="collapsible-content">
            <div className="collapsible-content-inner">
              <div className="history-list">
                {history.map((entry, idx) => {
                  const id = entry.id || `${entry.createdAt}-${idx}`;
                  const isOpen = historyExpandedId === id;
                  const meta = entry.metadata || {};
                  const totalQ =
                    (entry.content &&
                      entry.content.sections &&
                      entry.content.sections.reduce(
                        (acc, s) =>
                          acc + ((s.questions && s.questions.length) || 0),
                        0
                      )) ||
                    0;
                  return (
                    <div
                      key={id}
                      className={`history-item${isOpen ? " expanded" : ""}`}
                    >
                      <button
                        type="button"
                        className="history-item-header"
                        onClick={() =>
                          setHistoryExpandedId(isOpen ? null : id)
                        }
                        aria-expanded={isOpen}
                      >
                        <div className="history-item-meta">
                          <span className="history-item-date">
                            {formatTimestamp(entry.createdAt)}
                          </span>
                          <span className="history-pill">
                            {meta.difficulty || "?"}
                          </span>
                          <span className="history-pill">
                            {meta.totalMarks || "?"} marks
                          </span>
                          <span className="history-pill">
                            {meta.durationMinutes || "?"} min
                          </span>
                          <span className="history-pill">{totalQ} Q</span>
                        </div>
                        <span className="history-item-chevron" aria-hidden="true">
                          ▸
                        </span>
                      </button>
                      {isOpen && (
                        <div className="history-item-body">
                          <AiOutputPanel
                            output={entry.content || { sections: [] }}
                            showAnswers={false}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {historyLoading && history.length === 0 && (
                <div className="muted" style={{ padding: 8 }}>
                  Loading history…
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      <motion.form
        className="card"
        onSubmit={handleGenerate}
        style={{ marginTop: 18 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      >
        <h3>Generate sample question paper</h3>
        <div className="form-row">
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
            <label>Total marks</label>
            <input
              type="number"
              min={10}
              max={500}
              value={totalMarks}
              onChange={(e) => setTotalMarks(e.target.value)}
            />
          </motion.div>
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}>
            <label>Duration (minutes)</label>
            <input
              type="number"
              min={30}
              max={600}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </motion.div>
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}>
            <label>Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="easy">easy</option>
              <option value="medium">medium</option>
              <option value="hard">hard</option>
              <option value="mixed">mixed</option>
            </select>
          </motion.div>
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3}>
            <label>Include answers</label>
            <select
              value={includeAnswers ? "yes" : "no"}
              onChange={(e) => setIncludeAnswers(e.target.value === "yes")}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </motion.div>
        </div>
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={4}
          style={{ marginTop: 22 }}
        >
          <motion.button
            type="submit"
            className="primary"
            disabled={generating}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            {generating ? "Generating paper..." : "Generate sample paper →"}
          </motion.button>
        </motion.div>
      </motion.form>

      {genError && (
        <div style={{ marginTop: 14 }}>
          <ErrorState message={genError} />
        </div>
      )}

      {paperOutput && (
        <motion.div
          className="card"
          style={{ marginTop: 18 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h3>Result</h3>
          <AiOutputPanel output={paperOutput} showAnswers={false} />
        </motion.div>
      )}
    </motion.div>
  );
}
