import TreeNode from "./TreeNode.jsx";

export default function CourseTree({ tree, courseId }) {
  if (!tree) return null;
  return (
    <div className="tree">
      <TreeNode node={tree} courseId={courseId} />
    </div>
  );
}
