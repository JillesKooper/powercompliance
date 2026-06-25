import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";

// HashRouter i.p.v. BrowserRouter: zo werkt de navigatie in elke serveer-context
// (dev-server, productie-build in dist/, refresh op een subpagina en file://)
// zonder dat de server een SPA-fallback nodig heeft.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
