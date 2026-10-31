# 模块输出（2026-10-16）

依据 Anywhere `Documentations/Module.md`、`ModuleParser.swift`、`Module.swift`、`RoutingRule.swift` 与 `MITMRule.swift` 实现。

- UI、CLI、`convertAny` / `convertAnyAsync`、Worker API 默认 `auto`：插件、模块和 QX Rewrite / JS 生成 AMOD；纯规则集保持独立文件，规则集工坊继续输出 ARRS。
- 显式 `outputFormat=standalone` 保留独立 AMRS/ARRS，`amod` 可将纯规则集打包。底层 `convertModule` / `convertRuleSet` 继续生成独立文件。
- 子集原有名称、hostname、参数定义和路由初始值不变。首次导入时写入路由初始值；后续更新遵守 Anywhere 按类型和名称匹配、保留用户参数/开关/路由的逻辑。上游改名仍可能导致参数无法继承。
- 64 个子集、MITM 每集 10,000 条/256 参数、Routing 每集 100,000 条、模块图标每种 65,536 字节、模块 JSON 900,000 字节。超限回退完整独立文件，不裁剪、不自动拆为多个模块。
- 容量估算投影实际 Codable 字段，包含脚本 base64、UTF-8 和斜杠转义。规则本身不编码 UUID，路由初始分配也不进入 Module JSON。另保留 4096 字节供订阅地址、日期和普通参数覆盖使用；这不是任意长 URL/用户参数的绝对上界，最终以客户端 `validateLimits()` 为准。
- 独立动态订阅路径始终输出独立文件；新生成的回退链接显式固定 standalone，避免上游缩小后突然变成 AMOD。`/sub/module.amod` 始终尝试模块，超限返回 HTTP 422 `module_limit_exceeded`，附原因和独立文件替代链接，不缓存该错误，不返回成功的空模块。客户端保留旧模块，需要用户重新转换并导入替代链接。原有 `/sub/deeplink` 无格式参数时继续沿用独立文件，避免改变旧链接行为。
- 不增加外部请求或 DO/KV 操作；沿用转换器既有缓存、下载和频率预算。模块将相关文件合为一条订阅，打包不降低 JS 执行开销。
- UI 提示旧独立规则与模块可能同时存在，且相同条件下独立规则优先；确认模块后由用户停用重复项。不会自动删除用户规则。

本地验证：`npm test`，`node bin/verify-native-module.mjs`。后者临时编译实际 Swift 解析器与模型，对比原生 JSONEncoder 字节数，完成后清理构建文件。可在源码目录参数后追加本地 AMOD 文件进行核验。编译只为无关存储常量提供桩，不替换解析或编码逻辑。真实 iPhone 导入、订阅刷新与流量效果仍需实机验收。
