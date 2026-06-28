export function LoadingState({ message = "Loading..." }) {
  return <div className="loading">{message}</div>;
}

export function ErrorState({ message }) {
  if (!message) return null;
  return <div className="error">{message}</div>;
}

export function EmptyState({ message = "Nothing here yet." }) {
  return <div className="empty">{message}</div>;
}
