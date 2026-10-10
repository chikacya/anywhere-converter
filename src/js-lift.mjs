import { parse } from "acorn";

export function parseScript(source) {
  try { return parse(source, { ecmaVersion: "latest", allowReturnOutsideFunction: true }); }
  catch { return null; }
}

export function liftRequestStatic(source, parsed) {
  if (parsed.phase !== 0) return [];
  const ast=parseScript(source); if(!ast)return [];
  const constants=new Map(), rules=[];let completed=false;
  const member=(n,object,key)=>n?.type==='MemberExpression'&&!n.computed&&n.object.name===object&&n.property.name===key;
  const value=n=>n?.type==='Literal'&&typeof n.value==='string'?n.value:n?.type==='Identifier'?constants.get(n.name):undefined;
  const header=n=>n?.type==='MemberExpression'&&member(n.object,'$request','headers')?(n.computed?value(n.property):n.property.name):undefined;
  const headers=n=>{
    if(n?.type!=='ObjectExpression')return false;
    for(const p of n.properties){if(p.type!=='Property'||p.computed||p.method||p.kind!=='init'||value(p.value)===undefined)return false;}
    for(const p of n.properties)rules.push({phase:0,op:3,pattern:parsed.pattern,fields:[String(p.key.name??p.key.value).toLowerCase(),value(p.value)]});return true;
  };
  for(const statement of ast.body){
    if(statement.type==='EmptyStatement')continue;if(completed)return [];
    if(statement.type==='VariableDeclaration'&&statement.kind==='const'){
      for(const d of statement.declarations){if(d.id.type!=='Identifier'||['Object','$request','$done'].includes(d.id.name)||value(d.init)===undefined)return [];constants.set(d.id.name,value(d.init));}continue;
    }
    if(statement.type!=='ExpressionStatement')return [];const e=statement.expression;
    if(e.type==='CallExpression'&&e.callee.name==='$done'&&e.arguments.length===1){
      const arg=e.arguments[0];if(arg.type==='Identifier'&&arg.name==='$request'){completed=true;continue;}
      if(arg.type!=='ObjectExpression')return [];
      for(const p of arg.properties){
        if(p.type!=='Property'||p.computed||p.kind!=='init'||p.method)return [];
        const key=p.key.name??p.key.value;
        if(key==='url'&&value(p.value)!==undefined)rules.push({phase:0,op:0,pattern:parsed.pattern,fields:['0',value(p.value)]});
        else if(key==='headers'&&headers(p.value)){}else return [];
      }
      completed=true;continue;
    }
    if(e.type==='AssignmentExpression'&&e.operator==='='){
      const name=header(e.left);if(name&&value(e.right)!==undefined){rules.push({phase:0,op:3,pattern:parsed.pattern,fields:[name.toLowerCase(),value(e.right)]});continue;}
      if(member(e.left,'$request','url')){
        if(value(e.right)!==undefined){rules.push({phase:0,op:0,pattern:parsed.pattern,fields:['0',value(e.right)]});continue;}
        const c=e.right,r=c.arguments?.[0],replacement=value(c.arguments?.[1]);
        // Only a whole-URL match identical to this rule's gate. No discarded
        // JS flags, unmatched suffix, or URL-dependent side effect.
        if(c.type==='CallExpression'&&c.callee.property?.name==='replace'&&member(c.callee.object,'$request','url')&&c.arguments.length===2&&r?.regex?.flags===''&&r.regex.pattern.replaceAll('\\/','/')===parsed.pattern.replaceAll('\\/','/')&&/\(\.\*\)\$?$/.test(r.regex.pattern)&&/^https?:\/\//.test(replacement||'')&&!/\$(?:&|`|'|\$)/.test(replacement)){
          rules.push({phase:0,op:0,pattern:parsed.pattern,fields:['0',replacement]});continue;
        }
      }
      return [];
    }
    if(e.type==='UnaryExpression'&&e.operator==='delete'&&header(e.argument)){rules.push({phase:0,op:2,pattern:parsed.pattern,fields:[header(e.argument).toLowerCase()]});continue;}
    if(e.type==='CallExpression'&&member(e.callee,'Object','assign')&&e.arguments.length===2&&member(e.arguments[0],'$request','headers')&&headers(e.arguments[1]))continue;
    return [];
  }
  return completed?rules:[];
}

// Whole-program whitelist: an unrecognized statement rejects the entire lift.
// Nested paths, filters and arbitrary guards stay in JS: their throw/no-op and
// coercion contracts differ from Foundation's total JSON operations.
export function liftResponseScript(source, parsed) {
  if (parsed.phase !== 1 || parsed.binaryBodyMode) return [];
  const ast = parseScript(source);
  if (!ast) return [];
  const replacement = liftGlobalReplace(ast, parsed);
  if (replacement.length) return replacement;
  const constants = new Map();
  let root = "";
  let completed = false;
  const rules = [];
  const member = (node, object, key) => node?.type === "MemberExpression" && !node.computed && node.object.type === "Identifier" && node.object.name === object && node.property.name === key;
  const call = (node, object, key) => node?.type === "CallExpression" && member(node.callee, object, key);
  function literal(node) {
    if (node?.type === "Identifier" && constants.has(node.name)) return constants.get(node.name);
    if (node?.type === "Literal" && !node.regex && (node.value === null || ["string", "boolean"].includes(typeof node.value) || typeof node.value === "number" && Number.isFinite(node.value))) return { value: node.value };
    if (node?.type === "UnaryExpression" && node.operator === "-" && Number.isFinite(node.argument.value)) return { value: -node.argument.value };
    if (node?.type === "ArrayExpression") {
      const values = node.elements.map(literal);
      if (values.every(Boolean)) return { value: values.map(x => x.value) };
    }
    if (node?.type === "ObjectExpression") {
      const value = Object.create(null);
      for (const p of node.properties) {
        if (p.type !== "Property" || p.computed || p.kind !== "init" || p.method) return null;
        const key = p.key.name ?? p.key.value;
        const item = literal(p.value);
        if (!item || key === "__proto__") return null;
        value[key] = item.value;
      }
      return { value };
    }
    return null;
  }
  function path(node) {
    if (node?.type !== "MemberExpression" || node.object.type !== "Identifier" || node.object.name !== root) return null;
    const key = node.computed ? node.property.type === "Literal" && node.property.value : node.property.name;
    return typeof key === "string" && !["__proto__", "length"].includes(key) && !/^\d+$/.test(key) ? "$[" + JSON.stringify(key) + "]" : null;
  }
  for (const statement of ast.body) {
    if (statement.type === "EmptyStatement") continue;
    if (completed) return [];
    if (statement.type === "VariableDeclaration") {
      for (const d of statement.declarations) {
        if (d.id.type !== "Identifier") return [];
        if (["JSON", "$response", "$done"].includes(d.id.name)) return [];
        if (call(d.init, "JSON", "parse") && d.init.arguments.length === 1 && member(d.init.arguments[0], "$response", "body") && !root) root = d.id.name;
        else {
          const value = literal(d.init);
          if (!value || statement.kind !== "const") return [];
          constants.set(d.id.name, value);
        }
      }
      continue;
    }
    if (statement.type !== "ExpressionStatement") return [];
    const e = statement.expression;
    if (e.type === "CallExpression" && e.callee.name === "$done" && e.arguments.length === 1) {
      const arg = e.arguments[0];
      const p = arg.type === "ObjectExpression" && arg.properties.length === 1 && arg.properties[0];
      if (!p || p.type !== "Property" || p.kind !== "init" || p.method || p.computed || (p.key.name ?? p.key.value) !== "body") return [];
      if (root && call(p.value, "JSON", "stringify") && p.value.arguments.length === 1 && p.value.arguments[0].name === root) { completed = true; continue; }
      // A standalone replace is lifted below; anything else remains JS.
      return [];
    }
    if (root && e.type === "UnaryExpression" && e.operator === "delete") {
      const target = path(e.argument);
      if (!target) return [];
      rules.push({ phase: 1, op: 5, pattern: parsed.pattern, fields: ["delete", target] });
      continue;
    }
    if (root && e.type === "AssignmentExpression" && e.operator === "=") {
      const target = path(e.left); const value = literal(e.right);
      if (!target || !value) return [];
      rules.push({ phase: 1, op: 5, pattern: parsed.pattern, fields: ["add", target, JSON.stringify(value.value)] });
      continue;
    }
    return [];
  }
  if (completed && rules.length) return rules;
  return liftGlobalReplace(ast, parsed);
}

function liftGlobalReplace(ast, parsed) {
  const body = ast.body.filter(x => x.type !== "EmptyStatement");
  if (body.length !== 2 || body.some(x => x.type !== "ExpressionStatement")) return [];
  const [a, done] = body.map(x => x.expression);
  const responseBody = n => n?.type === "MemberExpression" && !n.computed && n.object.name === "$response" && n.property.name === "body";
  if (a.type !== "AssignmentExpression" || a.operator !== "=" || !responseBody(a.left)) return [];
  const c = a.right;
  if (c.type !== "CallExpression" || c.callee.property?.name !== "replace" || !responseBody(c.callee.object) || c.arguments.length !== 2) return [];
  const [regex, replacement] = c.arguments;
  // Only global, plain literals: JS-only flags, replacement tokens and advanced
  // regex syntax are not assumed to be equivalent to Swift Regex.
  if (regex.type !== "Literal" || regex.regex?.flags !== "g" || replacement.type !== "Literal" || typeof replacement.value !== "string") return [];
  if (/[^A-Za-z0-9 _:\/-]/.test(regex.regex.pattern) || replacement.value.includes("$")) return [];
  if (done.type !== "CallExpression" || done.callee.name !== "$done" || done.arguments.length !== 1 || done.arguments[0].type !== "ObjectExpression") return [];
  const ps = done.arguments[0].properties;
  if (ps.length && !(ps.length === 1 && ps[0].type === "Property" && ps[0].kind === "init" && !ps[0].method && !ps[0].computed && (ps[0].key.name ?? ps[0].key.value) === "body" && responseBody(ps[0].value))) return [];
  return [{ phase: 1, op: 4, pattern: parsed.pattern, fields: [regex.regex.pattern, replacement.value] }];
}
