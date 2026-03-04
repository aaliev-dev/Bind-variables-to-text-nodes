// code.ts — Multi-section binding + optional SINGLE global log panel
// UI: "Bind" + "Generate missing locales" + Logging toggle
// ALWAYS uses search-based binding (no strict structure mode)
//
// RTL tweak:
// - If locale key starts with "ar" or "he" (case-insensitive), then after binding:
//   - Title_var + all Description_* nodes get textAlignHorizontal = "RIGHT"
//
// Log:
// - Single global log panel placed LEFT of the lowest common ancestor Section (LCA) of the originally selected sections
// - Log lists every binding: <Section>/<Frame>/<Layer> -> <Variable name>
//
// Variables:
// - Local STRING variables, names split by "/" and last 3 segments include:
//   .../<localizationKey>/<screenshot_01>/<field>
//
// Supported fields:
// - title
// - description (legacy => description #1)
// - description_1..3
// - description_01..03
//
// Supported layer names in layout (case-insensitive, tolerant to spaces/dashes):
// - Title_var
// - Description_var (=> description #1)
// - Description_var_1, Description_var_2, Description_var_3

interface Settings {
  logging: boolean;
}

const SETTINGS_KEY = "bind_settings_v12";
const ROOT_SEGMENT = ""; // e.g. "Collection"; set "" to disable filtering
const MAX_DESC = 3;

// Log panel sizes (LEFT of anchor section)
const LOG_PANEL_WIDTH = 520;
const LOG_TEXT_WIDTH = 480;
const LOG_PAD = 20;
const LOG_GAP = 80;

const GLOBAL_LOG_PANEL_ID_KEY = "global_bind_log_panel_id";
const GLOBAL_LOG_PANEL_NAME = "__bind_global_log_panel__";
const GLOBAL_LOG_TEXT_NAME = "__bind_global_log_text__";

// Clone placement
const CLONE_GAP_Y = 120;

// Snapshot selection at plugin start (selection can change while UI is open)
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
    .actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
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
    <label>
      <input id="logging" type="checkbox" checked />
      Create/update a single global log panel
    </label>
    <div class="muted">The log will be placed left of the lowest common parent Section that contains all selected language Sections.</div>
  </div>

  <div class="actions">
    <button id="bind">Bind</button>
    <button id="gen">Generate missing locales</button>
    <button id="cancel">Cancel</button>
  </div>

  <div id="status" class="status"></div>

  <script>
    const statusEl = document.getElementById('status');
    const logEl = document.getElementById('logging');
    const bindBtn = document.getElementById('bind');
    const genBtn = document.getElementById('gen');

    function setSettings(s) {
      if (s && typeof s.logging === 'boolean') logEl.checked = s.logging;
    }

    function disableButtons(disabled) {
      bindBtn.disabled = disabled;
      genBtn.disabled = disabled;
    }

    bindBtn.onclick = () => {
      disableButtons(true);
      statusEl.textContent = 'Binding...';
      parent.postMessage({ pluginMessage: {
        type: 'BIND',
        settings: { logging: !!logEl.checked }
      }}, '*');
    };

    genBtn.onclick = () => {
      disableButtons(true);
      statusEl.textContent = 'Generating missing locales...';
      parent.postMessage({ pluginMessage: {
        type: 'GEN',
        settings: { logging: !!logEl.checked }
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
        disableButtons(false);
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

figma.showUI(UI_HTML, { width: 520, height: 740 });

(async () => {
  const saved = (await figma.clientStorage.getAsync(SETTINGS_KEY)) as Settings | undefined;
  const settings: Settings = { logging: typeof saved?.logging === "boolean" ? saved.logging : true };
  figma.ui.postMessage({ type: "INIT", settings });
})().catch(() => {
  figma.ui.postMessage({ type: "INIT", settings: { logging: true } });
});

figma.ui.onmessage = async (raw: unknown) => {
  const msg = raw as { type?: string; settings?: Partial<Settings> };

  if (msg?.type === "CANCEL") {
    figma.closePlugin();
    return;
  }

  const settings: Settings = { logging: !!msg.settings?.logging };
  await figma.clientStorage.setAsync(SETTINGS_KEY, settings);

  try {
    let summary = "";
    if (msg?.type === "BIND") summary = await runBinding(settings);
    else if (msg?.type === "GEN") summary = await generateMissingLocales(settings);
    else return;

    figma.ui.postMessage({ type: "DONE", summary });
    figma.closePlugin();
  } catch (e: unknown) {
    figma.ui.postMessage({ type: "ERROR", message: String((e as any)?.message ?? e) });
  }
};

// ---------------- helpers ----------------

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

function isRTLKey(keyLower: string): boolean {
  // simple heuristic: Arabic/Hebrew locale prefixes
  return keyLower.startsWith("ar") || keyLower.startsWith("he");
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
  const ordered: SectionNode[] = [];

  for (const id of ids) {
    const n = await figma.getNodeByIdAsync(id);
    if (!n) continue;
    const s = n.type === "SECTION" ? (n as SectionNode) : nearestSection(n);
    if (!s) continue;
    if (!byId.has(s.id)) {
      byId.set(s.id, s);
      ordered.push(s);
    }
  }
  return ordered;
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

  for (const candidate of chains[0]) {
    const ok = sets.every((st) => st.has(candidate.id));
    if (ok) return candidate;
  }
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
  const c: string[] = [
    `description_${descIndex}`,
    `description_${pad2(descIndex)}`,
  ];
  if (descIndex === 1) c.push("description");
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
  try { await loadFontOnce({ family: "Noto Sans", style: "Black" }); } catch {}
  try { await loadFontOnce({ family: "Noto Sans", style: "SemiBold" }); } catch {}

  if (keyLower.startsWith("ar")) {
    try { await loadFontOnce({ family: "Noto Sans Arabic", style: "Black" }); } catch {}
    try { await loadFontOnce({ family: "Noto Sans Arabic", style: "SemiBold" }); } catch {}
  }
}

// ---------------- global log panel ----------------

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

      await ensureInterRegular();
      if (!text) {
        text = figma.createText();
        styleLogText(text);
        frame.appendChild(text);
      } else {
        styleLogText(text);
      }

      frame.name = GLOBAL_LOG_PANEL_NAME;
      return { frame, text };
    }
  }

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

// ---------------- node finding (ALWAYS search-based) ----------------

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
  const direct = section.children.filter((n) => n.type === "FRAME") as FrameNode[];
  const directFiltered = direct.filter((f) => getIndex1to7FromAny(f.name) !== null);
  if (directFiltered.length) return directFiltered;

  const all = section.findAll((n) => n.type === "FRAME") as FrameNode[];
  return all.filter((f) => getIndex1to7FromAny(f.name) !== null);
}

function findNodesBySearch(frame: FrameNode): { title: TextNode | null; descriptions: TextNode[] } {
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

// ---------------- RTL alignment ----------------

function tryApplyRTLAlignment(node: TextNode, rtl: boolean, warnings: string[], ctx: string) {
  if (!rtl) return;
  try {
    node.textAlignHorizontal = "RIGHT";
  } catch (e: unknown) {
    // Some cases may throw (rare). We keep it non-fatal.
    warnings.push(`${ctx}: failed to set textAlignHorizontal=RIGHT (${String((e as any)?.message ?? e)})`);
  }
}

// ---------------- binding + reporting ----------------

type BindRecord = { section: string; frame: string; layer: string; variable: string };

type SectionResult = {
  sectionName: string;
  keyRaw: string | null;
  keyLower: string | null;
  bound: number;
  binds: BindRecord[];
  warnings: string[];
  errors: string[];
};

async function bindLanguageSection(
  section: SectionNode,
  global: GlobalVarIndex,
  forcedKey?: { keyLower: string; keyRaw: string }
): Promise<SectionResult> {
  const sectionName = (section.name ?? "").trim();

  const detected = forcedKey
    ? { keyLower: forcedKey.keyLower, keyRaw: forcedKey.keyRaw }
    : detectKeyForSection(sectionName, global.keyLowerToRaw);

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

  const rtl = isRTLKey(detected.keyLower);

  await maybePreloadCommonFonts(detected.keyLower);

  const frames = getScreenshotFrames(section);

  for (const frame of frames) {
    const shotIdx = getIndex1to7FromAny(frame.name);
    if (!shotIdx) continue;

    const found = findNodesBySearch(frame);

    // Title
    {
      const { variable: vTitle } = getVariableByCandidates(global.index, detected.keyLower, shotIdx, ["title"]);
      if (found.title && vTitle) {
        if (found.title.locked) res.warnings.push(`[${sectionName}] ${frame.name}: Title_var is locked`);
        else if (isInsideInstance(found.title)) res.warnings.push(`[${sectionName}] ${frame.name}: Title_var is inside instance`);
        else {
          const ok = await bindWithFontRetry(found.title, vTitle, `[${sectionName}] ${frame.name}: Title_var`, res.errors);
          if (ok) {
            tryApplyRTLAlignment(found.title, rtl, res.warnings, `[${sectionName}] ${frame.name}: Title_var`);
            res.bound++;
            res.binds.push({ section: sectionName, frame: frame.name, layer: found.title.name, variable: vTitle.name });
          }
        }
      } else {
        if (!found.title) res.warnings.push(`[${sectionName}] ${frame.name}: missing Title_var`);
        if (!vTitle) res.warnings.push(`[${sectionName}] ${frame.name}: missing variable ${detected.keyRaw}/screenshot_${pad2(shotIdx)}/title`);
      }
    }

    // Descriptions
    const descMap = new Map<number, TextNode[]>();
    for (const n of found.descriptions) {
      const di = parseDescriptionIndexFromLayerName(n.name);
      const arr = descMap.get(di) ?? [];
      arr.push(n);
      descMap.set(di, arr);
    }

    for (let di = 1; di <= MAX_DESC; di++) {
      const nodesForThis = descMap.get(di) ?? [];
      if (nodesForThis.length === 0) continue;

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
          tryApplyRTLAlignment(node, rtl, res.warnings, `[${sectionName}] ${frame.name}: ${node.name}`);
          res.bound++;
          res.binds.push({ section: sectionName, frame: frame.name, layer: node.name, variable: variable.name });
        }
      }
    }
  }

  return res;
}

// ---------------- BIND ----------------

async function runBinding(settings: Settings): Promise<string> {
  const languageSections = await collectSectionsFromSnapshot(selectionSnapshotIds);
  if (languageSections.length === 0) throw new Error("No Sections found in the selection snapshot.");

  const anchor = lowestCommonSection(languageSections);
  const global = await buildGlobalVarIndex();

  const results: SectionResult[] = [];
  for (const sec of languageSections) results.push(await bindLanguageSection(sec, global));

  const totalBound = results.reduce((s, r) => s + r.bound, 0);
  const processed = results.filter((r) => r.keyRaw).length;
  const missingKey = results.filter((r) => !r.keyRaw).length;

  const logText = buildGlobalLogText({
    title: "Global Bind Log",
    anchorName: anchor.name,
    selectedSectionsCount: languageSections.length,
    processed,
    missingKey,
    totalBound,
    results,
    extraBlocks: [],
  });

  if (settings.logging) await writeGlobalLog(anchor, logText);

  figma.notify(`Bound: ${totalBound} | Sections: ${languageSections.length}`, { timeout: 8000 });

  return `Selected sections: ${languageSections.length}\nProcessed: ${processed}\nMissing key: ${missingKey}\nTotal bound: ${totalBound}`;
}

// ---------------- GEN: generate missing locales ----------------

function isChildrenParent(n: BaseNode | null): n is BaseNode & ChildrenMixin {
  return !!n && (n as any).children !== undefined && typeof (n as any).appendChild === "function";
}

function sortKeysByRaw(keyLowers: string[], keyLowerToRaw: Map<string, string>): string[] {
  return keyLowers
    .slice()
    .sort((a, b) => (keyLowerToRaw.get(a) ?? a).localeCompare(keyLowerToRaw.get(b) ?? b));
}

function localeKeysWithAnyContent(global: GlobalVarIndex): string[] {
  // Heuristic: locale key is valid if it has screenshot_01/title
  const keys: string[] = [];
  for (const keyLower of global.keyLowerToRaw.keys()) {
    if (global.index.has(makeIndexKey(keyLower, 1, "title"))) keys.push(keyLower);
  }
  return keys;
}

function presentLocaleKeysAmongSiblings(parent: BaseNode & ChildrenMixin, global: GlobalVarIndex): Set<string> {
  const present = new Set<string>();
  for (const ch of parent.children) {
    if (ch.type !== "SECTION") continue;
    const s = ch as SectionNode;
    const det = detectKeyForSection(s.name ?? "", global.keyLowerToRaw);
    if (det.keyLower) present.add(det.keyLower);
  }
  return present;
}

async function generateMissingLocales(settings: Settings): Promise<string> {
  const selectedLanguageSections = await collectSectionsFromSnapshot(selectionSnapshotIds);
  if (selectedLanguageSections.length === 0) throw new Error("No Sections found in the selection snapshot.");

  const anchor = lowestCommonSection(selectedLanguageSections);
  const global = await buildGlobalVarIndex();

  const template = selectedLanguageSections[0];
  if (!isChildrenParent(template.parent)) throw new Error("Template section has no valid parent container.");

  const parent = template.parent;

  const allLocaleKeys = localeKeysWithAnyContent(global);
  const presentKeys = presentLocaleKeysAmongSiblings(parent, global);

  const templateDet = detectKeyForSection(template.name ?? "", global.keyLowerToRaw);
  if (templateDet.keyLower) presentKeys.add(templateDet.keyLower);

  const missing = allLocaleKeys.filter((k) => !presentKeys.has(k));
  const missingSorted = sortKeysByRaw(missing, global.keyLowerToRaw);

  if (missingSorted.length === 0) {
    const logText = buildGlobalLogText({
      title: "Global Log (Generate Missing Locales)",
      anchorName: anchor.name,
      selectedSectionsCount: selectedLanguageSections.length,
      processed: 0,
      missingKey: 0,
      totalBound: 0,
      results: [],
      extraBlocks: [
        `Generate missing locales:\n(none) — all locales already exist next to the selected section.`,
      ],
    });
    if (settings.logging) await writeGlobalLog(anchor, logText);
    figma.notify("No missing locales found.", { timeout: 5000 });
    return "No missing locales found.";
  }

  let nextY = template.y + template.height + CLONE_GAP_Y;

  const createdSections: SectionNode[] = [];
  const results: SectionResult[] = [];

  for (const keyLower of missingSorted) {
    const keyRaw = global.keyLowerToRaw.get(keyLower) ?? keyLower;

    const cloneNode = template.clone();
    if (cloneNode.type !== "SECTION") {
      cloneNode.remove();
      continue;
    }

    const clone = cloneNode as SectionNode;
    clone.name = keyRaw;

    parent.appendChild(clone);

    clone.x = template.x;
    clone.y = nextY;
    nextY += clone.height + CLONE_GAP_Y;

    createdSections.push(clone);

    const r = await bindLanguageSection(clone, global, { keyLower, keyRaw });
    results.push(r);
  }

  const totalBound = results.reduce((s, r) => s + r.bound, 0);

  const extraBlocks: string[] = [
    `Generate missing locales:\nTemplate: ${template.name}\nCreated sections: ${createdSections.length}\nCreated locales:\n${
      createdSections.map((s) => `- ${s.name}`).join("\n")
    }`,
  ];

  const logText = buildGlobalLogText({
    title: "Global Log (Generate Missing Locales)",
    anchorName: anchor.name,
    selectedSectionsCount: selectedLanguageSections.length,
    processed: createdSections.length,
    missingKey: 0,
    totalBound,
    results,
    extraBlocks,
  });

  if (settings.logging) await writeGlobalLog(anchor, logText);

  figma.notify(`Created: ${createdSections.length} | Bound: ${totalBound}`, { timeout: 8000 });

  return `Created sections: ${createdSections.length}\nTotal bound in new sections: ${totalBound}`;
}

// ---------------- log text builder ----------------

function buildGlobalLogText(args: {
  title: string;
  anchorName: string;
  selectedSectionsCount: number;
  processed: number;
  missingKey: number;
  totalBound: number;
  results: SectionResult[];
  extraBlocks: string[];
}): string {
  const perSectionSummary = args.results.map((r) => {
    const key = r.keyRaw ? r.keyRaw : "NOT FOUND";
    return `${r.sectionName} (key: ${key}) — bound ${r.bound}`;
  });

  const bindLines: string[] = [];
  for (const r of args.results) {
    for (const b of r.binds) {
      bindLines.push(`${b.section} / ${b.frame} / ${b.layer} -> ${b.variable}`);
    }
  }

  const warningLines: string[] = [];
  const errorLines: string[] = [];
  for (const r of args.results) {
    for (const w of r.warnings) warningLines.push(w);
    for (const e of r.errors) errorLines.push(e);
  }

  const extras = args.extraBlocks.length ? args.extraBlocks.join("\n\n") + "\n\n" : "";

  return (
    `${args.title}\n` +
    `Anchor section: ${args.anchorName}\n` +
    `Selected sections: ${args.selectedSectionsCount}\n` +
    `Processed: ${args.processed}\n` +
    `Missing key: ${args.missingKey}\n` +
    `Total bound: ${args.totalBound}\n\n` +
    extras +
    `Per-section summary:\n${perSectionSummary.length ? perSectionSummary.join("\n") : "(none)"}\n\n` +
    `Bindings:\n${bindLines.length ? bindLines.join("\n") : "(none)"}\n\n` +
    `Warnings:\n${warningLines.length ? warningLines.join("\n") : "(none)"}\n\n` +
    `Errors:\n${errorLines.length ? errorLines.join("\n") : "(none)"}`
  );
}