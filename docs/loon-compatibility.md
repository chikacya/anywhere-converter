# Loon 3.5.1 新旧语法兼容（2026-10-31）

依据官方 [Rewrite 新语法](https://nsloon.app/docs/Rewrite/rewrite_v2/)、[旧 Rewrite](https://nsloon.app/docs/Rewrite/)、[Script 新语法](https://nsloon.app/docs/Script/script_v2/)、[旧 Script](https://nsloon.app/docs/Script/) 和 [Script API](https://nsloon.app/docs/Script/script_api/) 核对。新版配置语法增加条件和参数类型，脚本 API 本身并未随配置语法一起替换。

实现入口是 `src/loon.mjs`，经现有 CLI、Worker API、动态订阅共用的 `convertAny` 管线输出 AMOD / AMRS；不新增请求或存储服务。定时、网络变化和手动任务没有映射为 HTTP 脚本。

## 已支持

| 内容 | 行为 |
| --- | --- |
| request / response 条件 | 解析 `==`、`~=`、`&&`、`||` 和括号；支持 i/m/s 正则，Header 空值与缺失分别处理 |
| 字符串 | 双引号模板、反引号原始字符串、转义和反引号转义；分隔符只在语法边界生效 |
| 插件参数 | `[Argument]` 的 String / Boolean、`type=number`；参数作为数据绑定，不替换整行，不二次展开 |
| 固定 URL Header 动作 | add 追加、set 删除后新增、del 删除；批量等长数组按顺序展开为原生规则 |
| JSON | add / replace / delete，固定单 URL 条件优先原生 op 5；条件/动态值使用 `Anywhere.json`，不自造另一套 JSONPath 语义 |
| Body 正则替换 | 固定单 URL 条件使用原生 op 4；动态条件用小脚本，保留 `$0`/`$n`，批量展开 |
| URL / redirect | 单一必选 URL 正则，固定目标和命名 URL 捕获转原生透明重写/302；307 用 `Anywhere.respond`，不降级为 302 |
| Reject | 请求阶段文本/JSON 对象/数组/1×1 GIF，保留指定状态和 MIME；不把所有 Reject 当空白 200 |
| 响应 Mock | 内联文本或 base64、状态码、MIME；支持组合静态响应 Header add/set/del，转换为请求阶段 `Anywhere.respond` |
| jq | 仅复用可确认的原生 jq 子集，不能识别的表达式明确跳过 |
| Script | `script(path[, argument]) with ...`，远程 JS 走既有下载与大小预算；省略 argument 是 null，字符串和插件对象保留类型 |
| Script 条件与选择 | Response 必须有必选 URL Guard；每个阶段按原顺序选择首条完整命中项，支持 fallback 和与旧 HTTP Script 混用 |
| Script 属性 | 固定 timeout、requires_body、binary_body_mode；enable 可绑定并保留 Boolean 参数；tag/img_url/debug 校验类型但不生成 Loon UI/日志开关 |
| 参数保留 | Script 对象参数、字符串模板、enable 和可映射正文动作通过 `Anywhere.params` 读取；没有参数也可保留原生 Header 动作 |
| 旧语法 | 原 Rewrite / Surge / QX 管线保留；补齐旧 Loon 批量 header-add/header-replace/header-del，兼容 enabled 属性；旧 JSON/jq 仍用原有处理器 |

## 明确边界

- 响应阶段无法从 Anywhere 获取原始请求 Header。遇到这种条件会拒绝整行，不能删掉条件或把响应 Header 冒充请求 Header。
- 条件 Header 修改、Header 正则局部替换，以及需要脚本回写 Header 的混合管道暂不支持；`ctx.headers` 只读。framing/hop-by-hop Header 修改也不开放。
- URL Action 的额外条件、动态保留参数、可选 OR 捕获、越界捕获、终止动作与其他 Action 组合不强行映射。使用新 URL Action 时不接受旧 `$n` 引用。
- `mock_file` / `jq_file`、本地/相对脚本路径、空白视频 Reject、请求 Mock 暂不扩展；会显示原因，既有 Map Local 文件下载保持原能力。
- 旧裸 `reject` 的连接拒绝语义没有等价 URL 操作，保留历史 200 默认响应近似并明确标记 sample-required；不扩大为整个域名拦截。显式 `reject-200` 必须用 `Anywhere.respond` 保持零字节正文，因为原生空文本/数据子模式会生成默认正文；`reject-dict/array` 同样用小脚本保留 JSON MIME。
- 动态 timeout 暂不保留。即使配置了固定 timeout，执行仍受 Anywhere 的原生 HTTP/脚本预算约束，不能凭一个 Loon 参数扩大宿主预算。
- 仅用于对象参数的缺省 null、动态 Option 缺值回退尚未完整模拟。缺少实际值时明确提示提供默认值/覆盖值，不把它猜成空串或 0。
- Loon 与 Anywhere 的 Rewrite/Script 禁用关系、原始响应条件快照，以及不同原生操作类别的执行分组并不完全相同。混合新版 Script 和 Rewrite 时标记 sample-required；单条无法保留 Action 顺序的配置整行拒绝，已能用一个正文脚本顺序执行的动作管道不拆成不同阶段。
- 单独的旧模块仍沿用已有兼容行为；本轮没有把所有历史旧 Script 的多条执行行为改成新选择器，以免扩大回归范围。出现新版 HTTP Script 的模块才统一使用首条命中选择器。

这些是转换器可映射子集，不是对 Loon 新语法的完整实现。输出能解析不等于真实 App 功能已验证。

## 验证

`test/loon.test.mjs` 覆盖语法边界、参数注入与单次展开、批量顺序、原生规则、条件执行、Mock 状态和正文、捕获、参数类型、fallback、enabled、大小写和 Header null/空串、Worker 远程下载，以及不能表达的能力拒绝整行。沿用完整历史回归。

本地示例和原生 Swift 解析/编码对照位于忽略目录 `local-verification/20261031/loon/`，不上传第三方远程脚本或新增 fixtures。真实 iPhone / Loon 对照和生产 Worker 部署不属于本轮已验证结果。

脚本外层筛选保留 `/i` 语义；原生 Header 合并时，同 flags 统一前置，不同 flags 不强行合并。
