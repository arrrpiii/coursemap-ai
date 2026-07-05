import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link, useParams } from "react-router-dom";
import {
  generateQuestions,
  listPreviousQuestions,
} from "../api/aiApi.js";
import { getNodeWorkspace } from "../api/nodesApi.js";
import AiOutputPanel from "../components/AiOutputPanel.jsx";
import { ErrorState, LoadingState } from "../components/LoadingState.jsx";

const QUESTION_TYPES = ["mcq", "short_answer", "long_answer", "numerical", "case_study"];
const DIFFICULTIES = ["easy", "medium", "hard", "mixed"];

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

export default function QuestionsPage() {
  const { courseId, nodeId } = useParams();

  const [node, setNode] = useState(null);
  const [course, setCourse] = useState(null);
  const [parent, setParent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [difficulty, setDifficulty] = useState("medium");
  const [count, setCount] = useState(10);
  const [selectedTypes, setSelectedTypes] = useState(["short_answer", "long_answer"]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [questionsOutput, setQuestionsOutput] = useState(null);

  const [history, setHistory] = useState([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [historyExpandedId, setHistoryExpandedId] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const data = await listPreviousQuestions(courseId, nodeId);
      setHistory(data && data.questions ? data.questions : []);
    } catch (_) {
      // silent
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await getNodeWorkspace(courseId, nodeId);
        if (!cancelled) {
          setNode(data && data.node);
          setCourse(data && data.course);
          setParent(data && data.parent);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load node");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [courseId, nodeId]);

  function toggleType(t) {
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }

  async function handleGenerate(e) {
    e.preventDefault();
    if (selectedTypes.length === 0) {
      setGenError("Select at least one question type.");
      return;
    }
    setGenerating(true);
    setGenError("");
    setQuestionsOutput(null);
    try {
      const res = await generateQuestions(courseId, nodeId, {
        difficulty,
        count: Number(count),
        questionTypes: selectedTypes,
      });
      setQuestionsOutput(res);
      loadHistory();
    } catch (err) {
      setGenError(err.message || "Failed to generate questions");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <LoadingState message="Loading node..." />;
  if (error) return <ErrorState message={error} />;
  if (!node) return <ErrorState message="Node not found." />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="breadcrumb">
        <Link to={`/course/${courseId}`}>{course?.title || "Course"}</Link>
        <span>{parent ? parent.title : "Root"}</span>
        <Link to={`/course/${courseId}/node/${nodeId}`}>{node.title}</Link>
        <span>Questions</span>
      </div>

      <div className="page-header">
        <div>
          <div className="eyebrow">// Question forge</div>
          <h2>Questions for: {node.title}</h2>
          <p className="muted">Generate exam-style questions for this node.</p>
        </div>
      </div>

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
              <span className="collapsible-title">Previous questions</span>
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
                  const questions =
                    (entry.content && entry.content.questions) || [];
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
                            {meta.count || questions.length} Q
                          </span>
                          <span className="history-pill history-pill-types">
                            {(meta.questionTypes || []).join(", ") || "—"}
                          </span>
                        </div>
                        <span className="history-item-chevron" aria-hidden="true">
                          ▸
                        </span>
                      </button>
                      {isOpen && (
                        <div className="history-item-body">
                          <AiOutputPanel
                            output={entry.content || { questions }}
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      >
        <h3>Settings</h3>
        <div className="form-row">
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
            <label>Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </motion.div>
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}>
            <label>Count</label>
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </motion.div>
        </div>

        <motion.label
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={2}
          style={{ marginTop: 18, display: "block" }}
        >
          Question types
        </motion.label>
        <motion.div
          className="checkbox-row"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={3}
        >
          {QUESTION_TYPES.map((t) => {
            const active = selectedTypes.includes(t);
            return (
              <label
                key={t}
                className={`checkbox-pill${active ? " active" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleType(t)}
                />
                {t.replace("_", " ")}
              </label>
            );
          })}
        </motion.div>

        {genError && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginTop: 14 }}
          >
            <ErrorState message={genError} />
          </motion.div>
        )}

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
            {generating ? "Generating questions..." : "Generate questions →"}
          </motion.button>
        </motion.div>
      </motion.form>

      {questionsOutput && (
        <motion.div
          className="card"
          style={{ marginTop: 18 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h3>Result</h3>
          <AiOutputPanel output={questionsOutput} showAnswers={false} />
        </motion.div>
      )}
    </motion.div>
  );
}
