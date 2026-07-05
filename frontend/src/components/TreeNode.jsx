import { useNavigate } from "react-router-dom";
import StatusBadge from "./StatusBadge.jsx";

export default function TreeNode({ node, courseId }) {
  const navigate = useNavigate();

  if (!node) return null;

  function handleClick(e) {
    // Don't navigate when clicking the status badge (a span).
    if (e.target.closest(".status-badge")) return;
    if (node.type === "root") {
      navigate(`/course/${courseId}/main`);
    } else {
      navigate(`/course/${courseId}/node/${node.id}`);
    }
  }

  return (
    <div className="tree-node-wrapper">
      <div
        className={`tree-node ${node.type || ""}`}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleClick(e);
        }}
      >
        <span className="title">{node.title}</span>
        <span className="tag">{node.type}</span>
        <StatusBadge status={node.status} />
      </div>

      {node.children && node.children.length > 0 && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              courseId={courseId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
