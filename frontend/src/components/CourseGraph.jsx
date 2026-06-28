import { useLayoutEffect, useMemo, useRef, useState } from "react";
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
  pending: "#fee2e2",   // light red
  learning: "#fef3c7",  // light yellow
  completed: "#dcfce7", // light green
};
const STATUS_BORDER = {
  pending: "#fca5a5",
  learning: "#fcd34d",
  completed: "#86efac",
};
// Edge colors are a deeper shade of the destination node's status color,
// so the eye can trace from parent → child without losing the connection.
const STATUS_EDGE = {
  pending: "#dc2626",   // deeper red
  learning: "#d97706",  // deeper amber
  completed: "#16a34a", // deeper green
};
const DEFAULT_EDGE = "#64748b";

/**
 * Radial / sunburst layout:
 *   - Root sits at the world origin (0, 0).
 *   - Topics are placed evenly on an inner ring of radius R1.
 *   - Subtopics are placed on an outer ring of radius R2, sharing the angular
 *     sector of their parent topic (so each topic "owns" a slice of the outer
 *     ring for its subtopics).
 *
 * Returns a positions map plus a bbox covering the whole world.
 */
function computeRadialLayout(tree) {
  const positions = {};
  const topics = tree?.children || [];
  const N = topics.length;

  // Adaptive radii so a course with many topics/subtopics still fits without
  // bumping neighbours into each other.
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

  // Topics evenly spaced. Start at top (-π/2) and go clockwise.
  topics.forEach((topic, i) => {
    const angle = -Math.PI / 2 + (i / N) * 2 * Math.PI;
    positions[topic.id] = {
      x: R1 * Math.cos(angle),
      y: R1 * Math.sin(angle),
      width: NODE_W,
      height: NODE_H,
      label: `${i + 1}`,
    };
  });

  // Subtopics in each topic's angular sector on the outer ring.
  topics.forEach((topic, ti) => {
    const subs = topic.children || [];
    if (subs.length === 0) return;

    const topicAngle = -Math.PI / 2 + (ti / N) * 2 * Math.PI;
    const sectorSize = (2 * Math.PI) / N;
    const sectorStart = topicAngle - sectorSize / 2;

    subs.forEach((sub, si) => {
      const subAngle = sectorStart + (sectorSize * (si + 0.5)) / subs.length;
      positions[sub.id] = {
        x: R2 * Math.cos(subAngle),
        y: R2 * Math.sin(subAngle),
        width: NODE_W,
        height: NODE_H,
        label: `${ti + 1}.${si + 1}`,
      };
    });
  });

  // Square bbox that contains the entire outer ring.
  const half = R2 + Math.max(NODE_W, NODE_H) + 20;
  const bbox = {
    minX: -half,
    maxX: half,
    minY: -half,
    maxY: half,
    width: half * 2,
    height: half * 2,
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

  function fitToViewport(rect) {
    if (!rect || bbox.width <= 0 || bbox.height <= 0) {
      return { zoom: 1, pan: { x: rect ? rect.width / 2 : 0, y: rect ? rect.height / 2 : 0 } };
    }
    const fitZoomX = (rect.width - FIT_PADDING * 2) / bbox.width;
    const fitZoomY = (rect.height - FIT_PADDING * 2) / bbox.height;
    const fitZoom = clamp(Math.min(fitZoomX, fitZoomY, 1), ZOOM_MIN, 1);

    // World (0,0) is the root. Place it in the center of the viewport.
    return { zoom: fitZoom, pan: { x: rect.width / 2, y: rect.height / 2 } };
  }

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const next = fitToViewport(rect);
    setZoom(next.zoom);
    setPan(next.pan);
  }, [tree, bbox.width, bbox.height]);

  useLayoutEffect(() => {
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

  function handleNodeClick(node) {
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
      edges.push({
        key: `${n.id}-${child.id}`,
        x1: p.x,
        y1: p.y,
        x2: c.x,
        y2: c.y,
        color: STATUS_EDGE[childStatus] || DEFAULT_EDGE,
      });
    });
  });

  const strokeWidth = 2.5 / zoom;

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
          <span>Marked</span>
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
            />
          ))}
        </svg>

        {flatNodes.map((node) => {
          const pos = positions[node.id];
          if (!pos) return null;
          const status = (node.status || "pending").toLowerCase();
          const bg = STATUS_BG[status] || STATUS_BG.pending;
          const border = STATUS_BORDER[status] || STATUS_BORDER.pending;
          const isRoot = node.type === "root";
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
              }}
              onClick={() => handleNodeClick(node)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNodeClick(node);
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