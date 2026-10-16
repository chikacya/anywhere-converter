# Quantumult X 兼容范围

2026-10-16。目标是转换 Rewrite / JS，不转换 QX 整份代理配置，也不运行定时任务。语法依据 [QX 官方示例](https://github.com/crossutility/Quantumult-X/blob/master/sample.conf)，不是把 `url` 当成 Loon 的 URL rewrite。

| 来源 | 输出与边界 |
| --- | --- |
| `[rewrite_local]` 或无 section Rewrite | 按规则动作转换，保留 pattern |
| `[mitm]` / `[MITM]` / 裸 hostname | 统一解析；`*.example.com, example.com` 合并为原生后缀 `example.com` |
| 部分标签通配符，如 `tnc*-*.example.com` | 后缀范围会扩大，明确警告，不生成去掉星号后的虚假主机 |
| `url 302` | 原生 302，保留 `$1/$2` 捕获模板 |
| 301/303/307/308 | 请求 responder 保留对应状态；不降级为 302 |
| `url reject-200` | 原生 200 空文本，不因 URL 像图片就换成 GIF |
| `reject-img` | 原生 tiny GIF |
| `reject-dict/array` | 小型 responder 保留 JSON Content-Type 和 `{}` / `[]` |
| 无后缀 `reject` | 明确不等价而跳过，不用 200 冒充连接拒绝 |
| `request/response-body A request/response-body B` | 原生 body-replace，保留 search/replacement |
| `jsonjq-request/response-body` | 已支持 jq 子集；本轮增加字符串 `IN(...)` 排除，使用原生 remove-where-field-in；其他 jq 明确跳过 |
| script-request/response-header/body | 使用现有下载预算、URL 去重及兼容层；ctx 不支持的 head 修改明确诊断 |
| script-echo-response / script-analyze-echo-response | 请求 responder；处理 QX status line、headers、body/bodyBytes |
| 整段 HTTP head 正则 / 资源 echo / task | 不猜映射，明确诊断 |

## 独立 JS

解析真实 JS AST 的注释，提取其中的 QX Rewrite 和 hostname。不能把注释外的代码当配置，也不能把本文件源码绑定到注释里的其他脚本。

- 远程 JS：以来源 URL 选择自己的规则，避免再次下载自己。
- 粘贴/本地 JS：仅当注释中只有一个脚本 URL 时自动绑定；多文件头可用 CLI `--source-url` 指定自身 URL。
- 没有匹配范围、阶段或关联规则时返回 `script-metadata-required`。请提供配套 rewrite，不能自动设置全域拦截。
- Loon / Surge JS 仍可通过来源插件或“脚本补全”输入；本轮不声称识别其全部注释头格式。

```sh
npm run convert -- --input sample.conf --out-dir ./out
npm run convert -- --input sample.js --source-url https://example.com/sample.js --out-dir ./out
```

## 运行时边界

QX 的 bodyBytes 使用 ArrayBuffer；`$done({bodyBytes})`、`$task.fetch` 的 bodyBytes、`$prefs.removeValueForKey` 已接入。异步依序执行，二进制不为读取 bodyBytes 而强制解码 UTF-8。

Anywhere 响应上下文只有响应头/正文。原始 `$request.headers/body/bodyBytes` 不可用：诊断后，实际读取会抛错并保留原文，不能用响应头冒充。response headers/status 修改也不能通过 ctx 生效。请求 JS 单字段赋值采用 native delete + add；完整替换未知头对象不能冒充单字段更新。

库/定时器/外部 HTTP/动态代码的既有能力限制不变。不支持的 QX 功能不会因“已包兼容层”而变为完整可用。JS 原生化继续使用完整程序白名单，保留操作顺序。

## 已验证

[本轮 review](review-20261016.md)包含 TX hostname 对照、小熊油耗真实源码行为回放、墨鱼墨迹天气与小宇宙两个来源、原生 Swift 对照和 Worker API/动态订阅验证。离线通过不等于手机去广告效果通过。
