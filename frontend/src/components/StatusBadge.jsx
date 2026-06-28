export default function StatusBadge({ status }) {
  const normalized = (status || "pending").toLowerCase();
  return (
    <span className={`status-badge ${normalized}`}>{normalized}</span>
  );
}
