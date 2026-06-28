const STATUSES = ["pending", "learning", "completed"];

export default function StatusSelect({ value, onChange, disabled = false }) {
  return (
    <select
      className="status-select"
      value={value || "pending"}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
