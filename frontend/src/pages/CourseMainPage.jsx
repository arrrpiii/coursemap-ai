import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteCourse, getCourseTree } from "../api/coursesApi.js";
import { generateSamplePaper } from "../api/aiApi.js";
import AiOutputPanel from "../components/AiOutputPanel.jsx";
import { ErrorState, LoadingState } from "../components/LoadingState.jsx";

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
    <div>
      <div className="breadcrumb">
        <Link to={`/course/${courseId}`}>← Back to tree</Link>
      </div>

      <div className="page-header">
        <div>
          <h2>{course.title}</h2>
          <p>Course-level workspace. Generate a full sample question paper.</p>
        </div>
        <div className="row">
          {!confirmingDelete ? (
            <button
              type="button"
              className="secondary"
              onClick={() => setConfirmingDelete(true)}
              style={{ background: "#fee2e2", color: "#991b1b" }}
            >
              Delete course
            </button>
          ) : (
            <div className="row">
              <span style={{ color: "#991b1b", fontSize: "0.9rem" }}>
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
                className="primary"
                onClick={handleDelete}
                disabled={deleting}
                style={{ background: "#dc2626" }}
              >
                {deleting ? "Deleting..." : "Yes, delete forever"}
              </button>
            </div>
          )}
        </div>
      </div>

      {deleteError && <ErrorState message={deleteError} />}

      <div className="card">
        <h3>Syllabus</h3>
        <div className="syllabus-box">{course.syllabus || "(no syllabus)"}</div>
      </div>

      <form className="card" onSubmit={handleGenerate}>
        <h3>Generate sample question paper</h3>
        <div className="form-row">
          <div>
            <label>Total marks</label>
            <input
              type="number"
              min={10}
              max={500}
              value={totalMarks}
              onChange={(e) => setTotalMarks(e.target.value)}
            />
          </div>
          <div>
            <label>Duration (minutes)</label>
            <input
              type="number"
              min={30}
              max={600}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
          <div>
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
          </div>
          <div>
            <label>Include answers</label>
            <select
              value={includeAnswers ? "yes" : "no"}
              onChange={(e) => setIncludeAnswers(e.target.value === "yes")}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>
        <button type="submit" className="primary" disabled={generating}>
          {generating ? "Generating paper..." : "Generate sample paper"}
        </button>
      </form>

      {genError && <ErrorState message={genError} />}

      {paperOutput && (
        <div className="card">
          <h3>Result</h3>
          <AiOutputPanel output={paperOutput} />
        </div>
      )}
    </div>
  );
}