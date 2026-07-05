import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
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
      setWorkspace((prev) =>
        prev ? { ...prev, node: { ...prev.node, status } } : prev
      );
    } catch (err) {
      setError(err.message || "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  }

  if (error && !workspace) return <ErrorState message={error} />;

  const node = workspace?.node || {};
  const course = workspace?.course || {};
  const parent = workspace?.parent;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="breadcrumb">
        <Link to={`/course/${courseId}`}>{course.title || "Course"}</Link>
        <span>{parent ? parent.title : "Root"}</span>
        <span>{node.title || "…"}</span>
      </div>

      <div className="page-header">
        <div>
          <div className="eyebrow">// Node workspace</div>
          <h2>
            {node.title || "Loading…"}
            {node.type && <span className="tag">{node.type}</span>}
          </h2>
          <p>
            {node.status && <StatusBadge status={node.status} />}
          </p>
        </div>
        <div className="row">
          {node.status && (
            <>
              <label style={{ marginBottom: 0 }}>Status</label>
              <StatusSelect
                value={node.status}
                onChange={handleStatusChange}
                disabled={updatingStatus}
              />
            </>
          )}
          <motion.button
            type="button"
            className="primary"
            onClick={() => navigate(`/course/${courseId}/node/${nodeId}/questions`)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Generate questions →
          </motion.button>
        </div>
      </div>

      <motion.div
        className="card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      >
        {loading && !workspace ? (
          <LoadingState message="Loading chat…" />
        ) : (
          <ChatPanel
            courseId={courseId}
            nodeId={nodeId}
            nodeTitle={node.title || ""}
          />
        )}
      </motion.div>
    </motion.div>
  );
}
