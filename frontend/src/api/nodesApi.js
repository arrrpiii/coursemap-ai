import { apiGet, apiPatch } from "./client.js";

export function getNodeWorkspace(courseId, nodeId) {
  return apiGet(`/courses/${courseId}/nodes/${nodeId}`);
}

export function updateNodeStatus(courseId, nodeId, status) {
  return apiPatch(`/courses/${courseId}/nodes/${nodeId}/status`, { status });
}