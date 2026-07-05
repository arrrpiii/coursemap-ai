import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getCourseTree } from "../api/coursesApi.js";
import CourseGraph from "../components/CourseGraph.jsx";
import { ErrorState, LoadingState } from "../components/LoadingState.jsx";

export default function CourseTreePage() {
  const { courseId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getCourseTree(courseId);
      setData(res);
    } catch (err) {
      setError(err.message || "Failed to load course");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState message="Loading course graph..." />;
  if (error) return <ErrorState message={error} />;
  if (!data || !data.tree) {
    return <ErrorState message="Course not found." />;
  }

  return (
    <div className="course-graph-page">
      <CourseGraph tree={data.tree} courseId={courseId} />
    </div>
  );
}