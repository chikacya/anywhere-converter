# JavaScript Mapping and Native Lift

以当前 Anywhere 源码和[模式说明](conversion-modes.md)为准。

## 完整脚本检查

Acorn AST 白名单检查完整程序。未知语句拒绝整个原生提升，不拆出几个 delete 后丢掉排序、条件或其他副作用。根对象赋值生成 body-json add，删除生成 delete，顺序不变。嵌套、过滤、递归、splice 和不支持的正则保持 JS。

原生 JSON 不承诺 stringify 的字节语义：大整数精度和无变更原文保留是原生行为，明确标记需验证。可用 jsLift=false 禁用 JS 提升对照；直接 rewrite 的原生映射不受影响。

## 兼容映射

| 上游能力 | 转换器行为 |
| --- | --- |
| $request / $response.body | 按需解码；binary-body-mode 提供字节副本，异常不污染原正文 |
| $done({body}) | 写回 ctx.body；响应增长超过 65,535 字节时透传 |
| $done({response}) | 请求阶段 Anywhere.respond |
| $argument / globalThis.$argument | 常量或 Anywhere.params 模板；跨子脚本恢复全局 |
| $persistentStore / $prefs / Env storage | Anywhere.store onDisk |
| $httpClient / $task.fetch / fetch | Anywhere.http.request；dispatcher 依序 await |
| TextEncoder / TextDecoder | 优先原生；缺失时 UTF-8 fallback，不模拟所有字符编码 |
| URL / URLSearchParams | 常用 HTTP(S) 子集；set/append/delete 与 href/search 联动 |
| timer | 无原生 timer 时仅零延时微任务；正延时和 interval 报错、诊断 |
| atob / btoa | base64 fallback，不承诺完整浏览器异常/Unicode 语义 |
| crypto.getRandomValues / randomUUID | Anywhere.crypto；不实现 crypto.subtle |
| $notification / $notify | no-op，非通知服务 |

URL shim 不是完整 WHATWG：credentials、IPv6、IDN authority 不支持时失败透传；路径规范化、百分号容错、迭代器等仍需样本验证。ctx URL/method/headers 只读，未经完整原生提升的 head 修改不可照搬。

## 运行成本

原脚本为静态 runner，不再重复内部 base64 和 new Function 编译。同源不同参数共享 runner，参数与执行门限独立。上游自身 eval/Function 保留并诊断。

正文型脚本只带正文适配器；Env/HTTP/Web API/动态代码带完整兼容层。字节下降不等于转换 CPU 下降：AST 检查有成本，部署后需监控真实 CPU 与配额。不会剥离 APP 库、Protobuf schema 或加密实现。

## 验证边界

2026-10-16 补充：支持 [QX Rewrite 与带规则注释的 JS](qx-compatibility.md)。响应阶段原始请求头/正文不可用，不再用响应数据替代；请求头赋值使用 delete + add 保证缺失字段也能加入；整个头对象替换需人工处理。原生操作按顺序保留，不能跨中间操作去重。

隔离 VM 不注入 URL/timer，并对照上游输出。Swift 对照直接编译当前 APP 的 MITMJSONPatch。真实网易云快照以 Node AES-ECB 解密输出验证参数控制；不宣称等同 iOS 实机。
