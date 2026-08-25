import React from "react";
import { createRoot } from "react-dom/client";
import NodeDentApp from "./nodedent/NodeDentApp";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found");
}

const root = createRoot(rootElement);

async function renderApp() {
  let app: React.ReactNode = <NodeDentApp />;

  if (import.meta.env.DEV && window.location.hash === "#/dev/semantic-ui") {
    const { SemanticStateGallery } = await import("./nodedent/components/SemanticStateGallery");
    app = <SemanticStateGallery />;
  }

  root.render(<React.StrictMode>{app}</React.StrictMode>);
}

void renderApp();
