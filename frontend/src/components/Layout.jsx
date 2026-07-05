import { Outlet } from "react-router-dom";
import AuroraBackground from "./AuroraBackground.jsx";
import Sidebar from "./Sidebar.jsx";

export default function Layout() {
  return (
    <>
      <AuroraBackground />
      <div className="app">
        <Sidebar />
        <main className="main">
          <div className="page-inner">
            <Outlet />
          </div>
        </main>
      </div>
    </>
  );
}
