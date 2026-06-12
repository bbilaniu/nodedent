#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const DOCS_DIR = path.resolve("docs");
const SPECS_DIR = path.join(DOCS_DIR, "specs");
const ADR_DIR = path.join(DOCS_DIR, "adr");
const README_PATH = path.join(DOCS_DIR, "README.md");

const SPEC_STATUSES = new Set(["active", "implemented", "deprecated"]);
const ADR_STATUSES = new Set(["Proposed", "Accepted", "Superseded", "Deprecated"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function walkMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(full));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(full);
    }
  }

  return files.sort();
}

function parseFrontmatter(content) {
  if (!content.startsWith("---\n")) {
    return { hasFrontmatter: false, raw: "", fields: {}, body: content };
  }

  const end = content.indexOf("\n---\n", 4);
  if (end < 0) {
    return { hasFrontmatter: false, raw: "", fields: {}, body: content };
  }

  const raw = content.slice(4, end);
  const body = content.slice(end + 5);
  const fields = {};

  for (const line of raw.split("\n")) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    fields[match[1]] = match[2].trim();
  }

  return { hasFrontmatter: true, raw, fields, body };
}

function rel(file) {
  return path.relative(process.cwd(), file).split(path.sep).join("/");
}

function relFromDocs(file) {
  return path.relative(DOCS_DIR, file).split(path.sep).join("/");
}

function isDate(value) {
  return typeof value === "string" && DATE_RE.test(value);
}

function statusFromAdrBody(body) {
  const match = body.match(/^## Status\s*\n+([^\n#]+)/m);
  return match?.[1]?.trim();
}

function validateSpec(file, errors, activeSpecLinks) {
  const parsed = parseFrontmatter(fs.readFileSync(file, "utf8"));
  const fileRel = rel(file);
  const docsRel = relFromDocs(file);
  const segments = docsRel.split("/");
  const isArchived = segments.includes("archive");

  if (!parsed.hasFrontmatter) {
    errors.push(`${fileRel}: spec docs must include lifecycle frontmatter`);
    return;
  }

  const status = parsed.fields.status;
  if (!SPEC_STATUSES.has(status)) {
    errors.push(`${fileRel}: status must be one of active, implemented, deprecated`);
  }

  if (!isDate(parsed.fields.created_on)) {
    errors.push(`${fileRel}: missing or invalid created_on date`);
  }

  if (isArchived) {
    if (status === "active") {
      errors.push(`${fileRel}: archived spec cannot have status 'active'`);
    }

    if (status === "implemented" && !isDate(parsed.fields.completed_on)) {
      errors.push(`${fileRel}: archived implemented spec is missing completed_on`);
    }

    if (status === "deprecated" && !isDate(parsed.fields.deprecated_on)) {
      errors.push(`${fileRel}: archived deprecated spec is missing deprecated_on`);
    }

    return;
  }

  if (status === "implemented" || status === "deprecated") {
    errors.push(`${fileRel}: ${status} specs should be moved to docs/specs/archive/`);
    return;
  }

  if (status === "active") {
    activeSpecLinks.push(docsRel);
  }
}

function validateAdr(file, errors, adrLinks) {
  const content = fs.readFileSync(file, "utf8");
  const parsed = parseFrontmatter(content);
  const body = parsed.hasFrontmatter ? parsed.body : content;
  const fileRel = rel(file);
  const base = path.basename(file);
  const nameMatch = base.match(/^(\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/);

  if (!nameMatch) {
    errors.push(`${fileRel}: ADR filename must look like 0001-short-title.md`);
    return;
  }

  const number = nameMatch[1];
  if (!body.startsWith(`# ADR ${number}:`)) {
    errors.push(`${fileRel}: ADR title must start with '# ADR ${number}:'`);
  }

  const status = statusFromAdrBody(body);
  if (!ADR_STATUSES.has(status)) {
    errors.push(`${fileRel}: ADR status must be one of ${[...ADR_STATUSES].join(", ")}`);
  }

  adrLinks.push(relFromDocs(file));
}

function readReadmeLinks() {
  if (!fs.existsSync(README_PATH)) return null;
  const content = fs.readFileSync(README_PATH, "utf8");
  const links = new Set();
  const linkRe = /\[[^\]]+\]\(([^)]+)\)/g;

  for (const match of content.matchAll(linkRe)) {
    const target = match[1].trim();
    if (!target || target.includes("://") || target.startsWith("#")) continue;
    links.add(path.normalize(target).split(path.sep).join("/"));
  }

  return links;
}

function validateReadmeLinks(errors, requiredLinks) {
  const readmeLinks = readReadmeLinks();
  if (!readmeLinks) {
    errors.push("docs/README.md: missing documentation index");
    return;
  }

  for (const link of requiredLinks.sort()) {
    if (!readmeLinks.has(link)) {
      errors.push(`docs/README.md: missing link to ${link}`);
    }
  }
}

function main() {
  const errors = [];
  const activeSpecLinks = [];
  const adrLinks = [];
  const specFiles = walkMarkdownFiles(SPECS_DIR);
  const adrFiles = walkMarkdownFiles(ADR_DIR);

  for (const file of specFiles) {
    validateSpec(file, errors, activeSpecLinks);
  }

  for (const file of adrFiles) {
    validateAdr(file, errors, adrLinks);
  }

  validateReadmeLinks(errors, [...activeSpecLinks, ...adrLinks]);

  console.log(`Checked ${specFiles.length} spec docs and ${adrFiles.length} ADRs for lifecycle metadata.`);
  if (errors.length === 0) {
    console.log("Doc lifecycle checks passed.");
    return;
  }

  console.error("\nDoc lifecycle check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 2;
}

main();
