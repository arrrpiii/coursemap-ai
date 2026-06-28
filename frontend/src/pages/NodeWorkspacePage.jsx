import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getNodeWorkspace, updateNodeStatus } from "../api/nodesApi.js";
import ChatPanel from "../components/ChatPanel.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import StatusSelect from "../components/StatusSelect.jsx";
import { ErrorState, LoadingState } from "../components/LoadingState.jsx";

export default function NodeWorkspacePage() {
  const { courseId, nodeId } = useParams();
  const navigate = useNavigate();

  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getNodeWorkspace(courseId, nodeId);
      setWorkspace(data);
    } catch (err) {
      setError(err.message || "Failed to load node");
    } finally {
      setLoading(false);
    }
  }, [courseId, nodeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStatusChange(status) {
    setUpdatingStatus(true);
    try {
      await updateNodeStatus(courseId, nodeId, status);
      await load();
    } catch (err) {
      setError(err.message || "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  }

  if (loading) return <LoadingState message="Loading node workspace..." />;
  if (error) return <ErrorState message={error} />;
  if (!workspace) return <ErrorState message="Node not found." />;

  const node = workspace.node || {};
  const course = workspace.course || {};
  const parent = workspace.parent;

  return (
    <div>
      <div className="breadcrumb">
        <Link to={`/course/${courseId}`}>{course.title || "Course"}</Link>
        <span>›</span>
        {parent ? <span>{parent.title}</span> : <span>Root</span>}
        <span>›</span>
        <span>{node.title}</span>
      </div>

      <div className="page-header">
        <div>
          <h2>
            {node.title}
            <span className="tag">{node.type}</span>
          </h2>
          <p>
            <StatusBadge status={node.status} />
          </p>
        </div>
        <div className="row">
          <label style={{ marginBottom: 0 }}>Status</label>
          <StatusSelect
            value={node.status}
            onChange={handleStatusChange}
            disabled={updatingStatus}
          />
          <button
            type="button"
            className="secondary"
            onClick={() => navigate(`/course/${courseId}/node/${nodeId}/questions`)}
          >
            Generate questions →
          </button>
        </div>
      </div>

      <div className="card">
        <ChatPanel courseId={courseId} nodeId={nodeId} nodeTitle={node.title} />
      </div>
    </div>
  );
}