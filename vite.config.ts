import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

function clinicalContentSecurityPolicy(command: "build" | "serve"): Plugin {
  const scriptSource = command === "serve" ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self'";
  const styleSource = command === "serve" ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'";
  const connectSource = command === "serve" ? "connect-src 'self' ws: wss:" : "connect-src 'none'";
  const policy = [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "form-action 'self'",
    scriptSource,
    styleSource,
    "img-src 'self' data:",
    "font-src 'self'",
    "media-src 'none'",
    "worker-src 'none'",
    "manifest-src 'self'",
    connectSource,
    "upgrade-insecure-requests",
  ].join("; ");

  return {
    name: "nodedent-clinical-content-security-policy",
    transformIndexHtml: {
      order: "pre",
      handler: () => [{
        tag: "meta",
        attrs: { "http-equiv": "Content-Security-Policy", content: policy },
        injectTo: "head-prepend",
      }],
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [clinicalContentSecurityPolicy(command), react(), tailwindcss()],
}));
