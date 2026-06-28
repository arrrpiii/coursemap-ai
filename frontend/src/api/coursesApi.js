import { apiDelete, apiGet, apiPost } from "./client.js";

export function createCourse(title, syllabus) {
  return apiPost("/courses", { title, syllabus });
}

export function listCourses() {
  return apiGet("/courses");
}

export function getCourseTree(courseId) {
  return apiGet(`/courses/${courseId}/tree`);
}

export function deleteCourse(courseId) {
  return apiDelete(`/courses/${courseId}`);
}
