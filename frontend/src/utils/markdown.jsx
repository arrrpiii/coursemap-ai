/**
 * Tiny zero-dependency Markdown renderer for AI assistant responses.
 *
 * Handles the subset Gemini reliably emits:
 *   # / ## / ###      headings                  → <h3> / <h4> / <h5>
 *   **bold** / __bold__                         → <strong>
 *   *italic* / _italic_                         → <em>
 *   `inline code`                              → <code>
 *   ```code``` blocks                           → <pre><code>
 *   * item / - item / • item   (one per line)   → <ul><li>
 *   1. item / 1) item           (contiguous)    → <ol><li>
 *   > quoted line (contiguous)                  → <blockquote>
 *
 * No `dangerouslySetInnerHTML` — every text node passes through React's
 * default escaping, so an AI response containing `<script>` stays as text.
 *
 * Returns a React fragment; callers can drop it anywhere a node is allowed.
 */

import { Fragment } from "react";

/* ---------- inline tokeniser ---------- */
//
// Walks `text` left-to-right, splitting on the first matching token
// at each step. Tokens are bold/italic/code; whitespace is preserved
// verbatim. We return an array of strings and React elements which
// the caller renders in place.
function tokeniseInline(text, keyBase) {
  const out = [];
  let cursor = 0;
  let counter = 0;
  // Bold first (longest prefix), then italic, then inline code.
  // Each alternative captures its inner group at index 2 / 4 / 6.
  const re = /\*\*([^*\n]+?)\*\*|__([^_\n]+?)__|\*([^*\n]+?)\*|_([^_\n]+?)_|`([^`\n]+?)`/;

  while (cursor < text.length) {
    const slice = text.slice(cursor);
    const m = re.exec(slice);
    if (!m) {
      // No more tokens. Skip the next block. The token matcher is stateless,
      // so re-running it on the whole remainder is fine; we slice by index.
      out.push(text.slice(cursor));
      break;
    }

    if (m.index > 0) out.push(text.slice(cursor, cursor + m.index));

    if (m[1] != null)      out.push(<strong key={`${keyBase}-b-${counter++}`}>{m[1]}</strong>);
    else if (m[2] != null) out.push(<strong key={`${keyBase}-b-${counter++}`}>{m[2]}</strong>);
    else if (m[3] != null) out.push(<em     key={`${keyBase}-i-${counter++}`}>{m[3]}</em>);
    else if (m[4] != null) out.push(<em     key={`${keyBase}-i-${counter++}`}>{m[4]}</em>);
    else if (m[5] != null) out.push(<code   key={`${keyBase}-c-${counter++}`}>{m[5]}</code>);

    cursor += m.index + m[0].length;
  }
  return out;
}

/* ---------- block parser ---------- */

function isBullet(s)    { return /^(\*|\-|\•)\s+/.test(s); }
function isOrdered(s)   { return /^\d+[.)]\s+/.test(s); }
function isHeading(s)   { return /^(#{1,6})\s+(.+)$/.exec(s); }
function isFence(s)     { return /^```/.test(s); }
function isBlockquote(s){ return /^>\s?/.test(s); }

export default function renderMarkdown(text) {
  if (!text) return null;

  const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw;

    // Skip blank lines between blocks.
    if (!line.trim()) { i++; continue; }

    // Fenced code block — preserve every byte inside verbatim.
    if (isFence(line)) {
      i++;
      const body = [];
      while (i < lines.length && !isFence(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // closing fence
      blocks.push(
        <pre key={`md-${blockKey++}`} className="md-pre">
          <code>{body.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Heading.
    const h = isHeading(line);
    if (h) {
      const level = Math.min(h[1].length, 6);
      const inner = tokeniseInline(h[2], `md-${blockKey}`);
      // Map to display-family headings. We don't go below h5 — anything
      // smaller is just paragraph text in our visual hierarchy.
      const Tag = `h${Math.min(level + 2, 5)}`;
      blocks.push(<Tag key={`md-${blockKey++}`} className="md-heading">{inner}</Tag>);
      i++;
      continue;
    }

    // Bulleted list.
    if (isBullet(line)) {
      const items = [];
      while (i < lines.length && isBullet(lines[i])) {
        items.push(lines[i].replace(/^(\*|\-|\•)\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={`md-${blockKey++}`} className="md-list md-list-ul">
          {items.map((it, j) => (
            <li key={j}>{tokeniseInline(it, `md-${blockKey}-ul-${j}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list.
    if (isOrdered(line)) {
      const items = [];
      while (i < lines.length && isOrdered(lines[i])) {
        items.push(lines[i].replace(/^\d+[.)]\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={`md-${blockKey++}`} className="md-list md-list-ol">
          {items.map((it, j) => (
            <li key={j}>{tokeniseInline(it, `md-${blockKey}-ol-${j}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Blockquote (contiguous `>` lines collapse into one).
    if (isBlockquote(line)) {
      const qLines = [];
      while (i < lines.length && (isBlockquote(lines[i]) || (qLines.length && lines[i].trim() && !isBullet(lines[i]) && !isOrdered(lines[i]) && !isHeading(lines[i]) && !isFence(lines[i])))) {
        if (isBlockquote(lines[i])) qLines.push(lines[i].replace(/^>\s?/, ""));
        else qLines.push(lines[i]);          // wrapped quote line
        i++;
      }
      blocks.push(
        <blockquote key={`md-${blockKey++}`} className="md-quote">
          {tokeniseInline(qLines.join(" "), `md-${blockKey}-q`)}
        </blockquote>
      );
      continue;
    }

    // Paragraph: collect adjacent non-blank, non-structural lines.
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !isHeading(lines[i]) &&
      !isFence(lines[i]) &&
      !isBullet(lines[i]) &&
      !isOrdered(lines[i]) &&
      !isBlockquote(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length) {
      blocks.push(
        <p key={`md-${blockKey++}`} className="md-p">
          {tokeniseInline(paraLines.join(" "), `md-${blockKey}-p`)}
        </p>
      );
    }
  }

  return <Fragment>{blocks}</Fragment>;
}
