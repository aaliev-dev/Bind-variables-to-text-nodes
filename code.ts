// code.ts — Multi-section binding + 2 modes + optional SINGLE global log panel
// Log panel is placed LEFT of the lowest common ancestor Section (LCA) that contains all selected language sections.
// The log explicitly lists every binding: <Section>/<Frame>/<Layer> -> <Variable name>
//
// Supports up to 3 description variables per screenshot in BOTH formats:
// - description_01 / description_02 / description_03
// - description_1  / description_2  / description_3
// - description (legacy, treated as description_1)
//
// Layout layers supported:
// - Title_var
// - Description_var (treated as description #1)
// - Description_var_1, Description_var_2, Description_var_3
//
// Modes:
// 1) Strict structure: Screenshot frame -> Body (direct child) -> Text (direct child) -> layers (direct children of Text)
// 2) Find by node names: searches inside screenshot frame (subtree) for the layer names
//
// Selection:
// - Select multiple Sections (or any nodes inside them). Plugin processes each unique language Section from the snapshot selection.
//
// Variables:
// - Local STRING variables, names split by "/" and last segments include:
//   .../<localizationKey>/<screenshot_01>/<field>
//
// Optional variable root filtering:
// - Set ROOT_SEGMENT if you need to only consider variables under a certain segment in their name (e.g. "Collection").
// - Default is disabled.

// ---------------- settings ----------------

type Mode = "structure" | "names";
interface Settings {
  mode: Mode;
  logging: boolean;
}

const SETTINGS_KEY = "bind_settings_v9";
const ROOT_SEGMENT = ""; // e.g. "Collection"; set "" to disable

const MAX_DESC = 3;

// Global log panel sizes (left of anchor section)
const LOG_PANEL_WIDTH = 520;
const LOG_TEXT_WIDTH = 480;
const LOG_PAD = 20;
const LOG_GAP = 80;

const GLOBAL_LOG_PANEL_ID_KEY = "global_bind_log_panel_id";
const GLOBAL_LOG_PANEL_NAME = "__bind_global_log_panel__";
const GLOBAL_LOG_TEXT_NAME = "__bind_global_log_text__";

// Snapshot selection at plugin start (critical: selection can change while UI is open)
const selectionSnapshotIds: string[] = figma.currentPage.selection.map((n) => n.id);

// ---------------- UI ----------------

const UI_HTML = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font: 12px/1.45 -apple-system, BlinkMacSystemFont, Segoe UI, Inter, Roboto, Arial; margin: 12px; }
    .row { margin: 10px 0; }
    .box { border: 1px solid #e5e7eb; padding: 10px; border-radius: 8px; }
    h3 { margin: 0 0 8px 0; font-size: 13px; }
    ol { margin: 8px 0 0 18px; padding: 0; }
    li { margin: 6px 0; }
    pre { background: #f9fafb; border: 1px solid #e5e7eb; padding: 8px; border-radius: 6px; overflow: auto; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 11px; }
    label { display: block; margin: 8px 0; }
    button { padding: 8px 10px; }
    .muted { color: #6b7280; margin-top: 2px; }
    .actions { display: flex; gap: 8px; margin-top: 12px; }
    .status { margin-top: 10px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div class="row box">
    <h3>Instructions</h3>
    <div>This plugin helps you prepare store screenshots in all languages.</div>
    <ol>
      <li>
        Create a String Variables file in <b>Design Tokens Format Module 2025.10</b> with a structure like:
        <pre><code>{
  "Collection": {
    "Localization key": {
      "screenshot_01 (screenshot number)": {
        "title": { "$type": "string", "$value": "Title example" },
        "description_01": { "$type": "string", "$value": "Description 1" },
        "description_02": { "$type": "string", "$value": "Description 2" },
        "description_03": { "$type": "string", "$value": "Description 3" }
      }
    }
  }
}</code></pre>
      </li>
      <li>Add variables to the Figma file (for example, using the <b>Variables JSON Import</b> plugin).</li>
      <li>
        Name screenshot Sections so the Section name includes the <b>localization key</b>.
        Make sure frames inside each Section are numbered (<code>_01_</code>, <code>_02_</code>, etc.).
        Also make sure each screenshot frame contains text layers named:
        <code>Title_var</code>,
        <code>Description_var</code> (optional),
        and/or <code>Description_var_1</code>, <code>Description_var_2</code>, <code>Description_var_3</code>.
      </li>
      <li>Select one or more language Sections and run this plugin.</li>
    </ol>
  </div>

  <div class="row box">
    <div><b>Binding mode</b></div>
    <label>
      <input type="radio" name="mode" value="structure" checked />
      Strict structure (Body → Text)
      <div class="muted">Body/Text must exist as direct children. Layers must be direct children of Body/Text.</div>
    </label>
    <label>
      <input type="radio" name="mode" value="names" />
      Find by node names
      <div class="muted">Searches anywhere inside each screenshot frame for the expected layer names.</div>
    </label>
  </div>

  <div class="row box">
    <label>
      <input id="logging" type="checkbox" checked />
      Create/update a single global log panel
    </label>
    <div class="muted">The log will be placed left of the lowest common parent Section that contains all selected language Sections.</div>
  </div>

  <div class="actions">
    <button id="run">Run</button>
    <button id="cancel">Cancel</button>
  </div>

  <div id="status" class="status"></div>

  <script>
    const statusEl = document.getElementById('status');
    const logEl = document.getElementById('logging');
    const runBtn = document.getElementById('run');

    function getMode() {
      const checked = document.querySelector('input[name="mode"]:checked');
      return checked ? checked.value : 'structure';
    }
    function setMode(mode) {
      const el = document.querySelector('input[name="mode"][value="' + mode + '"]');
      if (el) el.checked = true;
    }
    function setSettings(s) {
      if (s && s.mode) setMode(s.mode);
      if (s && typeof s.logging === 'boolean') logEl.checked = s.logging;
    }

    runBtn.onclick = () => {
      runBtn.disabled = true;
      statusEl.textContent = 'Running...';
      parent.postMessage({ pluginMessage: {
        type: 'RUN',
        settings: { mode: getMode(), logging: !!logEl.checked }
      }}, '*');
    };

    document.getElementById('cancel').onclick = () => {
      parent.postMessage({ pluginMessage: { type: 'CANCEL' }}, '*');
    };

    onmessage = (event) => {
      const msg = event.data.pluginMessage;
      if (!msg) return;

      if (msg.type === 'INIT') setSettings(msg.settings);

      if (msg.type === 'ERROR') {
        runBtn.disabled = false;
        statusEl.textContent = 'Error:\\n' + String(msg.message || msg.error || 'Unknown error');
      }

      if (msg.type === 'DONE') {
        statusEl.textContent = msg.summary || 'Done';
      }
    };
  </script>
</body>
</html>
`;

figma.showUI(UI_HTML, { width: 520, height: 780 });

(async () => {
  const saved = (await figma.clientStorage.getAsync(SETTINGS_KEY)) as Settings | undefined;
  const settings: Settings = {
    mode: saved?.mode ?? "structure",
    logging: typeof saved?.logging === "boolean" ? saved.logging : true,
  };
  figma.ui.postMessage({ type: "INIT", settings });
})().catch(() => {
  figma.ui.postMessage({ type: "INIT", settings: { mode: "structure", logging: true } });
});

figma.ui.onmessage = async (raw: unknown) => {
  const msg = raw as { type?: string; settings?: Partial<Settings> };

  if (msg?.type === "CANCEL") {
    figma.closePlugin();
    return;
  }
  if (msg?.type !== "RUN") return;

  const settings: Settings = {
    mode: msg.settings?.mode === "names" ? "names" : "structure",
    logging: !!msg.settings?.logging,
  };

  await figma.clientStorage.setAsync(SETTINGS_KEY, settings);

  try {
    const summary = await runBinding(settings);
    figma.ui.postMessage({ type: "DONE", summary });
    figma.closePlugin();
  } catch (e: unknown) {
    figma.ui.postMessage({ type: "ERROR", message: String((e as any)?.message ?? e) });
  }
};

// ---------------- core helpers ----------------

function norm(s: string): string {
  return (s ?? "").trim().toLowerCase();
}

function normLoose(s: string): string {
  return norm(s).replace(/[\s-]+/g, "_").replace(/_+/g, "_");
}

function pad2(n: number): string {
  const s = String(n);
  return s.length >= 2 ? s : "0" + s;
}

function getIndex1to7FromAny(name: string): number | null {
  const m = (name ?? "").match(/(\d{1,2})/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1 || n > 7) return null;
  return n;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesKey(sectionLower: string, keyLower: string): boolean {
  if (!keyLower) return false;
  if (keyLower.length <= 2) {
    const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(keyLower)}([^a-z0-9]|$)`, "i");
    return re.test(sectionLower);
  }
  return sectionLower.includes(keyLower);
}

function isInsideInstance(node: BaseNode): boolean {
  let cur: BaseNode | null = node;
  while (cur) {
    if (cur.type === "INSTANCE") return true;
    cur = cur.parent;
  }
  return false;
}

// ---------------- selection -> sections + LCA ----------------

function nearestSection(node: BaseNode): SectionNode | null {
  let cur: BaseNode | null = node;
  while (cur) {
    if (cur.type === "SECTION") return cur as SectionNode;
    cur = cur.parent;
  }
  return null;
}

async function collectSectionsFromSnapshot(ids: string[]): Promise<SectionNode[]> {
  const byId = new Map<string, SectionNode>();

  for (const id of ids) {
    const n = await figma.getNodeByIdAsync(id);
    if (!n) continue;
    const s = n.type === "SECTION" ? (n as SectionNode) : nearestSection(n);
    if (s) byId.set(s.id, s);
  }
  return Array.from(byId.values());
}

function sectionAncestorChain(section: SectionNode): SectionNode[] {
  const chain: SectionNode[] = [];
  let cur: BaseNode | null = section;
  while (cur) {
    if (cur.type === "SECTION") chain.push(cur as SectionNode);
    cur = cur.parent;
  }
  return chain; // leaf -> ... -> root
}

function lowestCommonSection(sections: SectionNode[]): SectionNode {
  if (sections.length === 1) return sections[0];

  const chains = sections.map(sectionAncestorChain);
  const sets = chains.map((c) => new Set(c.map((s) => s.id)));

  // iterate first chain from leaf upwards; first id present in all sets is LCA
  for (const candidate of chains[0]) {
    const ok = sets.every((st) => st.has(candidate.id));
    if (ok) return candidate;
  }
  // fallback
  return sections[0];
}

// ---------------- variables: global index ----------------

type VarIndexKey = string;
function makeIndexKey(keyLower: string, shotIdx: number, fieldLower: string): VarIndexKey {
  return `${keyLower}|screenshot_${pad2(shotIdx)}|${fieldLower}`;
}

function isSupportedField(fieldRaw: string): boolean {
  const f = norm(fieldRaw);
  if (f === "title") return true;
  if (f === "description") return true; // legacy
  if (f.startsWith("description_")) return true;
  return false;
}

interface GlobalVarIndex {
  keyLowerToRaw: Map<string, string>;
  index: Map<VarIndexKey, Variable>;
}

async function buildGlobalVarIndex(): Promise<GlobalVarIndex> {
  const vars: Variable[] = await figma.variables.getLocalVariablesAsync("STRING");

  const keyLowerToRaw = new Map<string, string>();
  const index = new Map<VarIndexKey, Variable>();

  for (const v of vars) {
    const parts = v.name.split("/").map((p) => p.trim()).filter(Boolean);
    if (parts.length < 3) continue;

    if (ROOT_SEGMENT) {
      const ok = parts.some((p) => norm(p) === norm(ROOT_SEGMENT));
      if (!ok) continue;
    }

    const fieldRaw = parts[parts.length - 1];
    const shotRaw = parts[parts.length - 2];
    const keyRaw = parts[parts.length - 3];

    if (!isSupportedField(fieldRaw)) continue;

    const shotIdx = getIndex1to7FromAny(shotRaw);
    if (!shotIdx) continue;

    const keyLower = norm(keyRaw);
    if (!keyLowerToRaw.has(keyLower)) keyLowerToRaw.set(keyLower, keyRaw);

    const fieldLower = norm(fieldRaw);
    const k = makeIndexKey(keyLower, shotIdx, fieldLower);
    if (!index.has(k)) index.set(k, v);
  }

  return { keyLowerToRaw, index };
}

function detectKeyForSection(sectionName: string, keyLowerToRaw: Map<string, string>): { keyLower: string | null; keyRaw: string | null } {
  const sectionLower = norm(sectionName);
  let bestLower: string | null = null;
  let bestLen = 0;

  for (const keyLower of keyLowerToRaw.keys()) {
    if (matchesKey(sectionLower, keyLower) && keyLower.length > bestLen) {
      bestLen = keyLower.length;
      bestLower = keyLower;
    }
  }

  if (!bestLower) return { keyLower: null, keyRaw: null };
  return { keyLower: bestLower, keyRaw: keyLowerToRaw.get(bestLower) ?? bestLower };
}

function getVariableByCandidates(
  globalIndex: Map<VarIndexKey, Variable>,
  keyLower: string,
  shotIdx: number,
  fields: string[]
): { variable: Variable | null; usedFieldLower: string | null } {
  for (const f of fields) {
    const fieldLower = norm(f);
    const v = globalIndex.get(makeIndexKey(keyLower, shotIdx, fieldLower));
    if (v) return { variable: v, usedFieldLower: fieldLower };
  }
  return { variable: null, usedFieldLower: null };
}

function variableCandidatesForDescription(descIndex: number): string[] {
  // prefer unpadded first
  const c: string[] = [
    `description_${descIndex}`,
    `description_${pad2(descIndex)}`,
  ];
  if (descIndex === 1) c.push("description"); // legacy
  return c;
}

// ---------------- fonts + bind retry ----------------

const loadedFonts = new Set<string>();
function fontKey(f: FontName): string {
  return `${f.family}::${f.style}`;
}
async function loadFontOnce(f: FontName): Promise<void> {
  const k = fontKey(f);
  if (loadedFonts.has(k)) return;
  await figma.loadFontAsync(f);
  loadedFonts.add(k);
}

const styleFontCache = new Map<string, FontName | null>();
async function fontFromStyleId(styleId: string): Promise<FontName | null> {
  if (styleFontCache.has(styleId)) return styleFontCache.get(styleId) ?? null;

  const style = await figma.getStyleByIdAsync(styleId);
  let font: FontName | null = null;

  if (style && style.type === "TEXT") {
    const ts = style as TextStyle;
    if (ts.fontName) font = ts.fontName;
  }

  styleFontCache.set(styleId, font);
  return font;
}

async function ensureFontsForText(t: TextNode): Promise<void> {
  const candidates: FontName[] = [];

  if (t.fontName !== figma.mixed) candidates.push(t.fontName as FontName);

  if (t.textStyleId !== figma.mixed && t.textStyleId) {
    const f = await fontFromStyleId(t.textStyleId as string);
    if (f) candidates.push(f);
  }

  const len = t.characters?.length ?? 0;
  const end = Math.max(1, len);

  try {
    const fonts = t.getRangeAllFontNames(0, end);
    for (const f of fonts) candidates.push(f);
  } catch {}

  try {
    const f = t.getRangeFontName(0, end);
    if (f !== figma.mixed) candidates.push(f as FontName);
  } catch {}

  const uniq = new Map<string, FontName>();
  for (const f of candidates) uniq.set(fontKey(f), f);
  for (const f of uniq.values()) await loadFontOnce(f);
}

function parseFontFromError(msg: string): FontName | null {
  const re = /figma\.loadFontAsync\(\{\s*family:\s*"([^"]+)"\s*,\s*style:\s*"([^"]+)"\s*\}\)/;
  const m = msg.match(re);
  if (!m) return null;
  return { family: m[1], style: m[2] };
}

async function bindWithFontRetry(node: TextNode, variable: Variable, ctx: string, errors: string[]): Promise<boolean> {
  try {
    await ensureFontsForText(node);
    node.setBoundVariable("characters", variable);
    return true;
  } catch (e: unknown) {
    const msg = String((e as any)?.message ?? e);
    const f = parseFontFromError(msg);

    if (f) {
      try {
        await loadFontOnce(f);
        node.setBoundVariable("characters", variable);
        return true;
      } catch (e2: unknown) {
        errors.push(`${ctx} -> ${String((e2 as any)?.message ?? e2)}`);
        return false;
      }
    }

    errors.push(`${ctx} -> ${msg}`);
    return false;
  }
}

async function maybePreloadCommonFonts(keyLower: string): Promise<void> {
  // best-effort
  try { await loadFontOnce({ family: "Noto Sans", style: "Black" }); } catch {}
  try { await loadFontOnce({ family: "Noto Sans", style: "SemiBold" }); } catch {}

  if (keyLower.startsWith("ar")) {
    try { await loadFontOnce({ family: "Noto Sans Arabic", style: "Black" }); } catch {}
    try { await loadFontOnce({ family: "Noto Sans Arabic", style: "SemiBold" }); } catch {}
  }
}

// ---------------- log panel (single, global, left of anchor section) ----------------

let interLoaded = false;
async function ensureInterRegular(): Promise<void> {
  if (interLoaded) return;
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  interLoaded = true;
}

function styleLogFrame(frame: FrameNode) {
  frame.clipsContent = false;
  frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, opacity: 1 }];
  frame.strokes = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 }, opacity: 1 }];
  frame.strokeWeight = 1;
  frame.cornerRadius = 8;
}

function styleLogText(t: TextNode) {
  t.name = GLOBAL_LOG_TEXT_NAME;
  t.fontName = { family: "Inter", style: "Regular" };
  t.fontSize = 12;
  t.lineHeight = { unit: "PIXELS", value: 16 };
  t.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 0.92 }];

  t.textAutoResize = "HEIGHT";
  t.resize(LOG_TEXT_WIDTH, Math.max(10, t.height));
  t.x = LOG_PAD;
  t.y = LOG_PAD;
}

async function getOrCreateGlobalLogPanel(): Promise<{ frame: FrameNode; text: TextNode }> {
  // try by stored id
  const storedId = figma.currentPage.getPluginData(GLOBAL_LOG_PANEL_ID_KEY);
  if (storedId) {
    const n = await figma.getNodeByIdAsync(storedId);
    if (n && n.type === "FRAME") {
      const frame = n as FrameNode;
      styleLogFrame(frame);
      frame.resize(LOG_PANEL_WIDTH, Math.max(60, frame.height));

      let text = frame.findOne(
        (x: SceneNode) => x.type === "TEXT" && (x as TextNode).name === GLOBAL_LOG_TEXT_NAME
      ) as TextNode | null;

      if (!text) {
        await ensureInterRegular();
        text = figma.createText();
        styleLogText(text);
        frame.appendChild(text);
      } else {
        await ensureInterRegular();
        styleLogText(text);
      }

      frame.name = GLOBAL_LOG_PANEL_NAME;
      return { frame, text };
    }
  }

  // fallback: search by name (rare)
  const existingByName = figma.currentPage.findOne(
    (x: SceneNode) => x.type === "FRAME" && (x as FrameNode).name === GLOBAL_LOG_PANEL_NAME
  ) as FrameNode | null;

  if (existingByName) {
    figma.currentPage.setPluginData(GLOBAL_LOG_PANEL_ID_KEY, existingByName.id);
    const text = existingByName.findOne(
      (x: SceneNode) => x.type === "TEXT" && (x as TextNode).name === GLOBAL_LOG_TEXT_NAME
    ) as TextNode | null;

    if (text) {
      await ensureInterRegular();
      styleLogFrame(existingByName);
      styleLogText(text);
      existingByName.resize(LOG_PANEL_WIDTH, Math.max(60, existingByName.height));
      return { frame: existingByName, text };
    }
  }

  // create new
  await ensureInterRegular();

  const frame = figma.createFrame();
  frame.name = GLOBAL_LOG_PANEL_NAME;
  styleLogFrame(frame);
  frame.resize(LOG_PANEL_WIDTH, 80);

  const text = figma.createText();
  styleLogText(text);

  frame.appendChild(text);
  figma.currentPage.appendChild(frame);

  figma.currentPage.setPluginData(GLOBAL_LOG_PANEL_ID_KEY, frame.id);
  return { frame, text };
}

async function writeGlobalLog(anchor: SectionNode, content: string): Promise<void> {
  await ensureInterRegular();
  const { frame, text } = await getOrCreateGlobalLogPanel();

  frame.x = anchor.x - LOG_GAP - LOG_PANEL_WIDTH;
  frame.y = anchor.y;

  text.characters = content;

  text.textAutoResize = "HEIGHT";
  text.resize(LOG_TEXT_WIDTH, Math.max(10, text.height));

  const newH = text.height + LOG_PAD * 2;
  frame.resize(LOG_PANEL_WIDTH, Math.max(60, newH));
}

// ---------------- node finding ----------------

function getDirectTextByLooseName(parent: ChildrenMixin, wanted: string): TextNode | null {
  const w = normLoose(wanted);
  for (const ch of parent.children) {
    if (ch.type === "TEXT" && normLoose(ch.name) === w) return ch as TextNode;
  }
  return null;
}

function listDescriptionLayerNames(): string[] {
  const names: string[] = ["Description_var"];
  for (let i = 1; i <= MAX_DESC; i++) names.push(`Description_var_${i}`);
  return names;
}

function parseDescriptionIndexFromLayerName(nodeName: string): number {
  const n = normLoose(nodeName);
  const m = n.match(/description_var_(\d+)$/);
  if (!m) return 1;
  const idx = Number(m[1]);
  if (!Number.isFinite(idx) || idx < 1) return 1;
  return Math.min(MAX_DESC, idx);
}

function getScreenshotFrames(section: SectionNode): FrameNode[] {
  // Prefer direct children frames. If none match, fallback to findAll in section.
  const direct = section.children.filter((n) => n.type === "FRAME") as FrameNode[];
  const directFiltered = direct.filter((f) => getIndex1to7FromAny(f.name) !== null);
  if (directFiltered.length) return directFiltered;

  const all = section.findAll((n) => n.type === "FRAME") as FrameNode[];
  return all.filter((f) => getIndex1to7FromAny(f.name) !== null);
}

function findNodesStrict(frame: FrameNode): {
  title: TextNode | null;
  descriptions: TextNode[];
  missingContainer?: string;
} {
  const body = frame.children.find((n) => norm(n.name) === "body") as SceneNode | undefined;
  if (!body || !(body as any).children) return { title: null, descriptions: [], missingContainer: "Body" };

  const textContainer = (body as ChildrenMixin).children.find((n) => norm(n.name) === "text") as SceneNode | undefined;
  if (!textContainer || !(textContainer as any).children) return { title: null, descriptions: [], missingContainer: "Body/Text" };

  const textChildren = textContainer as ChildrenMixin;

  const title = getDirectTextByLooseName(textChildren, "Title_var");

  const descriptions: TextNode[] = [];
  for (const name of listDescriptionLayerNames()) {
    const n = getDirectTextByLooseName(textChildren, name);
    if (n) descriptions.push(n);
  }

  return { title, descriptions };
}

function findNodesBySearch(frame: FrameNode): {
  title: TextNode | null;
  descriptions: TextNode[];
} {
  const titleWanted = normLoose("Title_var");
  const title = frame.findOne(
    (n: SceneNode) => n.type === "TEXT" && normLoose((n as TextNode).name) === titleWanted
  ) as TextNode | null;

  const descriptions: TextNode[] = [];
  for (const name of listDescriptionLayerNames()) {
    const wanted = normLoose(name);
    const node = frame.findOne(
      (n: SceneNode) => n.type === "TEXT" && normLoose((n as TextNode).name) === wanted
    ) as TextNode | null;
    if (node) descriptions.push(node);
  }

  return { title, descriptions };
}

// ---------------- binding + reporting ----------------

type BindRecord = {
  section: string;
  frame: string;
  layer: string;
  variable: string;
};

type SectionResult = {
  sectionName: string;
  keyRaw: string | null;
  keyLower: string | null;
  bound: number;
  binds: BindRecord[];
  warnings: string[];
  errors: string[];
};

async function processLanguageSection(
  section: SectionNode,
  settings: Settings,
  global: GlobalVarIndex
): Promise<SectionResult> {
  const sectionName = (section.name ?? "").trim();
  const detected = detectKeyForSection(sectionName, global.keyLowerToRaw);

  const res: SectionResult = {
    sectionName,
    keyRaw: detected.keyRaw,
    keyLower: detected.keyLower,
    bound: 0,
    binds: [],
    warnings: [],
    errors: [],
  };

  if (!detected.keyLower || !detected.keyRaw) {
    res.warnings.push(`Key not detected for section "${sectionName}"`);
    return res;
  }

  await maybePreloadCommonFonts(detected.keyLower);

  const frames = getScreenshotFrames(section);

  for (const frame of frames) {
    const shotIdx = getIndex1to7FromAny(frame.name);
    if (!shotIdx) continue;

    let titleNode: TextNode | null = null;
    let descNodes: TextNode[] = [];
    let missingContainer: string | undefined;

    if (settings.mode === "structure") {
      const r = findNodesStrict(frame);
      titleNode = r.title;
      descNodes = r.descriptions;
      missingContainer = r.missingContainer;
    } else {
      const r = findNodesBySearch(frame);
      titleNode = r.title;
      descNodes = r.descriptions;
    }

    if (missingContainer) {
      res.warnings.push(`[${sectionName}] ${frame.name}: missing ${missingContainer}`);
      continue; // strict mode cannot proceed for this frame
    }

    // ---- TITLE ----
    {
      const { variable: vTitle } = getVariableByCandidates(global.index, detected.keyLower, shotIdx, ["title"]);
      if (titleNode && vTitle) {
        if (titleNode.locked) res.warnings.push(`[${sectionName}] ${frame.name}: Title_var is locked`);
        else if (isInsideInstance(titleNode)) res.warnings.push(`[${sectionName}] ${frame.name}: Title_var is inside instance`);
        else {
          const ok = await bindWithFontRetry(titleNode, vTitle, `[${sectionName}] ${frame.name}: Title_var`, res.errors);
          if (ok) {
            res.bound++;
            res.binds.push({ section: sectionName, frame: frame.name, layer: titleNode.name, variable: vTitle.name });
          }
        }
      } else {
        if (!titleNode) res.warnings.push(`[${sectionName}] ${frame.name}: missing Title_var`);
        if (!vTitle) res.warnings.push(`[${sectionName}] ${frame.name}: missing variable ${detected.keyRaw}/screenshot_${pad2(shotIdx)}/title`);
      }
    }

    // ---- DESCRIPTIONS ----
    const descMap = new Map<number, TextNode[]>();
    for (const n of descNodes) {
      const di = parseDescriptionIndexFromLayerName(n.name);
      const arr = descMap.get(di) ?? [];
      arr.push(n);
      descMap.set(di, arr);
    }

    for (let di = 1; di <= MAX_DESC; di++) {
      const nodesForThis = descMap.get(di) ?? [];
      if (nodesForThis.length === 0) continue; // no layer -> skip

      const { variable, usedFieldLower } = getVariableByCandidates(global.index, detected.keyLower, shotIdx, variableCandidatesForDescription(di));
      if (!variable) {
        res.warnings.push(
          `[${sectionName}] ${frame.name}: missing variable for description #${di} (${variableCandidatesForDescription(di).join(" or ")})`
        );
        continue;
      }

      for (const node of nodesForThis) {
        if (node.locked) {
          res.warnings.push(`[${sectionName}] ${frame.name}: ${node.name} is locked`);
          continue;
        }
        if (isInsideInstance(node)) {
          res.warnings.push(`[${sectionName}] ${frame.name}: ${node.name} is inside instance`);
          continue;
        }
        const ctx = `[${sectionName}] ${frame.name}: ${node.name} -> ${usedFieldLower ?? "description"}`;
        const ok = await bindWithFontRetry(node, variable, ctx, res.errors);
        if (ok) {
          res.bound++;
          res.binds.push({ section: sectionName, frame: frame.name, layer: node.name, variable: variable.name });
        }
      }
    }
  }

  return res;
}

// ---------------- main run ----------------

async function runBinding(settings: Settings): Promise<string> {
  const languageSections = await collectSectionsFromSnapshot(selectionSnapshotIds);
  if (languageSections.length === 0) {
    throw new Error("No Sections found in the selection snapshot. Select one or more Sections (or nodes inside them), then run the plugin.");
  }

  const anchor = lowestCommonSection(languageSections);
  const global = await buildGlobalVarIndex();

  const results: SectionResult[] = [];
  for (const sec of languageSections) {
    results.push(await processLanguageSection(sec, settings, global));
  }

  const totalBound = results.reduce((s, r) => s + r.bound, 0);
  const processed = results.filter((r) => r.keyRaw).length;
  const missingKey = results.filter((r) => !r.keyRaw).length;

  // Build detailed log (bindings first)
  const bindLines: string[] = [];
  for (const r of results) {
    for (const b of r.binds) {
      bindLines.push(`${b.section} / ${b.frame} / ${b.layer} -> ${b.variable}`);
    }
  }

  const warningLines: string[] = [];
  const errorLines: string[] = [];
  for (const r of results) {
    for (const w of r.warnings) warningLines.push(w);
    for (const e of r.errors) errorLines.push(e);
  }

  const perSectionSummary = results.map((r) => {
    const key = r.keyRaw ? r.keyRaw : "NOT FOUND";
    return `${r.sectionName} (key: ${key}) — bound ${r.bound}`;
  });

  const logText =
    `Global Bind Log\n` +
    `Anchor section: ${anchor.name}\n` +
    `Selected sections: ${languageSections.length}\n` +
    `Processed: ${processed}\n` +
    `Missing key: ${missingKey}\n` +
    `Total bound: ${totalBound}\n\n` +
    `Per-section summary:\n${perSectionSummary.join("\n")}\n\n` +
    `Bindings:\n${bindLines.length ? bindLines.join("\n") : "(none)"}\n\n` +
    `Warnings:\n${warningLines.length ? warningLines.join("\n") : "(none)"}\n\n` +
    `Errors:\n${errorLines.length ? errorLines.join("\n") : "(none)"}`;

  if (settings.logging) {
    await writeGlobalLog(anchor, logText);
  }

  figma.notify(`Bound: ${totalBound} | Sections: ${languageSections.length}`, { timeout: 8000 });

  // Return a compact UI summary
  const summary =
    `Selected sections: ${languageSections.length}\n` +
    `Processed: ${processed}\n` +
    `Missing key: ${missingKey}\n` +
    `Total bound: ${totalBound}`;
  return summary;
}