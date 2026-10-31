import type { ReportData } from "./collectReport";

/**
 * レポートを1枚の自己完結したHTMLにする（データは埋め込み、描画はブラウザ側のJS）。
 */
export function renderReport(data: ReportData): string {
  // </script> で埋め込みが途切れないようにする
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CPUの読みレポート</title>
<style>${STYLE}</style>
</head>
<body>
<main>
  <header>
    <h1>CPUの読みレポート</h1>
    <p class="muted" id="summary"></p>
  </header>

  <section>
    <h2>リプレイ</h2>
    <p class="muted">Strategy版のCPU4人の1ゲーム目。CPUが判断するたびに、全員の本当の手札と、そのCPUの読みを並べています。← → キーでも送れます。</p>
    <div class="controls">
      <button type="button" id="prev" aria-label="前の判断">◀</button>
      <input type="range" id="slider" min="0" value="0" aria-label="判断の番号">
      <button type="button" id="next" aria-label="次の判断">▶</button>
      <span id="position" class="muted"></span>
    </div>
    <div id="frame"></div>
    <p id="result" class="result"></p>
  </section>

  <section>
    <h2>読みの精度</h2>
    <p class="muted">CPUが「相手の手札合計が t 点である確率は p」と読んだとき、実際にそうだった割合（件数が30未満の区間はグラフから省き、表にだけ載せています）。点が対角線に乗っていれば、読みの確率が正確です（対角線より下なら読みすぎ、上なら読み足りない）。t はドボンに関わる点数（0〜10、20、30、40、50 など）。</p>
    <div class="legend" id="legend"></div>
    <div class="chart-wrap"><svg id="calibration" role="img" aria-label="予測確率と実際の割合"></svg><div id="tooltip" class="tooltip" hidden></div></div>
    <h3>表で見る</h3>
    <div id="calibration-table"></div>
    <h3>ドボン返し狙いの読み（きっかけのカードごと）</h3>
    <p class="muted">手札が少ないときに記号カードを出した人について、「残りが出したカードと同じ点数」とつけた確率と、実際にそうだった割合。シミュレーターの相手はCPUなので、人間がどれだけ狙うかとは別物です。</p>
    <div id="bait-table"></div>
    <h3>ドボン返しされる確率</h3>
    <p class="muted">ドボンできるときに見積もった「ドボン返しされる確率」と、実際にドボン返しできる手札だった割合。</p>
    <div id="return-table"></div>
  </section>
</main>
<script id="report-data" type="application/json">${json}</script>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

const STYLE = `
:root {
  color-scheme: light;
  --surface: #fcfcfb;
  --surface-2: #f2f1ee;
  --border: #dddcd6;
  --text-primary: #0b0b0b;
  --text-secondary: #52514e;
  --text-muted: #6f6e69;
  --series-1: #2a78d6;
  --series-2: #eb6834;
  --series-3: #1baf7a;
  --accent: #2a78d6;
  --card-red: #e34948;
  --card-blue: #2a78d6;
  --card-green: #008300;
  --card-yellow: #c98500;
  --card-wild: #3b3a37;
  --bar: #2a78d6;
  --bar-true: #eb6834;
  --grid: #e6e5e0;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --surface: #1a1a19;
    --surface-2: #242423;
    --border: #3a3a38;
    --text-primary: #f0efec;
    --text-secondary: #c3c2b7;
    --text-muted: #9a998f;
    --series-1: #3987e5;
    --series-2: #d95926;
    --series-3: #199e70;
    --accent: #3987e5;
    --card-wild: #8a8983;
    --bar: #3987e5;
    --bar-true: #d95926;
    --grid: #2e2e2c;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --surface: #1a1a19;
  --surface-2: #242423;
  --border: #3a3a38;
  --text-primary: #f0efec;
  --text-secondary: #c3c2b7;
  --text-muted: #9a998f;
  --series-1: #3987e5;
  --series-2: #d95926;
  --series-3: #199e70;
  --accent: #3987e5;
  --card-wild: #8a8983;
  --bar: #3987e5;
  --bar-true: #d95926;
  --grid: #2e2e2c;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--surface); color: var(--text-primary);
  font: 14px/1.6 system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif; }
main { max-width: 1120px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 22px; margin: 0 0 4px; }
h2 { font-size: 18px; margin: 40px 0 8px; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
h3 { font-size: 15px; margin: 24px 0 8px; }
.muted { color: var(--text-muted); margin: 4px 0 12px; }
.controls { display: flex; gap: 8px; align-items: center; margin: 12px 0; }
.controls input { flex: 1; min-width: 0; }
button { font: inherit; padding: 4px 12px; border-radius: 6px; border: 1px solid var(--border);
  background: var(--surface-2); color: var(--text-primary); cursor: pointer; }
.frame { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
@media (max-width: 760px) { .frame { grid-template-columns: minmax(0, 1fr); } }
.panel { background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; min-width: 0; }
.panel h4 { margin: 0 0 8px; font-size: 14px; }
.events { margin: 0; padding-left: 18px; color: var(--text-secondary); }
.decision { font-size: 16px; font-weight: 600; margin: 4px 0 10px; }
.field { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; color: var(--text-secondary); }
.players { width: 100%; border-collapse: collapse; }
.players td { padding: 4px 6px; border-top: 1px solid var(--border); vertical-align: middle; }
.players tr.actor td { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.chips { display: flex; flex-wrap: wrap; gap: 3px; }
.chip { display: inline-block; padding: 0 5px; border-radius: 4px; color: #fff; font-size: 12px; line-height: 20px; white-space: nowrap; }
.chip.red { background: var(--card-red); } .chip.blue { background: var(--card-blue); }
.chip.green { background: var(--card-green); } .chip.yellow { background: var(--card-yellow); }
.chip.wild { background: var(--card-wild); }
.num { font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
.read { border-top: 1px solid var(--border); padding: 8px 0; }
.read:first-of-type { border-top: 0; padding-top: 0; }
.read-head { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.tags { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0; }
.tag { font-size: 12px; padding: 0 6px; border-radius: 4px; border: 1px solid var(--border); color: var(--text-secondary); }
.bars { display: grid; grid-template-columns: 40px 1fr 48px; gap: 2px 6px; align-items: center; font-size: 12px; }
.bar-track { height: 10px; background: var(--grid); border-radius: 2px; overflow: hidden; }
.bar-fill { height: 100%; background: var(--bar); border-radius: 0 2px 2px 0; }
.bar-fill.true { background: var(--bar-true); }
.candidates { width: 100%; border-collapse: collapse; font-size: 13px; }
.candidates th, .candidates td { padding: 3px 6px; border-top: 1px solid var(--border); text-align: left; }
.candidates th { color: var(--text-muted); font-weight: 500; }
.candidates tr.chosen td { font-weight: 600; }
.result { font-weight: 600; margin-top: 12px; }
.legend { display: flex; gap: 16px; flex-wrap: wrap; margin: 8px 0; color: var(--text-secondary); }
.legend span::before { content: ""; display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; background: var(--c); }
.chart-wrap { position: relative; max-width: 560px; }
#calibration { width: 100%; height: auto; display: block; }
#calibration text { fill: var(--text-muted); font-size: 11px; }
.tooltip { position: absolute; pointer-events: none; background: var(--surface); border: 1px solid var(--border);
  border-radius: 6px; padding: 6px 8px; font-size: 12px; color: var(--text-primary); white-space: nowrap; box-shadow: 0 2px 8px rgb(0 0 0 / 0.15); }
.table-scroll { overflow-x: auto; }
table.data { border-collapse: collapse; font-size: 13px; min-width: 100%; }
table.data th, table.data td { padding: 4px 8px; border-top: 1px solid var(--border); }
table.data th { color: var(--text-muted); font-weight: 500; text-align: left; }
`;

const SCRIPT = `
const data = JSON.parse(document.getElementById("report-data").textContent);
const MIN_POINT_SAMPLES = 30;
const SERIES = { plain: "--series-1", excluded: "--series-2", bait: "--series-3" };

function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") node.className = v; else if (k === "style") node.style.cssText = v; else node.setAttribute(k, v);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : String(child));
  }
  return node;
}
const pct = (p) => (p * 100).toFixed(p < 0.1 ? 1 : 0) + "%";
const COLOR_JA = { red: "赤", blue: "青", green: "緑", yellow: "黄" };
const VALUE_JA = { skip: "スキップ", reverse: "リバース", draw2: "ドロー2", wild: "ワイルド", draw4: "ドロー4", "force-change": "強制色変え" };
const chip = (c) => el("span", { class: "chip " + c.color, title: c.points + "点" },
  (COLOR_JA[c.color] || "") + (VALUE_JA[c.value] || c.value));

document.getElementById("summary").textContent =
  data.games + "ゲーム分の判断から集計 / リプレイは " + data.replay.frames.length + " 回の判断";

// ---------- リプレイ ----------
const frames = data.replay.frames;
const slider = document.getElementById("slider");
slider.max = String(Math.max(frames.length - 1, 0));
let index = 0;

function renderFrame() {
  const f = frames[index];
  const root = document.getElementById("frame");
  root.replaceChildren();
  document.getElementById("position").textContent = (index + 1) + " / " + frames.length;
  slider.value = String(index);
  document.getElementById("result").textContent = index === frames.length - 1 ? "結果: " + data.replay.result : "";
  if (!f) return;

  const left = el("div", { class: "panel" },
    el("h4", {}, "ここまでの出来事"),
    f.events.length ? el("ol", { class: "events" }, f.events.map((e) => el("li", {}, e))) : el("p", { class: "muted" }, "（前の判断から変化なし）"),
    el("div", { class: "field" }, "場札:", f.field ? chip(f.field) : "なし",
      f.currentColor ? "色: " + (COLOR_JA[f.currentColor] || f.currentColor) : "",
      f.drawStack ? "累積ドロー: " + f.drawStack + "枚" : ""),
    el("h4", {}, "全員の本当の手札"),
    el("table", { class: "players" }, el("tbody", {}, f.players.map((p) =>
      el("tr", { class: p.name === f.actor ? "actor" : "" },
        el("td", {}, p.name), el("td", {}, el("div", { class: "chips" }, p.hand.map(chip))),
        el("td", { class: "num" }, p.total + "点"))))),
  );

  const reads = f.reads.map((r) => {
    const tags = [];
    if (r.excluded.length) tags.push("ドボンしなかった点数: " + r.excluded.join(", "));
    if (r.bait) tags.push("ドボン返し狙い: 残り" + r.bait.total + "点 " + pct(r.bait.weight) + "（" + (VALUE_JA[r.bait.source] || r.bait.source) + "）");
    for (const l of r.lacks) tags.push("持っていなさそう: " + l);
    if (r.trapColor) tags.push("色変えで選んだ色: " + (COLOR_JA[r.trapColor] || r.trapColor));
    const max = Math.max(...r.top.map((t) => t.p), 0.1);
    return el("div", { class: "read" },
      el("div", { class: "read-head" },
        el("strong", {}, r.name + "（" + r.handCount + "枚）"),
        el("span", {}, "本当は " + r.trueTotal + "点 → 読みの確率 " + pct(r.predictedTrue) + " / 期待値 " + r.mean.toFixed(1) + "点")),
      tags.length ? el("div", { class: "tags" }, tags.map((t) => el("span", { class: "tag" }, t))) : null,
      el("div", { class: "bars" }, r.top.map((t) => [
        el("span", { class: "num" }, t.total + "点"),
        el("div", { class: "bar-track" }, el("div", { class: "bar-fill" + (t.total === r.trueTotal ? " true" : ""), style: "width:" + (t.p / max * 100) + "%" })),
        el("span", { class: "num" }, pct(t.p)),
      ])));
  });

  const right = el("div", { class: "panel" },
    el("h4", {}, f.actor + " の判断"),
    el("p", { class: "decision" }, f.decision + (f.returnRisk !== undefined && f.returnRisk !== null ? "（ドボン返しされる確率 " + pct(f.returnRisk) + "）" : "")),
    f.candidates.length ? el("table", { class: "candidates" },
      el("thead", {}, el("tr", {}, el("th", {}, "候補"), el("th", { class: "num" }, "評価"), el("th", { class: "num" }, "ドボンされる確率"))),
      el("tbody", {}, f.candidates.map((c) => el("tr", { class: c.chosen ? "chosen" : "" },
        el("td", {}, (c.chosen ? "✓ " : "") + c.label),
        el("td", { class: "num" }, c.score.toFixed(1)),
        el("td", { class: "num" }, c.dobonRisk === undefined || c.dobonRisk === null ? "—" : pct(c.dobonRisk)))))) : null,
    el("h4", { style: "margin-top:12px" }, "相手の読み：その点数のカードを出したらドボンされる確率（橙が本当の合計）"),
    reads,
  );

  root.append(el("div", { class: "frame" }, left, right));
}
const go = (d) => { index = Math.min(Math.max(index + d, 0), frames.length - 1); renderFrame(); };
document.getElementById("prev").addEventListener("click", () => go(-1));
document.getElementById("next").addEventListener("click", () => go(1));
slider.addEventListener("input", () => { index = Number(slider.value); renderFrame(); });
document.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") go(-1); if (e.key === "ArrowRight") go(1); });
renderFrame();

// ---------- 読みの精度 ----------
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const legend = document.getElementById("legend");
for (const s of data.calibration) {
  legend.append(el("span", { style: "--c: var(" + SERIES[s.key] + ")" }, s.label + "（" + s.samples.toLocaleString() + "件）"));
}

function drawCalibration() {
  const svg = document.getElementById("calibration");
  const W = 520, H = 400, L = 48, R = 16, T = 12, B = 40;
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  svg.replaceChildren();
  const NS = "http://www.w3.org/2000/svg";
  const s = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); svg.append(n); return n; };
  // 低い確率に点が集まるので平方根の目盛りにする
  const scale = (v) => Math.sqrt(Math.max(v, 0));
  const x = (v) => L + scale(v) * (W - L - R);
  const y = (v) => H - B - scale(v) * (H - T - B);
  for (const tick of [0, 0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 1]) {
    s("line", { x1: x(tick), x2: x(tick), y1: y(0), y2: y(1), stroke: css("--grid") });
    s("line", { x1: x(0), x2: x(1), y1: y(tick), y2: y(tick), stroke: css("--grid") });
    s("text", { x: x(tick), y: H - B + 16, "text-anchor": "middle" }).textContent = pct(tick);
    s("text", { x: L - 6, y: y(tick) + 4, "text-anchor": "end" }).textContent = pct(tick);
  }
  s("text", { x: (L + W - R) / 2, y: H - 4, "text-anchor": "middle" }).textContent = "CPUの読み（予測確率）";
  const yl = s("text", { x: 12, y: (T + H - B) / 2, "text-anchor": "middle", transform: "rotate(-90 12 " + (T + H - B) / 2 + ")" });
  yl.textContent = "実際にそうだった割合";
  const diag = [];
  for (let i = 0; i <= 50; i++) { const v = i / 50; diag.push(x(v) + "," + y(v)); }
  s("polyline", { points: diag.join(" "), fill: "none", stroke: css("--text-muted"), "stroke-dasharray": "4 4", "stroke-width": 1 });

  const tooltip = document.getElementById("tooltip");
  for (const series of data.calibration) {
    const color = css(SERIES[series.key]);
    const pts = series.bins.filter((b) => b.count >= MIN_POINT_SAMPLES);
    s("polyline", { points: pts.map((b) => x(b.meanPredicted) + "," + y(b.observed)).join(" "), fill: "none", stroke: color, "stroke-width": 2 });
    for (const b of pts) {
      const r = Math.max(4, Math.min(9, 3 + Math.log10(b.count)));
      s("circle", { cx: x(b.meanPredicted), cy: y(b.observed), r, fill: color, stroke: css("--surface"), "stroke-width": 2 });
      const hit = s("circle", { cx: x(b.meanPredicted), cy: y(b.observed), r: 14, fill: "transparent" });
      hit.addEventListener("pointerenter", () => {
        tooltip.hidden = false;
        tooltip.replaceChildren(el("strong", {}, series.label), el("br"),
          "予測 " + pct(b.lo) + "〜" + pct(b.hi) + "（平均 " + pct(b.meanPredicted) + "）", el("br"),
          "実際 " + pct(b.observed) + " / " + b.count.toLocaleString() + "件");
        const box = svg.getBoundingClientRect();
        const k = box.width / W;
        tooltip.style.left = Math.min(x(b.meanPredicted) * k + 12, box.width - 180) + "px";
        tooltip.style.top = (y(b.observed) * k - 10) + "px";
      });
      hit.addEventListener("pointerleave", () => { tooltip.hidden = true; });
    }
  }
}
drawCalibration();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", drawCalibration);

function seriesTable(list, withBins) {
  const head = ["読み", "件数", "予測の平均", "実際の割合"];
  const rows = list.map((s) => [s.label, s.samples.toLocaleString(), pct(s.meanPredicted), pct(s.observed)]);
  const table = el("table", { class: "data" },
    el("thead", {}, el("tr", {}, head.map((h) => el("th", {}, h)))),
    el("tbody", {}, rows.map((r) => el("tr", {}, r.map((c, i) => el("td", { class: i ? "num" : "" }, c))))));
  const wrap = el("div", { class: "table-scroll" }, table);
  if (!withBins) return wrap;
  const binTable = el("table", { class: "data", style: "margin-top:12px" },
    el("thead", {}, el("tr", {}, el("th", {}, "予測の区間"), list.map((s) => el("th", { class: "num" }, s.label + "（件数 / 実際）")))),
    el("tbody", {}, list[0].bins.map((b, i) => el("tr", {},
      el("td", {}, pct(b.lo) + "〜" + pct(b.hi)),
      list.map((s) => el("td", { class: "num" }, s.bins[i].count ? s.bins[i].count.toLocaleString() + " / " + pct(s.bins[i].observed) : "—"))))));
  return el("div", {}, wrap, el("div", { class: "table-scroll" }, binTable));
}
document.getElementById("calibration-table").append(seriesTable(data.calibration, true));
document.getElementById("bait-table").append(data.baits.length ? seriesTable(data.baits, false) : el("p", { class: "muted" }, "該当なし"));
document.getElementById("return-table").append(seriesTable([data.returnRisk], true));
`;
