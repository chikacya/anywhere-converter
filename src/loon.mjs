// Loon 3.5.1 Rewrite (978) / Script (983). Parse data, never evaluate config.
const fail = message => { throw new Error(message); };
const q = JSON.stringify;
export const isLoonV2 = text => /^(?:request|response)\s+if\b|^(?:cron|network-changed|generic)\b/.test(text);

class Parser {
  constructor(text) { this.text = text; this.i = 0; }
  space() { while (/\s/.test(this.text[this.i] || "x")) this.i++; }
  take(text) { this.space(); if (!this.text.startsWith(text, this.i)) return false; this.i += text.length; return true; }
  need(text) { if (!this.take(text)) fail(`预期 ${text}，位置 ${this.i + 1}`); }
  word() { this.space(); const m = /^[A-Za-z_][\w.-]*/.exec(this.text.slice(this.i)); if (!m) fail("缺少名称"); this.i += m[0].length; return m[0]; }
  value() {
    this.space(); const start = this.i, ch = this.text[this.i];
    if (this.take("${")) { const end = this.text.indexOf("}", this.i); if (end < 0) fail("变量未闭合"); const name = this.text.slice(this.i, end); this.i = end + 1; return { kind: "variable", name }; }
    if (ch === '"' || ch === '`') {
      this.i++; let value = "";
      while (this.i < this.text.length) {
        const c = this.text[this.i++];
        if (c === ch) {
          if (ch === '`' && this.text[this.i] === '`') { value += '`'; this.i++; continue; }
          return { kind: ch === '`' ? "literal" : "template", value };
        }
        if (c === "\\" && ch === '"') {
          const next = this.text[this.i++];
          if (next === "$" && this.text[this.i] === "{") value += "\u0000{";
          else if (Object.hasOwn({n:1,r:1,t:1,'"':1,"\\":1}, next)) value += ({n:"\n",r:"\r",t:"\t",'"':'"',"\\":"\\"})[next];
          else fail("不支持的字符串转义");
        } else value += c;
      }
      fail("字符串未闭合");
    }
    if (ch === "/") {
      this.i++; let pattern = "", escaped = false, bracket = false;
      while (this.i < this.text.length) {
        const c = this.text[this.i++];
        if (!escaped && c === "/" && !bracket) {
          const flags = /^[a-z]*/.exec(this.text.slice(this.i))[0]; this.i += flags.length;
          if (!/^(?!.*(.).*\1)[ims]*$/.test(flags)) fail("仅支持 i/m/s 正则 flags");
          pattern = pattern.replace(/\\\//g,"/");
          try { new RegExp(pattern, flags); } catch { fail("无效正则"); }
          return { kind:"regex", pattern, flags };
        }
        if (!escaped && c === "[") bracket = true;
        if (!escaped && c === "]") bracket = false;
        pattern += c; escaped = c === "\\" && !escaped;
      }
      fail("正则未闭合");
    }
    if (this.take("[")) { const values = []; if (!this.take("]")) { do { values.push(this.value()); } while (this.take(",")); this.need("]"); } return {kind:"array",values}; }
    if (this.take("{")) { const values=[]; if (!this.take("}")) { do { const v=this.value(); if(v.kind!=="variable")fail("插件对象只能引用参数"); values.push(v); } while(this.take(",")); this.need("}"); } if(!values.length||new Set(values.map(v=>v.name)).size!==values.length)fail("插件对象为空或参数重复"); return {kind:"object",values}; }
    const m=/^(true|false|null|-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?)(?![\w.])/.exec(this.text.slice(start));
    if(m){this.i+=m[0].length;const value=JSON.parse(m[0]);if(typeof value==='number'&&!Number.isFinite(value))fail("非有限数字");return {kind:"literal",value};}
    fail("无法识别的参数值，位置 "+(start+1));
  }
  atom() {
    if(this.take("(")){const node=this.condition();this.need(")");return node;}
    const left=this.value();const op=this.take("~=")?"regex":this.take("==")?"equal":fail("条件仅支持 == 或 ~=");
    const right=this.value();let capture;
    this.space();if(/^as\b/.test(this.text.slice(this.i))){this.i+=2;capture=this.word();if(op!=="regex")fail("as 仅能用于正则");}
    return {kind:"compare",left,right,op,capture};
  }
  and(){let node=this.atom();while(this.take("&&"))node={kind:"and",left:node,right:this.atom()};return node;}
  condition(){let node=this.and();while(this.take("||"))node={kind:"or",left:node,right:this.and()};return node;}
  action(){const name=this.word();this.need("(");const args=[];if(!this.take(")")){do{args.push(this.value());}while(this.take(","));this.need(")");}return {name,args};}
  end(){this.space();if(this.i<this.text.length&&!/^(?:#|\/\/)/.test(this.text.slice(this.i)))fail("多余内容，位置 "+(this.i+1));}
}

export function parseLoonV2(text, script = false) {
  if (!isLoonV2(text)) return null;
  try {
    const p=new Parser(text),phase=p.word();
    if(!["request","response"].includes(phase))return {error:"loon-trigger-unsupported",message:"Anywhere MITM 不执行 Cron、网络变化或手动任务脚本。"};
    p.need("if");const condition=p.condition();p.need("then");const actions=[p.action()];
    while(p.take("|"))actions.push(p.action());
    const options={};if(p.take("with")){do{const key=p.word();if(Object.hasOwn(options,key))fail("重复 option "+key);p.need("=");options[key]=p.value();}while(p.take(","));}
    p.end();
    if(script&&(actions.length!==1||actions[0].name!=="script"))fail("Script 只允许一个 script(...) Action");
    if(!script&&(Object.keys(options).length||actions.some(a=>a.name==="script")))fail("Rewrite 不接受 with/script");
    return {phase:phase==="request"?0:1,condition,actions,options,script};
  } catch(error){return {error:"loon-v2-invalid",message:error.message};}
}

function compares(node){return node.kind==="compare"?[node]:[...compares(node.left),...compares(node.right)];}
function mandatory(node){if(node.kind==="compare")return new Set([node]);const a=mandatory(node.left),b=mandatory(node.right);return node.kind==="and"?new Set([...a,...b]):new Set([...a].filter(x=>b.has(x)));}
function urlGuard(node){if(node.kind==="compare")return node.left.kind==="variable"&&node.left.name==="url";return node.kind==="and"?urlGuard(node.left)||urlGuard(node.right):urlGuard(node.left)&&urlGuard(node.right);}
const capturesCount=pattern=>{let count=0,bracket=false;for(let i=0;i<pattern.length;i++){if(pattern[i]==="\\"){i++;continue;}if(pattern[i]==="[")bracket=true;if(pattern[i]==="]")bracket=false;if(!bracket&&pattern[i]==="("&&(pattern[i+1]!=="?"||/^\(\?<[^=!]/.test(pattern.slice(i))))count++;}return count;};

export function bindLoon(node, definitions, values, options={}) {
  const captures=new Map(),must=mandatory(node.condition),conditions=compares(node.condition);
  for(const c of conditions)if(c.capture){
    if(node.script||captures.has(c.capture)||Object.hasOwn(definitions,c.capture))fail("非法或重复捕获名 "+c.capture);
    if(c.right.kind!=="regex")fail("动态正则不支持命名捕获");
    captures.set(c.capture,{required:must.has(c),count:capturesCount(c.right.pattern)});
  }
  const variable=name=>{
    if(name==="url")return {code:"ctx.url",type:"string",dynamic:true};
    if(name==="request.method")return {code:"ctx.method",type:"string",dynamic:true};
    if(name==="response.status"){if(!node.phase)fail("请求阶段不能读取响应状态");return {code:"ctx.status",type:"number",dynamic:true};}
    const header=/^(request|response)\.header\['([^']+)'\]$/.exec(name);
    if(header){if(header[1]==="response"&&!node.phase)fail("请求阶段不能读取响应头");if(header[1]==="request"&&node.phase)fail("Anywhere 响应阶段无法读取原始请求头，不能保留该条件");return {code:`((ctx.headers||[]).find(p=>String(p[0]).toLowerCase()===${q(header[2].toLowerCase())})||[0,null])[1]`,type:"header",dynamic:true};}
    const capture=/^([\w-]+)\.(\d+)$/.exec(name);
    if(capture&&captures.has(capture[1])){const c=captures.get(capture[1]);if(!c.required||Number(capture[2])>c.count)fail("捕获不在全部成功路径上或下标越界");return {code:`__capture(${q(capture[1])},${Number(capture[2])})`,type:"string",dynamic:true};}
    if(!Object.hasOwn(definitions,name))fail("未声明参数 ${"+name+"}");
    const definition=definitions[name],type=/switch|checkbox/.test(definition.type)?"boolean":definition.valueType==="number"||definition.type==="number"?"number":"string";
    if(definition.hasDefaultValue===false&&(values[name]==null||values[name]===""))fail("参数缺少实际值："+name+"；请先提供默认值或覆盖值");
    let value=values[name];if(value==null)value=null;
    else if(type==="number"){if(String(value).trim()===""||!Number.isFinite(Number(value)))fail("参数不是有限数字："+name);value=Number(value);}
    else if(type==="boolean")value=value===true||value==="true";
    else value=String(value);
    if(options.preserveParameters){const key=options.parameterNameMap?.[name]||name;const read=`Anywhere.params.get(${q(key)})`;return {type,dynamic:true,code:`(()=>{var v=${read};return v==null?${q(value)}:${type==="number"?'Number(v)':type==="boolean"?'String(v)==="true"':'String(v)'};})()`};}
    return {code:q(value),type,value,dynamic:false};
  };
  const value=v=>{
    if(v.kind==="variable")return variable(v.name);
    if(v.kind==="literal")return {code:q(v.value),value:v.value,type:v.value===null?"null":typeof v.value,dynamic:false};
    if(v.kind==="regex")return {code:`new RegExp(${q(v.pattern)},${q(v.flags)})`,value:v,type:"regex",dynamic:false};
    if(v.kind==="template"){
      let index=0,parts=[],dynamic=false,staticText="";
      for(const m of v.value.matchAll(/\$\{([^{}]+)\}/g)){
        const variableValue=variable(m[1]);const prefix=v.value.slice(index,m.index).replaceAll("\u0000{","${");parts.push(q(prefix),`String(${variableValue.code})`);staticText+=prefix+String(variableValue.value);dynamic ||= variableValue.dynamic;index=m.index+m[0].length;
      }
      const suffix=v.value.slice(index).replaceAll("\u0000{","${");parts.push(q(suffix));staticText+=suffix;
      return {code:parts.join("+"),value:staticText,type:"string",dynamic};
    }
    if(v.kind==="object"){
      const entries=v.values.map(v=>{if(!Object.hasOwn(definitions,v.name))fail("对象只接受插件参数");return [v.name,variable(v.name)];});
      return {code:'{'+entries.map(([k,v])=>q(k)+':'+v.code).join(',')+'}',type:"object",dynamic:entries.some(([,v])=>v.dynamic)};
    }
    fail("此处不接受数组");
  };
  const condition=n=>{
    if(n.kind!=="compare")return `(${condition(n.left)} ${n.kind==="and"?"&&":"||"} ${condition(n.right)})`;
    const left=value(n.left),right=value(n.right);
    if(n.op==="equal"&&left.type==="header"&&!["string","null"].includes(right.type))fail("Header 比较只接受 String/null");
    if(n.op==="regex"){
      if(!["regex","variable"].includes(n.right.kind))fail("~= 右侧需要正则字面量或参数变量");
      if(!["regex","string"].includes(right.type))fail("正则条件需要 Regex 或 String 参数");
      return `__match(${left.code},${right.code},${q(n.capture||"")})`;
    }
    if(left.type!==right.type&&left.type!=="header")fail("条件两侧类型不同");
    return `(${left.code}===${right.code})`;
  };
  const helper=`var __captures={};function __capture(n,i){var v=__captures[n]&&__captures[n][i];if(v===undefined)throw Error("Missing optional capture");return v;}function __match(v,r,n){if(v==null)return false;var m=(r instanceof RegExp?r:new RegExp(r)).exec(String(v));if(m&&n)__captures[n]=m;return !!m;}`;
  const expression=condition(node.condition);
  let pattern="^https?://";
  const url=conditions.filter(c=>c.left.kind==="variable"&&c.left.name==="url"&&must.has(c));
  const simple=node.condition.kind==="compare"&&url.length===1;
  if(simple){const c=url[0],v=value(c.right);if(!v.dynamic){if(c.op==="equal")pattern="^"+String(v.value).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"$";else if(c.right.kind==="regex")pattern=(c.right.flags?"(?"+c.right.flags+")":"")+c.right.pattern;else pattern=String(v.value);}}
  return {value,helper,expression,pattern,simple,url,nativeCondition:simple&&!value(url[0].right).dynamic,
    urlPatterns:conditions.filter(c=>c.left.kind==="variable"&&c.left.name==="url"&&c.right.kind==="regex").map(c=>c.right.pattern),
    guard:`(()=>{${helper}return ${expression};})()`,urlGuard:urlGuard(node.condition)};
}

export function prepareLoonScript(node,definitions,values,options={}) {
  if(node.error)return {error:node.error,message:node.message};
  try{
    const bound=bindLoon(node,definitions,values,options),action=node.actions[0];
    if(node.phase&&!bound.urlGuard)fail("Response Script 缺少必选 URL Guard");
    if(action.args.length<1||action.args.length>2)fail("script 参数数量错误");
    const path=bound.value(action.args[0]);
    if(path.type!=="string"||path.dynamic||action.args[0].kind==="template"&&/\$\{/.test(action.args[0].value))fail("脚本路径必须是固定字符串");
    if(!/^https?:\/\//.test(path.value))fail("本地/相对路径无法远程拉取，请提供 http(s) JS 地址");
    let enabled="true",timeout=20000,requiresBody=false,binary=false;
    for(const [key,raw] of Object.entries(node.options)){
      if(!["enable","tag","img_url","timeout","debug","requires_body","binary_body_mode"].includes(key))fail("未知 option "+key);
      const v=bound.value(raw);
      if(["enable","debug","requires_body","binary_body_mode"].includes(key)&&v.type!=="boolean")fail(key+" 需要 Boolean");
      if(["tag","img_url"].includes(key)&&(v.type!=="string"||v.dynamic))fail(key+" 需要固定 String");
      if(["requires_body","binary_body_mode"].includes(key)&&v.dynamic)fail(key+" 不接受变量");
      if(key==="enable")enabled=v.code;
      if(key==="timeout"){if(v.dynamic)fail("暂不保留动态 timeout，请使用固定超时");if(!Number.isFinite(Number(v.value))||Number(v.value)<=0)fail("timeout 需要正数");timeout=Number(v.value)*1000;}
      if(key==="requires_body")requiresBody=v.value;
      if(key==="binary_body_mode")binary=v.value;
    }
    const argument=action.args[1]?bound.value(action.args[1]):{code:"null",type:"null"};
    if(!["string","object","null"].includes(argument.type)||action.args[1]&&argument.type==="null")fail("$argument 需要 String 或插件对象，只有省略时才是 null");
    return {phase:node.phase,pattern:/^\(\?/.test(bound.pattern)?"^https?://":bound.pattern,path:path.value,requiresBody,binaryBodyMode:binary,timeoutMs:timeout,
      loonArgumentCode:argument.code,loonGuard:`(${enabled})&&${bound.guard}`,loonHTTP:true,loonHostPatterns:bound.urlPatterns};
  }catch(error){return {error:"loon-script-unsupported",message:error.message};}
}

function expandedActions(actions){
  return actions.flatMap(action=>{
    const arrays=action.args.filter(a=>a.kind==="array");if(!arrays.length)return [action];
    if(!/^(?:request|response)\.(?:header\.(?:add|set|del|replace)|body\.replace|json\.(?:add|delete|replace))$/.test(action.name))fail("此 Action 不接受批量数组");
    if(arrays.length!==action.args.length||!arrays[0].values.length||arrays.some(a=>a.values.length!==arrays[0].values.length||a.values.some(v=>v.kind==="array")))fail("批量参数必须为非空、等长、无嵌套的数组");
    return arrays[0].values.map((_,i)=>({name:action.name,args:action.args.map(a=>a.values[i])}));
  });
}

export function convertLoonRewrite(node,definitions,values,options={},jqMapper) {
  if(node.error)return {kind:"skip",code:node.error,message:node.message};
  try{
    const actions=expandedActions(node.actions),rules=[],runtime=[];
    const mock=actions.filter(a=>a.name==="response.body.mock");
    const b=bindLoon(mock.length?{...node,phase:0}:node,definitions,values,options);
    if(mock.length>1)fail("一条 Rewrite 只能包含一个响应 Mock");
    if(mock.length&&actions.some(a=>a.name!=="response.body.mock"&&!a.name.startsWith("response.header.")))fail("响应 Mock 只能组合响应 Header Action");
    if(mock.length&&/\$\{response\.(?:status|header)|"kind":"variable","name":"response\.(?:status|header)/.test(JSON.stringify(node)))fail("响应 Mock 不可依赖响应数据");
    let runtimePhase=mock.length?0:node.phase;
    const native=b.nativeCondition&&!mock.length;
    const arity=(a,min,max=min)=>{if(a.args.length<min||a.args.length>max)fail(a.name+" 参数数量错误");};
    const typed=(v,type)=>{const out=b.value(v);if(out.type!==type)fail("Action 参数需要 "+type);return out;};
    const fixed=(v,type)=>{const out=typed(v,type);if(out.dynamic)fail("此操作无法保留动态变量");return out.value;};
    const rule=(op,fields,phase=node.phase)=>rules.push({phase,op,pattern:b.pattern,fields});
    const script=code=>runtime.push(`try{${code}}catch(e){Anywhere.log.error("Loon Action: "+String(e));}`);
    const mime=type=>({json:"application/json",text:"text/plain",plain:"text/plain",html:"text/html",css:"text/css",javascript:"application/javascript",'text/event-stream':'text/event-stream',png:'image/png',gif:'image/gif',jpeg:'image/jpeg',tiff:'image/tiff',svg:'image/svg+xml',mp4:'video/mp4','form-data':'multipart/form-data'})[type]||fail("不支持的 Mock 类型");
    // Do not split a mixed pipeline between native header/body/script passes:
    // Anywhere groups operations by kind, unlike Loon's strict action order.
    const categories=new Set(actions.map(a=>a.name.includes('.header.')?'header':a.name.includes('.json.')?'json':a.name.includes('.body.')?'body':a.name));
    const hasDynamic=actions.some(a=>a.args.some(v=>v.kind!=="array"&&b.value(v).dynamic));
    const allNative=native&&categories.size===1&&!hasDynamic;
    if(actions.length>1&&actions.some(a=>/^(url\.replace|redirect|reject(?:_.*)?)$/.test(a.name)))fail("终止响应或 URL 修改暂不与其他 Action 组合");
    for(const a of actions){
      if(a.name==="url.replace"||a.name==="redirect"){
        arity(a,a.name==="redirect"?2:1);
        if(!b.simple||b.url.length!==1||b.url[0].op!=="regex")fail("URL 修改需要唯一必选 URL 正则，当前只支持单一 URL 条件");
        const status=a.name==="redirect"?fixed(a.args[0],"number"):0;
        if(status&&![302,307].includes(status))fail("redirect 仅支持 302/307");
        const target=a.args.at(-1);let template;
        if(/\$\d/.test(String(target.value||"")))fail("新版 URL Action 不接受 $n，请使用命名捕获 ${name.n}");
        if(target.kind==="template"){
          template=target.value.replace(/\$\{([^{}]+)\}/g,(_,name)=>{
            const capture=/^([\w-]+)\.(\d+)$/.exec(name);if(capture&&capture[1]===b.url[0].capture){b.value({kind:'variable',name});return "$"+capture[2];}
            return fixed({kind:'variable',name},'string');
          }).replaceAll('\u0000{','${');
        }else template=fixed(target,'string');
        if(!/^https?:\/\//.test(template)||template.includes('${'))fail("URL 替换目标必须是可静态确定的 http(s) URL");
        if(options.preserveParameters&&/\$\{/.test(target.value||""))fail("URL 原生修改暂不保留动态参数");
        if(status===307){script(`var u=String(ctx.url).replace(new RegExp(${q(b.url[0].right.pattern)},${q(b.url[0].right.flags)}),${q(template.replace(/\$0/g,'$$&'))});Anywhere.respond({status:307,headers:[["location",u]],body:""});`);}
        else rule(0,[status?"1":"0",template]);
        continue;
      }
      if(/^reject(?:_img|_dict|_array|_video)?$/.test(a.name)){
        arity(a,1,a.name==="reject"?2:1);const status=fixed(a.args[0],"number");
        if(!Number.isInteger(status)||status<100||status>599)fail("reject 状态码必须为 100–599 整数");
        if(a.name==="reject_video")fail("空白视频二进制契约尚未映射，请使用显式 Mock");
        if(a.name==="reject_img"){
          if(status===200&&b.nativeCondition){rule(0,["3"],0);continue;}
          runtimePhase=0;if(node.phase)fail("reject_img 仅支持请求阶段");
          script(`Anywhere.respond({status:${status},headers:[["content-type","image/gif"]],body:Anywhere.codec.base64.decode("R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==")});`);continue;
        }
        const body=a.name==="reject_dict"?'"{}"':a.name==="reject_array"?'"[]"':a.args[1]?typed(a.args[1],"string").code:'""';
        const type=a.name==="reject_dict"||a.name==="reject_array"?"application/json":"text/plain";
        runtimePhase=0;
        if(node.phase)fail("reject 仅支持请求阶段");
        script(`Anywhere.respond({status:${status},headers:[["content-type",${q(type)}]],body:Anywhere.codec.utf8.encode(${body})});`);continue;
      }
      const m=/^(request|response)\.(header|body|json)\.([a-z_]+)$/.exec(a.name);
      if(!m)fail("未知 Action "+a.name);
      const phase=m[1]==="request"?0:1,kind=m[2],method=m[3];
      if(phase!==node.phase)fail("Action 与配置阶段不一致");
      if(kind==="header"){
        if(!["add","set","del","replace"].includes(method))fail("未知 Header Action");
        arity(a,method==="del"?1:method==="replace"?3:2);
        const name=fixed(a.args[0],"string");if(!name||/[\r\n:]/.test(name))fail("非法 Header 名称");
        if(/^(content-length|transfer-encoding|connection|keep-alive|proxy-connection|upgrade|te|trailer)$/i.test(name))fail("不能直接修改 framing/hop-by-hop Header");
        if(!allNative||method==="replace"){
          if(mock.length){
            if(method==="replace")fail("响应 Mock Header 正则替换暂未映射");
            const v=method==="del"?null:typed(a.args[1],"string").code;
            runtime.push(`${method!=="add"?`__mock.headers=__mock.headers.filter(p=>p[0].toLowerCase()!==${q(name.toLowerCase())});`:''}${v?`__mock.headers.push([${q(name)},${v}]);`:''}`);continue;
          }
          fail("条件 Header、Header 正则替换或混合管道不能通过只读 ctx.headers 表达");
        }
        if(method==="del"||method==="set")rule(2,[name]);
        if(method!=="del")rule(1,[name,fixed(a.args[1],"string")]);
      }else if(kind==="json"){
        arity(a,method==="delete"||method==="jq"||method==="jq_file"?1:2);
        if(method==="jq_file")fail("不拉取插件本地 jq 资源，请提供内联 jq");
        if(method==="jq"){
          const mapped=jqMapper?.(phase,b.pattern,fixed(a.args[0],"string"));if(!mapped||Array.isArray(mapped)||mapped.op!==5)fail("jq 超出可证明的原生子集");
          if(!allNative)fail("条件 jq 暂不映射");rules.push(mapped);continue;
        }
        if(!["add","replace","delete"].includes(method))fail("未知 JSON Action");
        const path=fixed(a.args[0],"string");if(!/^[\w$-]+(?:\[\d+\]|\.[\w$-]+)*$/.test(path))fail("JSON 路径仅支持属性和非负数组下标");
        const val=method!=="delete"?b.value(a.args[1]):null;
        if(val&&!["string","number","boolean","null"].includes(val.type))fail("JSON 值类型错误");
        if(allNative){rule(5,[method,path,...(val?[JSON.stringify(val.value)]:[])]);}
        else script(`ctx.body=Anywhere.json[${q(method)}](ctx.body,${q(path)}${val?','+val.code:''});`);
      }else if(method==="replace"){
        arity(a,2);const regex=fixed(a.args[0],"regex"),replacement=typed(a.args[1],"string");
        // Use a JS replacement callback: Loon $0 is the full match, JS $& is
        // different; avoid accidentally treating literal $&/$`/$' as captures.
        if(allNative){rule(4,[(regex.flags?'(?'+regex.flags+')':'')+regex.pattern,fixed(a.args[1],"string")]);}
        else script(`var text=Anywhere.codec.utf8.decode(ctx.body);ctx.body=Anywhere.codec.utf8.encode(text.replace(new RegExp(${q(regex.pattern)},${q(regex.flags+'g')}),function(){var a=arguments;return (${replacement.code}).replace(/\\$(\\d+)/g,function(s,n){return a[Number(n)]===undefined?s:String(a[Number(n)]);});}));`);
      }else if(method==="mock"){
        arity(a,2,phase?4:3);const type=mime(fixed(a.args[0],"string")),body=typed(a.args[1],"string"),status=phase?(a.args[2]?fixed(a.args[2],"number"):200):200;
        if(!Number.isInteger(status)||status<100||status>599)fail("Mock 状态码无效");
        const binary=a.args[phase?3:2]?fixed(a.args[phase?3:2],"boolean"):false;
        const bytes=`Anywhere.codec.${binary?'base64.decode':'utf8.encode'}(${body.code})`;
        if(phase)runtime.unshift(`var __mock={status:${status},headers:[["content-type",${q(type)}]],body:${bytes}};`);
        else script(`ctx.body=${bytes};`);
        if(!phase)fail("请求 Mock 还需同步 Content-Type，当前不支持保证完整语义");
      }else fail("不支持的 Body Action 或远程/本地资源："+a.name);
    }
    if(mock.length)runtime.push('Anywhere.respond(__mock);');
    if(runtime.length){
      if(rules.length)fail("混合原生与脚本 Action 顺序无法保证");
      const needsGuard=!b.nativeCondition||hasDynamic||/^\(\?/.test(b.pattern);
      const source=`async function process(ctx){${needsGuard?b.helper+'if(!('+b.expression+'))return;':''}${runtime.join('\n')}\n}`;
      // A script dispatcher uses JS RegExp gates, which cannot carry ICU's
      // (?i) prefix. Do not strip the flags and narrow the candidate gate:
      // use a broad transport gate and keep the exact flagged condition inside.
      const scriptPattern=runtimePhase!==node.phase||/^\(\?[ims]+\)/.test(b.pattern)?'^https?://':b.pattern;
      rules.push({phase:runtimePhase,op:100,pattern:scriptPattern,fields:[options.base64(source)],scriptSource:source});
    }
    return rules.map(rule=>({...rule,loonHostPatterns:b.urlPatterns,loonV2:true}));
  }catch(error){return {kind:"skip",code:"loon-rewrite-unsupported",message:error.message};}
}
