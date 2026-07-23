#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_ROOT = path.join(ROOT, "src", "nodedent");
const BUILD_INDEX = path.join(ROOT, "dist", "index.html");
const errors = [];

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(resolved);
    return /\.(?:ts|tsx)$/u.test(entry.name) ? [resolved] : [];
  });
}

if (!fs.existsSync(BUILD_INDEX)) {
  errors.push("dist/index.html is missing; run the production build before the clinical security check.");
} else {
  const index = fs.readFileSync(BUILD_INDEX, "utf8");
  const decodedIndex = index.replaceAll("&#39;", "'").replaceAll("&quot;", '"');
  const requiredDirectives = [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "connect-src 'none'",
  ];
  if (!/http-equiv=["']Content-Security-Policy["']/iu.test(index)) {
    errors.push("The production index is missing a Content-Security-Policy meta element.");
  }
  for (const directive of requiredDirectives) {
    if (!decodedIndex.includes(directive)) errors.push(`The production CSP is missing ${JSON.stringify(directive)}.`);
  }
  if (decodedIndex.includes("unsafe-inline") || decodedIndex.includes("unsafe-eval")) {
    errors.push("The production index must not allow unsafe-inline or unsafe-eval.");
  }
}

const networkPatterns = [
  { label: "fetch", pattern: /\bfetch\s*\(/u },
  { label: "XMLHttpRequest", pattern: /\bXMLHttpRequest\b/u },
  { label: "WebSocket", pattern: /\bWebSocket\b/u },
  { label: "EventSource", pattern: /\bEventSource\b/u },
  { label: "sendBeacon", pattern: /\bsendBeacon\s*\(/u },
  { label: "absolute network URL", pattern: /\b(?:https?|wss?):\/\//u },
];

for (const file of sourceFiles(SOURCE_ROOT)) {
  const relative = path.relative(ROOT, file).split(path.sep).join("/");
  const content = fs.readFileSync(file, "utf8");
  for (const { label, pattern } of networkPatterns) {
    if (pattern.test(content)) errors.push(`${relative} contains a forbidden clinical-data network capability (${label}).`);
  }

  if (/(?:window\.)?localStorage\.(?:getItem|setItem|removeItem|clear|key)\b/u.test(content) && ![
    "src/nodedent/NodeDentApp.tsx",
    "src/nodedent/state/anesthesiaCatalogPersistence.ts",
    "src/nodedent/state/isolationCatalogPersistence.ts",
    "src/nodedent/state/legacyClinicalStorage.ts",
  ].includes(relative)) {
    errors.push(`${relative} accesses localStorage outside an approved non-case or legacy boundary.`);
  }
}

const appSource = fs.readFileSync(path.join(SOURCE_ROOT, "NodeDentApp.tsx"), "utf8");
const appLocalStorageUses = appSource.match(/window\.localStorage\.(?:getItem|setItem|removeItem)\([^\n]+/gu) || [];
if (appLocalStorageUses.some((use) => !use.includes("THEME_STORAGE_KEY"))) {
  errors.push("NodeDentApp localStorage access must remain limited to the display theme.");
}

if (errors.length) {
  console.error("Clinical security check failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log("Clinical security check passed: production CSP blocks network connections and case state is outside localStorage.");
}
