import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
const App = lazy(() => import("./App"));
const Portfolio = lazy(() => import("./portfolio/Portfolio"));
const isPortfolio = /^\/projects(?:\/|$)/.test(window.location.pathname);
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={null}>
      {isPortfolio ? <Portfolio /> : <App />}
    </Suspense>
  </StrictMode>,
);
