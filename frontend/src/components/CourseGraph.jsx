import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

// Pixel sizes used by the layout.
const NODE_W = 200;
const NODE_H = 72;
const ROOT_W = 240;
const ROOT_H = 84;

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.2;
const FIT_PADDING = 40;

const STATUS_BG = {
  pending: "rgba(255, 181, 71, 0.12)",   // amber tint
  learning: "rgba(6, 214, 255, 0.14)",   // cyan tint
  completed: "rgba(16, 224, 164, 0.14)", // emerald tint
};
const STATUS_BORDER = {
  pending: "#ffb547",
  learning: "#06d6ff",
  completed: "#10e0a4",
};
const STATUS_GLOW = {
  pending: "rgba(255, 181, 71, 0.6)",
  learning: "rgba(6, 214, 255, 0.65)",
  completed: "rgba(16, 224, 164, 0.65)",
};
// Edge colors are a deeper shade of the destination node's status color,
// so the eye can trace from parent → child without losing the connection.
const STATUS_EDGE = {
  pending: "#ff8a3d",   // deep amber
  learning: "#22a7ff",  // deep cyan
  completed: "#10e0a4", // emerald
};
const DEFAULT_EDGE = "rgba(124, 92, 255, 0.55)";

/**
 * Semicircle / fan layout (downward arc):
 *   - Root sits at the world origin (0, 0), anchoring the fan.
 *   - Topics are placed evenly along the LOWER semicircle of radius R1,
 *     sweeping anti-clockwise: starting at θ=π (left, 9 o'clock),
 *     down through θ=π/2 (bottom, 6 o'clock), and ending at θ=0
 *     (right, 3 o'clock). Topic i sits at θ = π * (1 - i/(N-1)).
 *   - Subtopics are placed on an outer semicircle of radius R2, each
 *     topic owning a slice of width π/N centred on its angle.
 *
 * Returns a positions map plus a tight bbox around the populated area.
 */
function computeRadialLayout(tree) {
  const positions = {};
  const topics = tree?.children || [];
  const N = topics.length;

  // Two concentric semicircles — same radii for the whole tree.
  // R1 = inner arc (root → topics), R2 = outer arc (topic → subtopics).
  const R1 = Math.max(320, 220 + N * 22);
  const R2 = R1 + 280;

  positions[tree.id] = { x: 0, y: 0, width: ROOT_W, height: ROOT_H, label: "" };

  if (N === 0) {
    const bbox = {
      minX: -ROOT_W,
      maxX: ROOT_W,
      minY: -ROOT_H,
      maxY: ROOT_H,
      width: ROOT_W * 2,
      height: ROOT_H * 2,
    };
    return { positions, bbox };
  }

  // Topic angles along the lower semicircle, anti-clockwise.
  // In screen coordinates (y down), anti-clockwise visually = decreasing θ,
  // so we go π → π/2 → 0 (left → bottom → right).
  const topicAngles = topics.map((_, i) =>
    N === 1 ? Math.PI / 2 : Math.PI * (1 - i / (N - 1))
  );

  topics.forEach((topic, i) => {
    const angle = topicAngles[i];
    positions[topic.id] = {
      x: R1 * Math.cos(angle),
      y: R1 * Math.sin(angle),
      width: NODE_W,
      height: NODE_H,
      label: `${i + 1}`,
    };
  });

  // Subtopics on the outer semicircle. Every topic → subtopic edge
  // has the same length (R2 - R1 = 280 px) regardless of how many
  // subtopics the parent has.
  //
  // Sector width: instead of a perfect π/N (which makes adjacent
  // topics' subtopics sit flush against each other and visibly overlap
  // when there are many subtopics), we use 0.75 * π/N — a slight
  // tighten that leaves a clear gap between sectors and clusters
  // each topic's subtopics into a narrower arc under their parent.
  const SECTOR_FILL = 0.75;
  topics.forEach((topic, ti) => {
    const subs = topic.children || [];
    if (subs.length === 0) return;

    const topicAngle = topicAngles[ti];
    const sectorSize = (Math.PI / N) * SECTOR_FILL;
    const sectorStart = topicAngle + sectorSize / 2; // boundary toward θ=π (left)
    const sectorEnd = topicAngle - sectorSize / 2;   // boundary toward θ=0 (right)

    subs.forEach((sub, si) => {
      const subAngle =
        subs.length === 1
          ? topicAngle
          : sectorStart - (sectorSize * si) / (subs.length - 1);
      positions[sub.id] = {
        x: R2 * Math.cos(subAngle),
        y: R2 * Math.sin(subAngle),
        width: NODE_W,
        height: NODE_H,
        label: `${ti + 1}.${si + 1}`,
      };
    });
  });

  // Tight bbox from actual node extents (the world only fills the
  // lower half, so we don't waste fit-zoom on empty top space).
  const pad = 24;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of Object.values(positions)) {
    const halfW = (p.width || 0) / 2;
    const halfH = (p.height || 0) / 2;
    if (p.x - halfW < minX) minX = p.x - halfW;
    if (p.x + halfW > maxX) maxX = p.x + halfW;
    if (p.y - halfH < minY) minY = p.y - halfH;
    if (p.y + halfH > maxY) maxY = p.y + halfH;
  }
  const bbox = {
    minX: minX - pad,
    maxX: maxX + pad,
    minY: minY - pad,
    maxY: maxY + pad,
    width: (maxX - minX) + pad * 2,
    height: (maxY - minY) + pad * 2,
  };
  return { positions, bbox };
}

function flatten(tree) {
  const out = [];
  function walk(n) {
    out.push(n);
    (n.children || []).forEach(walk);
  }
  if (tree) walk(tree);
  return out;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export default function CourseGraph({ tree, courseId }) {
  const navigate = useNavigate();
  const containerRef = useRef(null);

  const { positions, bbox } = useMemo(() => computeRadialLayout(tree), [tree]);
  const flatNodes = useMemo(() => flatten(tree), [tree]);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 });

  // Per-node fade-in delay. Order: root → topics anti-clockwise
  // (index 0 = left at θ=π, going right through bottom to θ=0) →
  // subtopics in their parent's sector (left → right).
  // The actual staggered fade-in is driven by a CSS animation; this
  // memo just hands each node its `animation-delay`.
  const animationDelays = useMemo(() => {
    const map = new Map();
    if (!tree) return map;
    map.set(tree.id, 0);
    const topics = tree.children || [];
    const topicStep = 90;
    const subStep = 50;
    topics.forEach((topic, i) => {
      map.set(topic.id, 140 + i * topicStep);
    });
    const subBaseDelay = 140 + topics.length * topicStep + 100;
    topics.forEach((topic, ti) => {
      const subs = topic.children || [];
      subs.forEach((sub, si) => {
        map.set(sub.id, subBaseDelay + ti * topicStep + si * subStep);
      });
    });
    return map;
  }, [tree]);

  function fitToViewport(rect) {
    if (!rect || bbox.width <= 0 || bbox.height <= 0) {
      return { zoom: 1, pan: { x: rect ? rect.width / 2 : 0, y: rect ? rect.height / 2 : 0 } };
    }
    const fitZoomX = (rect.width - FIT_PADDING * 2) / bbox.width;
    const fitZoomY = (rect.height - FIT_PADDING * 2) / bbox.height;
    const fitZoom = clamp(Math.min(fitZoomX, fitZoomY, 1), ZOOM_MIN, 1);

    // Place the BBOX CENTER at the viewport center, not world (0,0).
    // For a semicircle the root sits at the top of the figure, so
    // centering on it leaves the figure hanging below. Centering on
    // the bbox center keeps the figure visually balanced and shifts
    // the root slightly above the viewport center.
    const bboxCenterX = (bbox.minX + bbox.maxX) / 2;
    const bboxCenterY = (bbox.minY + bbox.maxY) / 2;
    return {
      zoom: fitZoom,
      pan: {
        x: rect.width / 2 - bboxCenterX * fitZoom,
        y: rect.height / 2 - bboxCenterY * fitZoom,
      },
    };
  }

  useLayoutEffect(() => {
    // Synchronous fit so the browser never paints the graph with the
    // default zoom=1, pan=(0,0) values — the user would see a single
    // frame of the graph pinned to the top-left at full size before
    // it jumps to fit. useLayoutEffect runs before paint, so React
    // commits the fitted state in the same frame as mount.
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const next = fitToViewport(rect);
    setZoom(next.zoom);
    setPan(next.pan);
  }, [tree, bbox.width, bbox.height]);

  useEffect(() => {
    function onResize() {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const next = fitToViewport(rect);
      setZoom(next.zoom);
      setPan(next.pan);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bbox.width, bbox.height]);

  // Track the cursor over the canvas so .graph-mouse-glow can brighten
  // the area near it. Throttled to once per animation frame.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let frame = 0;
    function onMove(e) {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        el.style.setProperty("--gx", `${x}%`);
        el.style.setProperty("--gy", `${y}%`);
        frame = 0;
      });
    }
    el.addEventListener("mousemove", onMove);
    return () => {
      el.removeEventListener("mousemove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  function handleMouseDown(e) {
    if (e.target.closest(".graph-node")) return;
    if (e.target.closest(".graph-toolbar")) return;
    if (e.target.closest(".graph-legend")) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      originX: pan.x,
      originY: pan.y,
    };
    e.preventDefault();
  }

  function handleMouseMove(e) {
    if (!dragRef.current.active) return;
    setPan({
      x: dragRef.current.originX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.originY + (e.clientY - dragRef.current.startY),
    });
  }

  function endDrag() {
    dragRef.current.active = false;
  }

  function handleWheel(e) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    setZoom((z) => clamp(z + delta, ZOOM_MIN, ZOOM_MAX));
  }

  function zoomIn() {
    setZoom((z) => clamp(z + ZOOM_STEP, ZOOM_MIN, ZOOM_MAX));
  }
  function zoomOut() {
    setZoom((z) => clamp(z - ZOOM_STEP, ZOOM_MIN, ZOOM_MAX));
  }
  function resetView() {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const next = fitToViewport(rect);
    setZoom(next.zoom);
    setPan(next.pan);
  }

  function handleNodeClick(node, e) {
    // Drop focus/hover immediately so the node isn't still scaled
    // and glowing at the instant the graph unmounts. That lingering
    // hover state is what produces the microsecond flicker on click.
    if (e && e.currentTarget && e.currentTarget.blur) {
      e.currentTarget.blur();
    }
    if (node.type === "root") {
      navigate(`/course/${courseId}/main`);
    } else {
      navigate(`/course/${courseId}/node/${node.id}`);
    }
  }

  if (!tree) return null;

  const edges = [];
  flatNodes.forEach((n) => {
    (n.children || []).forEach((child) => {
      const p = positions[n.id];
      const c = positions[child.id];
      if (!p || !c) return;
      const childStatus = (child.status || "pending").toLowerCase();
      // Geometric length of the edge — used for the stroke-dasharray
      // draw-in animation (one segment = full length, so the line is
      // fully hidden until dashoffset animates to 0).
      const dx = c.x - p.x;
      const dy = c.y - p.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      edges.push({
        key: `${n.id}-${child.id}`,
        x1: p.x,
        y1: p.y,
        x2: c.x,
        y2: c.y,
        color: STATUS_EDGE[childStatus] || DEFAULT_EDGE,
        // Thinner, less saturated edges when zoomed out so they
        // don't dominate the canvas.
        opacity: Math.min(0.85, 0.35 + zoom * 0.5),
        length,
        // Match the child's node fade-in delay so the edge draws
        // toward the node as it appears.
        delay: animationDelays.get(child.id) || 0,
      });
    });
  });

  const strokeWidth = Math.min(2.5, 2.5 * zoom);

  const worldStyle = {
    width: bbox.width,
    height: bbox.height,
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: "0 0",
  };

  return (
    <div
      ref={containerRef}
      className="graph-canvas"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onWheel={handleWheel}
    >
      <div className="graph-mouse-glow" aria-hidden="true" />
      <div className="graph-hint">
        Drag to pan · Ctrl + scroll to zoom · click a node to open
      </div>

      <div className="graph-toolbar">
        <button type="button" onClick={zoomOut} aria-label="Zoom out" title="Zoom out">
          −
        </button>
        <span className="graph-zoom-label">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={zoomIn} aria-label="Zoom in" title="Zoom in">
          +
        </button>
        <button type="button" onClick={resetView} title="Fit graph to viewport">
          Fit
        </button>
      </div>

      <div className="graph-legend">
        <div className="graph-legend-item">
          <span className="legend-dot pending" />
          <span>Pending</span>
        </div>
        <div className="graph-legend-item">
          <span className="legend-dot learning" />
          <span>Learning</span>
        </div>
        <div className="graph-legend-item">
          <span className="legend-dot completed" />
          <span>Completed</span>
        </div>
      </div>

      <div className="graph-world" style={worldStyle}>
        <svg
          className="graph-edges"
          width={bbox.width}
          height={bbox.height}
          viewBox={`${bbox.minX} ${bbox.minY} ${bbox.width} ${bbox.height}`}
          style={{
            position: "absolute",
            left: bbox.minX,
            top: bbox.minY,
          }}
        >
          {edges.map((e) => (
            <line
              key={e.key}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              stroke={e.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              opacity={e.opacity}
              strokeDasharray={e.length}
              strokeDashoffset={e.length}
              style={{ animationDelay: `${e.delay}ms` }}
            />
          ))}
        </svg>

        {flatNodes.map((node) => {
          const pos = positions[node.id];
          if (!pos) return null;
          const status = (node.status || "pending").toLowerCase();
          const bg = STATUS_BG[status] || STATUS_BG.pending;
          const border = STATUS_BORDER[status] || STATUS_BORDER.pending;
          const glow = STATUS_GLOW[status] || STATUS_GLOW.pending;
          const isRoot = node.type === "root";
          const delay = animationDelays.get(node.id) || 0;
          return (
            <div
              key={node.id}
              className={`graph-node ${isRoot ? "graph-node-root" : ""}`}
              style={{
                left: pos.x - pos.width / 2,
                top: pos.y - pos.height / 2,
                width: pos.width,
                height: pos.height,
                background: bg,
                borderColor: border,
                "--node-glow": glow,
                // Per-node stagger delay for the fade-in animation.
                // Skip the root — its CSS combines fade-in + pulse with
                // its own timing, and an inline animationDelay would
                // clobber the pulse's offset.
                ...(isRoot ? {} : { animationDelay: `${delay}ms` }),
              }}
              onClick={(e) => handleNodeClick(node, e)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNodeClick(node, e);
              }}
            >
              {pos.label && (
                <span className="graph-node-badge">{pos.label}</span>
              )}
              <div className="graph-node-title">{node.title}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}