import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { LiveProvider } from "./live.tsx";
import { Router } from "./router.tsx";
import "./styles.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <Router>
      <LiveProvider>
        <App />
      </LiveProvider>
    </Router>
  </StrictMode>,
);
