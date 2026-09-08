import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

function validateDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid expiry date: ${value}; use YYYY-MM-DD.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid calendar date: ${value}.`);
  }
  return value;
}

// This preflight uses only Node built-ins; most daily runs need no npm install.
export function findExpiryMarkers(source, today) {
  validateDate(today);
  const lines = source.split("\n");
  const markers = [];
  let offset = 0;
  for (const [index, line] of lines.entries()) {
    if (/#\s*ignore-until\b/.test(line)) {
      const match = /^( *)# ignore-until: (\d{4}-\d{2}-\d{2})\r?$/.exec(line);
      if (!match) throw new Error(`Malformed ignore-until marker on line ${index + 1}.`);
      const date = validateDate(match[2]);
      const nextStart = offset + line.length + 1;
      if (!lines[index + 1]?.startsWith(`${match[1]}- dependency-name: `)) {
        throw new Error(`Marker on line ${index + 1} must immediately precede an ignore entry at the same indentation.`);
      }
      markers.push({ start: offset, nextStart, date, expired: today >= date });
    }
    offset += line.length + 1;
  }
  return markers;
}

export async function expireDependabotIgnores(source, today) {
  const markers = findExpiryMarkers(source, today);
  const { isMap, isSeq, parseDocument } = await import("yaml");
  const document = parseDocument(source);
  if (document.errors.length || document.warnings.length) {
    throw new Error("Dependabot YAML must parse without errors or warnings.");
  }
  const updates = document.get("updates");
  if (document.get("version") !== 2 || !isSeq(updates)) {
    throw new Error("Expected a version 2 Dependabot updates sequence.");
  }
  const expected = document.toJS();
  const recognized = new Set();
  const removals = [];
  const expired = [];
  const lineStart = (offset) => source.lastIndexOf("\n", offset - 1) + 1;
  const lineEnd = (offset) => {
    const end = source.indexOf("\n", offset);
    return end === -1 ? source.length : end + 1;
  };

  for (const [updateIndex, update] of updates.items.entries()) {
    if (!isMap(update)) throw new Error("Each Dependabot update must be a mapping.");
    const ignores = update.get("ignore");
    if (ignores === undefined) continue;
    if (!isSeq(ignores)) throw new Error("Dependabot ignore must be a sequence.");
    const removedIndexes = new Set();
    for (const [itemIndex, item] of ignores.items.entries()) {
      if (!isMap(item) || !item.range) throw new Error("Each ignore entry must be a mapping.");
      const marker = markers.find(({ nextStart }) => nextStart === lineStart(item.range[0]));
      if (!marker) continue;
      if (item.flow || ignores.flow || item.anchor || update.flow) {
        throw new Error("Dated ignores must use block mappings without anchors.");
      }
      const dependency = item.get("dependency-name");
      if (typeof dependency !== "string" || !dependency) throw new Error("Missing dependency-name.");
      recognized.add(marker);
      if (!marker.expired) continue;
      removals.push([marker.start, lineEnd(item.range[1] - 1)]);
      removedIndexes.add(itemIndex);
      expired.push({ dependency, ecosystem: update.get("package-ecosystem"), date: marker.date });
    }
    if (removedIndexes.size) {
      expected.updates[updateIndex].ignore = expected.updates[updateIndex].ignore.filter(
        (_, index) => !removedIndexes.has(index),
      );
      if (!expected.updates[updateIndex].ignore.length) {
        // An empty block would become `ignore: null`, which Dependabot rejects.
        const pair = update.items.find(({ key }) => key.value === "ignore");
        const start = lineStart(pair.key.range[0]);
        removals.push([start, lineEnd(start)]);
        delete expected.updates[updateIndex].ignore;
      }
    }
  }
  if (recognized.size !== markers.length) {
    throw new Error("Every ignore-until marker must belong to an updates[].ignore[] entry.");
  }
  let text = source;
  for (const [start, end] of removals.sort((a, b) => b[0] - a[0])) {
    text = text.slice(0, start) + text.slice(end);
  }
  const result = parseDocument(text);
  if (result.errors.length || result.warnings.length || !isDeepStrictEqual(result.toJS(), expected)) {
    throw new Error("Refusing a change that does more than remove expired ignore entries.");
  }
  return { text, expired };
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args.shift();
  if (!["--check", "--write", "--preview"].includes(mode) || args.length % 2) {
    throw new Error("Usage: expire-dependabot-ignores.mjs --check|--write|--preview [--date YYYY-MM-DD] [--file path]");
  }
  let today = new Date().toISOString().slice(0, 10);
  let file = ".github/dependabot.yml";
  for (let index = 0; index < args.length; index += 2) {
    if (args[index] === "--date") today = args[index + 1];
    else if (args[index] === "--file") file = args[index + 1];
    else throw new Error(`Unknown argument: ${args[index]}`);
  }
  const source = readFileSync(file, "utf8");
  if (mode === "--check") {
    const due = findExpiryMarkers(source, today).some(({ expired }) => expired);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `due=${due}\n`);
    console.log(due ? "Expired annotations found; full YAML validation is required." : "No expired annotations.");
    return;
  }
  const result = await expireDependabotIgnores(source, today);
  if (mode === "--preview") process.stdout.write(result.text);
  else {
    if (result.text !== source) writeFileSync(file, result.text);
    console.log(`Removed ${result.expired.length} expired ignore rule(s).`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
