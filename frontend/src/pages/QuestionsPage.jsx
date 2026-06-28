import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { generateQuestions } from "../api/aiApi.js";
import { getNodeWorkspace } from "../api/nodesApi.js";
import AiOutputPanel from "../components/AiOutputPanel.jsx";
import { ErrorState, LoadingState } from "../components/LoadingState.jsx";

const QUESTION_TYPES = ["mcq", "short_answer", "long_answer", "numerical", "case_study"];
const DIFFICULTIES = ["easy", "medium", "hard", "mixed"];

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
    <div>
      <div className="breadcrumb">
        <Link to={`/course/${courseId}`}>{course?.title || "Course"}</Link>
        <span>›</span>
        {parent ? <span>{parent.title}</span> : <span>Root</span>}
        <span>›</span>
        <Link to={`/course/${courseId}/node/${nodeId}`}>{node.title}</Link>
        <span>›</span>
        <span>Questions</span>
      </div>

      <div className="page-header">
        <div>
          <h2>Questions for: {node.title}</h2>
          <p className="muted">Generate exam-style questions for this node.</p>
        </div>
      </div>

      <form className="card" onSubmit={handleGenerate}>
        <h3>Settings</h3>
        <div className="form-row">
          <div>
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
          </div>
          <div>
            <label>Count</label>
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </div>
        </div>
        <label style={{ marginTop: 8 }}>Question types</label>
        <div className="checkbox-row">
          {QUESTION_TYPES.map((t) => (
            <label key={t}>
              <input
                type="checkbox"
                checked={selectedTypes.includes(t)}
                onChange={() => toggleType(t)}
              />
              {t}
            </label>
          ))}
        </div>
        <button type="submit" className="primary" disabled={generating}>
          {generating ? "Generating questions..." : "Generate questions"}
        </button>
      </form>

      {genError && <ErrorState message={genError} />}

      {questionsOutput && (
        <div className="card">
          <h3>Result</h3>
          <AiOutputPanel output={questionsOutput} />
        </div>
      )}
    </div>
  );
}
