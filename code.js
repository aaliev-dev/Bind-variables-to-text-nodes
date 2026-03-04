"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
const selectionSnapshotIds = figma.currentPage.selection.map((n) => n.id);
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
(() => __awaiter(void 0, void 0, void 0, function* () {
    const saved = (yield figma.clientStorage.getAsync(SETTINGS_KEY));
    const settings = { logging: typeof (saved === null || saved === void 0 ? void 0 : saved.logging) === "boolean" ? saved.logging : true };
    figma.ui.postMessage({ type: "INIT", settings });
}))().catch(() => {
    figma.ui.postMessage({ type: "INIT", settings: { logging: true } });
});
figma.ui.onmessage = (raw) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const msg = raw;
    if ((msg === null || msg === void 0 ? void 0 : msg.type) === "CANCEL") {
        figma.closePlugin();
        return;
    }
    const settings = { logging: !!((_a = msg.settings) === null || _a === void 0 ? void 0 : _a.logging) };
    yield figma.clientStorage.setAsync(SETTINGS_KEY, settings);
    try {
        let summary = "";
        if ((msg === null || msg === void 0 ? void 0 : msg.type) === "BIND")
            summary = yield runBinding(settings);
        else if ((msg === null || msg === void 0 ? void 0 : msg.type) === "GEN")
            summary = yield generateMissingLocales(settings);
        else
            return;
        figma.ui.postMessage({ type: "DONE", summary });
        figma.closePlugin();
    }
    catch (e) {
        figma.ui.postMessage({ type: "ERROR", message: String((_b = e === null || e === void 0 ? void 0 : e.message) !== null && _b !== void 0 ? _b : e) });
    }
});
// ---------------- helpers ----------------
function norm(s) {
    return (s !== null && s !== void 0 ? s : "").trim().toLowerCase();
}
function normLoose(s) {
    return norm(s).replace(/[\s-]+/g, "_").replace(/_+/g, "_");
}
function pad2(n) {
    const s = String(n);
    return s.length >= 2 ? s : "0" + s;
}
function getIndex1to7FromAny(name) {
    const m = (name !== null && name !== void 0 ? name : "").match(/(\d{1,2})/);
    if (!m)
        return null;
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n < 1 || n > 7)
        return null;
    return n;
}
function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function matchesKey(sectionLower, keyLower) {
    if (!keyLower)
        return false;
    if (keyLower.length <= 2) {
        const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(keyLower)}([^a-z0-9]|$)`, "i");
        return re.test(sectionLower);
    }
    return sectionLower.includes(keyLower);
}
function isInsideInstance(node) {
    let cur = node;
    while (cur) {
        if (cur.type === "INSTANCE")
            return true;
        cur = cur.parent;
    }
    return false;
}
function isRTLKey(keyLower) {
    // simple heuristic: Arabic/Hebrew locale prefixes
    return keyLower.startsWith("ar") || keyLower.startsWith("he");
}
// ---------------- selection -> sections + LCA ----------------
function nearestSection(node) {
    let cur = node;
    while (cur) {
        if (cur.type === "SECTION")
            return cur;
        cur = cur.parent;
    }
    return null;
}
function collectSectionsFromSnapshot(ids) {
    return __awaiter(this, void 0, void 0, function* () {
        const byId = new Map();
        const ordered = [];
        for (const id of ids) {
            const n = yield figma.getNodeByIdAsync(id);
            if (!n)
                continue;
            const s = n.type === "SECTION" ? n : nearestSection(n);
            if (!s)
                continue;
            if (!byId.has(s.id)) {
                byId.set(s.id, s);
                ordered.push(s);
            }
        }
        return ordered;
    });
}
function sectionAncestorChain(section) {
    const chain = [];
    let cur = section;
    while (cur) {
        if (cur.type === "SECTION")
            chain.push(cur);
        cur = cur.parent;
    }
    return chain; // leaf -> ... -> root
}
function lowestCommonSection(sections) {
    if (sections.length === 1)
        return sections[0];
    const chains = sections.map(sectionAncestorChain);
    const sets = chains.map((c) => new Set(c.map((s) => s.id)));
    for (const candidate of chains[0]) {
        const ok = sets.every((st) => st.has(candidate.id));
        if (ok)
            return candidate;
    }
    return sections[0];
}
function makeIndexKey(keyLower, shotIdx, fieldLower) {
    return `${keyLower}|screenshot_${pad2(shotIdx)}|${fieldLower}`;
}
function isSupportedField(fieldRaw) {
    const f = norm(fieldRaw);
    if (f === "title")
        return true;
    if (f === "description")
        return true; // legacy
    if (f.startsWith("description_"))
        return true;
    return false;
}
function buildGlobalVarIndex() {
    return __awaiter(this, void 0, void 0, function* () {
        const vars = yield figma.variables.getLocalVariablesAsync("STRING");
        const keyLowerToRaw = new Map();
        const index = new Map();
        for (const v of vars) {
            const parts = v.name.split("/").map((p) => p.trim()).filter(Boolean);
            if (parts.length < 3)
                continue;
            if (ROOT_SEGMENT) {
                const ok = parts.some((p) => norm(p) === norm(ROOT_SEGMENT));
                if (!ok)
                    continue;
            }
            const fieldRaw = parts[parts.length - 1];
            const shotRaw = parts[parts.length - 2];
            const keyRaw = parts[parts.length - 3];
            if (!isSupportedField(fieldRaw))
                continue;
            const shotIdx = getIndex1to7FromAny(shotRaw);
            if (!shotIdx)
                continue;
            const keyLower = norm(keyRaw);
            if (!keyLowerToRaw.has(keyLower))
                keyLowerToRaw.set(keyLower, keyRaw);
            const fieldLower = norm(fieldRaw);
            const k = makeIndexKey(keyLower, shotIdx, fieldLower);
            if (!index.has(k))
                index.set(k, v);
        }
        return { keyLowerToRaw, index };
    });
}
function detectKeyForSection(sectionName, keyLowerToRaw) {
    var _a;
    const sectionLower = norm(sectionName);
    let bestLower = null;
    let bestLen = 0;
    for (const keyLower of keyLowerToRaw.keys()) {
        if (matchesKey(sectionLower, keyLower) && keyLower.length > bestLen) {
            bestLen = keyLower.length;
            bestLower = keyLower;
        }
    }
    if (!bestLower)
        return { keyLower: null, keyRaw: null };
    return { keyLower: bestLower, keyRaw: (_a = keyLowerToRaw.get(bestLower)) !== null && _a !== void 0 ? _a : bestLower };
}
function getVariableByCandidates(globalIndex, keyLower, shotIdx, fields) {
    for (const f of fields) {
        const fieldLower = norm(f);
        const v = globalIndex.get(makeIndexKey(keyLower, shotIdx, fieldLower));
        if (v)
            return { variable: v, usedFieldLower: fieldLower };
    }
    return { variable: null, usedFieldLower: null };
}
function variableCandidatesForDescription(descIndex) {
    const c = [
        `description_${descIndex}`,
        `description_${pad2(descIndex)}`,
    ];
    if (descIndex === 1)
        c.push("description");
    return c;
}
// ---------------- fonts + bind retry ----------------
const loadedFonts = new Set();
function fontKey(f) {
    return `${f.family}::${f.style}`;
}
function loadFontOnce(f) {
    return __awaiter(this, void 0, void 0, function* () {
        const k = fontKey(f);
        if (loadedFonts.has(k))
            return;
        yield figma.loadFontAsync(f);
        loadedFonts.add(k);
    });
}
const styleFontCache = new Map();
function fontFromStyleId(styleId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (styleFontCache.has(styleId))
            return (_a = styleFontCache.get(styleId)) !== null && _a !== void 0 ? _a : null;
        const style = yield figma.getStyleByIdAsync(styleId);
        let font = null;
        if (style && style.type === "TEXT") {
            const ts = style;
            if (ts.fontName)
                font = ts.fontName;
        }
        styleFontCache.set(styleId, font);
        return font;
    });
}
function ensureFontsForText(t) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const candidates = [];
        if (t.fontName !== figma.mixed)
            candidates.push(t.fontName);
        if (t.textStyleId !== figma.mixed && t.textStyleId) {
            const f = yield fontFromStyleId(t.textStyleId);
            if (f)
                candidates.push(f);
        }
        const len = (_b = (_a = t.characters) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
        const end = Math.max(1, len);
        try {
            const fonts = t.getRangeAllFontNames(0, end);
            for (const f of fonts)
                candidates.push(f);
        }
        catch (_c) { }
        try {
            const f = t.getRangeFontName(0, end);
            if (f !== figma.mixed)
                candidates.push(f);
        }
        catch (_d) { }
        const uniq = new Map();
        for (const f of candidates)
            uniq.set(fontKey(f), f);
        for (const f of uniq.values())
            yield loadFontOnce(f);
    });
}
function parseFontFromError(msg) {
    const re = /figma\.loadFontAsync\(\{\s*family:\s*"([^"]+)"\s*,\s*style:\s*"([^"]+)"\s*\}\)/;
    const m = msg.match(re);
    if (!m)
        return null;
    return { family: m[1], style: m[2] };
}
function bindWithFontRetry(node, variable, ctx, errors) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            yield ensureFontsForText(node);
            node.setBoundVariable("characters", variable);
            return true;
        }
        catch (e) {
            const msg = String((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e);
            const f = parseFontFromError(msg);
            if (f) {
                try {
                    yield loadFontOnce(f);
                    node.setBoundVariable("characters", variable);
                    return true;
                }
                catch (e2) {
                    errors.push(`${ctx} -> ${String((_b = e2 === null || e2 === void 0 ? void 0 : e2.message) !== null && _b !== void 0 ? _b : e2)}`);
                    return false;
                }
            }
            errors.push(`${ctx} -> ${msg}`);
            return false;
        }
    });
}
function maybePreloadCommonFonts(keyLower) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield loadFontOnce({ family: "Noto Sans", style: "Black" });
        }
        catch (_a) { }
        try {
            yield loadFontOnce({ family: "Noto Sans", style: "SemiBold" });
        }
        catch (_b) { }
        if (keyLower.startsWith("ar")) {
            try {
                yield loadFontOnce({ family: "Noto Sans Arabic", style: "Black" });
            }
            catch (_c) { }
            try {
                yield loadFontOnce({ family: "Noto Sans Arabic", style: "SemiBold" });
            }
            catch (_d) { }
        }
    });
}
// ---------------- global log panel ----------------
let interLoaded = false;
function ensureInterRegular() {
    return __awaiter(this, void 0, void 0, function* () {
        if (interLoaded)
            return;
        yield figma.loadFontAsync({ family: "Inter", style: "Regular" });
        interLoaded = true;
    });
}
function styleLogFrame(frame) {
    frame.clipsContent = false;
    frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 }, opacity: 1 }];
    frame.strokes = [{ type: "SOLID", color: { r: 0.9, g: 0.9, b: 0.9 }, opacity: 1 }];
    frame.strokeWeight = 1;
    frame.cornerRadius = 8;
}
function styleLogText(t) {
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
function getOrCreateGlobalLogPanel() {
    return __awaiter(this, void 0, void 0, function* () {
        const storedId = figma.currentPage.getPluginData(GLOBAL_LOG_PANEL_ID_KEY);
        if (storedId) {
            const n = yield figma.getNodeByIdAsync(storedId);
            if (n && n.type === "FRAME") {
                const frame = n;
                styleLogFrame(frame);
                frame.resize(LOG_PANEL_WIDTH, Math.max(60, frame.height));
                let text = frame.findOne((x) => x.type === "TEXT" && x.name === GLOBAL_LOG_TEXT_NAME);
                yield ensureInterRegular();
                if (!text) {
                    text = figma.createText();
                    styleLogText(text);
                    frame.appendChild(text);
                }
                else {
                    styleLogText(text);
                }
                frame.name = GLOBAL_LOG_PANEL_NAME;
                return { frame, text };
            }
        }
        yield ensureInterRegular();
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
    });
}
function writeGlobalLog(anchor, content) {
    return __awaiter(this, void 0, void 0, function* () {
        yield ensureInterRegular();
        const { frame, text } = yield getOrCreateGlobalLogPanel();
        frame.x = anchor.x - LOG_GAP - LOG_PANEL_WIDTH;
        frame.y = anchor.y;
        text.characters = content;
        text.textAutoResize = "HEIGHT";
        text.resize(LOG_TEXT_WIDTH, Math.max(10, text.height));
        const newH = text.height + LOG_PAD * 2;
        frame.resize(LOG_PANEL_WIDTH, Math.max(60, newH));
    });
}
// ---------------- node finding (ALWAYS search-based) ----------------
function listDescriptionLayerNames() {
    const names = ["Description_var"];
    for (let i = 1; i <= MAX_DESC; i++)
        names.push(`Description_var_${i}`);
    return names;
}
function parseDescriptionIndexFromLayerName(nodeName) {
    const n = normLoose(nodeName);
    const m = n.match(/description_var_(\d+)$/);
    if (!m)
        return 1;
    const idx = Number(m[1]);
    if (!Number.isFinite(idx) || idx < 1)
        return 1;
    return Math.min(MAX_DESC, idx);
}
function getScreenshotFrames(section) {
    const direct = section.children.filter((n) => n.type === "FRAME");
    const directFiltered = direct.filter((f) => getIndex1to7FromAny(f.name) !== null);
    if (directFiltered.length)
        return directFiltered;
    const all = section.findAll((n) => n.type === "FRAME");
    return all.filter((f) => getIndex1to7FromAny(f.name) !== null);
}
function findNodesBySearch(frame) {
    const titleWanted = normLoose("Title_var");
    const title = frame.findOne((n) => n.type === "TEXT" && normLoose(n.name) === titleWanted);
    const descriptions = [];
    for (const name of listDescriptionLayerNames()) {
        const wanted = normLoose(name);
        const node = frame.findOne((n) => n.type === "TEXT" && normLoose(n.name) === wanted);
        if (node)
            descriptions.push(node);
    }
    return { title, descriptions };
}
// ---------------- RTL alignment ----------------
function tryApplyRTLAlignment(node, rtl, warnings, ctx) {
    var _a;
    if (!rtl)
        return;
    try {
        node.textAlignHorizontal = "RIGHT";
    }
    catch (e) {
        // Some cases may throw (rare). We keep it non-fatal.
        warnings.push(`${ctx}: failed to set textAlignHorizontal=RIGHT (${String((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : e)})`);
    }
}
function bindLanguageSection(section, global, forcedKey) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const sectionName = ((_a = section.name) !== null && _a !== void 0 ? _a : "").trim();
        const detected = forcedKey
            ? { keyLower: forcedKey.keyLower, keyRaw: forcedKey.keyRaw }
            : detectKeyForSection(sectionName, global.keyLowerToRaw);
        const res = {
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
        yield maybePreloadCommonFonts(detected.keyLower);
        const frames = getScreenshotFrames(section);
        for (const frame of frames) {
            const shotIdx = getIndex1to7FromAny(frame.name);
            if (!shotIdx)
                continue;
            const found = findNodesBySearch(frame);
            // Title
            {
                const { variable: vTitle } = getVariableByCandidates(global.index, detected.keyLower, shotIdx, ["title"]);
                if (found.title && vTitle) {
                    if (found.title.locked)
                        res.warnings.push(`[${sectionName}] ${frame.name}: Title_var is locked`);
                    else if (isInsideInstance(found.title))
                        res.warnings.push(`[${sectionName}] ${frame.name}: Title_var is inside instance`);
                    else {
                        const ok = yield bindWithFontRetry(found.title, vTitle, `[${sectionName}] ${frame.name}: Title_var`, res.errors);
                        if (ok) {
                            tryApplyRTLAlignment(found.title, rtl, res.warnings, `[${sectionName}] ${frame.name}: Title_var`);
                            res.bound++;
                            res.binds.push({ section: sectionName, frame: frame.name, layer: found.title.name, variable: vTitle.name });
                        }
                    }
                }
                else {
                    if (!found.title)
                        res.warnings.push(`[${sectionName}] ${frame.name}: missing Title_var`);
                    if (!vTitle)
                        res.warnings.push(`[${sectionName}] ${frame.name}: missing variable ${detected.keyRaw}/screenshot_${pad2(shotIdx)}/title`);
                }
            }
            // Descriptions
            const descMap = new Map();
            for (const n of found.descriptions) {
                const di = parseDescriptionIndexFromLayerName(n.name);
                const arr = (_b = descMap.get(di)) !== null && _b !== void 0 ? _b : [];
                arr.push(n);
                descMap.set(di, arr);
            }
            for (let di = 1; di <= MAX_DESC; di++) {
                const nodesForThis = (_c = descMap.get(di)) !== null && _c !== void 0 ? _c : [];
                if (nodesForThis.length === 0)
                    continue;
                const { variable, usedFieldLower } = getVariableByCandidates(global.index, detected.keyLower, shotIdx, variableCandidatesForDescription(di));
                if (!variable) {
                    res.warnings.push(`[${sectionName}] ${frame.name}: missing variable for description #${di} (${variableCandidatesForDescription(di).join(" or ")})`);
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
                    const ctx = `[${sectionName}] ${frame.name}: ${node.name} -> ${usedFieldLower !== null && usedFieldLower !== void 0 ? usedFieldLower : "description"}`;
                    const ok = yield bindWithFontRetry(node, variable, ctx, res.errors);
                    if (ok) {
                        tryApplyRTLAlignment(node, rtl, res.warnings, `[${sectionName}] ${frame.name}: ${node.name}`);
                        res.bound++;
                        res.binds.push({ section: sectionName, frame: frame.name, layer: node.name, variable: variable.name });
                    }
                }
            }
        }
        return res;
    });
}
// ---------------- BIND ----------------
function runBinding(settings) {
    return __awaiter(this, void 0, void 0, function* () {
        const languageSections = yield collectSectionsFromSnapshot(selectionSnapshotIds);
        if (languageSections.length === 0)
            throw new Error("No Sections found in the selection snapshot.");
        const anchor = lowestCommonSection(languageSections);
        const global = yield buildGlobalVarIndex();
        const results = [];
        for (const sec of languageSections)
            results.push(yield bindLanguageSection(sec, global));
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
        if (settings.logging)
            yield writeGlobalLog(anchor, logText);
        figma.notify(`Bound: ${totalBound} | Sections: ${languageSections.length}`, { timeout: 8000 });
        return `Selected sections: ${languageSections.length}\nProcessed: ${processed}\nMissing key: ${missingKey}\nTotal bound: ${totalBound}`;
    });
}
// ---------------- GEN: generate missing locales ----------------
function isChildrenParent(n) {
    return !!n && n.children !== undefined && typeof n.appendChild === "function";
}
function sortKeysByRaw(keyLowers, keyLowerToRaw) {
    return keyLowers
        .slice()
        .sort((a, b) => { var _a, _b; return ((_a = keyLowerToRaw.get(a)) !== null && _a !== void 0 ? _a : a).localeCompare((_b = keyLowerToRaw.get(b)) !== null && _b !== void 0 ? _b : b); });
}
function localeKeysWithAnyContent(global) {
    // Heuristic: locale key is valid if it has screenshot_01/title
    const keys = [];
    for (const keyLower of global.keyLowerToRaw.keys()) {
        if (global.index.has(makeIndexKey(keyLower, 1, "title")))
            keys.push(keyLower);
    }
    return keys;
}
function presentLocaleKeysAmongSiblings(parent, global) {
    var _a;
    const present = new Set();
    for (const ch of parent.children) {
        if (ch.type !== "SECTION")
            continue;
        const s = ch;
        const det = detectKeyForSection((_a = s.name) !== null && _a !== void 0 ? _a : "", global.keyLowerToRaw);
        if (det.keyLower)
            present.add(det.keyLower);
    }
    return present;
}
function generateMissingLocales(settings) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const selectedLanguageSections = yield collectSectionsFromSnapshot(selectionSnapshotIds);
        if (selectedLanguageSections.length === 0)
            throw new Error("No Sections found in the selection snapshot.");
        const anchor = lowestCommonSection(selectedLanguageSections);
        const global = yield buildGlobalVarIndex();
        const template = selectedLanguageSections[0];
        if (!isChildrenParent(template.parent))
            throw new Error("Template section has no valid parent container.");
        const parent = template.parent;
        const allLocaleKeys = localeKeysWithAnyContent(global);
        const presentKeys = presentLocaleKeysAmongSiblings(parent, global);
        const templateDet = detectKeyForSection((_a = template.name) !== null && _a !== void 0 ? _a : "", global.keyLowerToRaw);
        if (templateDet.keyLower)
            presentKeys.add(templateDet.keyLower);
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
            if (settings.logging)
                yield writeGlobalLog(anchor, logText);
            figma.notify("No missing locales found.", { timeout: 5000 });
            return "No missing locales found.";
        }
        let nextY = template.y + template.height + CLONE_GAP_Y;
        const createdSections = [];
        const results = [];
        for (const keyLower of missingSorted) {
            const keyRaw = (_b = global.keyLowerToRaw.get(keyLower)) !== null && _b !== void 0 ? _b : keyLower;
            const cloneNode = template.clone();
            if (cloneNode.type !== "SECTION") {
                cloneNode.remove();
                continue;
            }
            const clone = cloneNode;
            clone.name = keyRaw;
            parent.appendChild(clone);
            clone.x = template.x;
            clone.y = nextY;
            nextY += clone.height + CLONE_GAP_Y;
            createdSections.push(clone);
            const r = yield bindLanguageSection(clone, global, { keyLower, keyRaw });
            results.push(r);
        }
        const totalBound = results.reduce((s, r) => s + r.bound, 0);
        const extraBlocks = [
            `Generate missing locales:\nTemplate: ${template.name}\nCreated sections: ${createdSections.length}\nCreated locales:\n${createdSections.map((s) => `- ${s.name}`).join("\n")}`,
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
        if (settings.logging)
            yield writeGlobalLog(anchor, logText);
        figma.notify(`Created: ${createdSections.length} | Bound: ${totalBound}`, { timeout: 8000 });
        return `Created sections: ${createdSections.length}\nTotal bound in new sections: ${totalBound}`;
    });
}
// ---------------- log text builder ----------------
function buildGlobalLogText(args) {
    const perSectionSummary = args.results.map((r) => {
        const key = r.keyRaw ? r.keyRaw : "NOT FOUND";
        return `${r.sectionName} (key: ${key}) — bound ${r.bound}`;
    });
    const bindLines = [];
    for (const r of args.results) {
        for (const b of r.binds) {
            bindLines.push(`${b.section} / ${b.frame} / ${b.layer} -> ${b.variable}`);
        }
    }
    const warningLines = [];
    const errorLines = [];
    for (const r of args.results) {
        for (const w of r.warnings)
            warningLines.push(w);
        for (const e of r.errors)
            errorLines.push(e);
    }
    const extras = args.extraBlocks.length ? args.extraBlocks.join("\n\n") + "\n\n" : "";
    return (`${args.title}\n` +
        `Anchor section: ${args.anchorName}\n` +
        `Selected sections: ${args.selectedSectionsCount}\n` +
        `Processed: ${args.processed}\n` +
        `Missing key: ${args.missingKey}\n` +
        `Total bound: ${args.totalBound}\n\n` +
        extras +
        `Per-section summary:\n${perSectionSummary.length ? perSectionSummary.join("\n") : "(none)"}\n\n` +
        `Bindings:\n${bindLines.length ? bindLines.join("\n") : "(none)"}\n\n` +
        `Warnings:\n${warningLines.length ? warningLines.join("\n") : "(none)"}\n\n` +
        `Errors:\n${errorLines.length ? errorLines.join("\n") : "(none)"}`);
}
