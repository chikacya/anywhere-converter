# 2026-10-31 fmz200 / Beta LPX 实际样本验证

上一轮主要以合成语法及历史锁定样本验证，不能据此承诺当前 LPX 全部正确。本轮区分三个来源：fmz200 当前稳定 LPX、其 `blockAdsV2.plugin` 同名规则片段，以及用户实际提供的 ifflagged/Romeo Beta LPX。三者不可互相替代。

## 用户实际七猫：可复现的转换器缺陷

源文件：[Beta/QiMaoNovel.lpx](https://github.com/ifflagged/Romeo/blob/main/Modules/Loon/fmz200/Beta/QiMaoNovel.lpx)。7 条域名路由 + 7 条带 `/i` 的 URL 条件，显式 `reject(200)`；没有 JS。源要求的是空 200，不是 fmz 稳定版裸 reject 的连接拒绝。

原转换器虽然解析了 `/i`，却在生成正文脚本的外层 URL 筛选时剥掉了旗标，使真实判断的候选范围变窄。`/v1/adv` 可以触发，`/v1/ADV`、`/adunionvideo` 这类原规则应当匹配的大小写变体却不能进入脚本。已修复为宽的传输筛选 + 内部完整原条件，保留所有 flags。不能据此声称已经证明用户实机的所有广告都由这一问题导致。

## 其他确定修复

- 小宇宙 Beta：带 `/i` 的原生 JSON 规则合并缓存 Header 时，在每个正则分支里插入 `(?i)`，输出验证器报错。现在同 flags 统一前置；不同 flags 保持独立。
- 新版 `reject_img(200)`：使用 Anywhere 原生 GIF 子模式，不再跳过。非 200 图片响应通过 `Anywhere.respond`。
- 旧显式 `reject-200`：原生空文本参数返回 21 字节 `Success from Anywhere`，不是零字节。改用小型 `Anywhere.respond`，`reject-data` 空值也不再变成默认 8 字节数据。
- 旧 `reject-dict/array`：原生文本子模式给出 text/plain，改为保留 JSON MIME 的小响应脚本。仍不包装完整上游 JS 兼容层。
- 旧裸 `reject`：没有等价 URL 断连原语，暂保留历史近似，但显式提示 sample-required。没有猜测为 404，也没有扩大到整个域名拦截。
- 小宇宙 `.data = []`：jq 会创建缺失的根字段，旧映射 replace 不会。根字段赋值改用原生 add/upsert，且 RHS 只接受有效 JSON；嵌套父路径创建仍提示需样本。

## Beta 真实文件结果

| 插件 | 已处理源项 | 跳过 | 证据与限制 |
| --- | ---: | ---: | --- |
| 七猫 | 14 | 0 | 7 路由 + 7 URL；60 个 HTTP/HTTPS、原始/大写/小写变体执行用例均返回零字节 200，正常内容 URL 不触发 |
| 起点 | 12 | 0 | 输出验证与原生解析通过 |
| 番茄 | 35 | 0 | 部分复杂 hostname wildcard 无法等价；均有诊断，不能按已处理条数承诺全部主机被覆盖 |
| 小宇宙 | 6 | 0 | 修复 flagged Header 合并；原生 JSON 操作与 jq CLI 对照 |
| 小红书 | 23 | 1 | QUIC AND 路由条件没有等价映射；12 段 Script 进入首条选择器；实际上游脚本的搜索页合成响应回归通过，复杂路径仍需实机 |
| 虎扑 | 13 | 0 | hostname 内部 wildcard 扩大为 suffix，有诊断；不承诺主机范围完全一致 |

fmz200 稳定 LPX 六例也已测试。其同名 V2 合集片段中，起点 3 行、番茄 1 行、虎扑 2 行有未转义的正则 `/`，小红书 12 条脚本使用非官方的裸 Option 引用 `enable=xhs_enable`，未按 `${xhs_enable}` 声明。这些作为上游语法问题保留诊断，不静默修复后冒充转换正确。

## 可重复验证

本地输入、资源 SHA、原始/修正产物及结果在忽略目录 `local-verification/20261031/fmz-lpx/`。不提交第三方 fixtures。

```sh
# 明确联网刷新用户这个 Beta 来源的 6 个源文件及其脚本资源
node bin/verify-fmz-lpx.mjs local-verification/20261031/fmz-lpx --download
# 使用已锁定资源离线重跑
node bin/verify-fmz-lpx.mjs local-verification/20261031/fmz-lpx
npm test
node bin/verify-native-reject.mjs
node bin/verify-native-json.mjs
node bin/verify-native-module.mjs ../../Anywhere local-verification/20261031/fmz-lpx/*-checked.amod
```

原生响应验证编译的是实际 `MITMRespondBuilder.swift`、原生操作枚举及响应类型，直接证实默认文本/数据、JSON MIME 和 GIF。JSON 验证包含 9 个 jq CLI oracle 用例，对照实际 `MITMJSONPatch.swift`。JavaScript 运行回归使用测试桩，并非真实 App 响应或流量验收。另复查历史 12 个正式插件对应上游和 53 段正式脚本语法，保持原有证据边界。

本地最终检查：178 项测试全部通过；原生模块验证覆盖原有 22 例和本轮 18 个真实/抽样产物，共 40 例，字节估算均比固定日期原生编码多 7 字节；原生 JSON 对照共 30 例，包含上述 9 例 jq oracle。Worker dry-run 通过。

未更改 Worker 配额、缓存和存储绑定；仅本地修复与 dry-run，没有部署、提交或推送。
