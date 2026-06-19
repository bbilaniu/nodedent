import React from "react";
import { createRoot } from "react-dom/client";
import NodeDentApp from "./nodedent/NodeDentApp";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <NodeDentApp />
  </React.StrictMode>
);
