// Renders AI outputs in different shapes (text, questions, sample paper).

export default function AiOutputPanel({ output }) {
  if (!output) {
    return <div className="muted">AI output will appear here.</div>;
  }

  // Text-shaped outputs (explanation, generated_notes)
  if (typeof output === "string") {
    return <pre className="ai-output">{output}</pre>;
  }

  // Questions
  if (output.type === "questions" || Array.isArray(output.questions)) {
    const questions = output.questions || [];
    if (questions.length === 0) {
      return <div className="muted">No questions were generated.</div>;
    }
    return (
      <div>
        {questions.map((q, i) => (
          <div key={i} className="question-item">
            <div className="q-line">
              <div className="q-text">
                {i + 1}. {q.question}
              </div>
              <span className="q-meta">
                {q.type} · {q.difficulty}
              </span>
            </div>
            {q.type === "mcq" && q.options && q.options.length > 0 && (
              <ul className="q-options">
                {q.options.map((opt, j) => (
                  <li key={j}>{opt}</li>
                ))}
              </ul>
            )}
            {q.answer && (
              <div className="q-answer">
                <strong>Answer:</strong> {q.answer}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Sample paper
  if (output.type === "sample_paper" || output.sections) {
    return (
      <div>
        <div className="card">
          <h3>{output.title || "Sample Question Paper"}</h3>
          <p className="muted">
            Total marks: {output.totalMarks} · Duration: {output.durationMinutes} minutes
          </p>
        </div>
        {(output.sections || []).map((section, i) => (
          <div key={i} className="sample-section">
            <h4>{section.name}</h4>
            {section.instructions && (
              <div className="instructions">{section.instructions}</div>
            )}
            <ol>
              {(section.questions || []).map((q, j) => (
                <li key={j}>
                  {q.question}
                  <span className="marks">[{q.marks} marks]</span>
                  {q.answer ? (
                    <div className="q-answer">
                      <strong>Answer:</strong> {q.answer}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    );
  }

  // Fallback: pretty-print JSON
  return (
    <pre className="ai-output">{JSON.stringify(output, null, 2)}</pre>
  );
}
