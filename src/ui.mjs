export function renderHome() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#f3f5fa">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="Anywhere">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="icon" href="/icons/anywhere-converter-app-icon-192.png" type="image/png">
  <link rel="apple-touch-icon" href="/icons/anywhere-converter-app-icon-180.png">
  <title>Anywhere Converter</title>
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
    body[data-theme="dark"] .argument-config,
    body[data-theme="dark"] .icon-config {
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
    .icon-config {
      border: 1px solid #9fb0c0;
      border-radius: 6px;
      background: #f8fbfd;
      overflow: clip;
    }
    .icon-config summary {
      min-height: 52px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 9px 10px;
      color: var(--ink);
      cursor: pointer;
      list-style: none;
      user-select: none;
    }
    .icon-config summary::-webkit-details-marker { display: none; }
    .icon-config summary:focus-visible { outline: 3px solid color-mix(in srgb, var(--blueprint) 32%, transparent); outline-offset: -3px; }
    .icon-summary-copy { display: grid; gap: 2px; min-width: 0; }
    .icon-summary-copy strong { font-size: 12px; }
    .icon-summary-copy small { color: var(--muted); font-size: 11px; line-height: 1.35; font-weight: 700; }
    .icon-summary-state {
      flex: 0 0 auto;
      min-height: 28px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 9px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--paper);
      color: var(--muted);
      font-size: 11px;
      font-weight: 900;
    }
    .icon-summary-state::after { content: "+"; font-size: 16px; line-height: 1; }
    .icon-config[open] .icon-summary-state::after { content: "−"; }
    .icon-config.has-icon .icon-summary-state { color: var(--teal); border-color: color-mix(in srgb, var(--teal) 55%, var(--line)); }
    .icon-panel {
      display: grid;
      grid-template-columns: 92px minmax(0, 1fr);
      gap: 12px;
      padding: 12px 10px 10px;
      border-top: 1px solid var(--line);
    }
    .icon-preview {
      width: 88px;
      aspect-ratio: 1;
      display: grid;
      place-items: center;
      border: 1px solid var(--line);
      border-radius: 20px;
      background:
        linear-gradient(45deg, var(--panel) 25%, transparent 25%, transparent 75%, var(--panel) 75%),
        linear-gradient(45deg, var(--panel) 25%, var(--paper) 25%, var(--paper) 75%, var(--panel) 75%);
      background-position: 0 0, 8px 8px;
      background-size: 16px 16px;
      overflow: hidden;
    }
    .icon-preview img { width: 100%; height: 100%; object-fit: contain; display: block; }
    .icon-preview svg { width: 30px; height: 30px; color: var(--muted); }
    .icon-controls { display: grid; gap: 9px; min-width: 0; }
    .icon-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 3px; border-radius: 7px; background: var(--line); }
    .icon-tab {
      min-height: 34px;
      border: 0;
      border-radius: 5px;
      background: transparent;
      color: var(--muted);
      font-size: 12px;
      font-weight: 900;
      cursor: pointer;
    }
    .icon-tab.active { background: var(--paper); color: var(--ink); box-shadow: 0 1px 2px var(--shadow); }
    .icon-pane { display: grid; gap: 7px; }
    .icon-drop {
      min-height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px 10px;
      border: 1px dashed var(--blueprint);
      border-radius: 6px;
      background: color-mix(in srgb, var(--blueprint) 6%, var(--paper));
      color: var(--blueprint);
      text-align: center;
      cursor: pointer;
    }
    .icon-drop input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
    .icon-url-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 7px; }
    .icon-help, .icon-message { margin: 0; font-size: 11px; line-height: 1.4; font-weight: 700; }
    .icon-help { color: var(--muted); }
    .icon-message { min-height: 16px; color: var(--muted); }
    .icon-message.error { color: var(--red); }
    .icon-message.success { color: var(--teal); }
    .icon-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
    .icon-remove { min-height: 32px; padding: 0 9px; }
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
      .icon-panel { grid-template-columns: 72px minmax(0, 1fr); }
      .icon-preview { width: 68px; border-radius: 16px; }
      .icon-url-row { grid-template-columns: 1fr; }
      .script-recovery-head { align-items: stretch; }
      .panel-body { padding: 10px; }
      h1 { font-size: 31px; }
    }
    /* iOS-inspired application layer. Existing converter controls retain their IDs and behaviour. */
    :root {
      --ios-blue: #007aff;
      --ios-indigo: #5856d6;
      --ios-fill: color-mix(in srgb, #8e8e93 12%, transparent);
      --ios-material: rgba(255, 255, 255, .78);
      --ios-material-strong: rgba(255, 255, 255, .92);
      --ios-shadow: 0 1px 2px rgba(0, 0, 0, .03), 0 8px 24px rgba(0, 0, 0, .05);
      --paper: #fff;
      --panel: #fbfbfd;
      --line: rgba(60, 60, 67, .16);
      --ink: #1d1d1f;
      --muted: #6e6e73;
      --radius: 22px;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", Arial, sans-serif;
      font-synthesis: none;
    }
    body {
      background: #f5f5f7;
      letter-spacing: 0;
      font-size: 16px;
      line-height: 1.5;
    }
    body[data-theme="dark"] { --ios-material: rgba(28, 28, 30, .84); --ios-material-strong: rgba(28, 28, 30, .94); --ios-shadow: 0 1px 1px rgba(0,0,0,.2), 0 12px 24px rgba(0,0,0,.22); --paper: #1c1c1e; --panel: #2c2c2e; --line: rgba(235,235,245,.16); --ink: #f5f5f7; --muted: #aeaeb2; background: #000; }
    .shell { width: min(1368px, calc(100vw - 48px)); padding: 12px 0 calc(72px + env(safe-area-inset-bottom)); }
    header { position: sticky; z-index: 10; top: max(12px, env(safe-area-inset-top)); grid-template-columns: minmax(0, 1fr) auto; border: 1px solid color-mix(in srgb, var(--line) 88%, transparent); border-radius: 25px; padding: 10px 16px; background: var(--ios-material); box-shadow: 0 10px 28px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.28); -webkit-backdrop-filter: blur(26px) saturate(175%); backdrop-filter: blur(26px) saturate(175%); }
    .brand { display: flex; align-items: center; gap: 13px; min-width: 0; }
    .brand-mark { width: 44px; height: 44px; flex: 0 0 44px; display: block; border-radius: 13px; object-fit: cover; box-shadow: 0 1px 3px rgba(0,0,0,.16); }
    .brand-mark svg { width: 28px; height: 28px; }
    h1 { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif; font-size: clamp(23px, 3vw, 34px); line-height: 1.04; letter-spacing: -.045em; }
    .subtitle { margin-top: 5px; font-size: 13px; max-width: 690px; }
    .header-actions { display: inline-flex; align-items: center; gap: 2px; }
    .top-link, .btn { border: 1px solid color-mix(in srgb, var(--line) 78%, transparent); border-radius: 14px; box-shadow: none; font-weight: 720; transition: transform .22s ease, background .22s ease, box-shadow .22s ease; }
    .top-link { min-height: 36px; background: color-mix(in srgb, var(--paper) 84%, transparent); }
    .btn { min-height: 40px; padding: 0 13px; background: color-mix(in srgb, var(--paper) 82%, transparent); }
    .btn.primary { border-color: transparent; background: linear-gradient(135deg, var(--ios-blue), #5e5ce6); box-shadow: 0 8px 18px rgba(0, 122, 255, .20); }
    .top-link:hover, .btn:hover:not(:disabled), .file-link:hover { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(23, 32, 42, .10); }
    .header-actions .top-link { min-height: 40px; border: 0; background: transparent; box-shadow: none; }
    .header-actions .top-link:hover, .header-actions .top-link:focus-visible, .theme-toggle:hover, .theme-toggle:focus-visible { background: var(--ios-fill); box-shadow: none; transform: none; }
    .hub-link { gap: 7px; border-radius: 13px; color: var(--ios-blue); font-size: 13px; font-weight: 680; padding: 0 10px; }
    .health::before { display: none; }
    .hub-orb { display: grid; width: 15px; height: 15px; place-items: center; border: 1.5px solid currentColor; border-radius: 50%; }
    .hub-orb::before { width: 5px; height: 5px; border-radius: 50%; background: currentColor; content: ""; }
    .hub-arrow { margin-left: -2px; font-size: 15px; font-weight: 500; line-height: 1; }
    .github-link { display: grid; width: 40px; min-width: 40px; place-items: center; border-radius: 50%; color: var(--ink); font-size: 0; padding: 0; }
    .github-link svg { width: 19px; height: 19px; }
    .theme-toggle { position: relative; display: grid; width: 40px; height: 40px; min-width: 40px; min-height: 40px; place-items: center; overflow: hidden; border: 0; border-radius: 50%; background: transparent; color: var(--ink); cursor: pointer; padding: 0; -webkit-tap-highlight-color: transparent; transition: background 160ms ease-out, transform 100ms ease-out; }
    .theme-toggle:active { transform: scale(.94); }
    .theme-toggle .moon, .theme-toggle .sun { position: absolute; inset: 0; display: grid; place-items: center; }
    .theme-toggle .moon::before { width: 17px; height: 17px; border-radius: 50%; background: currentColor; content: ""; }
    .theme-toggle .moon::after { position: absolute; width: 15px; height: 15px; border-radius: 50%; background: var(--ios-material); content: ""; transform: translate(5px, -4px); }
    .theme-toggle .sun { display: none; }
    .theme-toggle .sun svg { width: 19px; height: 19px; }
    body[data-theme="dark"] .theme-toggle .moon { display: none; }
    body[data-theme="dark"] .theme-toggle .sun { display: grid; }
    .app-tabs { display: none !important; }
    .app-tab { border: 0; background: transparent; cursor: pointer; }
    .workspace { gap: 14px; margin-top: 52px; }
    .workspace[hidden], .studio-view[hidden] { display: none !important; }
    .panel { border: 1px solid var(--line); border-radius: 24px; background: var(--paper); box-shadow: var(--ios-shadow); overflow: clip; }
    .panel-head { border-color: color-mix(in srgb, var(--line) 62%, transparent); padding: 15px 17px; }
    .panel-body { padding: 17px; }
    .panel-title { letter-spacing: -.025em; }
    .converter-panel-title { display: grid; gap: 1px; }
    .converter-panel-title small { color: var(--muted); font-size: 11px; font-weight: 560; }
    .converter-panel form { display: grid; gap: 14px; }
    .converter-source-step { display: grid; gap: 11px; border: 1px solid color-mix(in srgb, var(--ios-blue) 17%, var(--line)); border-radius: 19px; background: color-mix(in srgb, var(--ios-blue) 3%, var(--panel)); padding: 14px; }
    .converter-step-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
    .converter-step-head > div { display: grid; gap: 2px; }
    .converter-step-head span { color: var(--ios-blue); font-size: 11px; font-weight: 720; letter-spacing: .04em; }
    .converter-step-head h3 { margin: 0; font-size: 16px; letter-spacing: -.02em; }
    .converter-step-head small { color: var(--muted); font-size: 11px; line-height: 1.4; text-align: right; }
    .converter-source-step > label { gap: 5px; font-size: 12px; font-weight: 650; }
    .converter-source-step textarea { min-height: 280px; max-height: min(52dvh, 480px); resize: vertical; }
    .converter-options { overflow: clip; border: 1px solid var(--line); border-radius: 18px; background: var(--panel); }
    .converter-options > summary { display: flex; min-height: 58px; align-items: center; justify-content: space-between; gap: 12px; cursor: pointer; list-style: none; padding: 10px 14px; }
    .converter-options > summary::-webkit-details-marker { display: none; }
    .converter-options > summary > span:first-child { display: grid; gap: 2px; }
    .converter-options > summary strong { font-size: 14px; letter-spacing: -.012em; }
    .converter-options > summary small { color: var(--muted); font-size: 11px; }
    .converter-options-chevron { color: var(--muted); font-size: 21px; line-height: 1; transition: transform 180ms ease-out; }
    .converter-options[open] .converter-options-chevron { transform: rotate(180deg); }
    .converter-options-body { display: grid; gap: 14px; border-top: 1px solid color-mix(in srgb, var(--line) 76%, transparent); padding: 14px; }
    .converter-basics { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
    .converter-basics > label:first-child { grid-column: 1 / -1; }
    .converter-options .argument-config, .converter-options .script-recovery { border-radius: 15px; background: color-mix(in srgb, var(--paper) 76%, transparent); padding: 12px; }
    .conversion-actions { align-items: stretch; }
    .conversion-actions #submit { min-height: 46px; }
    input, textarea, select { border-color: color-mix(in srgb, var(--line) 88%, transparent); border-radius: 13px; background: color-mix(in srgb, var(--paper) 82%, transparent); }
    .preview { border: 0; border-radius: 17px; }
    .metric { border-radius: 17px; border-color: transparent; background: var(--ios-fill); }
    .studio-view { margin-top: 30px; }
    .studio-hero { display: flex; align-items: end; justify-content: space-between; gap: 18px; margin: 0 0 20px; padding: 2px 2px 0; }
    .studio-hero h2 { margin: 0; font-size: clamp(24px, 3vw, 34px); letter-spacing: -.055em; }
    .studio-hero p { margin: 7px 0 0; color: var(--muted); line-height: 1.5; max-width: 690px; }
    .studio-grid { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 14px; align-items: start; }
    .studio-sidebar, .studio-editor, .studio-empty { padding: 18px; border: 1px solid var(--line); border-radius: 24px; background: var(--paper); box-shadow: var(--ios-shadow); }
    .studio-sidebar-head, .studio-editor-head, .studio-actions, .studio-workspace-meta { display: flex; align-items: center; justify-content: space-between; gap: 9px; }
    .studio-sidebar-head h3, .studio-editor-head h3 { margin: 0; font-size: 16px; letter-spacing: -.02em; }
    .studio-workspace-meta { margin: 13px 0; padding: 11px; border-radius: 15px; background: var(--ios-fill); align-items: flex-start; }
    .studio-workspace-meta small, .studio-hint, .studio-status { color: var(--muted); font-size: 12px; line-height: 1.45; }
    .studio-workspace-id { font-family: "SFMono-Regular", Consolas, monospace; font-size: 11px; overflow-wrap: anywhere; }
    .studio-list { display: grid; gap: 7px; }
    .ruleset-item { display: grid; gap: 3px; width: 100%; padding: 12px; border: 1px solid transparent; border-radius: 16px; text-align: left; color: var(--ink); background: transparent; cursor: pointer; }
    .ruleset-item:hover, .ruleset-item.active { border-color: color-mix(in srgb, var(--ios-blue) 36%, transparent); background: color-mix(in srgb, var(--ios-blue) 10%, transparent); }
    .ruleset-item strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ruleset-item small { color: var(--muted); }
    .studio-editor { min-width: 0; }
    .studio-editor[hidden], .studio-empty[hidden], .studio-grid[hidden] { display: none !important; }
    .studio-fields { display: grid; grid-template-columns: minmax(0, 1fr) 160px; gap: 10px; margin: 16px 0; }
    .studio-icon-card { display: grid; grid-template-columns: 58px minmax(0, 1fr); gap: 12px; align-items: center; margin: 0 0 16px; padding: 12px; border: 1px solid var(--line); border-radius: 17px; background: var(--panel); }
    .studio-icon-preview { display: grid; width: 58px; height: 58px; place-items: center; overflow: hidden; border: 1px solid color-mix(in srgb, var(--line) 88%, transparent); border-radius: 16px; background: var(--paper); color: var(--muted); font-size: 11px; font-weight: 650; }
    .studio-icon-preview img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .studio-icon-preview img[hidden] { display: none !important; }
    .studio-icon-copy { min-width: 0; }
    .studio-icon-copy h4 { margin: 0; font-size: 14px; letter-spacing: -.01em; }
    .studio-icon-copy p { margin: 2px 0 7px; color: var(--muted); font-size: 12px; line-height: 1.45; }
    .studio-icon-copy small { color: var(--muted); font-size: 11px; }
    .studio-icon-actions { display: flex; align-items: center; gap: 7px; margin-bottom: 5px; }
    .studio-icon-actions .btn { min-height: 34px; border-radius: 10px; font-size: 12px; padding: 0 10px; }
    #studio-icon-remove[hidden] { display: none !important; }
    .studio-icon-url-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 7px; margin-bottom: 6px; }
    .studio-icon-url-row input { min-width: 0; min-height: 34px; border-radius: 10px; font-size: 12px; }
    .studio-icon-url-row .btn { min-height: 34px; border-radius: 10px; font-size: 12px; padding: 0 10px; }
    .studio-source { min-height: 360px; font-family: "SFMono-Regular", Consolas, monospace; font-size: 12px; line-height: 1.55; }
    .rule-quick-add { display: grid; grid-template-columns: 150px minmax(0, 1fr) auto; gap: 9px; margin-top: 12px; }
    .studio-actions { flex-wrap: wrap; justify-content: flex-start; margin-top: 14px; }
    .studio-status { min-height: 18px; margin: 11px 0 0; }
    .studio-status.error { color: var(--red); }
    .studio-summary { color: var(--muted); font-size: 12px; }
    .studio-empty { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; padding: 0; border: 0; background: transparent; box-shadow: none; text-align: left; }
    .studio-entry-card { display: grid; gap: 11px; min-height: 270px; padding: 22px; border: 1px solid var(--line); border-radius: 24px; background: var(--paper); box-shadow: var(--ios-shadow); }
    .studio-entry-card h3 { margin: 0; font-size: 21px; letter-spacing: -.035em; }
    .studio-entry-card p { max-width: 560px; margin: 0; color: var(--muted); line-height: 1.55; }
    .studio-entry-card label { display: grid; gap: 5px; color: var(--muted); font-size: 12px; font-weight: 600; }
    .studio-entry-card input { min-height: 42px; }
    .studio-entry-card .btn { justify-self: start; margin-top: auto; }
    .mobile-tabbar { position: fixed; z-index: 30; bottom: max(14px, env(safe-area-inset-bottom)); left: 50%; display: grid; width: min(470px, calc(100vw - 48px)); min-height: 66px; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--line) 88%, transparent); border-radius: 24px; background: color-mix(in srgb, var(--ios-material-strong) 86%, transparent); box-shadow: 0 12px 30px rgba(0,0,0,.14), inset 0 1px 0 rgba(255,255,255,.24); -webkit-backdrop-filter: blur(26px) saturate(175%); backdrop-filter: blur(26px) saturate(175%); padding: 5px; transform: translateX(-50%); }
    .mobile-tabbar .app-tab { display: inline-flex; min-height: 54px; align-items: center; justify-content: center; flex-direction: column; gap: 2px; border-radius: 18px; color: var(--muted); font-size: 10px; font-weight: 650; line-height: 1.1; padding: 3px 8px; -webkit-tap-highlight-color: transparent; touch-action: manipulation; transition: color 160ms ease-out, background 160ms ease-out, box-shadow 160ms ease-out, transform 100ms ease-out; }
    .mobile-tabbar .app-tab svg { width: 20px; height: 20px; }
    .mobile-tabbar .app-tab[aria-selected="true"] { color: var(--ios-blue); background: color-mix(in srgb, var(--paper) 72%, transparent); box-shadow: inset 0 1px 0 rgba(255,255,255,.38), 0 1px 3px rgba(0,0,0,.08); }
    .mobile-tabbar .app-tab:active { transform: scale(.975); }
    @media (max-width: 780px) {
      .shell { width: min(100vw - 20px, 1368px); padding-top: 10px; padding-bottom: calc(105px + env(safe-area-inset-bottom)); }
      header { padding: 12px; border-radius: 23px; }
      .brand-mark { width: 39px; height: 39px; flex-basis: 39px; border-radius: 13px; }
      .brand-mark svg { width: 25px; height: 25px; }
      .subtitle { font-size: 11px; }
      .header-actions .health { display: none; }
      .top-link { font-size: 0; width: 38px; padding: 0; border-radius: 50%; }
      .top-link svg { width: 17px; height: 17px; }
      .github-link, .theme-toggle { width: 38px; min-width: 38px; height: 38px; min-height: 38px; }
      .workspace { margin-top: 30px; }
      .converter-panel .panel-head { align-items: center; }
      .converter-panel .panel-body { padding: 12px; }
      .converter-source-step { gap: 10px; border-radius: 18px; padding: 13px; }
      .converter-source-step textarea { min-height: min(42dvh, 330px); max-height: 430px; }
      .converter-step-head h3 { font-size: 15px; }
      .converter-options { border-radius: 17px; }
      .converter-options > summary { min-height: 56px; padding: 10px 13px; }
      .converter-options-body { gap: 12px; padding: 12px; }
      .converter-options .argument-config, .converter-options .script-recovery { padding: 11px; }
      .conversion-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .conversion-actions > * { width: 100%; min-width: 0; padding: 0 8px; font-size: 12px; }
      .conversion-actions #submit { grid-column: 1 / -1; min-height: 48px; font-size: 14px; }
      .output-panel .panel-body { padding: 12px; }
      .output-panel .result-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .output-panel .preview { min-height: 280px; max-height: 48dvh; }
      .studio-hero { padding: 2px 2px 0; align-items: start; flex-direction: column; margin-bottom: 16px; }
      .studio-grid { grid-template-columns: 1fr; }
      .studio-empty { grid-template-columns: 1fr; gap: 12px; }
      .studio-entry-card { min-height: 0; padding: 18px; }
      .studio-sidebar { order: 2; }
      .studio-fields, .rule-quick-add { grid-template-columns: 1fr; }
      .studio-icon-card { grid-template-columns: 52px minmax(0, 1fr); }
      .studio-icon-preview { width: 52px; height: 52px; border-radius: 14px; }
      .studio-icon-url-row { grid-template-columns: 1fr; }
      .studio-source { min-height: 310px; }
      /* Keep the iOS 26 floating geometry, but use AnywhereHub's shared material verbatim. */
      .mobile-tabbar { bottom: calc(10px + env(safe-area-inset-bottom)); width: min(430px, calc(100vw - 28px)); min-height: 64px; height: 64px; border-radius: 30px; }
      .mobile-tabbar .app-tab { min-height: 54px; border-radius: 25px; padding: 3px 12px 4px; }
      .mobile-tabbar .app-tab svg { width: 21px; height: 21px; stroke-width: 1.8; }
    }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; } }
    @media (prefers-reduced-transparency: reduce) { .mobile-tabbar { background: var(--paper); -webkit-backdrop-filter: none; backdrop-filter: none; } }
  </style>
</head>
<body>
  <div class="shell">
    <header>
      <div class="brand">
        <img class="brand-mark" src="/icons/anywhere-converter-app-icon.png" width="44" height="44" alt="">
        <div>
          <h1>Anywhere Converter</h1>
          <p class="subtitle">把 Loon / Surge 插件、模块、脚本和规则集，转化为轻量、可导入的 Anywhere 配置。</p>
        </div>
      </div>
      <div class="header-actions">
        <a class="top-link health hub-link" id="health" href="https://anywhere-hub.chikacya.indevs.in/" target="_blank" rel="noopener"><span class="hub-orb" aria-hidden="true"></span><span>Anywhere Hub</span><span class="hub-arrow" aria-hidden="true">↗</span></a>
        <a class="top-link github-link" href="https://github.com/chikacya/anywhere-converter" target="_blank" rel="noopener" title="访问 GitHub 源工程" aria-label="访问 GitHub 源工程">${icon("github")}</a>
        <button class="theme-toggle" id="theme-toggle" type="button" title="切换深色模式" aria-label="切换深色模式">
          <span class="moon" aria-hidden="true"></span>
          <span class="sun">${icon("sun")}</span>
        </button>
      </div>
    </header>

    <main class="workspace">
      <section class="panel converter-panel" aria-labelledby="input-title">
        <div class="panel-head">
          <div class="converter-panel-title"><h2 class="panel-title" id="input-title">转换器</h2><small>导入 Loon / Surge 插件、模块或规则集</small></div>
          <div class="actions">
            <button class="btn" id="sample" type="button" title="填入一个最小示例模块">${icon("file-plus")}示例</button>
            <button class="btn" id="clear" type="button" title="清空输入">${icon("trash")}清空</button>
          </div>
        </div>
        <div class="panel-body">
          <form id="form">
            <section class="converter-source-step" aria-labelledby="source-step-title">
              <div class="converter-step-head"><div><span>输入来源</span><h3 id="source-step-title">粘贴链接或插件内容</h3></div><small>二选一即可</small></div>
              <label>模块 / 规则集 URL
                <input name="url" inputmode="url" autocomplete="url" placeholder="https://example.com/module.plugin">
              </label>
              <label class="converter-source-text">插件 / 模块 / 规则集内容
                <textarea name="source" spellcheck="false" placeholder="粘贴 Loon / Surge 插件、模块或规则集内容。只填写 URL 时，会自动读取远程内容。"></textarea>
              </label>
            </section>
            <details class="converter-options">
              <summary><span><strong>转换选项</strong><small>格式、参数、脚本与图标</small></span><span class="converter-options-chevron" aria-hidden="true">⌄</span></summary>
              <div class="converter-options-body">
                <div class="converter-basics">
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
                </div>
            <details class="icon-config" id="icon-config">
              <summary>
                <span class="icon-summary-copy">
                  <strong>自定义图标（可选）</strong>
                  <small>上传图片或导入 URL，自动嵌入所有生成的 AMRS / ARRS。</small>
                </span>
                <span class="icon-summary-state" id="icon-summary-state">未设置</span>
              </summary>
              <div class="icon-panel">
                <div class="icon-preview" id="icon-preview" aria-label="图标预览">
                  <span id="icon-placeholder">${icon("image")}</span>
                  <img id="icon-preview-image" alt="自定义规则图标预览" hidden>
                </div>
                <div class="icon-controls">
                  <div class="icon-tabs" role="tablist" aria-label="图标来源">
                    <button class="icon-tab active" id="icon-upload-tab" type="button" role="tab" aria-selected="true">上传图片</button>
                    <button class="icon-tab" id="icon-url-tab" type="button" role="tab" aria-selected="false">图片 URL</button>
                  </div>
                  <div class="icon-pane" id="icon-upload-pane" role="tabpanel">
                    <label class="icon-drop" for="icon-file">
                      <input id="icon-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif">
                      <span>点击选择 PNG / JPEG / WebP / GIF</span>
                    </label>
                  </div>
                  <div class="icon-pane" id="icon-url-pane" role="tabpanel" hidden>
                    <div class="icon-url-row">
                      <input id="icon-url" type="url" inputmode="url" autocomplete="url" placeholder="https://example.com/icon.png" aria-label="图标 URL">
                      <button class="btn" id="icon-load-url" type="button">读取图标</button>
                    </div>
                  </div>
                  <p class="icon-help" id="icon-help">最大 256 KiB；上传图片使用快照，URL 图标可跟随动态订阅。</p>
                  <div class="icon-footer">
                    <p class="icon-message" id="icon-message" role="status" aria-live="polite"></p>
                    <button class="btn icon-remove" id="icon-remove" type="button" hidden>移除图标</button>
                  </div>
                </div>
              </div>
            </details>
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
              <input type="checkbox" name="preserveParameters" value="true">
              <span class="switch-copy">
                <span>保留 Anywhere 参数配置</span>
                <small>在 AMRS 写入 [Parameter]；原生规则使用当前值，兼容层脚本可读取 Anywhere.params。</small>
              </span>
            </label>
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
              </div>
            </details>
            <div class="actions conversion-actions">
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

      <section class="panel output-panel" id="output-panel" aria-labelledby="output-title">
        <div class="panel-head">
          <h2 class="panel-title" id="output-title">转换结果</h2>
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

    <section class="studio-view" id="studio-view" hidden aria-labelledby="studio-title">
      <div class="studio-hero">
        <div>
          <p class="section-kicker">Anywhere native ARRS</p>
          <h2 id="studio-title">规则集在线工坊</h2>
          <p>在浏览器中编写 Anywhere 原生 ARRS，发布后得到一条可多人订阅的在线链接。管理密钥仅保留在你的编辑链接片段中，不会出现在订阅地址。</p>
        </div>
      </div>
      <div class="studio-empty" id="studio-empty">
        <section class="studio-entry-card">
          <p class="section-kicker">New workspace</p>
          <h3>从一份自建规则集开始</h3>
          <p>创建后会生成唯一管理链接。请把它保存到密码管理器或自己的笔记中；没有管理密钥无法再次编辑。</p>
          <button class="btn primary" id="studio-create-workspace" type="button">创建工作区</button>
        </section>
        <section class="studio-entry-card">
          <p class="section-kicker">Open workspace</p>
          <h3>回到已有工作区</h3>
          <p>粘贴完整管理链接最方便；也可输入工作区 ID 和管理密钥。若密钥已在本设备保存，只填 ID 即可。</p>
          <label>管理链接或工作区 ID<input id="studio-open-workspace" autocomplete="off" placeholder="粘贴 /editor/...#key=... 或工作区 ID"></label>
          <label>管理密钥（可选）<input id="studio-open-key" type="password" autocomplete="off" placeholder="仅输入 ID 时需要"></label>
          <button class="btn" id="studio-open-workspace-button" type="button">打开工作区</button>
        </section>
      </div>
      <div class="studio-grid" id="studio-grid" hidden>
        <aside class="studio-sidebar">
          <div class="studio-sidebar-head">
            <h3>我的规则集</h3>
            <button class="btn" id="studio-new-ruleset" type="button">新建</button>
          </div>
          <div class="studio-workspace-meta">
            <div><small>工作区 ID</small><div class="studio-workspace-id" id="studio-workspace-id">—</div></div>
            <button class="btn" id="studio-copy-edit-link" type="button" title="复制管理链接">复制</button>
          </div>
          <div class="studio-list" id="studio-list"></div>
          <p class="studio-hint">最多 20 份规则集；单份上限 100,000 条 / 8 MiB。发布只在保存时发生。</p>
        </aside>
        <section class="studio-editor" id="studio-editor" hidden>
          <div class="studio-editor-head">
            <div><h3 id="studio-editor-title">规则集</h3><span class="studio-summary" id="studio-summary"></span></div>
            <button class="btn" id="studio-delete" type="button">删除</button>
          </div>
          <div class="studio-fields">
            <label>名称<input id="studio-name" maxlength="120" placeholder="例如：我的广告拦截"></label>
            <label>路由<select id="studio-routing"><option value="0">默认</option><option value="1">Direct</option><option value="2">Reject</option></select></label>
          </div>
          <section class="studio-icon-card" aria-labelledby="studio-icon-title">
            <div class="studio-icon-preview" id="studio-icon-preview"><img id="studio-icon-image" alt="规则集图标预览" hidden><span id="studio-icon-placeholder">图标</span></div>
            <div class="studio-icon-copy">
              <h4 id="studio-icon-title">自定义图标</h4>
              <p>上传图片或读取图片 URL 后，会作为 Base64 写入 <code>icon-light</code>，随规则集一起保存和发布。</p>
              <div class="studio-icon-actions"><label class="btn" for="studio-icon-file">选择图片<input id="studio-icon-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden></label><button class="btn" id="studio-icon-remove" type="button" hidden>移除图标</button></div>
              <div class="studio-icon-url-row"><input id="studio-icon-url" type="url" inputmode="url" autocomplete="url" placeholder="https://example.com/icon.png" aria-label="规则集图标 URL"><button class="btn" id="studio-icon-load-url" type="button">读取 URL</button></div>
              <small id="studio-icon-status">支持 PNG、JPEG、WebP、GIF，最大 256 KiB。</small>
            </div>
          </section>
          <label>ARRS 内容<textarea class="studio-source" id="studio-source" spellcheck="false" placeholder="name = 我的规则集&#10;routing = 2&#10;&#10;2, example.com&#10;3, tracker"></textarea></label>
          <div class="rule-quick-add" aria-label="快速添加规则">
            <select id="studio-rule-type"><option value="2">域名后缀</option><option value="3">域名关键字</option><option value="0">IPv4 CIDR</option><option value="1">IPv6 CIDR</option></select>
            <input id="studio-rule-value" placeholder="example.com">
            <button class="btn" id="studio-add-rule" type="button">添加规则</button>
          </div>
          <div class="studio-actions">
            <button class="btn primary" id="studio-save" type="button">保存并发布</button>
            <button class="btn" id="studio-copy-subscription" type="button">复制订阅链接</button>
            <a class="btn" id="studio-open-subscription" target="_blank" rel="noopener" hidden>打开 ARRS</a>
          </div>
          <p class="studio-status" id="studio-status" role="status" aria-live="polite"></p>
        </section>
      </div>
    </section>
  </div>

  <nav class="mobile-tabbar" aria-label="主导航">
    <button class="app-tab" type="button" data-app-view="convert" aria-selected="true" aria-current="page">${icon("wand")}<span>转换器</span></button>
    <button class="app-tab" type="button" data-app-view="studio" aria-selected="false">${icon("sliders")}<span>规则集工坊</span></button>
  </nav>

  <script>
    const icons = {};
    const form = document.querySelector("#form");
    const submit = document.querySelector("#submit");
    const preview = document.querySelector("#preview");
    const sourceInput = document.querySelector('textarea[name="source"]');
    const urlInput = document.querySelector('input[name="url"]');
    const iconConfig = document.querySelector("#icon-config");
    const iconSummaryState = document.querySelector("#icon-summary-state");
    const iconUploadTab = document.querySelector("#icon-upload-tab");
    const iconUrlTab = document.querySelector("#icon-url-tab");
    const iconUploadPane = document.querySelector("#icon-upload-pane");
    const iconUrlPane = document.querySelector("#icon-url-pane");
    const iconFileInput = document.querySelector("#icon-file");
    const iconUrlInput = document.querySelector("#icon-url");
    const iconLoadUrl = document.querySelector("#icon-load-url");
    const iconPreviewImage = document.querySelector("#icon-preview-image");
    const iconPlaceholder = document.querySelector("#icon-placeholder");
    const iconMessage = document.querySelector("#icon-message");
    const iconRemove = document.querySelector("#icon-remove");
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
    const outputPanel = document.querySelector("#output-panel");
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
    let sourceLoadedFromUrl = "";
    let refreshTimer = 0;
    let iconMode = "upload";
    let uploadedIconBase64 = "";
    let uploadedIconMime = "";
    let validatedIconUrl = "";
    let remoteIconBase64 = "";
    let remoteIconMime = "";
    let remoteIconBytes = 0;

    const savedTheme = localStorage.getItem("anywhere-converter-theme");
    const initialTheme = savedTheme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initialTheme);

    themeToggle.addEventListener("click", () => {
      const next = document.body.dataset.theme === "dark" ? "light" : "dark";
      localStorage.setItem("anywhere-converter-theme", next);
      setTheme(next);
    });

    iconUploadTab.addEventListener("click", () => setIconMode("upload"));
    iconUrlTab.addEventListener("click", () => setIconMode("url"));
    iconFileInput.addEventListener("change", async () => {
      const file = iconFileInput.files?.[0];
      if (!file) return;
      setIconMessage("正在读取图片…");
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (bytes.length > 256 * 1024) throw new Error("图片超过 256 KiB 上限，请更换更小的图标。");
        const mimeType = imageMimeType(bytes);
        if (!mimeType) throw new Error("只支持 PNG、JPEG、WebP 或 GIF 图片。");
        uploadedIconBase64 = bytesToBase64(bytes);
        uploadedIconMime = mimeType;
        validatedIconUrl = "";
        showIconPreview(uploadedIconBase64, mimeType, bytes.length, "已上传");
        scheduleReconvert();
      } catch (error) {
        uploadedIconBase64 = "";
        uploadedIconMime = "";
        clearIconPreview();
        setIconMessage(error.message, "error");
      }
    });
    iconLoadUrl.addEventListener("click", () => loadRemoteIcon().catch(() => {}));
    iconUrlInput.addEventListener("input", () => {
      validatedIconUrl = "";
      remoteIconBase64 = "";
      remoteIconMime = "";
      remoteIconBytes = 0;
      clearIconPreview();
      setIconMessage(iconUrlInput.value.trim() ? "点击“读取图标”检查远程图片。" : "");
    });
    iconUrlInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      loadRemoteIcon().catch(() => {});
    });
    iconRemove.addEventListener("click", () => resetCustomIcon());

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
      sourceLoadedFromUrl = "";
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
      sourceLoadedFromUrl = "";
      clearTimeout(inspectTimer);
      inspectTimer = setTimeout(() => {
        if (/^\\s*\\[Arguments?\\]/im.test(sourceInput.value)) inspectModule({ quiet: true, sourceOnly: true });
        else renderArgumentDefinitions({}, {});
      }, 450);
    });

    urlInput.addEventListener("input", () => {
      clearRemoteSourceIfUrlChanged();
    });

    for (const control of form.querySelectorAll('input[name="fetchScripts"], input[name="aggressive"], input[name="preserveParameters"], select[name="sourceKind"], select[name="ruleSetRouting"]')) {
      control.addEventListener("change", () => scheduleReconvert());
    }

    argumentFieldsEl.addEventListener("change", () => scheduleReconvert());

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
      sourceLoadedFromUrl = "";
      copyFile.disabled = true;
      copyJson.disabled = true;
      scriptOverridesEl.replaceChildren();
      resetCustomIcon();
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

      clearRemoteSourceIfUrlChanged();
      if (iconMode === "url" && iconUrlInput.value.trim() && validatedIconUrl !== iconUrlInput.value.trim()) {
        try {
          await loadRemoteIcon({ quiet: true });
        } catch (error) {
          lastJson = null;
          setStatus("blocked");
          signalsEl.replaceChildren(chip("icon failed"));
          preview.classList.add("error");
          preview.textContent = error.message;
          submit.disabled = false;
          return;
        }
      }
      const raw = Object.fromEntries(new FormData(form).entries());
      const argumentOverrides = collectArgumentOverrides();
      const source = sourceValueForRequest();

      try {
        const response = await fetch("/api/convert", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: raw.name || "",
            url: raw.url || "",
            source,
            sourceKind: raw.sourceKind || "auto",
            ruleSetRouting: raw.ruleSetRouting || "default",
            mode: raw.aggressive === "true" ? "aggressive" : "compat",
            arguments: argumentOverrides,
            preserveParameters: raw.preserveParameters === "true",
            iconLightBase64: iconMode === "upload" ? uploadedIconBase64 : "",
            iconUrl: iconMode === "url" ? iconUrlInput.value.trim() : "",
            scriptTextByURL: collectScriptTextByURL(),
            fetchScripts: raw.fetchScripts === "true",
            cacheBust: cacheBustValue,
            includeContent: true,
            includeSource: true,
          }),
        });
        const json = await readJSONResponse(response, "convert");
        if (!response.ok) throw new Error((json.detail || json.error || "convert failed"));
        lastJson = json;
        if (cacheBustValue) cacheBustValue = "";
        renderResult(json);
        revealMobileResult();
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
        revealMobileResult();
      } finally {
        submit.disabled = false;
        copyJson.disabled = !lastJson;
        copyFile.disabled = !currentFile?.content;
        downloadFile.disabled = !currentFile?.content;
        downloadAll.disabled = !(lastJson?.files || []).some((file) => typeof file.content === "string");
      }
    });

    fetch("/health").then((res) => readJSONResponse(res, "health")).then((json) => {
      healthEl.title = json.ok ? "Worker ready · 打开 Anywhere Hub" : "打开 Anywhere Hub";
    }).catch(() => {
      healthEl.title = "Worker health unavailable · 打开 Anywhere Hub";
    });

    function setIconMode(mode) {
      iconMode = mode === "url" ? "url" : "upload";
      const upload = iconMode === "upload";
      iconUploadTab.classList.toggle("active", upload);
      iconUrlTab.classList.toggle("active", !upload);
      iconUploadTab.setAttribute("aria-selected", String(upload));
      iconUrlTab.setAttribute("aria-selected", String(!upload));
      iconUploadPane.hidden = !upload;
      iconUrlPane.hidden = upload;
      if (upload && uploadedIconBase64) {
        showIconPreview(uploadedIconBase64, uploadedIconMime, base64ByteLength(uploadedIconBase64), "已上传");
      } else if (!upload && remoteIconBase64) {
        showIconPreview(remoteIconBase64, remoteIconMime, remoteIconBytes, "URL 已读取");
      } else {
        clearIconPreview();
        setIconMessage(!upload && iconUrlInput.value.trim() ? "点击“读取图标”检查远程图片。" : "");
      }
    }

    async function loadRemoteIcon(options = {}) {
      const url = iconUrlInput.value.trim();
      if (!url) {
        const error = new Error("请填写图片 URL。");
        setIconMessage(error.message, "error");
        throw error;
      }
      iconLoadUrl.disabled = true;
      if (!options.quiet) setIconMessage("正在读取远程图片…");
      try {
        const response = await fetch("/api/icon", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ iconUrl: url }),
        });
        const json = await readJSONResponse(response, "icon");
        if (!response.ok) throw new Error(json.detail || json.error || "图标读取失败。");
        validatedIconUrl = url;
        remoteIconBase64 = json.base64 || "";
        remoteIconMime = json.mimeType || "image/png";
        remoteIconBytes = Number(json.bytes) || base64ByteLength(remoteIconBase64);
        showIconPreview(remoteIconBase64, remoteIconMime, remoteIconBytes, "URL 已读取");
        if (!options.quiet) scheduleReconvert();
        return json;
      } catch (error) {
        validatedIconUrl = "";
        remoteIconBase64 = "";
        remoteIconMime = "";
        remoteIconBytes = 0;
        clearIconPreview();
        setIconMessage(error.message, "error");
        throw error;
      } finally {
        iconLoadUrl.disabled = false;
      }
    }

    function showIconPreview(encoded, mimeType, bytes, label) {
      iconPreviewImage.src = "data:" + mimeType + ";base64," + encoded;
      iconPreviewImage.hidden = false;
      iconPlaceholder.hidden = true;
      iconRemove.hidden = false;
      iconConfig.classList.add("has-icon");
      iconSummaryState.textContent = label;
      setIconMessage(label + " · " + formatByteSize(bytes), "success");
    }

    function clearIconPreview() {
      iconPreviewImage.removeAttribute("src");
      iconPreviewImage.hidden = true;
      iconPlaceholder.hidden = false;
      iconRemove.hidden = true;
      iconConfig.classList.remove("has-icon");
      iconSummaryState.textContent = "未设置";
    }

    function resetCustomIcon() {
      uploadedIconBase64 = "";
      uploadedIconMime = "";
      validatedIconUrl = "";
      remoteIconBase64 = "";
      remoteIconMime = "";
      remoteIconBytes = 0;
      iconFileInput.value = "";
      iconUrlInput.value = "";
      setIconMode("upload");
      setIconMessage("");
      scheduleReconvert();
    }

    function setIconMessage(message, kind = "") {
      iconMessage.textContent = message || "";
      iconMessage.className = "icon-message" + (kind ? " " + kind : "");
    }

    function imageMimeType(bytes) {
      if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
        && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
      if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
      if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38
        && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) return "image/gif";
      if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
        && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
      return "";
    }

    function bytesToBase64(bytes) {
      let binary = "";
      const chunkSize = 0x8000;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
      }
      return btoa(binary);
    }

    function base64ByteLength(value) {
      const text = String(value || "").replace(/\s+/g, "");
      if (!text) return 0;
      const padding = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0;
      return text.length / 4 * 3 - padding;
    }

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
      if (json.icon?.source === "upload") appendSignal("上传图标 · 快照");
      if (json.icon?.source === "url") appendSignal("URL 图标 · 动态可用");
      if ((json.dynamicFiles || []).some((file) => /[?&]cacheBust=/.test(file.url || ""))) appendSignal("已刷新缓存");
      if (json.sourceKind === "ruleset") appendSignal("规则集");
      if (summary.validationErrors) appendSignal("验证错误 " + summary.validationErrors);
      if ((json.preservedParameters || []).length) appendSignal("参数保留 " + json.preservedParameters.length);
      if (summary.nativeLiftCount) appendSignal("JS 原生化 " + summary.nativeLiftCount);
      if (summary.compatScriptCount) appendSignal("兼容层脚本 " + summary.compatScriptCount);
      if (summary.scriptRuleCount) appendSignal("JS " + summary.scriptRuleCount + " 条 · 单次最大 " + formatByteSize(summary.maxPerHitScriptBytes));
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
        sourceLoadedFromUrl = json.sourceUrl || urlInput.value || "";
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

    function formatByteSize(value) {
      const bytes = Number(value) || 0;
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0) + " KiB";
      return (bytes / 1024 / 1024).toFixed(1) + " MiB";
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
        } else if (code === "script-fetch-failed" || code === "script-source-missing" || code === "script-fetch-file-too-large" || code === "script-fetch-budget-exceeded" || code === "script-fetch-count-exceeded" || code === "script-import" || code === "request-mutation-script") {
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
        if (code === "script-fetch-failed" || code === "script-source-missing" || code === "script-fetch-file-too-large" || code === "script-fetch-budget-exceeded" || code === "script-fetch-count-exceeded" || code === "script-import") return "action";
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
        "script-fetch-count-exceeded": "脚本超过下载数量上限",
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
        "unsupported-framing-header-set": "不支持设置传输头",
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

    async function readJSONResponse(response, label) {
      const text = await response.text();
      if (!text.trim()) return {};
      try {
        return JSON.parse(text);
      } catch {
        const summary = summarizeNonJSONResponse(text);
        const status = response.status ? "HTTP " + response.status : "HTTP error";
        throw new Error(label + " returned non-JSON response (" + status + "): " + summary);
      }
    }

    function summarizeNonJSONResponse(text) {
      const withoutTags = String(text || "")
        .replace(/<script\\b[^>]*>[\\s\\S]*?<\\/script>/gi, " ")
        .replace(/<style\\b[^>]*>[\\s\\S]*?<\\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\\s+/g, " ")
        .trim();
      const summary = withoutTags || String(text || "").replace(/\\s+/g, " ").trim() || "empty response";
      return summary.length > 220 ? summary.slice(0, 217) + "..." : summary;
    }

    function normalizeSourceUrl(value) {
      return String(value || "").trim();
    }

    function clearRemoteSourceIfUrlChanged() {
      const currentUrl = normalizeSourceUrl(urlInput.value);
      if (!sourceLoadedFromUrl || !currentUrl || normalizeSourceUrl(sourceLoadedFromUrl) === currentUrl) return false;
      sourceInput.value = "";
      sourceLoadedFromUrl = "";
      renderArgumentDefinitions({}, {});
      return true;
    }

    function sourceValueForRequest() {
      if (clearRemoteSourceIfUrlChanged()) return "";
      return sourceInput.value || "";
    }

    function scheduleReconvert() {
      if (!lastJson) return;
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        if (!submit.disabled) form.requestSubmit();
      }, 120);
    }

    async function inspectModule(options = {}) {
      const quiet = options.quiet === true;
      const sourceOnly = options.sourceOnly === true;
      if (!sourceOnly) clearRemoteSourceIfUrlChanged();
      const source = sourceOnly ? (sourceInput.value || "") : sourceValueForRequest();
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
        const json = await readJSONResponse(response, "inspect");
        if (!response.ok) throw new Error(json.detail || json.error || "inspect failed");
        if (json.source && sourceInput && !sourceInput.value.trim()) {
          sourceInput.value = json.source;
          sourceLoadedFromUrl = json.sourceUrl || url || "";
        }
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

    // Rule Studio: the secret is kept in the URL fragment and sent only as a
    // bearer credential. It is never part of a public .arrs subscription URL.
    const studioView = document.querySelector("#studio-view");
    const converterView = document.querySelector("main.workspace");
    const studioEmpty = document.querySelector("#studio-empty");
    const studioGrid = document.querySelector("#studio-grid");
    const studioList = document.querySelector("#studio-list");
    const studioEditor = document.querySelector("#studio-editor");
    const studioWorkspaceIdEl = document.querySelector("#studio-workspace-id");
    const studioName = document.querySelector("#studio-name");
    const studioRouting = document.querySelector("#studio-routing");
    const studioSource = document.querySelector("#studio-source");
    const studioIconFile = document.querySelector("#studio-icon-file");
    const studioIconUrl = document.querySelector("#studio-icon-url");
    const studioIconLoadUrl = document.querySelector("#studio-icon-load-url");
    const studioIconImage = document.querySelector("#studio-icon-image");
    const studioIconPlaceholder = document.querySelector("#studio-icon-placeholder");
    const studioIconRemove = document.querySelector("#studio-icon-remove");
    const studioIconStatus = document.querySelector("#studio-icon-status");
    const studioSummary = document.querySelector("#studio-summary");
    const studioStatus = document.querySelector("#studio-status");
    const studioEditorTitle = document.querySelector("#studio-editor-title");
    const studioRuleType = document.querySelector("#studio-rule-type");
    const studioRuleValue = document.querySelector("#studio-rule-value");
    const studioOpenSubscription = document.querySelector("#studio-open-subscription");
    let studioWorkspaceId = workspaceIdFromPath();
    let studioKey = workspaceKeyFromFragment() || (studioWorkspaceId ? localStorage.getItem("anywhere-converter-workspace-key:" + studioWorkspaceId) : "");
    let studioWorkspace = null;
    let studioRuleSet = null;
    let studioDraftTimer = 0;

    document.querySelectorAll("[data-app-view]").forEach((button) => button.addEventListener("click", () => setAppView(button.dataset.appView)));
    document.querySelector("#studio-create-workspace").addEventListener("click", createStudioWorkspace);
    document.querySelector("#studio-open-workspace-button").addEventListener("click", openExistingStudioWorkspace);
    document.querySelector("#studio-new-ruleset").addEventListener("click", createStudioRuleSet);
    document.querySelector("#studio-save").addEventListener("click", saveStudioRuleSet);
    document.querySelector("#studio-delete").addEventListener("click", deleteStudioRuleSet);
    document.querySelector("#studio-copy-edit-link").addEventListener("click", () => copyText(currentEditUrl(), "管理链接已复制。"));
    document.querySelector("#studio-copy-subscription").addEventListener("click", () => copyText(studioSubscriptionUrl(), "订阅链接已复制。"));
    document.querySelector("#studio-add-rule").addEventListener("click", addStudioRule);
    [studioName, studioRouting, studioSource].forEach((field) => field.addEventListener("input", scheduleStudioDraft));
    studioSource.addEventListener("input", renderStudioIconPreview);
    studioIconFile.addEventListener("change", handleStudioIconUpload);
    studioIconLoadUrl.addEventListener("click", () => loadStudioIconUrl().catch(() => {}));
    studioIconUrl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      loadStudioIconUrl().catch(() => {});
    });
    studioIconRemove.addEventListener("click", removeStudioIcon);
    addEventListener("popstate", () => {
      studioWorkspaceId = workspaceIdFromPath();
      studioKey = workspaceKeyFromFragment() || (studioWorkspaceId ? localStorage.getItem("anywhere-converter-workspace-key:" + studioWorkspaceId) : "");
      if (studioWorkspaceId && studioKey) {
        setAppView("studio", false);
        loadStudioWorkspace();
      }
    });
    if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
    if (studioWorkspaceId && studioKey) {
      setAppView("studio", false);
      loadStudioWorkspace();
    }

    function setAppView(view, focus = true) {
      const isStudio = view === "studio";
      converterView.hidden = isStudio;
      studioView.hidden = !isStudio;
      document.querySelectorAll("[data-app-view]").forEach((button) => {
        const selected = button.dataset.appView === view;
        button.setAttribute("aria-selected", String(selected));
        button.toggleAttribute("aria-current", selected);
      });
      if (isStudio && studioWorkspaceId && studioKey && !studioWorkspace) loadStudioWorkspace();
      if (focus) window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }

    function revealMobileResult() {
      if (!matchMedia("(max-width: 780px)").matches || !outputPanel) return;
      requestAnimationFrame(() => outputPanel.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
    }

    async function createStudioWorkspace() {
      studioStatusText("正在创建私有工作区…");
      try {
        const response = await fetch("/api/workspaces", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
        const data = await readStudioResponse(response);
        if (!response.ok) throw new Error(data.detail || data.error || "无法创建工作区。");
        const target = new URL(data.editUrl);
        studioWorkspaceId = data.workspaceId;
        studioKey = new URLSearchParams(target.hash.slice(1)).get("key") || "";
        localStorage.setItem("anywhere-converter-workspace-key:" + studioWorkspaceId, studioKey);
        history.replaceState({}, "", target.pathname + target.hash);
        studioWorkspace = data.workspace;
        renderStudioWorkspace();
        studioStatusText("工作区已创建。请复制并保存管理链接。", false);
        await createStudioRuleSet();
      } catch (error) {
        studioStatusText(error.message || "创建工作区失败。", true);
      }
    }

    async function openExistingStudioWorkspace() {
      const workspaceInput = document.querySelector("#studio-open-workspace").value.trim();
      const explicitKey = document.querySelector("#studio-open-key").value.trim();
      const parsed = parseStudioWorkspaceReference(workspaceInput);
      if (!parsed.workspaceId) return studioStatusText("请输入工作区 ID，或粘贴完整管理链接。", true);
      const key = parsed.key || explicitKey || localStorage.getItem("anywhere-converter-workspace-key:" + parsed.workspaceId) || "";
      if (!key) return studioStatusText("工作区 ID 还需要对应的管理密钥；请粘贴完整管理链接或补充密钥。", true);
      studioWorkspaceId = parsed.workspaceId;
      studioKey = key;
      studioWorkspace = null;
      studioRuleSet = null;
      localStorage.setItem("anywhere-converter-workspace-key:" + studioWorkspaceId, studioKey);
      history.replaceState({}, "", "/editor/" + studioWorkspaceId + "#key=" + studioKey);
      setAppView("studio", false);
      await loadStudioWorkspace();
    }

    async function loadStudioWorkspace() {
      if (!studioWorkspaceId || !studioKey) return;
      studioStatusText("正在读取工作区…");
      try {
        const response = await studioFetch("/api/workspaces/" + studioWorkspaceId);
        const data = await readStudioResponse(response);
        if (!response.ok) throw new Error(data.detail || data.error || "无法读取工作区。");
        studioWorkspace = data.workspace;
        renderStudioWorkspace();
        if (studioWorkspace.ruleSets.length) await selectStudioRuleSet(studioWorkspace.ruleSets[0].id);
        else studioStatusText("还没有规则集，点击“新建”开始。", false);
      } catch (error) {
        studioWorkspace = null;
        renderStudioWorkspace();
        studioStatusText(error.message || "读取工作区失败。", true);
      }
    }

    function renderStudioWorkspace() {
      const ready = Boolean(studioWorkspace && studioWorkspaceId && studioKey);
      studioEmpty.hidden = ready;
      studioGrid.hidden = !ready;
      if (!ready) return;
      studioWorkspaceIdEl.textContent = studioWorkspaceId;
      studioList.replaceChildren();
      for (const item of studioWorkspace.ruleSets || []) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ruleset-item" + (item.id === studioRuleSet?.id ? " active" : "");
        const title = document.createElement("strong");
        title.textContent = item.name;
        const meta = document.createElement("small");
        meta.textContent = (item.ruleCount || 0).toLocaleString() + " 条 · " + formatStudioBytes(item.bytes || 0);
        button.append(title, meta);
        button.addEventListener("click", () => selectStudioRuleSet(item.id));
        studioList.append(button);
      }
      if (!studioWorkspace.ruleSets?.length) studioEditor.hidden = true;
    }

    async function createStudioRuleSet() {
      if (!studioWorkspaceId || !studioKey) return createStudioWorkspace();
      studioStatusText("正在新建规则集…");
      try {
        const response = await studioFetch("/api/workspaces/" + studioWorkspaceId + "/rulesets", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "未命名规则集", routing: 0, source: "" }),
        });
        const data = await readStudioResponse(response);
        if (!response.ok) throw new Error(data.detail || data.error || "无法新建规则集。");
        studioWorkspace = data.workspace || studioWorkspace;
        studioRuleSet = data.ruleSet;
        renderStudioWorkspace();
        renderStudioEditor();
        studioName.focus();
        studioStatusText("新规则集已创建，编辑后点击“保存并发布”。", false);
      } catch (error) { studioStatusText(error.message || "新建规则集失败。", true); }
    }

    async function selectStudioRuleSet(ruleSetId) {
      studioStatusText("正在读取规则集…");
      try {
        const response = await studioFetch("/api/workspaces/" + studioWorkspaceId + "/rulesets/" + ruleSetId);
        const data = await readStudioResponse(response);
        if (!response.ok) throw new Error(data.detail || data.error || "无法读取规则集。");
        studioRuleSet = data.ruleSet;
        const draft = await readStudioDraft(studioRuleSet.id);
        if (draft && draft.updatedAt > Number(studioRuleSet.updatedAt || 0)) studioRuleSet = { ...studioRuleSet, ...draft, localDraft: true };
        renderStudioWorkspace();
        renderStudioEditor();
        studioStatusText(studioRuleSet.localDraft ? "已恢复本机未保存草稿。" : "", false);
      } catch (error) { studioStatusText(error.message || "读取规则集失败。", true); }
    }

    function renderStudioEditor() {
      if (!studioRuleSet) return;
      studioEditor.hidden = false;
      studioEditorTitle.textContent = studioRuleSet.name || "规则集";
      studioName.value = studioRuleSet.name || "";
      studioRouting.value = String(studioRuleSet.routing || 0);
      studioSource.value = studioRuleSet.content || "";
      renderStudioIconPreview();
      studioSummary.textContent = (studioRuleSet.ruleCount || 0).toLocaleString() + " 条 · " + formatStudioBytes(studioRuleSet.bytes || 0) + " · v" + (studioRuleSet.revision || 1);
      const subscription = studioSubscriptionUrl();
      studioOpenSubscription.href = subscription;
      studioOpenSubscription.hidden = !subscription;
    }

    async function saveStudioRuleSet() {
      if (!studioRuleSet) return;
      const button = document.querySelector("#studio-save");
      clearTimeout(studioDraftTimer);
      studioDraftTimer = 0;
      button.disabled = true;
      studioStatusText("正在验证并发布…");
      try {
        const response = await studioFetch("/api/workspaces/" + studioWorkspaceId + "/rulesets/" + studioRuleSet.id, {
          method: "PUT",
          headers: { "content-type": "application/json", "if-match": String(studioRuleSet.revision || 1) },
          body: JSON.stringify({ name: studioName.value, routing: Number(studioRouting.value), source: studioSource.value, revision: studioRuleSet.revision }),
        });
        const data = await readStudioResponse(response);
        if (response.status === 409) throw new Error("此规则集已在另一处被更新，请重新打开后合并修改。");
        if (!response.ok) throw new Error(data.detail || data.error || "发布失败。");
        studioWorkspace = data.workspace || studioWorkspace;
        studioRuleSet = data.ruleSet;
        await deleteStudioDraft(studioRuleSet.id);
        renderStudioWorkspace();
        renderStudioEditor();
        studioStatusText("已保存并发布。订阅端最多在缓存 TTL 后看到最新版本。", false);
      } catch (error) { studioStatusText(error.message || "发布失败。", true); }
      finally { button.disabled = false; }
    }

    async function deleteStudioRuleSet() {
      if (!studioRuleSet || !confirm("确定删除“" + studioRuleSet.name + "”吗？已发布的订阅链接会失效。")) return;
      try {
        const response = await studioFetch("/api/workspaces/" + studioWorkspaceId + "/rulesets/" + studioRuleSet.id, { method: "DELETE" });
        const data = await readStudioResponse(response);
        if (!response.ok) throw new Error(data.detail || data.error || "删除失败。");
        await deleteStudioDraft(studioRuleSet.id);
        studioWorkspace = data.workspace || studioWorkspace;
        studioRuleSet = null;
        renderStudioWorkspace();
        if (studioWorkspace.ruleSets?.length) await selectStudioRuleSet(studioWorkspace.ruleSets[0].id);
        else studioStatusText("规则集已删除。", false);
      } catch (error) { studioStatusText(error.message || "删除失败。", true); }
    }

    function addStudioRule() {
      const value = studioRuleValue.value.trim();
      if (!value) return studioRuleValue.focus();
      const source = studioSource.value.replace(/\\s*$/, "");
      studioSource.value = source + (source ? "\\n" : "") + studioRuleType.value + ", " + value + "\\n";
      studioRuleValue.value = "";
      scheduleStudioDraft();
      studioStatusText("规则已加入草稿，保存后才会发布。", false);
    }

    async function handleStudioIconUpload() {
      const file = studioIconFile.files?.[0];
      if (!file) return;
      setStudioIconMessage("正在读取图片…");
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (bytes.length > 256 * 1024) throw new Error("图片超过 256 KiB 上限，请更换更小的图标。");
        if (!imageMimeType(bytes)) throw new Error("只支持 PNG、JPEG、WebP 或 GIF 图片。");
        writeStudioIcon(bytesToBase64(bytes));
        studioIconFile.value = "";
        setStudioIconMessage("图标已加入草稿，保存后会与规则集一起发布。");
      } catch (error) {
        studioIconFile.value = "";
        setStudioIconMessage(error.message || "读取图标失败。", true);
      }
    }

    async function loadStudioIconUrl() {
      const url = studioIconUrl.value.trim();
      if (!url) {
        setStudioIconMessage("请填写图片 URL。", true);
        return;
      }
      studioIconLoadUrl.disabled = true;
      setStudioIconMessage("正在读取图片 URL…");
      try {
        const response = await fetch("/api/icon", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ iconUrl: url }),
        });
        const json = await readStudioResponse(response);
        if (!response.ok) throw new Error(json.detail || json.error || "图片 URL 读取失败。");
        writeStudioIcon(json.base64 || "");
        studioIconUrl.value = "";
        setStudioIconMessage("已从 URL 读取并嵌入图标 · " + formatByteSize(Number(json.bytes) || base64ByteLength(json.base64 || "")) + "。");
      } catch (error) {
        setStudioIconMessage(error.message || "图片 URL 读取失败。", true);
        throw error;
      } finally {
        studioIconLoadUrl.disabled = false;
      }
    }

    function writeStudioIcon(base64) {
      const lines = studioSource.value.split("\\n").filter((line) => !/^\\s*icon-light\\s*=/i.test(line));
      const routingIndex = lines.findIndex((line) => /^\\s*routing\\s*=/i.test(line));
      const index = routingIndex >= 0 ? routingIndex + 1 : Math.min(lines.length, 2);
      lines.splice(index, 0, "icon-light = " + base64);
      studioSource.value = lines.join("\\n").replace(/\\n{3,}/g, "\\n\\n");
      renderStudioIconPreview();
      scheduleStudioDraft();
    }

    function removeStudioIcon() {
      const lines = studioSource.value.split("\\n").filter((line) => !/^\\s*icon-light\\s*=/i.test(line));
      studioSource.value = lines.join("\\n").replace(/\\n{3,}/g, "\\n\\n");
      studioIconFile.value = "";
      studioIconUrl.value = "";
      renderStudioIconPreview();
      scheduleStudioDraft();
      setStudioIconMessage("已从草稿移除图标。");
    }

    function renderStudioIconPreview() {
      const match = studioSource.value.match(/^\\s*icon-light\\s*=\\s*(.+)\\s*$/im);
      const raw = match?.[1]?.trim() || "";
      if (!raw) {
        studioIconImage.removeAttribute("src");
        studioIconImage.hidden = true;
        studioIconPlaceholder.hidden = false;
        studioIconRemove.hidden = true;
        setStudioIconMessage("支持 PNG、JPEG、WebP、GIF，最大 256 KiB。");
        return;
      }
      if (/^https?:\\/\\//i.test(raw)) {
        studioIconImage.src = raw;
        studioIconImage.hidden = false;
        studioIconPlaceholder.hidden = true;
        studioIconRemove.hidden = false;
        setStudioIconMessage("使用上游图标 URL；保存后会随订阅保留。");
        return;
      }
      const base64 = raw.replace(/^data:[^;,]+;base64,/i, "").replace(/\\s+/g, "");
      const mimeType = studioIconMimeType(base64);
      if (!mimeType) {
        studioIconImage.removeAttribute("src");
        studioIconImage.hidden = true;
        studioIconPlaceholder.hidden = false;
        studioIconRemove.hidden = false;
        setStudioIconMessage("图标数据无效，保存时会被阻止。", true);
        return;
      }
      studioIconImage.src = "data:" + mimeType + ";base64," + base64;
      studioIconImage.hidden = false;
      studioIconPlaceholder.hidden = true;
      studioIconRemove.hidden = false;
      setStudioIconMessage("已嵌入 · " + formatByteSize(base64ByteLength(base64)) + "。");
    }

    function studioIconMimeType(base64) {
      try {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        return imageMimeType(bytes);
      } catch { return ""; }
    }

    function setStudioIconMessage(message, isError = false) {
      studioIconStatus.textContent = message || "";
      studioIconStatus.classList.toggle("error", Boolean(isError));
    }

    function studioFetch(path, options = {}) {
      const headers = new Headers(options.headers || {});
      headers.set("authorization", "Bearer " + studioKey);
      return fetch(path, { ...options, headers });
    }

    async function readStudioResponse(response) {
      const type = response.headers.get("content-type") || "";
      if (!type.includes("application/json")) return { detail: await response.text() || "服务返回了非 JSON 响应。" };
      return response.json();
    }

    function workspaceIdFromPath() {
      const match = location.pathname.match(/^\\/editor\\/([A-Za-z0-9_-]+)$/);
      return match ? match[1] : "";
    }

    function parseStudioWorkspaceReference(value) {
      const directId = String(value || "").trim();
      if (/^[A-Za-z0-9_-]{8,80}$/.test(directId)) return { workspaceId: directId, key: "" };
      try {
        const url = new URL(directId);
        const match = url.pathname.match(/^\\/editor\\/([A-Za-z0-9_-]+)$/);
        return { workspaceId: match ? match[1] : "", key: new URLSearchParams(url.hash.slice(1)).get("key") || "" };
      } catch { return { workspaceId: "", key: "" }; }
    }

    function workspaceKeyFromFragment() { return new URLSearchParams(location.hash.slice(1)).get("key") || ""; }
    function currentEditUrl() { return studioWorkspaceId && studioKey ? location.origin + "/editor/" + studioWorkspaceId + "#key=" + studioKey : ""; }
    function studioSubscriptionUrl() { return studioWorkspaceId && studioRuleSet ? location.origin + "/s/" + studioWorkspaceId + "/" + studioRuleSet.id + "/rules.arrs" : ""; }
    function studioStatusText(message, isError = false) { studioStatus.textContent = message; studioStatus.classList.toggle("error", Boolean(isError)); }
    function formatStudioBytes(value) { return value < 1024 ? value + " B" : (value / 1024).toFixed(value < 1024 * 1024 ? 1 : 2) + (value < 1024 * 1024 ? " KiB" : " MiB"); }
    async function copyText(value, success) {
      if (!value) return studioStatusText("请先创建或打开规则集。", true);
      try { await navigator.clipboard.writeText(value); studioStatusText(success, false); }
      catch { studioStatusText("浏览器未允许剪贴板访问，请手动复制链接。", true); }
    }

    function scheduleStudioDraft() {
      if (!studioRuleSet) return;
      clearTimeout(studioDraftTimer);
      studioDraftTimer = setTimeout(async () => {
        await writeStudioDraft(studioRuleSet.id, { name: studioName.value, routing: Number(studioRouting.value), content: studioSource.value, updatedAt: Date.now() });
        studioStatusText("草稿已保存在此设备，尚未发布。", false);
      }, 450);
    }

    function studioDraftDatabase() {
      return new Promise((resolve, reject) => {
        if (!("indexedDB" in window)) return reject(new Error("IndexedDB unavailable"));
        const request = indexedDB.open("anywhere-converter", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("ruleset-drafts", { keyPath: "id" });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    async function writeStudioDraft(id, draft) {
      try { const db = await studioDraftDatabase(); await new Promise((resolve, reject) => { const request = db.transaction("ruleset-drafts", "readwrite").objectStore("ruleset-drafts").put({ id, ...draft }); request.onsuccess = resolve; request.onerror = () => reject(request.error); }); db.close(); }
      catch { localStorage.setItem("anywhere-converter-draft:" + id, JSON.stringify(draft)); }
    }
    async function readStudioDraft(id) {
      try { const db = await studioDraftDatabase(); const value = await new Promise((resolve, reject) => { const request = db.transaction("ruleset-drafts").objectStore("ruleset-drafts").get(id); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); db.close(); return value; }
      catch { try { return JSON.parse(localStorage.getItem("anywhere-converter-draft:" + id) || "null"); } catch { return null; } }
    }
    async function deleteStudioDraft(id) {
      try { const db = await studioDraftDatabase(); await new Promise((resolve, reject) => { const request = db.transaction("ruleset-drafts", "readwrite").objectStore("ruleset-drafts").delete(id); request.onsuccess = resolve; request.onerror = () => reject(request.error); }); db.close(); }
      catch { localStorage.removeItem("anywhere-converter-draft:" + id); }
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
    image: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="9" r="1.5" fill="currentColor"/><path d="m4 17 5-5 3 3 2-2 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    github: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.5-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 0 1.6 1.1 1.6 1.1.9 1.5 2.4 1.1 2.9.8.1-.7.4-1.1.7-1.4-2.2-.3-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7c-.1-.3-.5-1.3.1-2.7 0 0 .9-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .6 1.4.2 2.4.1 2.7a3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.8V21c0 .3.2.6.7.5A10 10 0 0 0 12 2z" fill="currentColor"/></svg>',
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 7 7 0 1 0 20 15.5z" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  };
    return icons[name] || "";
  }

export function renderManifest() {
  return JSON.stringify({
    name: "Anywhere Converter",
    short_name: "Anywhere",
    description: "Loon / Surge 到 Anywhere 的转换器与规则集在线工坊",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6fb",
    theme_color: "#f3f5fa",
    lang: "zh-CN",
    icons: [
      { src: "/icons/anywhere-converter-app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/anywhere-converter-app-icon.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  });
}

export function renderServiceWorker() {
  return `const CACHE = "anywhere-converter-shell-v2";
const ASSETS = ["/", "/manifest.webmanifest", "/icons/icon-192.svg", "/icons/icon-512.svg"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin || new URL(request.url).pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => response).catch(() => caches.match("/")));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});`;
}

export function renderAppIcon(size = 192) {
  const safeSize = Number(size) >= 512 ? 512 : 192;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${safeSize}" height="${safeSize}" viewBox="0 0 192 192" fill="none"><defs><linearGradient id="g" x1="20" y1="12" x2="170" y2="184" gradientUnits="userSpaceOnUse"><stop stop-color="#5E5CE6"/><stop offset=".55" stop-color="#007AFF"/><stop offset="1" stop-color="#30D5C8"/></linearGradient><filter id="s" x="25" y="30" width="142" height="133" filterUnits="userSpaceOnUse"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#002A68" flood-opacity=".24"/></filter></defs><rect width="192" height="192" rx="48" fill="url(#g)"/><path d="M38 133 96 42l58 91" stroke="white" stroke-width="19" stroke-linecap="round" stroke-linejoin="round" filter="url(#s)"/><path d="M61 133h70" stroke="white" stroke-width="19" stroke-linecap="round"/><circle cx="96" cy="133" r="13" fill="#30D5C8" stroke="white" stroke-width="7"/></svg>`;
}
