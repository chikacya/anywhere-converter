# Conversion Modes

2026-10-10 更新。默认 compat 使用完整脚本 AST 白名单；识别到几个操作不代表整段脚本可原生化。

## 当前策略

- Rewrite、reject、header 和 Map Local 仍优先映射 Anywhere 原生规则。
- JS 根对象直接删除、字面量赋值，所有语句均支持时才提升；赋值使用 add，保留语句顺序。
- 嵌套路径、URL 条件、数组 filter/splice、递归 walker、未知操作均保留完整 JS。大整数、格式和无变更原文方面的原生 JSON 差异会标记需验证。
- JS 正则只提升无高级语法的纯字面量全局替换；其他 flags、单次替换和替换模板保留 JS。直接 rewrite 的捕获替换仍使用 Anywhere 原生能力。
- 静态请求 URL/头变更必须通过完整 AST 检查；无法表达的请求 head 修改明确阻止，不假装生效。
- query redirect 和 URL proxy 轻量适配保留上游原始语句与条件。
- 正文型脚本带按需正文适配器；Env、HTTP、存储、动态代码或 Web API 脚本带完整兼容层。

## 旧 aggressive 参数

CLI/API/订阅仍接受 mode=aggressive，但不再开启基于类型猜测的额外提升，策略与 compat 相同，并给出诊断。UI 改为“安全 JS 原生化（自动）”。

二进制/Protobuf、定时任务和 APP 专用协议优化仍需样本及手工 Recipe，不猜字段号或删掉未理解的功能。

## 参数与输出

preserveParameters=true 输出原生参数；局部和 globalThis.$argument 均读取当前参数，每个合并子脚本独立适配。

默认 AMRS/ARRS；outputFormat=amod 尝试生成 Anywhere 2.4+ 模块。超过保守编码预算回退独立文件，不截断规则。详见 [验证报告](review-20261010.md)。

## 验证入口

```sh
npm test
node bin/verify-native-json.mjs /path/to/Anywhere
node bin/verify-local-corpus.mjs /path/to/anywhere-mitm-maintainer
```

后两项是可选本地源码对照，不包含上游 fixtures，也不联网。普通 npm test 在相邻 maintainer 快照缺失时跳过真实网易云案例，合成回归仍执行。离线通过不等于实机通过。
