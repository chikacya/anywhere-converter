export function renderHome() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Anywhere-converter</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #17202a;
      --muted: #5d6b78;
      --line: #c9d3dc;
      --panel: #f7fafc;
      --paper: #ffffff;
      --blueprint: #2554d7;
      --teal: #0e8f8f;
      --amber: #a15c08;
      --red: #b42318;
      --violet: #6544c6;
      --code: #101820;
      --shadow: rgba(23, 32, 42, .18);
      --radius: 8px;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    body[data-theme="dark"] {
      color-scheme: dark;
      --ink: #dce8f3;
      --muted: #9fb1c2;
      --line: #344456;
      --panel: #121b25;
      --paper: #0c131b;
      --blueprint: #7da2ff;
      --teal: #46c2bf;
      --amber: #d09242;
      --red: #ff7c72;
      --violet: #a995ff;
      --code: #060a0f;
      --shadow: rgba(0, 0, 0, .32);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        linear-gradient(90deg, rgba(37, 84, 215, .08) 1px, transparent 1px),
        linear-gradient(180deg, rgba(37, 84, 215, .07) 1px, transparent 1px),
        #edf3f8;
      background-size: 28px 28px;
      color: var(--ink);
    }
    body[data-theme="dark"] {
      background:
        linear-gradient(90deg, rgba(125, 162, 255, .1) 1px, transparent 1px),
        linear-gradient(180deg, rgba(70, 194, 191, .07) 1px, transparent 1px),
        #071019;
    }
    button, input, textarea, select { font: inherit; }
    a { color: var(--blueprint); text-decoration-thickness: 1px; text-underline-offset: 3px; }
    .shell {
      width: min(1440px, calc(100vw - 28px));
      margin: 0 auto;
      padding: 20px 0 28px;
    }
    header {
      display: grid;
      grid-template-columns: minmax(240px, 1fr) auto;
      align-items: center;
      gap: 16px;
      padding: 16px;
      border: 2px solid var(--ink);
      border-radius: var(--radius);
      background: color-mix(in srgb, var(--paper) 92%, transparent);
      box-shadow: 5px 5px 0 var(--shadow);
    }
    h1 {
      margin: 0;
      max-width: 780px;
      font-family: ui-serif, Georgia, "Times New Roman", serif;
      font-size: clamp(28px, 4.2vw, 56px);
      line-height: .96;
      letter-spacing: 0;
      font-weight: 800;
    }
    .subtitle {
      margin: 10px 0 0;
      max-width: 760px;
      color: var(--muted);
      line-height: 1.5;
      font-size: 14px;
    }
    .header-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
    .top-link {
      display: inline-grid;
      grid-auto-flow: column;
      align-items: center;
      gap: 8px;
      min-height: 38px;
      padding: 0 12px;
      border: 1px solid var(--ink);
      border-radius: 999px;
      background: var(--paper);
      font-size: 12px;
      font-weight: 900;
      white-space: nowrap;
      text-decoration: none;
      color: var(--ink);
      box-shadow: 2px 2px 0 rgba(23, 32, 42, .1);
    }
    body[data-theme="dark"] .top-link { box-shadow: 2px 2px 0 rgba(0, 0, 0, .24); }
    .top-link:hover, .btn:hover:not(:disabled), .file-link:hover { transform: translateY(-1px); }
    .top-link svg { width: 15px; height: 15px; }
    .health::before {
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--teal);
    }
    .github-link { color: var(--ink); }
    .theme-toggle {
      width: 38px;
      height: 38px;
      min-height: 38px;
      padding: 0;
      border-radius: 50%;
      position: relative;
      overflow: hidden;
    }
    .theme-toggle .moon,
    .theme-toggle .sun {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      line-height: 0;
    }
    .theme-toggle .moon svg,
    .theme-toggle .sun svg {
      width: 18px;
      height: 18px;
      display: block;
    }
    .theme-toggle .moon svg { transform: translate(.5px, -.25px); }
    .theme-toggle .sun { display: none; }
    body[data-theme="dark"] .theme-toggle .moon { display: none; }
    body[data-theme="dark"] .theme-toggle .sun { display: grid; }
    .workspace {
      display: grid;
      grid-template-columns: minmax(360px, 1.05fr) minmax(340px, .95fr);
      gap: 16px;
      margin-top: 16px;
      align-items: start;
    }
    .panel {
      border: 2px solid var(--ink);
      border-radius: var(--radius);
      background: var(--paper);
      box-shadow: 5px 5px 0 var(--shadow);
      min-width: 0;
    }
    .panel-head {
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      background: #f3f7fb;
    }
    body[data-theme="dark"] .panel-head { background: #101a24; }
    .panel-title {
      margin: 0;
      font-size: 13px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .08em;
    }
    .panel-body { padding: 12px; display: grid; gap: 12px; }
    form { display: grid; gap: 12px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    label { display: grid; gap: 6px; color: var(--muted); font-size: 12px; font-weight: 800; }
    input, textarea, select {
      width: 100%;
      border: 1px solid #aab7c4;
      border-radius: 6px;
      background: var(--paper);
      color: var(--ink);
      outline: none;
    }
    body[data-theme="dark"] input,
    body[data-theme="dark"] textarea,
    body[data-theme="dark"] select {
      border-color: #425368;
    }
    input, select { height: 38px; padding: 0 10px; }
    textarea {
      min-height: 430px;
      max-height: 58vh;
      resize: vertical;
      padding: 12px;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 12px;
      line-height: 1.5;
      tab-size: 2;
    }
    input:focus, textarea:focus, select:focus {
      border-color: var(--blueprint);
      box-shadow: 0 0 0 3px rgba(37, 84, 215, .16);
    }
    .switchline {
      display: grid;
      grid-template-columns: 22px minmax(0, 1fr);
      align-items: start;
      gap: 9px;
      min-height: 44px;
      color: var(--ink);
      font-weight: 800;
    }
    .switchline input { width: 18px; height: 18px; margin-top: 2px; accent-color: var(--blueprint); }
    .switch-copy { display: grid; gap: 2px; min-width: 0; }
    .switch-copy span { font-size: 12px; }
    .switch-copy small {
      color: var(--muted);
      font-size: 11px;
      line-height: 1.35;
      font-weight: 700;
    }
    .actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .script-recovery {
      display: grid;
      gap: 8px;
      border: 1px dashed #9fb0c0;
      border-radius: 6px;
      padding: 10px;
      background: #f8fbfd;
    }
    body[data-theme="dark"] .script-recovery,
    body[data-theme="dark"] .argument-config {
      background: #101a24;
      border-color: #425368;
    }
    .argument-config {
      display: grid;
      gap: 8px;
      border: 1px solid #9fb0c0;
      border-radius: 6px;
      padding: 10px;
      background: #f8fbfd;
    }
    .argument-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }
    .argument-title {
      display: grid;
      gap: 2px;
      color: var(--ink);
      font-size: 12px;
      font-weight: 900;
    }
    .argument-title small {
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      line-height: 1.35;
    }
    .argument-fields {
      display: grid;
      gap: 8px;
    }
    .argument-field {
      display: grid;
      grid-template-columns: minmax(130px, .75fr) minmax(160px, 1fr);
      gap: 10px;
      align-items: center;
      border-top: 1px solid var(--line);
      padding-top: 8px;
    }
    .argument-label {
      display: grid;
      gap: 2px;
      min-width: 0;
    }
    .argument-label strong {
      color: var(--ink);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .argument-label small {
      color: var(--muted);
      font-size: 11px;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }
    .argument-empty {
      min-height: 34px;
      display: flex;
      align-items: center;
      color: var(--muted);
      font-size: 12px;
      font-weight: 800;
    }
    .script-recovery-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }
    .script-recovery-title {
      display: grid;
      gap: 2px;
      color: var(--ink);
      font-size: 12px;
      font-weight: 900;
    }
    .script-recovery-title small {
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      line-height: 1.35;
    }
    .script-overrides { display: grid; gap: 8px; }
    .script-row {
      display: grid;
      gap: 7px;
      border-top: 1px solid var(--line);
      padding-top: 8px;
    }
    .script-row textarea {
      min-height: 110px;
      max-height: 240px;
    }
    .btn {
      min-height: 38px;
      border: 1px solid var(--ink);
      border-radius: 6px;
      padding: 0 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      background: var(--paper);
      color: var(--ink);
      font-weight: 900;
      cursor: pointer;
    }
    .btn.theme-toggle {
      width: 38px;
      height: 38px;
      min-width: 38px;
      min-height: 38px;
      padding: 0;
      border-radius: 999px;
      flex: 0 0 38px;
    }
    .btn svg { width: 16px; height: 16px; flex: 0 0 auto; }
    .btn.theme-toggle svg { width: 18px; height: 18px; }
    .btn.primary { background: var(--blueprint); color: white; border-color: var(--blueprint); }
    .btn:disabled { opacity: .58; cursor: wait; }
    .result-strip {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }
    .metric {
      min-height: 66px;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 9px;
      background: var(--panel);
      display: grid;
      align-content: space-between;
      gap: 4px;
    }
    .metric strong { font-size: 22px; line-height: 1; }
    .metric span { color: var(--muted); font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .07em; }
    .status {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      width: max-content;
      max-width: 100%;
      padding: 0 10px;
      border-radius: 999px;
      background: var(--line);
      color: var(--ink);
      font-size: 12px;
      font-weight: 900;
    }
    .status.stable { background: var(--teal); color: white; }
    .status.partial { background: var(--amber); color: white; }
    .status.sample-required { background: var(--violet); color: white; }
    .status.blocked { background: var(--red); color: white; }
    .chips, .files { display: flex; gap: 8px; flex-wrap: wrap; min-height: 30px; align-items: center; }
    .chip {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 5px 9px;
      background: var(--paper);
      color: var(--muted);
      font-size: 12px;
      font-weight: 800;
      max-width: 100%;
      overflow-wrap: anywhere;
    }
    .file-link {
      min-height: 34px;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 0 10px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--paper);
      font-size: 12px;
      font-weight: 900;
      text-decoration: none;
    }
    .explain {
      display: grid;
      gap: 8px;
    }
    .explain-card {
      display: grid;
      gap: 5px;
      border: 1px solid var(--line);
      border-left-width: 4px;
      border-radius: 6px;
      padding: 9px 10px;
      background: #f8fbfd;
    }
    .explain-card.native { border-left-color: var(--teal); }
    .explain-card.compat { border-left-color: var(--violet); }
    .explain-card.review { border-left-color: var(--amber); }
    .explain-card.blocked { border-left-color: var(--red); }
    .explain-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      color: var(--ink);
      font-size: 12px;
      font-weight: 900;
    }
    .explain-title span:last-child {
      color: var(--muted);
      font-size: 11px;
      font-weight: 800;
      white-space: nowrap;
    }
    .explain-card p {
      margin: 0;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.45;
    }
    .explain-source {
      margin-top: 2px;
      color: #3c4a57;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 11px;
      line-height: 1.4;
      overflow-wrap: anywhere;
    }
    .diagnostics {
      display: grid;
      gap: 8px;
    }
    .diagnostic-tabs {
      display: flex;
      gap: 7px;
      flex-wrap: wrap;
    }
    .diag-tab {
      min-height: 30px;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 0 9px;
      background: var(--paper);
      color: var(--muted);
      font-size: 12px;
      font-weight: 900;
      cursor: pointer;
    }
    .diag-tab.active {
      border-color: var(--ink);
      background: var(--ink);
      color: white;
    }
    .diagnostic-list {
      display: grid;
      gap: 7px;
    }
    .diagnostic-row {
      display: grid;
      gap: 4px;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 8px 9px;
      background: #fbfdff;
    }
    .diagnostic-row.error { border-left: 4px solid var(--red); color: inherit; }
    .diagnostic-row.warning { border-left: 4px solid var(--amber); color: inherit; }
    .diagnostic-row.info { border-left: 4px solid var(--teal); color: inherit; }
    .diag-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      color: var(--ink);
      font-size: 12px;
      font-weight: 900;
    }
    .diag-head span:last-child {
      color: var(--muted);
      font-size: 11px;
      font-weight: 800;
      white-space: nowrap;
    }
    .diag-message {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.4;
    }
    .diag-source {
      color: #3c4a57;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 11px;
      line-height: 1.4;
      overflow-wrap: anywhere;
    }
    .preview {
      min-height: 360px;
      max-height: 58vh;
      overflow: auto;
      margin: 0;
      border: 1px solid #1b2732;
      border-radius: 6px;
      padding: 12px;
      background: var(--code);
      color: #d8f3e8;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 12px;
      line-height: 1.5;
    }
    .placeholder {
      color: #9fb4c3;
    }
    .error { color: var(--red); font-weight: 800; }
    @media (max-width: 980px) {
      .workspace, header { grid-template-columns: 1fr; }
      .header-actions { justify-content: flex-start; }
      .result-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      textarea, .preview { min-height: 330px; max-height: none; }
    }
    @media (max-width: 560px) {
      .shell { width: min(100vw - 18px, 1440px); padding-top: 10px; }
      .grid-2, .result-strip { grid-template-columns: 1fr; }
      .argument-field { grid-template-columns: 1fr; }
      .script-recovery-head { align-items: stretch; }
      .panel-body { padding: 10px; }
      h1 { font-size: 31px; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header>
      <div>
        <h1>Anywhere-converter</h1>
        <p class="subtitle">把 Loon / Surge 插件、模块、脚本和规则集转换为 Anywhere 可导入的 .amrs / .arrs。</p>
      </div>
      <div class="header-actions">
        <a class="top-link health" id="health" href="https://anywhere-hub.chikacya.indevs.in/" target="_blank" rel="noopener">Anywhere Hub</a>
        <a class="top-link github-link" href="https://github.com/chikacya/anywhere-converter" target="_blank" rel="noopener" title="访问 GitHub 源工程">${icon("github")}GitHub</a>
        <button class="btn theme-toggle" id="theme-toggle" type="button" title="切换深色模式" aria-label="切换深色模式">
          <span class="moon">${icon("moon")}</span>
          <span class="sun">${icon("sun")}</span>
        </button>
      </div>
    </header>

    <main class="workspace">
      <section class="panel" aria-labelledby="input-title">
        <div class="panel-head">
          <h2 class="panel-title" id="input-title">Input</h2>
          <div class="actions">
            <button class="btn" id="sample" type="button" title="填入一个最小示例模块">${icon("file-plus")}示例</button>
            <button class="btn" id="clear" type="button" title="清空输入">${icon("trash")}清空</button>
          </div>
        </div>
        <div class="panel-body">
          <form id="form">
            <label>名称
              <input name="name" placeholder="留空则读取 #!name">
            </label>
            <label>输入类型
              <select name="sourceKind">
                <option value="auto">自动识别</option>
                <option value="module">插件/模块</option>
                <option value="ruleset">规则集</option>
              </select>
            </label>
            <label>规则集路由
              <select name="ruleSetRouting">
                <option value="default">默认规则</option>
                <option value="direct">Direct</option>
                <option value="reject">Reject</option>
              </select>
            </label>
            <label>模块/规则集 URL
              <input name="url" placeholder="https://example.com/module.plugin 或 ruleset.list">
            </label>
            <div class="argument-config">
              <div class="argument-head">
                <div class="argument-title">
                  <span>参数配置</span>
                  <small>读取模块里的 [Argument]，用表单配置后再转换。</small>
                </div>
                <button class="btn" id="inspect" type="button" title="读取模块参数">${icon("sliders")}读取配置</button>
              </div>
              <div class="argument-fields" id="argument-fields">
                <div class="argument-empty">未读取到可配置参数。</div>
              </div>
            </div>
            <label class="switchline">
              <input type="checkbox" name="fetchScripts" value="true" checked>
              <span class="switch-copy">
                <span>下载并保留远程脚本</span>
                <small>下载 script-path 指向的 JS；能识别的会转成原生规则，其余用兼容层保留。</small>
              </span>
            </label>
            <label class="switchline">
              <input type="checkbox" name="aggressive" value="true">
              <span class="switch-copy">
                <span>增强 JS 原生化</span>
                <small>尝试提升更多静态 JSON 清理脚本；二进制、动态逻辑仍会保留或标记需验证。</small>
              </span>
            </label>
            <div class="script-recovery">
              <div class="script-recovery-head">
                <div class="script-recovery-title">
                  <span>脚本补全</span>
                  <small>远程脚本 403/404 或超预算时，把对应 URL 和可信脚本文本粘贴到这里。</small>
                </div>
                <button class="btn" id="add-script" type="button" title="添加脚本源码">${icon("file-plus")}添加脚本</button>
              </div>
              <div class="script-overrides" id="script-overrides"></div>
            </div>
            <label>模块/规则集内容
              <textarea name="source" spellcheck="false" placeholder="粘贴 Loon / Surge 模块或规则集内容，或只填写 URL"></textarea>
            </label>
            <div class="actions">
              <button class="btn primary" id="submit" type="submit">${icon("wand")}转换</button>
              <a class="btn" id="import" hidden>${icon("phone")}导入 Anywhere</a>
              <button class="btn" id="refresh-cache" type="button" disabled title="重新生成动态订阅链接，绕过 Worker 缓存">${icon("refresh")}刷新缓存</button>
              <button class="btn" id="download-file" type="button" disabled title="从当前转换响应直接下载预览文件">${icon("download")}下载文件</button>
              <button class="btn" id="download-all" type="button" disabled title="从当前转换响应直接打包下载全部文件">${icon("download")}下载全部</button>
              <button class="btn" id="copy-file" type="button" disabled>${icon("copy")}复制文件</button>
              <button class="btn" id="copy-json" type="button" disabled>${icon("copy")}复制 JSON</button>
            </div>
          </form>
        </div>
      </section>

      <section class="panel" aria-labelledby="output-title">
        <div class="panel-head">
          <h2 class="panel-title" id="output-title">Output</h2>
          <span id="status" class="status">waiting</span>
        </div>
        <div class="panel-body">
          <div class="result-strip" aria-label="转换摘要">
            <div class="metric"><strong id="converted">0</strong><span>converted</span></div>
            <div class="metric"><strong id="skipped">0</strong><span>skipped</span></div>
            <div class="metric"><strong id="files-count">0</strong><span>files</span></div>
            <div class="metric"><strong id="rules-count">0</strong><span>rules</span></div>
          </div>
          <div class="chips" id="signals"></div>
          <div class="files" id="files"></div>
          <div class="explain" id="explain"></div>
          <div class="diagnostics" id="diagnostics"></div>
          <pre class="preview placeholder" id="preview">转换结果会显示在这里。点击“示例”可以快速填充一个模块。</pre>
        </div>
      </section>
    </main>
  </div>

  <script>
    const icons = {};
    const form = document.querySelector("#form");
    const submit = document.querySelector("#submit");
    const preview = document.querySelector("#preview");
    const sourceInput = document.querySelector('textarea[name="source"]');
    const urlInput = document.querySelector('input[name="url"]');
    const argumentFieldsEl = document.querySelector("#argument-fields");
    const inspectButton = document.querySelector("#inspect");
    const scriptOverridesEl = document.querySelector("#script-overrides");
    const addScriptButton = document.querySelector("#add-script");
    const statusEl = document.querySelector("#status");
    const importLink = document.querySelector("#import");
    const refreshCache = document.querySelector("#refresh-cache");
    const downloadFile = document.querySelector("#download-file");
    const downloadAll = document.querySelector("#download-all");
    const copyFile = document.querySelector("#copy-file");
    const copyJson = document.querySelector("#copy-json");
    const signalsEl = document.querySelector("#signals");
    const filesEl = document.querySelector("#files");
    const explainEl = document.querySelector("#explain");
    const diagnosticsEl = document.querySelector("#diagnostics");
    const healthEl = document.querySelector("#health");
    const themeToggle = document.querySelector("#theme-toggle");
    const metrics = {
      converted: document.querySelector("#converted"),
      skipped: document.querySelector("#skipped"),
      files: document.querySelector("#files-count"),
      rules: document.querySelector("#rules-count"),
    };
    let lastJson = null;
    let currentFile = null;
    let activeDiagnosticFilter = "action";
    let inspectTimer = 0;
    let cacheBustValue = "";

    const savedTheme = localStorage.getItem("anywhere-converter-theme");
    const initialTheme = savedTheme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initialTheme);

    themeToggle.addEventListener("click", () => {
      const next = document.body.dataset.theme === "dark" ? "light" : "dark";
      localStorage.setItem("anywhere-converter-theme", next);
      setTheme(next);
    });

    const sampleSource = String.raw\`#!name=Demo Ad Cleanup
#!desc=最小转换示例

[Argument]
cleanup_enable = switch,true,false,tag=启用广告清理,desc=关闭后会跳过带 enable 参数的规则
payload_mode = select,"compact","verbose",tag=响应模式

[Rule]
DOMAIN-SUFFIX, ads.example.com, REJECT

[Rewrite]
^https?:\\/\\/api\\.example\\.com\\/v1\\/ad reject-dict enable={cleanup_enable}
^https?:\\/\\/api\\.example\\.com\\/v1\\/banner response-body-json-jq 'del(.data.banner)'

[Header Rewrite]
http-request ^https?:\\/\\/api\\.example\\.com\\/v1\\/config header-del if-none-match

[Script]
http-response ^https?:\\/\\/api\\.example\\.com\\/v1\\/profile script-path=https://example.com/demo-lift.js, requires-body=true

[MITM]
hostname = %APPEND% *.example.com, *api.example.com
\`;

    const sampleLiftScript = String.raw\`const obj = JSON.parse($response.body);
delete obj.data.ad;
obj.data.vip = true;
$done({ body: JSON.stringify(obj) });\`;

    document.querySelector("#sample").addEventListener("click", () => {
      form.elements.name.value = "";
      form.elements.sourceKind.value = "auto";
      form.elements.ruleSetRouting.value = "default";
      form.elements.url.value = "";
      form.elements.source.value = sampleSource;
      scriptOverridesEl.replaceChildren();
      addScriptOverride("https://example.com/demo-lift.js", sampleLiftScript);
      renderArgumentDefinitions({}, {});
      preview.classList.add("placeholder");
      preview.textContent = "示例已填入。点击转换查看 .amrs / .arrs 输出。";
      inspectModule({ quiet: true });
    });

    inspectButton.addEventListener("click", () => {
      inspectModule({ quiet: false });
    });

    sourceInput.addEventListener("input", () => {
      clearTimeout(inspectTimer);
      inspectTimer = setTimeout(() => {
        if (/^\\s*\\[Arguments?\\]/im.test(sourceInput.value)) inspectModule({ quiet: true, sourceOnly: true });
        else renderArgumentDefinitions({}, {});
      }, 450);
    });

    addScriptButton.addEventListener("click", () => {
      addScriptOverride();
    });

    document.querySelector("#clear").addEventListener("click", () => {
      form.reset();
      lastJson = null;
      currentFile = null;
      importLink.hidden = true;
      refreshCache.disabled = true;
      downloadFile.disabled = true;
      downloadAll.disabled = true;
      cacheBustValue = "";
      copyFile.disabled = true;
      copyJson.disabled = true;
      scriptOverridesEl.replaceChildren();
      renderArgumentDefinitions({}, {});
      setStatus("waiting");
      setMetrics();
      signalsEl.replaceChildren();
      filesEl.replaceChildren();
      explainEl.replaceChildren();
      diagnosticsEl.replaceChildren();
      preview.classList.add("placeholder");
      preview.textContent = "转换结果会显示在这里。点击“示例”可以快速填充一个模块。";
    });

    copyJson.addEventListener("click", async () => {
      if (!lastJson) return;
      await navigator.clipboard.writeText(JSON.stringify(lastJson, null, 2));
      preview.classList.remove("placeholder");
      preview.textContent = "JSON 已复制到剪贴板。\\n\\n" + preview.textContent;
    });

    copyFile.addEventListener("click", async () => {
      if (!currentFile?.content) return;
      await navigator.clipboard.writeText(currentFile.content);
      preview.classList.remove("placeholder");
      preview.textContent = currentFile.name + " 已复制到剪贴板。\\n\\n" + currentFile.content;
    });

    downloadFile.addEventListener("click", () => {
      if (!currentFile?.content) return;
      downloadTextFile(currentFile.name, currentFile.content);
    });

    downloadAll.addEventListener("click", () => {
      const files = (lastJson?.files || []).filter((file) => typeof file.content === "string");
      if (!files.length) return;
      if (files.length === 1) {
        downloadTextFile(files[0].name, files[0].content);
        return;
      }
      downloadBlob(downloadBundleName(lastJson), makeZip(files), "application/zip");
    });

    refreshCache.addEventListener("click", () => {
      cacheBustValue = String(Date.now());
      form.requestSubmit();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      submit.disabled = true;
      copyFile.disabled = true;
      copyJson.disabled = true;
      downloadFile.disabled = true;
      downloadAll.disabled = true;
      importLink.hidden = true;
      refreshCache.disabled = true;
      currentFile = null;
      signalsEl.replaceChildren(chip("converting"));
      filesEl.replaceChildren();
      explainEl.replaceChildren();
      diagnosticsEl.replaceChildren();
      setStatus("working");
      preview.classList.remove("placeholder", "error");
      preview.textContent = "Converting...";

      const raw = Object.fromEntries(new FormData(form).entries());
      const argumentOverrides = collectArgumentOverrides();

      try {
        const response = await fetch("/api/convert", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: raw.name || "",
            url: raw.url || "",
            source: raw.source || "",
            sourceKind: raw.sourceKind || "auto",
            ruleSetRouting: raw.ruleSetRouting || "default",
            mode: raw.aggressive === "true" ? "aggressive" : "compat",
            arguments: argumentOverrides,
            scriptTextByURL: collectScriptTextByURL(),
            fetchScripts: raw.fetchScripts === "true",
            cacheBust: cacheBustValue,
            includeContent: true,
            includeSource: true,
          }),
        });
        const json = await response.json();
        if (!response.ok) throw new Error((json.detail || json.error || "convert failed"));
        lastJson = json;
        if (cacheBustValue) cacheBustValue = "";
        renderResult(json);
      } catch (error) {
        lastJson = null;
        currentFile = null;
        setStatus("blocked");
        setMetrics();
        signalsEl.replaceChildren(chip("request failed"));
        explainEl.replaceChildren();
        diagnosticsEl.replaceChildren();
        preview.classList.add("error");
        preview.textContent = error.message;
      } finally {
        submit.disabled = false;
        copyJson.disabled = !lastJson;
        copyFile.disabled = !currentFile?.content;
        downloadFile.disabled = !currentFile?.content;
        downloadAll.disabled = !(lastJson?.files || []).some((file) => typeof file.content === "string");
      }
    });

    fetch("/health").then((res) => res.json()).then((json) => {
      healthEl.title = json.ok ? "Worker ready · 打开 Anywhere Hub" : "打开 Anywhere Hub";
    }).catch(() => {
      healthEl.title = "Worker health unavailable · 打开 Anywhere Hub";
    });

    function setTheme(theme) {
      document.body.dataset.theme = theme === "dark" ? "dark" : "light";
      themeToggle.title = theme === "dark" ? "切换浅色模式" : "切换深色模式";
      themeToggle.setAttribute("aria-label", themeToggle.title);
    }

    function renderResult(json) {
      const summary = json.summary || {};
      setStatus(summary.status || "partial");
      setMetrics(summary);
      signalsEl.replaceChildren();
      const signalSet = new Set();
      const appendSignal = (text) => {
        if (!text || signalSet.has(text)) return;
        signalSet.add(text);
        signalsEl.append(chip(text));
      };
      appendSignal(json.dynamicImportUrl ? "动态订阅" : "快照链接");
      if ((json.dynamicFiles || []).some((file) => /[?&]cacheBust=/.test(file.url || ""))) appendSignal("已刷新缓存");
      if (json.sourceKind === "ruleset") appendSignal("规则集");
      if (summary.validationErrors) appendSignal("验证错误 " + summary.validationErrors);
      if (summary.nativeLiftCount) appendSignal("JS 原生化 " + summary.nativeLiftCount);
      if (summary.compatScriptCount) appendSignal("兼容层脚本 " + summary.compatScriptCount);
      for (const reason of summary.sampleReasons || []) appendSignal(signalLabel(reason));
      for (const warning of summary.warnings || []) {
        if (warning === "script-compat-layer" && summary.compatScriptCount) continue;
        appendSignal(signalLabel(warning));
      }
      for (const url of summary.scriptRecoveryUrls || []) {
        signalsEl.append(recoveryChip(url));
        if (!hasScriptOverride(url)) addScriptOverride(url);
      }
      if (!signalsEl.children.length) signalsEl.append(chip("无警告"));

      filesEl.replaceChildren();
      const dynamicByName = new Map((json.dynamicFiles || []).map((file) => [file.name, file]));
      for (const file of json.files || []) {
        const dynamicFile = dynamicByName.get(file.name);
        const link = document.createElement("a");
        link.className = "file-link";
        link.href = dynamicFile?.url || file.url;
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = file.name + " · " + file.ruleCount + " rules";
        if (file.content) {
          link.addEventListener("click", (event) => {
            event.preventDefault();
            showFile(file);
          });
        }
        filesEl.append(link);
      }
      renderConversionExplanation(json);
      renderDiagnostics(json);

      if (json.importUrl) {
        importLink.href = json.importUrl;
        importLink.hidden = false;
      }
      refreshCache.disabled = !json.dynamicImportUrl;

      renderArgumentDefinitions(json.argumentDefinitions || {}, json.arguments || {});
      const firstFile = (json.files || []).find((file) => file.content);
      if (json.source && sourceInput && !sourceInput.value.trim()) {
        sourceInput.value = json.source;
      }
      preview.classList.remove("placeholder", "error");
      if (firstFile) showFile(firstFile);
      else {
        currentFile = null;
        copyFile.disabled = true;
        downloadFile.disabled = true;
        preview.textContent = JSON.stringify({ summary: json.summary, files: json.files, diagnostics: json.diagnostics }, null, 2);
      }
      downloadAll.disabled = !(json.files || []).some((file) => typeof file.content === "string");
    }

    function showFile(file) {
      currentFile = file;
      copyFile.disabled = !file?.content;
      downloadFile.disabled = !file?.content;
      preview.classList.remove("placeholder", "error");
      preview.textContent = file?.content || "";
    }

    function downloadTextFile(name, content) {
      downloadBlob(name, new Blob([content], { type: "text/plain;charset=utf-8" }));
    }

    function downloadBlob(name, blob, type) {
      const fileBlob = blob instanceof Blob ? blob : new Blob([blob], { type: type || "application/octet-stream" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(fileBlob);
      link.download = safeFileName(name || "anywhere-rules.txt");
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1200);
    }

    function downloadBundleName(json) {
      const rawName = json?.metadata?.name || json?.report?.name || "anywhere-converter";
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      return safeFileName(rawName + "-" + stamp + ".zip");
    }

    function safeFileName(name) {
      return String(name || "download").replace(/[\\\\/:*?"<>|\\u0000-\\u001f]/g, "_").slice(0, 160) || "download";
    }

    function makeZip(files) {
      const encoder = new TextEncoder();
      const locals = [];
      const centrals = [];
      let offset = 0;
      const stamp = zipDateTime(new Date());
      for (const file of files) {
        const nameBytes = encoder.encode(safeFileName(file.name));
        const data = encoder.encode(file.content || "");
        const crc = crc32(data);
        const local = new Uint8Array(30 + nameBytes.length);
        write32(local, 0, 0x04034b50);
        write16(local, 4, 20);
        write16(local, 6, 0x0800);
        write16(local, 8, 0);
        write16(local, 10, stamp.time);
        write16(local, 12, stamp.date);
        write32(local, 14, crc);
        write32(local, 18, data.length);
        write32(local, 22, data.length);
        write16(local, 26, nameBytes.length);
        local.set(nameBytes, 30);
        locals.push(local, data);

        const central = new Uint8Array(46 + nameBytes.length);
        write32(central, 0, 0x02014b50);
        write16(central, 4, 20);
        write16(central, 6, 20);
        write16(central, 8, 0x0800);
        write16(central, 10, 0);
        write16(central, 12, stamp.time);
        write16(central, 14, stamp.date);
        write32(central, 16, crc);
        write32(central, 20, data.length);
        write32(central, 24, data.length);
        write16(central, 28, nameBytes.length);
        write32(central, 42, offset);
        central.set(nameBytes, 46);
        centrals.push(central);
        offset += local.length + data.length;
      }
      const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
      const end = new Uint8Array(22);
      write32(end, 0, 0x06054b50);
      write16(end, 8, files.length);
      write16(end, 10, files.length);
      write32(end, 12, centralSize);
      write32(end, 16, offset);
      return new Blob([...locals, ...centrals, end], { type: "application/zip" });
    }

    function zipDateTime(date) {
      const year = Math.max(1980, date.getFullYear());
      return {
        time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
        date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
      };
    }

    function write16(buffer, offset, value) {
      buffer[offset] = value & 255;
      buffer[offset + 1] = (value >>> 8) & 255;
    }

    function write32(buffer, offset, value) {
      buffer[offset] = value & 255;
      buffer[offset + 1] = (value >>> 8) & 255;
      buffer[offset + 2] = (value >>> 16) & 255;
      buffer[offset + 3] = (value >>> 24) & 255;
    }

    function crc32(bytes) {
      let crc = -1;
      for (let i = 0; i < bytes.length; i++) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 255];
      }
      return (crc ^ -1) >>> 0;
    }

    const crcTable = (() => {
      const table = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let value = i;
        for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
        table[i] = value >>> 0;
      }
      return table;
    })();

    function setStatus(status) {
      statusEl.textContent = status;
      statusEl.className = "status " + status;
    }

    function setMetrics(summary = {}) {
      metrics.converted.textContent = summary.converted ?? 0;
      metrics.skipped.textContent = summary.skipped ?? 0;
      metrics.files.textContent = summary.fileCount ?? 0;
      metrics.rules.textContent = summary.ruleCount ?? 0;
    }

    function renderConversionExplanation(json) {
      explainEl.replaceChildren();
      const diagnostics = Array.isArray(json.diagnostics) ? json.diagnostics : [];
      const stats = scriptStats(diagnostics);
      if (!stats.total) return;

      explainEl.append(explainCard({
        kind: stats.native ? "native" : stats.compat ? "compat" : stats.review ? "review" : "blocked",
        title: "JS 转换概览",
        badge: [
          stats.native && stats.native + " 个已原生化",
          stats.compat && stats.compat + " 个兼容层",
          stats.review && stats.review + " 个需验证",
          stats.blocked && stats.blocked + " 个未完整转换",
        ].filter(Boolean).join(" · "),
        message: jsSummaryMessage(stats),
      }));
    }

    function scriptStats(diagnostics) {
      const stats = { native: 0, compat: 0, review: 0, blocked: 0, total: 0 };
      for (const diagnostic of diagnostics) {
        const code = diagnostic?.code || "";
        if (code === "script-native-lift" || code === "script-aggressive-native-lift" || code === "script-request-lift" || code === "script-respond-lift" || code === "script-query-redirect-lift" || code === "script-url-proxy-lift") {
          stats.native += 1;
        } else if (code === "script-compat-layer") {
          stats.compat += 1;
        } else if (/sample-required/.test(code) || code === "sample-required-pattern" || code === "script-node-require-branch" || code === "script-http-client" || code === "script-large") {
          stats.review += 1;
        } else if (code === "script-fetch-failed" || code === "script-source-missing" || code === "script-fetch-file-too-large" || code === "script-fetch-budget-exceeded" || code === "script-import" || code === "request-mutation-script") {
          stats.blocked += 1;
        }
      }
      stats.total = stats.native + stats.compat + stats.review + stats.blocked;
      return stats;
    }

    function jsSummaryMessage(stats) {
      const parts = [];
      if (stats.native) parts.push("可静态识别的脚本已转换为 Anywhere 原生规则。");
      if (stats.compat) parts.push("未能安全提升的脚本会以 base64 兼容层保留，这是可导入格式。");
      if (stats.review) parts.push("部分脚本涉及二进制、动态逻辑或高风险路径，建议实机验证。");
      if (stats.blocked) parts.push("有脚本缺少源码或被能力边界阻断，需要补全或人工处理。");
      return parts.join("");
    }

    function renderDiagnostics(json) {
      const diagnostics = Array.isArray(json.diagnostics) ? json.diagnostics : [];
      const entries = diagnostics.map(normalizeDiagnostic).filter(Boolean);
      diagnosticsEl.replaceChildren();
      if (!entries.length) return;

      const filters = [
        ["action", "需处理"],
        ["review", "需验证"],
        ["script", "脚本诊断"],
        ["degraded", "语义放宽"],
        ["all", "全部"],
      ];
      const filterHints = {
        action: "需要补全源码或人工处理的诊断。",
        review: "建议实机验证的诊断。",
        script: "脚本相关诊断数量，不等于已下载脚本数。",
        degraded: "转换时发生语义放宽的说明。",
        all: "全部诊断。",
      };
      const counts = Object.fromEntries(filters.map(([key]) => [key, countDiagnostics(entries, key)]));
      if (!counts[activeDiagnosticFilter]) activeDiagnosticFilter = counts.action ? "action" : counts.review ? "review" : counts.script ? "script" : counts.degraded ? "degraded" : "all";

      const tabs = document.createElement("div");
      tabs.className = "diagnostic-tabs";
      for (const [key, label] of filters) {
        if (key !== "all" && !counts[key]) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "diag-tab" + (activeDiagnosticFilter === key ? " active" : "");
        button.textContent = label + " " + counts[key];
        button.title = filterHints[key] || "";
        button.addEventListener("click", () => {
          activeDiagnosticFilter = key;
          renderDiagnostics(json);
        });
        tabs.append(button);
      }
      diagnosticsEl.append(tabs);

      const list = document.createElement("div");
      list.className = "diagnostic-list";
      const visible = entries.filter((entry) => diagnosticMatches(entry, activeDiagnosticFilter)).slice(0, 12);
      for (const entry of visible) list.append(diagnosticRow(entry));
      if (!visible.length) {
        const empty = document.createElement("div");
        empty.className = "argument-empty";
        empty.textContent = "当前分类没有诊断。";
        list.append(empty);
      }
      const totalVisible = entries.filter((entry) => diagnosticMatches(entry, activeDiagnosticFilter)).length;
      if (totalVisible > visible.length) {
        const more = document.createElement("div");
        more.className = "argument-empty";
        more.textContent = "还有 " + (totalVisible - visible.length) + " 条，完整内容可复制 JSON 查看。";
        list.append(more);
      }
      diagnosticsEl.append(list);
    }

    function normalizeDiagnostic(diagnostic) {
      if (!diagnostic) return null;
      const code = diagnostic.code || diagnostic.level || "diagnostic";
      return {
        code,
        level: diagnostic.level || "info",
        line: Number(diagnostic.line || 0),
        message: diagnostic.message || signalLabel(code),
        source: diagnostic.source || "",
        group: diagnosticGroup(code, diagnostic.level),
      };
    }

    function diagnosticGroup(code, level) {
      if (code === "domain-exact-degraded" || code === "logical-and-degraded" || /degraded$/.test(code)) return "degraded";
      if (/sample-required/.test(code) || code === "sample-required-pattern") return "review";
      if (code.startsWith("script-")) {
        if (code === "script-fetch-failed" || code === "script-source-missing" || code === "script-fetch-file-too-large" || code === "script-fetch-budget-exceeded" || code === "script-import") return "action";
        return "script";
      }
      if (level === "error" || /^unsupported-|blocked|invalid|unknown-header|request-mutation-script/.test(code)) return "action";
      return "other";
    }

    function countDiagnostics(entries, filter) {
      return entries.filter((entry) => diagnosticMatches(entry, filter)).length;
    }

    function diagnosticMatches(entry, filter) {
      if (filter === "all") return true;
      if (filter === "action") return entry.group === "action";
      if (filter === "review") return entry.group === "review";
      if (filter === "script") return entry.group === "script" || entry.code.startsWith("script-");
      if (filter === "degraded") return entry.group === "degraded";
      return false;
    }

    function diagnosticRow(entry) {
      const row = document.createElement("div");
      row.className = "diagnostic-row " + (entry.level || "info");
      const head = document.createElement("div");
      head.className = "diag-head";
      const title = document.createElement("span");
      title.textContent = signalLabel(entry.code);
      const meta = document.createElement("span");
      meta.textContent = entry.line ? "line " + entry.line : entry.level;
      head.append(title, meta);
      const message = document.createElement("div");
      message.className = "diag-message";
      message.textContent = entry.message;
      row.append(head, message);
      const source = compactSource(entry.source);
      if (source) {
        const sourceEl = document.createElement("div");
        sourceEl.className = "diag-source";
        sourceEl.textContent = source;
        row.append(sourceEl);
      }
      return row;
    }

    function signalLabel(code) {
      const labels = {
        "script-binary-sample-required": "二进制脚本需验证",
        "script-dynamic-sample-required": "动态脚本需验证",
        "sample-required-pattern": "高风险路径需验证",
        "script-compat-layer": "兼容层脚本",
        "script-node-require-branch": "脚本含 require 分支",
        "script-http-client": "脚本含外部请求",
        "script-argument-unused": "脚本未使用参数",
        "script-large": "脚本体积较大",
        "script-fetch-failed": "脚本下载失败",
        "script-source-missing": "缺少脚本源码",
        "script-fetch-file-too-large": "脚本超过单文件限制",
        "script-fetch-budget-exceeded": "脚本超过总下载预算",
        "script-import": "脚本 import 阻断",
        "request-mutation-script": "请求脚本需人工处理",
        "script-source-merged": "相同脚本已合并",
        "script-dispatcher-merged": "脚本分发已合并",
        "script-native-lift": "JS 已原生化",
        "script-aggressive-native-lift": "增强原生化",
        "script-request-lift": "请求脚本已原生化",
        "script-respond-lift": "固定响应已轻量化",
        "script-query-redirect-lift": "跳转脚本已轻量化",
        "script-url-proxy-lift": "URL 改写已轻量化",
        "aggressive-mode": "实验模式",
        "unsupported-rule": "不支持的规则",
        "unsupported-rewrite": "不支持的改写",
        "unsupported-map-local": "不支持的 Map Local",
        "unsupported-body-rewrite": "不支持的 Body Rewrite",
        "unsupported-header-rewrite": "不支持的 Header Rewrite",
        "unsupported-url-regex-action": "不支持的 URL-REGEX 动作",
        "argument-disabled": "参数已禁用",
        "unsupported-argument": "不支持的参数",
        "outside-section": "忽略非配置段内容",
        "domain-exact-degraded": "域名匹配已放宽",
        "logical-and-degraded": "组合条件已放宽",
        "cross-host-transparent-rewrite": "跨域透明改写",
        "complex-hostname-wildcard": "复杂 hostname 已跳过",
        "map-local-script-response": "Map Local 保留响应信息",
        "map-local-native-trivial-header": "Map Local 已原生化",
        "unknown-header": "未知规则头",
        "invalid-regex": "正则无效",
        "invalid-rewrite": "改写规则无效",
      };
      return labels[code] || code;
    }

    function explainCard({ kind = "review", title, badge = "", message = "", source = "" }) {
      const card = document.createElement("div");
      card.className = "explain-card " + kind;
      const head = document.createElement("div");
      head.className = "explain-title";
      const titleEl = document.createElement("span");
      titleEl.textContent = title || "转换说明";
      const badgeEl = document.createElement("span");
      badgeEl.textContent = badge || kind;
      head.append(titleEl, badgeEl);
      const body = document.createElement("p");
      body.textContent = message || "";
      card.append(head, body);
      const compactSourceText = compactSource(source);
      if (compactSourceText) {
        const sourceEl = document.createElement("div");
        sourceEl.className = "explain-source";
        sourceEl.textContent = compactSourceText;
        card.append(sourceEl);
      }
      return card;
    }

    function compactSource(source) {
      const text = String(source || "").replace(/\\s+/g, " ").trim();
      if (!text) return "";
      return text.length > 220 ? text.slice(0, 217) + "..." : text;
    }

    async function inspectModule(options = {}) {
      const quiet = options.quiet === true;
      const sourceOnly = options.sourceOnly === true;
      const source = sourceInput.value || "";
      const url = sourceOnly ? "" : (urlInput.value || "");
      if (!source.trim() && !url.trim()) {
        renderArgumentDefinitions({}, {});
        return;
      }
      inspectButton.disabled = true;
      if (!quiet) {
        signalsEl.replaceChildren(chip("reading config"));
      }
      try {
        const response = await fetch("/api/inspect", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            url,
            source,
            sourceKind: form.elements.sourceKind.value || "auto",
            ruleSetRouting: form.elements.ruleSetRouting.value || "default",
            arguments: collectArgumentOverrides(),
            includeSource: true,
          }),
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.detail || json.error || "inspect failed");
        if (json.source && sourceInput && !sourceInput.value.trim()) sourceInput.value = json.source;
        if (json.metadata?.name && !form.elements.name.value.trim()) form.elements.name.value = json.metadata.name;
        if (json.sourceKind && form.elements.sourceKind.value === "auto") {
          signalsEl.append(chip(json.sourceKind === "ruleset" ? "规则集" : "模块"));
        }
        renderArgumentDefinitions(json.argumentDefinitions || {}, json.arguments || {});
        if (!quiet) {
          const count = Object.keys(json.argumentDefinitions || {}).length;
          signalsEl.replaceChildren(chip(count ? "config " + count : "no config"));
        }
      } catch (error) {
        if (!quiet) {
          signalsEl.replaceChildren(chip("config failed"));
          preview.classList.add("error");
          preview.textContent = error.message;
        }
      } finally {
        inspectButton.disabled = false;
      }
    }

    function renderArgumentDefinitions(definitions = {}, values = {}) {
      const previous = collectArgumentOverrides();
      const entries = Object.values(definitions || {}).sort((a, b) => (a.line || 0) - (b.line || 0));
      argumentFieldsEl.replaceChildren();
      if (!entries.length) {
        const empty = document.createElement("div");
        empty.className = "argument-empty";
        empty.textContent = "未读取到可配置参数。";
        argumentFieldsEl.append(empty);
        return;
      }
      for (const definition of entries) {
        argumentFieldsEl.append(argumentField(definition, values[definition.name] ?? previous[definition.name] ?? definition.defaultValue));
      }
    }

    function argumentField(definition, value) {
      const row = document.createElement("div");
      row.className = "argument-field";

      const text = document.createElement("div");
      text.className = "argument-label";
      const title = document.createElement("strong");
      title.textContent = definition.tag || definition.name;
      const detail = document.createElement("small");
      detail.textContent = definition.desc ? definition.name + " · " + definition.desc : definition.name;
      text.append(title, detail);

      row.append(text, argumentControl(definition, value));
      return row;
    }

    function argumentControl(definition, value) {
      const type = String(definition.type || "string").toLowerCase();
      if (type === "switch" || type === "checkbox") {
        const label = document.createElement("label");
        label.className = "switchline";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.dataset.argumentName = definition.name;
        input.dataset.argumentType = "boolean";
        input.checked = toBoolean(value);
        label.append(input, document.createTextNode("启用"));
        return label;
      }

      const options = uniqueValues(definition.options || []);
      if (type === "select" && options.length) {
        const select = document.createElement("select");
        select.dataset.argumentName = definition.name;
        select.dataset.argumentType = "string";
        for (const optionValue of options) {
          const option = document.createElement("option");
          option.value = String(optionValue);
          option.textContent = String(optionValue);
          if (String(optionValue) === String(value)) option.selected = true;
          select.append(option);
        }
        return select;
      }

      const input = document.createElement("input");
      input.dataset.argumentName = definition.name;
      input.dataset.argumentType = type === "number" ? "number" : "string";
      input.type = type === "number" ? "number" : "text";
      input.value = value ?? "";
      return input;
    }

    function collectArgumentOverrides() {
      const out = {};
      for (const input of argumentFieldsEl.querySelectorAll("[data-argument-name]")) {
        const name = input.dataset.argumentName;
        if (!name) continue;
        if (input.dataset.argumentType === "boolean") {
          out[name] = input.checked;
        } else if (input.dataset.argumentType === "number") {
          const text = input.value.trim();
          out[name] = text === "" ? "" : Number.isFinite(Number(text)) ? Number(text) : text;
        } else {
          out[name] = input.value;
        }
      }
      return out;
    }

    function uniqueValues(values) {
      const seen = new Set();
      const out = [];
      for (const value of values) {
        const key = String(value);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(value);
      }
      return out;
    }

    function toBoolean(value) {
      if (typeof value === "boolean") return value;
      return /^(?:1|true|yes|on)$/i.test(String(value || ""));
    }

    function chip(text) {
      const span = document.createElement("span");
      span.className = "chip";
      span.textContent = text;
      return span;
    }

    function recoveryChip(url) {
      const button = document.createElement("button");
      button.className = "chip";
      button.type = "button";
      button.textContent = "补脚本 " + compactUrl(url);
      button.addEventListener("click", () => {
        if (!hasScriptOverride(url)) addScriptOverride(url);
        findScriptOverrideInput(url)?.focus();
      });
      return button;
    }

    function collectScriptTextByURL() {
      const out = {};
      for (const row of scriptOverridesEl.querySelectorAll(".script-row")) {
        const url = row.querySelector("input")?.value.trim();
        const text = row.querySelector("textarea")?.value;
        if (!url || !text?.trim()) continue;
        out[url] = text;
      }
      return out;
    }

    function addScriptOverride(url = "", text = "") {
      const row = document.createElement("div");
      row.className = "script-row";

      const urlLabel = document.createElement("label");
      urlLabel.textContent = "脚本 URL";
      const urlInput = document.createElement("input");
      urlInput.placeholder = "https://example.com/script.js";
      urlInput.value = url;
      if (url) urlInput.dataset.scriptUrl = url;
      urlInput.addEventListener("input", () => {
        urlInput.dataset.scriptUrl = urlInput.value.trim();
      });
      urlLabel.append(urlInput);

      const textLabel = document.createElement("label");
      textLabel.textContent = "脚本文本";
      const textArea = document.createElement("textarea");
      textArea.placeholder = "粘贴可信脚本源码";
      textArea.spellcheck = false;
      textArea.value = text;
      textLabel.append(textArea);

      const remove = document.createElement("button");
      remove.className = "btn";
      remove.type = "button";
      remove.textContent = "移除脚本";
      remove.addEventListener("click", () => row.remove());

      row.append(urlLabel, textLabel, remove);
      scriptOverridesEl.append(row);
      return row;
    }

    function hasScriptOverride(url) {
      return [...scriptOverridesEl.querySelectorAll(".script-row input")].some((input) => input.value.trim() === url);
    }

    function findScriptOverrideInput(url) {
      return [...scriptOverridesEl.querySelectorAll(".script-row input")].find((input) => input.value.trim() === url);
    }

    function compactUrl(url) {
      try {
        const parsed = new URL(url);
        const last = parsed.pathname.split("/").filter(Boolean).pop() || parsed.hostname;
        return last.length > 28 ? last.slice(0, 25) + "..." : last;
      } catch {
        return String(url).slice(0, 32);
      }
    }

  </script>
</body>
</html>`;
}

    function icon(name) {
  const icons = {
    "file-plus": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14 2v6h6M12 18v-6M9 15h6" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 16h10l1-16M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    wand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 4 5 5M4 20 20 4M12 5l1-3 1 3 3 1-3 1-1 3-1-3-3-1zM5 14l1-2 1 2 2 1-2 1-1 2-1-2-2-1z" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM10 18h4" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8h11v11H8zM5 16H4a1 1 0 0 1-1-1V4h11a1 1 0 0 1 1 1v1" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    sliders: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    github: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.5-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 0 1.6 1.1 1.6 1.1.9 1.5 2.4 1.1 2.9.8.1-.7.4-1.1.7-1.4-2.2-.3-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7c-.1-.3-.5-1.3.1-2.7 0 0 .9-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .6 1.4.2 2.4.1 2.7a3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.8V21c0 .3.2.6.7.5A10 10 0 0 0 12 2z" fill="currentColor"/></svg>',
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 7 7 0 1 0 20 15.5z" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  };
    return icons[name] || "";
  }
