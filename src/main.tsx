import React from "react";
import { createRoot } from "react-dom/client";
import EndoChairsideGuide from "./nodedent/EndoChairsideGuide";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found");
}

createRoot(rootElement).render(
  <React.StrictMode>
    <EndoChairsideGuide />
  </React.StrictMode>
);
