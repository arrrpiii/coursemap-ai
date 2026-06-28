import { apiDelete, apiGet, apiPost } from "./client.js";

export function explainNode(courseId, nodeId, userQuery) {
  return apiPost(`/courses/${courseId}/nodes/${nodeId}/explain`, {
    userQuery,
  });
}

export function generateQuestions(courseId, nodeId, payload) {
  return apiPost(`/courses/${courseId}/nodes/${nodeId}/questions`, payload);
}

export function generateSamplePaper(courseId, payload) {
  return apiPost(`/courses/${courseId}/sample-paper`, payload);
}

// ----- Per-node chat history -----

export function getChatHistory(courseId, nodeId) {
  return apiGet(`/courses/${courseId}/nodes/${nodeId}/chat`);
}

export function sendChatMessage(courseId, nodeId, message) {
  return apiPost(`/courses/${courseId}/nodes/${nodeId}/chat`, { message });
}

export function clearChat(courseId, nodeId) {
  return apiDelete(`/courses/${courseId}/nodes/${nodeId}/chat`);
}