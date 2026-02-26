#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const designSystemPath = path.join(
  projectRoot,
  "design",
  "openai-hig-design-system.json"
);
const outCssPath = path.join(projectRoot, "app", "design-tokens.css");

const now = new Date().toISOString();

function toCssVarName(input) {
  return String(input)
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function stringifyCssValue(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function normalizeTokenRef(value) {
  return value
    .replace(/var\(--radius-([a-zA-Z0-9_-]+)\)/g, "var(--ds-radius-$1)")
    .replace(/var\(--elevation-([a-zA-Z0-9_-]+)\)/g, "var(--ds-elevation-$1)")
    .replace(/var\(--radius\)/g, "var(--ds-radius-base)");
}

function emitCssVars(target, entries) {
  const lines = [];
  for (const [rawKey, rawValue] of entries) {
    const key = toCssVarName(rawKey);
    const value = stringifyCssValue(rawValue);
    if (!key || !value) continue;
    lines.push(`  --${key}: ${value};`);
  }
  if (lines.length === 0) return `${target} {\n}\n`;
  return `${target} {\n${lines.join("\n")}\n}\n`;
}

async function main() {
  const raw = await readFile(designSystemPath, "utf8");
  const json = JSON.parse(raw);

  const spacing = json?.tokens?.spacing ?? {};
  const radius = json?.tokens?.radius ?? {};
  const typography = json?.tokens?.typography ?? {};
  const motion = json?.tokens?.motion ?? {};
  const elevation = json?.tokens?.elevation ?? {};
  const layout = json?.protocol?.layout ?? {};
  const interaction = json?.protocol?.interaction ?? {};
  const components = json?.components ?? {};
  const light = json?.tokens?.cssVariables?.light ?? {};
  const dark = json?.tokens?.cssVariables?.dark ?? {};

  const rootVars = [];

  for (const [k, v] of Object.entries(spacing)) {
    rootVars.push([`ds-space-${k}`, v]);
  }

  if (radius.base) rootVars.push(["radius", radius.base]);
  if (radius.base) rootVars.push(["ds-radius-base", radius.base]);
  for (const [k, v] of Object.entries(radius)) {
    if (k === "base") continue;
    rootVars.push([`ds-radius-${k}`, v]);
  }

  if (typography.fontFamily?.sans) rootVars.push(["ds-font-sans", typography.fontFamily.sans]);
  if (typography.fontFamily?.mono) rootVars.push(["ds-font-mono", typography.fontFamily.mono]);
  for (const [k, v] of Object.entries(typography.size ?? {})) {
    rootVars.push([`ds-font-size-${k}`, v]);
  }
  for (const [k, v] of Object.entries(typography.lineHeight ?? {})) {
    rootVars.push([`ds-line-height-${k}`, v]);
  }

  for (const [k, v] of Object.entries(motion)) {
    rootVars.push([`ds-${toCssVarName(k)}`, v]);
  }

  for (const [k, v] of Object.entries(elevation)) {
    rootVars.push([`ds-elevation-${k}`, v]);
  }

  for (const [k, v] of Object.entries(layout)) {
    rootVars.push([`ds-layout-${k}`, v]);
  }

  for (const [k, v] of Object.entries(interaction)) {
    rootVars.push([`ds-interaction-${k}`, typeof v === "string" ? normalizeTokenRef(v) : v]);
  }

  for (const [componentName, componentConfig] of Object.entries(components)) {
    if (!componentConfig || typeof componentConfig !== "object") continue;
    for (const [k, v] of Object.entries(componentConfig)) {
      rootVars.push([
        `ds-component-${componentName}-${k}`,
        typeof v === "string" ? normalizeTokenRef(v) : v,
      ]);
    }
  }

  const rootBlock = emitCssVars(":root", [...rootVars, ...Object.entries(light)]);
  const darkBlock = emitCssVars(".dark", Object.entries(dark));

  const output = `/* AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.
 * Source: design/openai-hig-design-system.json
 * Generated at: ${now}
 */

${rootBlock}
${darkBlock}`;

  await writeFile(outCssPath, output, "utf8");
}

main().catch((error) => {
  console.error("[design-sync] failed:", error);
  process.exit(1);
});
