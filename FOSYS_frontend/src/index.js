import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// ⛔ Disable rrweb ONLY for login + signup pages
const authRoutes = ["/login", "/signup"];

// If rrweb fetch wrapper exists → restore original fetch BEFORE any React runs
if (authRoutes.includes(window.location.pathname.toLowerCase())) {
  console.warn("%cRRWeb disabled on Auth pages", "color: orange; font-weight: bold;");

  // If rrweb wrapped fetch, undo it
  if (window.__RRWEB_FETCH_WRAPPED__ && window.__RRWEB_FETCH_ORIGINAL__) {
    window.fetch = window.__RRWEB_FETCH_ORIGINAL__;
  }

  // If rrweb record is present, disable recording
  if (window.record) {
    window.record = () => {};
  }
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
