// Renders AI outputs in different shapes (text, questions, sample paper).
//
// `showAnswers` is the *initial* state for answer visibility. Each
// question has its own toggle so the user can reveal/hide answers
// independently.

import { useState } from "react";
import renderMarkdown from "../utils/markdown.jsx";

function useRevealed(count, initialAllRevealed) {
  const [revealed, setRevealed] = useState(() => {
    const set = new Set();
    if (initialAllRevealed) {
      for (let i = 0; i < count; i++) set.add(i);
    }
    return set;
  });

  function toggle(i) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return [revealed, toggle];
}

function AnswerBlock({ answer, isRevealed, onToggle }) {
  if (!answer) return null;
  return (
    <div className="q-answer-row">
      <div className="q-answer-content">
        {isRevealed ? (
          <div className="q-answer">
            <strong>Answer:</strong>{" "}
            {renderMarkdown(answer)}
          </div>
        ) : (
          <div className="q-answer-hidden">Answer hidden — click reveal</div>
        )}
      </div>
      <button
        type="button"
        className="q-answer-toggle"
        onClick={onToggle}
      >
        {isRevealed ? "Hide" : "Reveal"}
      </button>
    </div>
  );
}

function QuestionsList({ output, showAnswers }) {
  const questions = (output && output.questions) || [];
  const [revealed, toggle] = useRevealed(questions.length, showAnswers);

  if (questions.length === 0) {
    return <div className="muted">No questions were generated.</div>;
  }

  return (
    <div>
      {questions.map((q, i) => (
        <div key={i} className="question-item">
          <div className="q-line">
            <div className="q-text">
              {i + 1}. {renderMarkdown(q.question)}
            </div>
            <span className="q-meta">
              {q.type} · {q.difficulty}
            </span>
          </div>
          {q.type === "mcq" && q.options && q.options.length > 0 && (
            <ul className="q-options">
              {q.options.map((opt, j) => (
                <li key={j}>{renderMarkdown(opt)}</li>
              ))}
            </ul>
          )}
          <AnswerBlock
            answer={q.answer}
            isRevealed={revealed.has(i)}
            onToggle={() => toggle(i)}
          />
        </div>
      ))}
    </div>
  );
}

function SamplePaper({ output, showAnswers }) {
  const sections = (output && output.sections) || [];
  // Flatten section questions to a single index space so we can track
  // a single `revealed` set across the whole paper.
  const flat = [];
  sections.forEach((sec, si) => {
    (sec.questions || []).forEach((q, qi) => {
      flat.push({ q, key: `${si}-${qi}` });
    });
  });
  const [revealed, toggle] = useRevealed(flat.length, showAnswers);

  return (
    <div className="sample-paper">
      <div className="card">
        <h3>{output.title || "Sample Question Paper"}</h3>
        <p className="muted">
          Total marks: {output.totalMarks} · Duration: {output.durationMinutes} minutes
        </p>
      </div>
      {sections.map((section, si) => (
        <div key={si} className="sample-section">
          <h4>{section.name}</h4>
          {section.instructions && (
            <div className="instructions">
              {renderMarkdown(section.instructions)}
            </div>
          )}
          <ol>
            {(section.questions || []).map((q, qi) => {
              const flatIndex = flat.findIndex(
                (f) => f.key === `${si}-${qi}`
              );
              return (
                <li key={qi}>
                  {renderMarkdown(q.question)}
                  <span className="marks">[{q.marks} marks]</span>
                  <AnswerBlock
                    answer={q.answer}
                    isRevealed={flatIndex >= 0 && revealed.has(flatIndex)}
                    onToggle={() => flatIndex >= 0 && toggle(flatIndex)}
                  />
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

export default function AiOutputPanel({ output, showAnswers = true }) {
  if (!output) {
    return <div className="muted">AI output will appear here.</div>;
  }

  // Text-shaped outputs (explanation, generated_notes)
  if (typeof output === "string") {
    return <pre className="ai-output">{output}</pre>;
  }

  // Questions
  if (output.type === "questions" || Array.isArray(output.questions)) {
    return <QuestionsList output={output} showAnswers={showAnswers} />;
  }

  // Sample paper
  if (output.type === "sample_paper" || output.sections) {
    return <SamplePaper output={output} showAnswers={showAnswers} />;
  }

  // Fallback: pretty-print JSON
  return (
    <pre className="ai-output">{JSON.stringify(output, null, 2)}</pre>
  );
}