# Anywhere-converter

[中文](#中文) | [English](#english)

## 中文

Anywhere-converter 是一个通用的 Loon / Surge 插件、模块、JavaScript rewrite 和规则集转换器，用来生成 Anywhere 可导入的 `.amrs` / `.arrs`。

它会优先把稳定能力转换为 Anywhere 原生规则；远程脚本默认会下载并尝试识别，能静态确认的 JSON/请求改写会被提升为原生规则，无法安全提升的脚本会通过兼容层保留。二进制、protobuf、大型混合脚本和强应用语义的脚本会标记为需要样本或实机验证，而不是盲目承诺等价。

### 推荐部署方式

为了个人用户使用方便，也为了避免公开服务被大量远程脚本下载、动态订阅刷新和重复转换请求拖慢，建议自行部署一个属于自己的转换器实例。

作者部署的公开转换器可以用于体验和临时转换，但不建议把它作为长期订阅转换服务。自部署的好处是：

- 转换请求、远程脚本下载和缓存都由自己的 Worker 承担。
- 动态订阅链接可以稳定跟随上游模块更新。
- 可以按自己的需求调整大小限制、缓存时间和速率限制。
- 避免公开服务限流或不可用时影响自己的规则更新。

### 功能

- Loon / Surge 模块、插件转换为 Anywhere MITM 规则 `.amrs`
- Loon / Surge 规则集转换为 Anywhere 路由规则 `.arrs`
- `[MITM] hostname`、`[Rule]`、`[Rewrite]`、`[Header Rewrite]`、`[Map Local]`、`[Body Rewrite]`、`[Argument]` 等常见配置转换
- 远程 `script-path` 下载、脚本合并、参数替换、兼容层包装
- 高置信度 JavaScript 原生化，例如 JSON 删除、替换、数组过滤、固定响应、静态请求改写
- 可选增强 JS 原生化模式
- Cloudflare Worker 在线 UI、API、动态订阅链接
- 浏览器端下载单个 `.amrs/.arrs` 或打包 zip，减少后续 Worker 访问

### 本地部署

本地部署适合开发、测试或临时转换。需要 Node.js 18+。

```sh
git clone https://github.com/chikacya/anywhere-converter.git
cd anywhere-converter
npm install
```

启动本地网页：

```sh
npm run dev
```

默认会启动 Wrangler 本地服务，通常地址是：

```text
http://localhost:8787/
```

本地 CLI 转换：

```sh
npm run convert -- --input path/to/module.plugin --out-dir ./out
```

转换独立规则集时，需要指定规则集类型和路由：

```sh
npm run convert -- \
  --input path/to/ad.list \
  --source-kind ruleset \
  --rule-set-routing reject \
  --out-dir ./out-ruleset
```

启用增强 JS 原生化：

```sh
npm run convert -- \
  --input path/to/module.plugin \
  --mode aggressive \
  --out-dir ./out-aggressive
```

覆盖模块参数：

```sh
npm run convert -- \
  --input path/to/module.plugin \
  --argument smzdm_enable=false
```

当远程脚本无法下载时，可以手动提供脚本文本：

```sh
npm run convert -- \
  --input path/to/module.plugin \
  --script-text 'https://example.com/script.js=/path/to/script.js' \
  --out-dir ./out
```

### Cloudflare Worker 部署

Cloudflare Worker 部署适合长期使用，可以生成在线转换页面、API 和动态订阅链接。

#### 方式一：Cloudflare Dashboard 连接 GitHub

1. Fork 或创建自己的仓库，并推送本项目代码。
2. 打开 Cloudflare Dashboard。
3. 进入 `Workers & Pages`。
4. 选择 `Create application`。
5. 选择 `Pages` 或支持 GitHub 部署的 Worker 项目入口。
6. 连接自己的 GitHub 仓库。
7. 构建命令留空或使用默认 Node 环境即可，本项目 Worker 入口是 `src/worker.mjs`。
8. 如果 Dashboard 要求 Worker 配置，请确认使用 `wrangler.toml`。
9. 部署完成后，打开 Cloudflare 分配的域名即可使用。

建议绑定 KV，用于保存快照链接：

1. 在 Cloudflare Dashboard 创建 KV namespace，例如 `CONVERTER_KV`。
2. 把 namespace 绑定到 Worker，变量名填 `CONVERTER_KV`。
3. 如果使用 `wrangler.toml`，把自己的 namespace id 填入 `kv_namespaces`。

可配置环境变量：

| 变量 | 作用 | 默认建议 |
| --- | --- | --- |
| `MAX_INPUT_BYTES` | 模块/规则集最大输入大小 | `524288` |
| `MAX_SCRIPT_BYTES` | 单个远程脚本最大大小 | `1048576` |
| `MAX_TOTAL_SCRIPT_BYTES` | 单次转换远程脚本总大小 | `5242880` |
| `FETCH_CACHE_TTL_SECONDS` | 上游模块/脚本 fetch 缓存时间 | `900` |
| `DYNAMIC_CACHE_TTL_SECONDS` | 动态订阅转换结果缓存时间 | `900` |
| `RATE_LIMIT_PER_MINUTE` | 每分钟请求限制，`0` 表示关闭 | `60` |

#### 方式二：Wrangler CLI 部署

```sh
git clone https://github.com/chikacya/anywhere-converter.git
cd anywhere-converter
npm install
npx wrangler login
```

创建 KV：

```sh
npx wrangler kv namespace create CONVERTER_KV
```

把输出的 namespace id 写入 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding = "CONVERTER_KV"
id = "your_namespace_id"
```

部署：

```sh
npm run deploy
```

部署完成后，Wrangler 会输出 Worker URL。

### 使用方法

#### 网页转换

1. 打开自己的 Worker URL。
2. 粘贴 Loon / Surge 模块内容，或填入远程模块 URL。
3. 如模块包含 `[Argument]`，点击 `读取配置` 后按需调整参数。
4. 保持 `下载并保留远程脚本` 开启，转换器会下载远程 JS 并尝试原生化。
5. 需要更激进的静态 JSON 脚本提升时，再开启 `增强 JS 原生化`。
6. 点击 `转换`。
7. 使用 `导入 Anywhere` 直接导入，或使用 `下载文件` / `下载全部` 保存到本地。

#### 动态订阅链接

URL 输入转换时，结果会优先生成 `/sub/*` 动态订阅链接。这类链接保留原始上游 URL，Worker 会在缓存过期后重新拉取上游并转换，适合需要跟随上游更新的模块。

示例：

```text
https://<worker-host>/sub/mitm.amrs?url=<module-url>
```

独立规则集示例：

```text
https://<worker-host>/sub/reject.arrs?url=<ruleset-url>&sourceKind=ruleset&ruleSetRouting=reject
```

如果你只想减轻 Worker 压力，不需要动态跟随上游更新，可以在网页转换后下载生成文件，并自行导入或托管。

#### API 转换

```sh
curl -sS https://<worker-host>/api/convert \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com/module.plugin","includeContent":false,"includeSource":true}'
```

规则集 API：

```sh
curl -sS https://<worker-host>/api/convert \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com/ad.list","sourceKind":"ruleset","ruleSetRouting":"reject","includeContent":false}'
```

### 验证

```sh
npm test
node --check src/core.mjs
node --check src/worker.mjs
node --check src/ui.mjs
node --check bin/cli.mjs
```

### 边界

- 兼容层覆盖常见 `$request`、`$response`、`$done`、`$argument`、`$persistentStore`、`$prefs`、Env helper、`$httpClient`、`$task.fetch`、`fetch` 等，但不是完整 Loon / Surge 运行时。
- protobuf / 二进制脚本会保留并标记为需要样本验证，通用转换器不会自动推断字段语义。
- 大型混合脚本、动态代码、复杂外部请求和强应用语义脚本仍可能需要人工转换。
- 手工转换产物用于验证通用转换器能力，不会被固化为逐模块硬编码输出。

## English

Anywhere-converter is a generic converter for Loon / Surge plugins, modules, JavaScript rewrites, and rule sets. It generates `.amrs` / `.arrs` files that can be imported into Anywhere.

The converter is intentionally conservative. Stable Loon / Surge features are mapped to native Anywhere rules first. Remote JavaScript is fetched by default; high-confidence JSON and request rewrite patterns are lifted to native rules, while the remaining scripts are preserved through a compatibility wrapper. Binary, protobuf, large mixed bundles, and app-specific dynamic behavior are marked as needing samples or real-device validation instead of being guessed.

### Recommended Deployment

For personal use, self-deployment is strongly recommended. The maintainer's public converter is useful for demos and occasional conversions, but it should not be treated as a long-term shared subscription service.

Self-deployment is better because:

- Your own Worker handles conversion requests and remote script fetching.
- Dynamic subscription links can follow upstream module updates reliably.
- You can control size limits, cache TTLs, and rate limits.
- Your rule updates will not depend on public service availability or throttling.

### Features

- Convert Loon / Surge modules and plugins to Anywhere MITM `.amrs`
- Convert Loon / Surge rule sets to Anywhere routing `.arrs`
- Support common sections such as `[MITM]`, `[Rule]`, `[Rewrite]`, `[Header Rewrite]`, `[Map Local]`, `[Body Rewrite]`, and `[Argument]`
- Fetch remote `script-path` files, merge scripts, substitute arguments, and wrap compatibility scripts
- Lift high-confidence JavaScript patterns into native Anywhere rules
- Optional aggressive JavaScript native-lift mode
- Cloudflare Worker UI, API, and dynamic subscription links
- Browser-side file and zip download to reduce repeated Worker hits

### Local Deployment

Local deployment is useful for development, testing, and one-off conversions. Node.js 18+ is recommended.

```sh
git clone https://github.com/chikacya/anywhere-converter.git
cd anywhere-converter
npm install
```

Start the local web UI:

```sh
npm run dev
```

The local URL is usually:

```text
http://localhost:8787/
```

Run the CLI converter:

```sh
npm run convert -- --input path/to/module.plugin --out-dir ./out
```

Convert a standalone rule set:

```sh
npm run convert -- \
  --input path/to/ad.list \
  --source-kind ruleset \
  --rule-set-routing reject \
  --out-dir ./out-ruleset
```

Enable aggressive JavaScript lifting:

```sh
npm run convert -- \
  --input path/to/module.plugin \
  --mode aggressive \
  --out-dir ./out-aggressive
```

Override module arguments:

```sh
npm run convert -- \
  --input path/to/module.plugin \
  --argument smzdm_enable=false
```

Provide trusted script text when a remote script cannot be fetched:

```sh
npm run convert -- \
  --input path/to/module.plugin \
  --script-text 'https://example.com/script.js=/path/to/script.js' \
  --out-dir ./out
```

### Cloudflare Worker Deployment

Cloudflare Worker deployment is recommended for long-term use. It provides an online UI, API endpoints, and dynamic subscription links.

#### Option 1: Cloudflare Dashboard with GitHub

1. Fork this repository or push it to your own GitHub repository.
2. Open the Cloudflare Dashboard.
3. Go to `Workers & Pages`.
4. Create a new application.
5. Connect your GitHub repository.
6. Use the project configuration from `wrangler.toml`; the Worker entry is `src/worker.mjs`.
7. Deploy and open the generated Worker URL.

KV is recommended for durable snapshot links:

1. Create a KV namespace, for example `CONVERTER_KV`.
2. Bind it to the Worker with the variable name `CONVERTER_KV`.
3. If you use `wrangler.toml`, put your namespace id under `kv_namespaces`.

Environment variables:

| Variable | Purpose | Suggested default |
| --- | --- | --- |
| `MAX_INPUT_BYTES` | Maximum module/rule-set input size | `524288` |
| `MAX_SCRIPT_BYTES` | Maximum size for one remote script | `1048576` |
| `MAX_TOTAL_SCRIPT_BYTES` | Maximum total remote script bytes per conversion | `5242880` |
| `FETCH_CACHE_TTL_SECONDS` | Upstream source/script fetch cache TTL | `900` |
| `DYNAMIC_CACHE_TTL_SECONDS` | Dynamic subscription conversion cache TTL | `900` |
| `RATE_LIMIT_PER_MINUTE` | Per-client rate limit; `0` disables it | `60` |

#### Option 2: Wrangler CLI

```sh
git clone https://github.com/chikacya/anywhere-converter.git
cd anywhere-converter
npm install
npx wrangler login
```

Create KV:

```sh
npx wrangler kv namespace create CONVERTER_KV
```

Put the namespace id into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "CONVERTER_KV"
id = "your_namespace_id"
```

Deploy:

```sh
npm run deploy
```

Wrangler will print the Worker URL after deployment.

### Usage

#### Web UI

1. Open your Worker URL.
2. Paste a Loon / Surge module, or enter a remote module URL.
3. If the module has `[Argument]`, click `读取配置` and adjust the generated form.
4. Keep `下载并保留远程脚本` enabled so remote JavaScript can be fetched and converted or preserved.
5. Enable `增强 JS 原生化` only when you want extra static JSON cleanup lifting.
6. Click `转换`.
7. Import directly into Anywhere, or download the generated files.

#### Dynamic Subscriptions

URL-based conversions prefer `/sub/*` dynamic subscription links. These links keep the original upstream URL, so the Worker can refresh and convert updated upstream content after the cache expires.

Example:

```text
https://<worker-host>/sub/mitm.amrs?url=<module-url>
```

Standalone rule-set example:

```text
https://<worker-host>/sub/reject.arrs?url=<ruleset-url>&sourceKind=ruleset&ruleSetRouting=reject
```

If you want to reduce Worker traffic and do not need automatic upstream updates, download the generated files from the web UI and import or host them yourself.

#### API

```sh
curl -sS https://<worker-host>/api/convert \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com/module.plugin","includeContent":false,"includeSource":true}'
```

Rule-set API:

```sh
curl -sS https://<worker-host>/api/convert \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com/ad.list","sourceKind":"ruleset","ruleSetRouting":"reject","includeContent":false}'
```

### Verification

```sh
npm test
node --check src/core.mjs
node --check src/worker.mjs
node --check src/ui.mjs
node --check bin/cli.mjs
```

### Limits

- The compatibility wrapper covers common Loon / Surge APIs, but it is not a full Loon / Surge runtime.
- Protobuf and binary scripts are preserved and marked as needing validation. The generic converter does not infer schema semantics.
- Large mixed bundles, dynamic code, complex external HTTP workflows, and app-specific behavior may still need manual conversion.
- Hand-converted modules are used as validation references, not as hard-coded templates for generated output.
