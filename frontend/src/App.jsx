import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import CourseMainPage from "./pages/CourseMainPage.jsx";
import CourseTreePage from "./pages/CourseTreePage.jsx";
import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import NewCoursePage from "./pages/NewCoursePage.jsx";
import NodeWorkspacePage from "./pages/NodeWorkspacePage.jsx";
import QuestionsPage from "./pages/QuestionsPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/course/new" element={<NewCoursePage />} />
        <Route path="/course/:courseId" element={<CourseTreePage />} />
        <Route path="/course/:courseId/main" element={<CourseMainPage />} />
        <Route
          path="/course/:courseId/node/:nodeId"
          element={<NodeWorkspacePage />}
        />
        <Route
          path="/course/:courseId/node/:nodeId/questions"
          element={<QuestionsPage />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}