import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import type { ClientKind, Json, JsonObject, ProfileOverrides, TransformContext, WireProtocol, WireRequest } from '../src/types.js';
import { CODEX_PROMPT_SHA256, CODEX_UPSTREAM_INSTRUCTIONS } from '../src/core/codex-prompt.js';
import { normalizeSystemDateCarriers } from '../src/core/dates.js';
import { claudeBetas, listProfiles, resolveProfile } from '../src/core/profiles.js';
import { claudeVersionSuffix, constructClaudeBillingHeader, firstAnthropicUserText } from '../src/core/billing.js';
import { ProtocolConversionError, transformRequest } from '../src/core/transform.js';
const ACCOUNT='aa68a3ca-1534-4fca-850b-bf748fc5cd07',SESSION='ed1423da-3bc1-4bde-8a30-043f1d9c378c',REQUEST='cf545dc0-a49c-41a8-98ed-19a6dc95e792',DEVICE='a'.repeat(64);
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function ctx(protocol:WireProtocol,client:ClientKind='claude-code',overrides?:ProfileOverrides):TransformContext {
 return {identity:{providerId:'provider-a',modelId:'model-a',sessionId:SESSION,requestId:REQUEST,url:'https://gateway.example/v1/messages',protocol,cwd:'E:/fixture/project'},rule:{client,...(client==='claude-code'?{profile:'claude-code/2.1.63'}:{}),overrides},accountId:ACCOUNT,deviceId:DEVICE};
}
function wire(body:JsonObject,protocol:WireProtocol):WireRequest {
 const path=protocol==='anthropic-messages'?'messages':protocol==='openai-responses'?'responses':'chat/completions';
 return {url:'https://gateway.example/prefix/v1/'+path+'?keep=1',method:'POST',headers:new Headers({authorization:'Bearer fixture-key','x-original':'keep','x-stainless-helper-method':'stream','content-length':'123'}),body};
}
function obj(v:Json|undefined):JsonObject {assert.ok(v!==null&&typeof v==='object'&&!Array.isArray(v));return v as JsonObject;}
function rows(v:Json|undefined):JsonObject[] {assert.ok(Array.isArray(v));return v.map(obj);}
function hdr(h:Headers):[string,string][] {return [...h.entries()];}
function code(c:string):(e:unknown)=>boolean {return e=>e instanceof ProtocolConversionError&&e.code===c;}
function freeze(v:Json):void {if(Array.isArray(v))v.forEach(freeze);else if(v!==null&&typeof v==='object')Object.values(v).forEach(freeze);if(v!==null&&typeof v==='object')Object.freeze(v);}
const claude=():JsonObject=>({model:'model-a',max_tokens:4096,system:[{type:'text',text:'original developer'}],messages:[{role:'user',content:'original user'}]});
const codex=():JsonObject=>({model:'model-a',instructions:'original developer',input:[{role:'user',content:'original user'}]});

test('profile inventory is pinned and explicitly not capture verified',()=>{
 const p=listProfiles();assert.equal(p.length,3);assert.equal(p[0].id,'claude-code/2.1.63-source');assert.equal(p[1].id,'claude-code/2.1.63');assert.equal(p[2].id,'codex-cli/0.107.0');assert.match(p[0].evidence,/SDK 0.74.0/);assert.equal(resolveProfile({client:'claude-code',profile:p[1].id}).evidence.kind,'reference-specification');assert.match(p[2].evidence,/not an observed full client capture/);
 p[0].version='mutation';assert.equal(listProfiles()[0].version,'2.1.63');const c=resolveProfile({client:'codex'});assert.equal(c.evidence.commit,'19f8797c0f62abecb347e817aac36d18c5fc554e');assert.equal(c.evidence.captureVerified,false);
});
test('full public Codex prompt matches exact pinned SHA256 and byte count',()=>{
 assert.equal(createHash('sha256').update(CODEX_UPSTREAM_INSTRUCTIONS).digest('hex'),CODEX_PROMPT_SHA256);assert.equal(CODEX_PROMPT_SHA256,'1b3dd697043a7f613c691a3721a450251626685b3e97ac3ad3d35ea62758a31e');assert.equal(Buffer.byteLength(CODEX_UPSTREAM_INSTRUCTIONS),7589);assert.equal(CODEX_UPSTREAM_INSTRUCTIONS.length,7563);
});
test('resolved overrides keep UA and billing versions coherent',()=>{
 const r=transformRequest(wire(claude(),'anthropic-messages'),ctx('anthropic-messages','claude-code',{version:'9.8.7',runtimeVersion:'v22.99.0',sdkVersion:'0.99.0',beta:['fixture-beta'],identity:'fixture identity'}));
 assert.equal(r.headers.get('user-agent'),'claude-cli/9.8.7 (external, cli)');assert.match(String(rows(r.body.system)[0].text),/cc_version=9\.8\.7\.[a-f0-9]{3};/);assert.equal(rows(r.body.system)[1].text,'fixture identity');assert.equal(r.headers.get('x-stainless-runtime-version'),'v22.99.0');assert.equal(r.headers.get('x-stainless-package-version'),'0.99.0');assert.equal(r.headers.get('anthropic-beta'),'fixture-beta');
});
test('unknown and cross-client profiles fail without fallback drift',()=>{
 assert.throws(()=>resolveProfile({client:'claude-code',profile:'codex-cli/0.107.0'}),/UNKNOWN_CLIENT_PROFILE/);assert.throws(()=>resolveProfile({client:'codex',profile:'missing'}),/UNKNOWN_CLIENT_PROFILE/);
});
test('none does not read throwing body or header getters',()=>{
 let read=0;const w={url:'unused',method:'POST',get body():JsonObject{read++;throw new Error('body read');},get headers():Headers{read++;throw new Error('headers read');}};
 const r=transformRequest(w,ctx('anthropic-messages','none'));assert.equal(read,0);assert.equal(r.changed,false);assert.equal(r.profile,'none');assert.equal(Object.getOwnPropertyDescriptor(r,'body')?.get,Object.getOwnPropertyDescriptor(w,'body')?.get);assert.equal(Object.getOwnPropertyDescriptor(r,'headers')?.get,Object.getOwnPropertyDescriptor(w,'headers')?.get);
});
test('none preserves wire references, URL, method and complete body/header bytes',()=>{
 const w=wire(claude(),'anthropic-messages'),b=JSON.stringify(w.body),h=hdr(w.headers),r=transformRequest(w,ctx('anthropic-messages','none'));
 assert.equal(r.body,w.body);assert.equal(r.headers,w.headers);assert.equal(r.url,w.url);assert.equal(r.method,w.method);assert.equal(JSON.stringify(r.body),b);assert.deepEqual(hdr(r.headers),h);assert.equal(r.originalProtocol,r.targetProtocol);
});
test('model mismatch also does not touch throwing getters',()=>{
 const w={url:'unused',method:'POST',get body():JsonObject{throw new Error('body read');},get headers():Headers{throw new Error('headers read');}},c=ctx('anthropic-messages');c.rule.modelIds=['other'];assert.equal(transformRequest(w,c).changed,false);
});
test('Claude native ordered billing/identity/cache and profile headers are complete',()=>{
 const w=wire(claude(),'anthropic-messages'),r=transformRequest(w,ctx('anthropic-messages')),s=rows(r.body.system);assert.equal(r.originalProtocol,'anthropic-messages');assert.equal(r.targetProtocol,'anthropic-messages');assert.equal(r.url,w.url);
 assert.match(String(s[0].text),/^x-anthropic-billing-header: cc_version=2\.1\.63\.[a-f0-9]{3}; cc_entrypoint=cli; cch=00000;$/);assert.equal(s[1].text,"You are Claude Code, Anthropic's official CLI for Claude.");assert.equal(s[2].text,'original developer');for(const b of s)assert.deepEqual(b.cache_control,{type:'ephemeral',ttl:'1h'});
 assert.equal(r.headers.get('user-agent'),'claude-cli/2.1.63 (external, cli)');assert.equal(r.headers.get('x-app'),'cli');assert.equal(r.headers.get('x-stainless-runtime'),'node');assert.equal(r.headers.get('x-stainless-runtime-version'),'v22.16.0');assert.equal(r.headers.get('x-stainless-package-version'),'0.74.0');assert.equal(r.headers.get('x-stainless-helper-method'),null);assert.equal(r.headers.get('x-claude-code-session-id'),SESSION);assert.equal(r.headers.get('x-client-request-id'),REQUEST);assert.equal(r.headers.get('content-length'),null);assert.equal(r.headers.get('authorization'),'Bearer fixture-key');
 assert.equal(obj(r.body.metadata).user_id,'user_'+DEVICE+'_account_'+ACCOUNT+'_session_'+SESSION);
});
test('active conversion never changes frozen input body or original headers',()=>{
 const b=claude();freeze(b);const w=wire(b,'anthropic-messages'),before=JSON.stringify(b),headers=hdr(w.headers),r=transformRequest(w,ctx('anthropic-messages'));assert.notEqual(r.body,w.body);assert.notEqual(r.headers,w.headers);assert.equal(JSON.stringify(b),before);assert.deepEqual(hdr(w.headers),headers);assert.equal(w.headers.get('x-stainless-helper-method'),'stream');
});
test('Claude retains every other metadata key including nested business values',()=>{
 const b=claude();b.metadata={user_id:'old',custom:{nested:['keep',42]},account_id:'business-account',session_id:'business-session',cwd:'original-cwd',source:'host'};const r=transformRequest(wire(b,'anthropic-messages'),ctx('anthropic-messages')),m=obj(r.body.metadata);for(const [k,v] of Object.entries(obj(b.metadata)))if(k!=='user_id')assert.deepEqual(m[k],v);assert.equal(obj(b.metadata).user_id,'old');
});
test('existing valid Claude account/session UUIDs are preserved and align with headers',()=>{
 const a='f42c68df-d70f-4343-84e5-3ca7b604bdb5',s='e160cccf-7795-47bd-abbb-ecf450d1693e',b=claude();b.metadata={user_id:'user_'+DEVICE+'_account_'+a+'_session_'+s};const r=transformRequest(wire(b,'anthropic-messages'),ctx('anthropic-messages'));assert.equal(obj(r.body.metadata).user_id,obj(b.metadata).user_id);assert.equal(r.headers.get('x-claude-code-session-id'),s);
});
test('JSON metadata format and explicit device/account overrides remain structured',()=>{
 const r=transformRequest(wire(claude(),'anthropic-messages'),ctx('anthropic-messages','claude-code',{metadataFormat:'json',accountId:ACCOUNT,deviceId:DEVICE}));assert.deepEqual(JSON.parse(String(obj(r.body.metadata).user_id)),{device_id:DEVICE,account_uuid:ACCOUNT,session_id:SESSION});
});
test('non-UUID host identifiers normalize to stable deterministic UUIDs',()=>{
 const c=ctx('anthropic-messages');c.identity.sessionId='dsh-session';c.identity.requestId='request';c.accountId='fixture-account';c.deviceId='fixture-device';const a=transformRequest(wire(claude(),'anthropic-messages'),c),b=transformRequest(wire(claude(),'anthropic-messages'),c);assert.match(String(a.headers.get('x-claude-code-session-id')),UUID);assert.match(String(a.headers.get('x-client-request-id')),UUID);assert.deepEqual(a.body,b.body);
});
test('system-only date normalization does not touch user text or ordinary dated prose',()=>{
 const u="Today's\u00a0date: 2026/11/25\nproxy_Search 2026-11-25",b=claude();b.system=[{type:'text',text:"The\u200bcurrent date = 2026/11/25\nRelease is 2026/11/25.\nToday's date is 2026-2-30."}];b.messages=[{role:'user',content:u}];const r=transformRequest(wire(b,'anthropic-messages'),ctx('anthropic-messages'));
 assert.equal(rows(r.body.system)[2].text,"Today's date is 2026-11-25.\nRelease is 2026/11/25.\nToday's date is 2026-2-30.");assert.deepEqual(r.body.messages,b.messages);assert.equal(rows(r.body.messages)[0].content,u);assert.equal(normalizeSystemDateCarriers('Today is 2026-1-2.'),"Today's date is 2026-01-02.");
});
test('Anthropic cache breakpoints are bounded at four and business cache keys survive',()=>{
 const b=claude();b.system=Array.from({length:20},(_,i)=>({type:'text',text:'system '+i,cache_control:{type:'ephemeral',ttl:'5m'}}));b.cache_control={type:'ephemeral'};b.tools=[{name:'proxy_Read',input_schema:{type:'object'},cache_control:{type:'ephemeral'}}];
 b.messages=[{role:'assistant',content:[{type:'tool_use',id:'c1',name:'proxy_Read',input:{cache_control:{business:true},name:'proxy_Read'},cache_control:{type:'ephemeral'}}]},{role:'user',content:[{type:'tool_result',tool_use_id:'c1',content:[{type:'text',text:'result',cache_control:{type:'ephemeral'}}],cache_control:{type:'ephemeral'}}]}];
 const r=transformRequest(wire(b,'anthropic-messages'),ctx('anthropic-messages'));assert.equal(rows(r.body.system).filter(x=>x.cache_control!==undefined).length,3);assert.equal(r.body.cache_control,undefined);assert.equal(rows(r.body.tools)[0].cache_control,undefined);const call=rows(rows(r.body.messages)[0].content)[0];assert.equal(call.cache_control,undefined);assert.deepEqual(obj(call.input).cache_control,{business:true});assert.equal(obj(call.input).name,'proxy_Read');assert.equal(rows(rows(rows(r.body.messages)[1].content)[0].content)[0].cache_control,undefined);assert.deepEqual(rows(rows(r.body.messages)[1].content)[0].cache_control,{type:'ephemeral',ttl:'1h'});
});
test('proxy rename is structural across tool definitions, choice and tool_use only',()=>{
 const b=claude();b.tools=[{name:'proxy_Search',description:'proxy_Search description',input_schema:{type:'object',properties:{proxy_Search:{type:'string'}}}}];b.tool_choice={type:'tool',name:'proxy_Search'};b.messages=[{role:'assistant',content:[{type:'tool_use',id:'c1',name:'proxy_Search',input:{name:'proxy_Search'}}]},{role:'user',content:[{type:'tool_result',tool_use_id:'c1',content:'proxy_Search result'}]},{role:'user',content:'proxy_Search user'}];
 const r=transformRequest(wire(b,'anthropic-messages'),ctx('anthropic-messages'));assert.equal(rows(r.body.tools)[0].name,'Search');assert.equal(obj(r.body.tool_choice).name,'Search');assert.equal(rows(rows(r.body.messages)[0].content)[0].name,'Search');assert.equal(r.toolNames.Search,'proxy_Search');assert.equal(rows(r.body.tools)[0].description,'proxy_Search description');assert.deepEqual(rows(rows(r.body.messages)[0].content)[0].input,{name:'proxy_Search'});assert.equal(rows(rows(r.body.messages)[1].content)[0].content,'proxy_Search result');assert.equal(rows(r.body.messages)[2].content,'proxy_Search user');
});
test('tool collisions fail before any mutation of original body or headers',()=>{
 const b=claude();b.tools=[{name:'proxy_Read',input_schema:{type:'object'}},{name:'Read',input_schema:{type:'object'}}];const w=wire(b,'anthropic-messages'),before=JSON.stringify(b),h=hdr(w.headers);assert.throws(()=>transformRequest(w,ctx('anthropic-messages')),code('TOOL_NAME_COLLISION'));assert.equal(JSON.stringify(b),before);assert.deepEqual(hdr(w.headers),h);
});
test('repeated proxy prefixes normalize idempotently and ambiguous chains collide',()=>{
 const b=claude();b.tools=[{name:'proxy_proxy_Read',input_schema:{type:'object'}}];const r=transformRequest(wire(b,'anthropic-messages'),ctx('anthropic-messages'));assert.equal(rows(r.body.tools)[0].name,'Read');assert.equal(r.toolNames.Read,'proxy_proxy_Read');b.tools=[{name:'proxy_proxy_Read',input_schema:{type:'object'}},{name:'proxy_Read',input_schema:{type:'object'}}];assert.throws(()=>transformRequest(wire(b,'anthropic-messages'),ctx('anthropic-messages')),code('TOOL_NAME_COLLISION'));
});
test('prototype-like tool names remain own values in a null-prototype reverse map',()=>{
 const b=claude();b.tools=[{name:'proxy___proto__',input_schema:{type:'object'}}];const r=transformRequest(wire(b,'anthropic-messages'),ctx('anthropic-messages'));assert.equal(r.toolNames.__proto__,'proxy___proto__');assert.equal(Object.getPrototypeOf(r.toolNames),null);
});
test('repeated Claude execution preserves originalProtocol, inverse map and one injection',()=>{
 const b:JsonObject={model:'model-a',messages:[{role:'user',content:'hello'}],tools:[{type:'function',function:{name:'proxy_Read',parameters:{type:'object'}}}]},c=ctx('openai-chat-completions'),a=transformRequest(wire(b,'openai-chat-completions'),c),r=transformRequest(a,c),third=transformRequest(r,c);assert.deepEqual(r.body,a.body);assert.deepEqual(third.body,a.body);assert.deepEqual(r.toolNames,a.toolNames);assert.equal(r.originalProtocol,'openai-chat-completions');assert.equal(r.url,a.url);assert.deepEqual(hdr(r.headers),hdr(a.headers));
});
test('serialized Claude replay does not duplicate billing or identity blocks',()=>{
 const a=transformRequest(wire(claude(),'anthropic-messages'),ctx('anthropic-messages'));const replay:WireRequest={url:a.url,method:a.method,headers:new Headers(a.headers),body:JSON.parse(JSON.stringify(a.body))};assert.deepEqual(transformRequest(replay,ctx('anthropic-messages')).body,a.body);
});
test('chat to Claude retains developer/user text, call IDs, JSON arguments and tool outputs',()=>{
 const u="Today's date: 2026/11/25 user",result='{"name":"proxy_Search","result":17}',b:JsonObject={model:'model-a',max_completion_tokens:2048,messages:[{role:'system',content:'system-original'},{role:'developer',content:[{type:'text',text:'developer-original'}]},{role:'user',content:u},{role:'assistant',content:'calling',tool_calls:[{type:'function',id:'c1',function:{name:'proxy_Search',arguments:'{"q":"proxy_Search"}'}}]},{role:'tool',tool_call_id:'c1',content:result}],tools:[{type:'function',function:{name:'proxy_Search',parameters:{type:'object'}}}],tool_choice:{type:'function',function:{name:'proxy_Search'}},metadata:{tag:'keep'}};
 const r=transformRequest(wire(b,'openai-chat-completions'),ctx('openai-chat-completions')),ms=rows(r.body.messages);assert.equal(r.body.max_tokens,2048);assert.equal(r.body.max_completion_tokens,undefined);assert.equal(r.body.input,undefined);assert.match(r.url,/\/prefix\/v1\/messages\?keep=1$/);assert.equal(rows(r.body.system)[2].text,'system-original');assert.equal(rows(r.body.system)[3].text,'developer-original');assert.equal(rows(ms[0].content)[0].text,u);assert.deepEqual(rows(ms[1].content)[1],{type:'tool_use',id:'c1',name:'Search',input:{q:'proxy_Search'}});assert.equal(rows(ms[2].content)[0].content,result);assert.equal(r.toolNames.Search,'proxy_Search');assert.equal(obj(r.body.metadata).tag,'keep');
});
test('Responses to Claude retains original instructions, developer text and function history',()=>{
 const b:JsonObject={model:'model-a',instructions:'top-original',input:[{role:'developer',content:'developer-original'},{role:'user',content:[{type:'input_text',text:'user-original'}]},{type:'function_call',call_id:'c2',name:'proxy_Read',arguments:'{"path":"a"}'},{type:'function_call_output',call_id:'c2',output:'tool-original'}],tools:[{type:'function',name:'proxy_Read',parameters:{type:'object'}}],metadata:{tag:'keep'}},r=transformRequest(wire(b,'openai-responses'),ctx('openai-responses')),ms=rows(r.body.messages);
 assert.equal(rows(r.body.system)[2].text,'top-original');assert.equal(rows(r.body.system)[3].text,'developer-original');assert.equal(r.body.instructions,undefined);assert.equal(r.body.input,undefined);assert.equal(rows(ms[0].content)[0].text,'user-original');assert.equal(rows(ms[1].content)[0].name,'Read');assert.equal(rows(ms[2].content)[0].content,'tool-original');assert.equal(obj(r.body.metadata).tag,'keep');
});
test('stateful Responses and opaque reasoning fail explicitly instead of losing history',()=>{
 assert.throws(()=>transformRequest(wire({model:'model-a',input:'hello',previous_response_id:'resp_123'},'openai-responses'),ctx('openai-responses')),code('STATEFUL_CONVERSION'));assert.throws(()=>transformRequest(wire({model:'model-a',input:[{type:'reasoning',id:'rs_opaque',encrypted_content:'opaque'}]},'openai-responses'),ctx('openai-responses')),code('NONPORTABLE_INPUT_ITEM'));
});
test('Claude JSON schema and parallel choice use only true Messages API fields',()=>{
 const b:JsonObject={model:'model-a',messages:[{role:'user',content:'json'}],response_format:{type:'json_schema',json_schema:{name:'schema',schema:{type:'object',properties:{a:{type:'string'}}},strict:true}},parallel_tool_calls:false},r=transformRequest(wire(b,'openai-chat-completions'),ctx('openai-chat-completions'));assert.equal(obj(obj(r.body.output_config).format).type,'json_schema');assert.equal(r.body.response_format,undefined);assert.equal(r.body.parallel_tool_calls,undefined);assert.equal(r.body.tool_choice,undefined);assert.equal(r.body.tools,undefined);
});
test('native Codex injects full template and retains original instructions as developer input',()=>{
 const b=codex();b.metadata={tag:'keep',source:'original-source',session_id:'original-session',cwd:'original-cwd'};const w=wire(b,'openai-responses'),r=transformRequest(w,ctx('openai-responses','codex')),list=rows(r.body.input);assert.equal(r.body.instructions,CODEX_UPSTREAM_INSTRUCTIONS);assert.equal(r.body.base_instructions,undefined);assert.equal(r.url,w.url);assert.equal(list[0].role,'developer');assert.equal(rows(list[0].content)[0].text,'original developer');assert.deepEqual(list[1],rows(b.input)[0]);assert.deepEqual(r.body.metadata,b.metadata);assert.equal(r.headers.get('originator'),'codex_cli_rs');assert.equal(r.headers.get('user-agent'),'codex_cli_rs/0.107.0 (Windows 10.0.26100; x86_64) unknown');assert.equal(r.headers.get('session_id'),SESSION);assert.equal(r.headers.get('x-stainless-helper-method'),null);assert.equal(r.headers.get('anthropic-beta'),null);assert.equal(r.headers.get('x-codex-beta-features'),'remote_compaction_v2');assert.equal(r.headers.get('x-codex-window-id'),SESSION+':0');assert.equal(r.headers.get('thread-id'),SESSION);assert.equal(r.body.prompt_cache_key,SESSION);
});
test('every stateless Codex request carries template plus stable session/source/cwd defaults',()=>{
 const c=ctx('openai-responses','codex'),a=transformRequest(wire({model:'model-a',input:'hello'},'openai-responses'),c);c.identity.requestId='next-request';const b=transformRequest(wire({model:'model-a',input:'next'},'openai-responses'),c);assert.equal(a.body.instructions,CODEX_UPSTREAM_INSTRUCTIONS);assert.equal(b.body.instructions,CODEX_UPSTREAM_INSTRUCTIONS);assert.deepEqual(obj(a.body.metadata),{session_id:SESSION,source:'codex_cli_rs',cwd:'E:/fixture/project'});assert.equal(a.body.input,'hello');assert.equal(b.body.input,'next');assert.equal(a.headers.get('session_id'),b.headers.get('session_id'));assert.equal(a.body.prompt_cache_key,SESSION);assert.equal(b.body.prompt_cache_key,SESSION);
});
test('Codex repeated execution and serialized replay do not duplicate developer input',()=>{
 const c=ctx('openai-responses','codex'),a=transformRequest(wire(codex(),'openai-responses'),c),b=transformRequest(a,c);assert.deepEqual(b.body,a.body);assert.deepEqual(hdr(b.headers),hdr(a.headers));const replay:WireRequest={url:a.url,method:a.method,headers:new Headers(a.headers),body:JSON.parse(JSON.stringify(a.body))};assert.deepEqual(transformRequest(replay,c).body,a.body);
});
test('Codex consumes internal base_instructions into developer input and never emits it',()=>{
 const r=transformRequest(wire({model:'model-a',base_instructions:'legacy-original',instructions:'top-original',input:'user-original'},'openai-responses'),ctx('openai-responses','codex')),list=rows(r.body.input);assert.equal(r.body.base_instructions,undefined);assert.equal(r.body.instructions,CODEX_UPSTREAM_INSTRUCTIONS);assert.equal(rows(list[0].content)[0].text,'top-original');assert.equal(rows(list[1].content)[0].text,'legacy-original');assert.equal(list[2].content,'user-original');
});
test('chat to Codex retains all message roles and exact function call/output text',()=>{
 const b:JsonObject={model:'model-a',max_tokens:2048,messages:[{role:'system',content:'system-original'},{role:'developer',content:'developer-original'},{role:'user',content:'user-original'},{role:'assistant',content:null,tool_calls:[{type:'function',id:'c3',function:{name:'proxy_Read',arguments:'{"path":"x"}'}}]},{role:'tool',tool_call_id:'c3',content:'tool-original'}],tools:[{type:'function',function:{name:'proxy_Read',parameters:{type:'object'}}}],metadata:{tag:'keep'}},r=transformRequest(wire(b,'openai-chat-completions'),ctx('openai-chat-completions','codex')),list=rows(r.body.input);
 assert.equal(r.originalProtocol,'openai-chat-completions');assert.equal(r.body.messages,undefined);assert.equal(r.body.max_tokens,undefined);assert.equal(r.body.max_output_tokens,2048);assert.match(r.url,/\/prefix\/v1\/responses\?keep=1$/);assert.deepEqual(list.map(x=>x.role??x.type),['developer','developer','user','function_call','function_call_output']);assert.equal(rows(list[0].content)[0].text,'system-original');assert.equal(rows(list[2].content)[0].text,'user-original');assert.equal(list[3].arguments,'{"path":"x"}');assert.equal(list[4].output,'tool-original');assert.equal(rows(r.body.tools)[0].name,'proxy_Read');assert.deepEqual(r.toolNames,{});
});
test('Claude to Codex keeps all system/user text and preserves error tool-result payload',()=>{
 const b:JsonObject={model:'model-a',max_tokens:4096,system:[{type:'text',text:'first system'},{type:'text',text:'second system'}],messages:[{role:'user',content:'user-original'},{role:'assistant',content:[{type:'text',text:'assistant-original'},{type:'tool_use',id:'c4',name:'proxy_Read',input:{q:'proxy_Read'}}]},{role:'user',content:[{type:'tool_result',tool_use_id:'c4',content:'error-original',is_error:true}]}],tools:[{name:'proxy_Read',input_schema:{type:'object'}}],tool_choice:{type:'tool',name:'proxy_Read',disable_parallel_tool_use:true},metadata:{tag:'keep'}},r=transformRequest(wire(b,'anthropic-messages'),ctx('anthropic-messages','codex')),list=rows(r.body.input);
 assert.deepEqual(rows(list[0].content).map(x=>x.text),['first system','second system']);assert.equal(list[1].content,'user-original');assert.equal(list[3].name,'proxy_Read');assert.deepEqual(JSON.parse(String(list[4].output)),{content:'error-original',is_error:true});assert.equal(r.body.system,undefined);assert.equal(r.body.messages,undefined);assert.equal(r.body.parallel_tool_calls,false);assert.deepEqual(r.body.tool_choice,{type:'function',name:'proxy_Read'});assert.equal(obj(r.body.metadata).tag,'keep');
});
test('cross-protocol user images use actual source/input_image API objects',()=>{
 const data='data:image/png;base64,aGVsbG8=',a=transformRequest(wire({model:'model-a',messages:[{role:'user',content:[{type:'text',text:'look'},{type:'image_url',image_url:{url:data}}]}]},'openai-chat-completions'),ctx('openai-chat-completions')),blocks=rows(rows(a.body.messages)[0].content);assert.equal(blocks[0].text,'look');assert.deepEqual(blocks[1],{type:'image',source:{type:'base64',media_type:'image/png',data:'aGVsbG8='}});
 const b=transformRequest(wire({model:'model-a',max_tokens:1024,messages:[{role:'user',content:[{type:'text',text:'look'},{type:'image',source:{type:'base64',media_type:'image/png',data:'aGVsbG8='}}]}]},'anthropic-messages'),ctx('anthropic-messages','codex'));assert.deepEqual(rows(rows(b.body.input)[0].content),[{type:'input_text',text:'look'},{type:'input_image',image_url:data}]);
});
test('PDF document/file conversion is structural and retains exact base64 bytes',()=>{
 const a=transformRequest(wire({model:'model-a',input:[{role:'user',content:[{type:'input_file',filename:'fixture.pdf',file_data:'data:application/pdf;base64,YWJj'}]}]},'openai-responses'),ctx('openai-responses')),doc=rows(rows(a.body.messages)[0].content)[0];assert.deepEqual(doc,{type:'document',title:'fixture.pdf',source:{type:'base64',media_type:'application/pdf',data:'YWJj'}});
 const b=transformRequest(wire({model:'model-a',max_tokens:1024,messages:[{role:'user',content:[doc]}]},'anthropic-messages'),ctx('anthropic-messages','codex'));assert.deepEqual(rows(rows(b.body.input)[0].content)[0],{type:'input_file',filename:'fixture.pdf',file_data:'data:application/pdf;base64,YWJj'});
});
test('nonportable image file IDs, signed thinking and stop controls are explicit errors',()=>{
 assert.throws(()=>transformRequest(wire({model:'model-a',input:[{role:'user',content:[{type:'input_image',file_id:'file_private'}]}]},'openai-responses'),ctx('openai-responses')),code('NONPORTABLE_FILE_ID'));assert.throws(()=>transformRequest(wire({model:'model-a',max_tokens:1024,messages:[{role:'assistant',content:[{type:'thinking',thinking:'private',signature:'signed'}]}]},'anthropic-messages'),ctx('anthropic-messages','codex')),code('NONPORTABLE_CONTENT_BLOCK'));assert.throws(()=>transformRequest(wire({model:'model-a',messages:[{role:'user',content:'hello'}],stop:['stop']},'openai-chat-completions'),ctx('openai-chat-completions','codex')),code('UNSUPPORTED_STOP'));
});
test('unknown body controls and invalid argument JSON are not silently discarded',()=>{
 assert.throws(()=>transformRequest(wire({model:'model-a',messages:[{role:'user',content:'hello'}],n:2},'openai-chat-completions'),ctx('openai-chat-completions')),code('UNSUPPORTED_BODY_FIELD'));assert.throws(()=>transformRequest(wire({model:'model-a',messages:[{role:'assistant',content:null,tool_calls:[{type:'function',id:'bad',function:{name:'Read',arguments:'[1,2]'}}]}]},'openai-chat-completions'),ctx('openai-chat-completions')),code('INVALID_TOOL_ARGUMENTS'));
});
test('URL rewriting retains configured prefix/query and rejects unrelated endpoints',()=>{
 const w=wire(claude(),'anthropic-messages');w.url='https://gateway.example/custom/v1/messages?beta=true&key=fixture';const r=transformRequest(w,ctx('anthropic-messages','codex'));assert.equal(r.url,'https://gateway.example/custom/v1/responses?key=fixture');assert.equal(w.url,'https://gateway.example/custom/v1/messages?beta=true&key=fixture');w.url='https://gateway.example/unrelated';assert.throws(()=>transformRequest(w,ctx('anthropic-messages','codex')),code('UNRECOGNIZED_API_ENDPOINT'));
});

test('parallel flags without declared tools never fabricate a Messages tool_choice',()=>{
 const r=transformRequest(wire({model:'model-a',messages:[{role:'user',content:'original'}],parallel_tool_calls:false},'openai-chat-completions'),ctx('openai-chat-completions'));assert.equal(r.body.tools,undefined);assert.equal(r.body.tool_choice,undefined);
 assert.throws(()=>transformRequest(wire({model:'model-a',messages:[{role:'user',content:'original'}],tool_choice:'required'},'openai-chat-completions'),ctx('openai-chat-completions')),code('TOOL_CHOICE_WITHOUT_TOOLS'));
});
test('service tiers use target API enum values instead of incompatible source strings',()=>{
 const a=transformRequest(wire({model:'model-a',messages:[{role:'user',content:'original'}],service_tier:'default'},'openai-chat-completions'),ctx('openai-chat-completions'));assert.equal(a.body.service_tier,'standard_only');
 const b=transformRequest(wire({model:'model-a',max_tokens:1024,messages:[{role:'user',content:'original'}],service_tier:'standard_only'},'anthropic-messages'),ctx('anthropic-messages','codex'));assert.equal(b.body.service_tier,'default');
 assert.throws(()=>transformRequest(wire({model:'model-a',messages:[{role:'user',content:'original'}],service_tier:'flex'},'openai-chat-completions'),ctx('openai-chat-completions')),code('UNSUPPORTED_SERVICE_TIER'));
});
test('nullable source metadata converts and original input retains its null value',()=>{
 const w=wire({model:'model-a',messages:[{role:'user',content:'original'}],metadata:null},'openai-chat-completions'),r=transformRequest(w,ctx('openai-chat-completions'));assert.equal(w.body.metadata,null);assert.ok(typeof obj(r.body.metadata).user_id==='string');
});
test('open-ended JSON object mode is explicit error rather than an invalid Anthropic schema',()=>{
 assert.throws(()=>transformRequest(wire({model:'model-a',messages:[{role:'user',content:'json'}],response_format:{type:'json_object'}},'openai-chat-completions'),ctx('openai-chat-completions')),code('UNSUPPORTED_RESPONSE_FORMAT'));
});

test('Unicode system date carrier spacing normalizes, invalid dates and identical user text stay exact',()=>{
 const carrier='The current date is 2026/2/3.',eol=String.fromCharCode(13,10),bad="Today's date is 2026-02-30.",b=claude();b.system=carrier+eol+bad;b.messages=[{role:'user',content:carrier+eol+bad}];const r=transformRequest(wire(b,'anthropic-messages'),ctx('anthropic-messages'));assert.equal(rows(r.body.system)[2].text,"Today's date is 2026-02-03."+eol+bad);assert.equal(rows(r.body.messages)[0].content,carrier+eol+bad);
});


test('canonical extraHeaders accept case-insensitive header names without fingerprint drift',()=>{
 const a=transformRequest(wire(claude(),'anthropic-messages'),ctx('anthropic-messages','claude-code',{extraHeaders:{'User-Agent':'claude-cli/2.1.63 (external, cli)','user-agent':'claude-cli/2.1.63 (external, cli)','x-stainless-runtime-version':'v22.16.0','x-stainless-package-version':'0.74.0','x-app':'cli','x-claude-code-session-id':SESSION,'x-client-request-id':REQUEST}}));assert.equal(a.headers.get('user-agent'),'claude-cli/2.1.63 (external, cli)');assert.match(String(rows(a.body.system)[0].text),/cc_version=2\.1\.63\.[a-f0-9]{3};/);
 const b=transformRequest(wire(codex(),'openai-responses'),ctx('openai-responses','codex',{extraHeaders:{'User-Agent':'codex_cli_rs/0.107.0 (Windows 10.0.26100; x86_64) unknown',originator:'codex_cli_rs',session_id:SESSION}}));assert.equal(b.headers.get('originator'),'codex_cli_rs');assert.equal(b.body.instructions,CODEX_UPSTREAM_INSTRUCTIONS);
});
test('structured overrides own version SDK runtime beta identity and consistent extra headers',()=>{
 const a=transformRequest(wire(claude(),'anthropic-messages'),ctx('anthropic-messages','claude-code',{version:'9.8.7',runtimeVersion:'v22.99.0',sdkVersion:'0.99.0',identity:'new identity',beta:['fixture-beta'],extraHeaders:{'user-agent':'claude-cli/9.8.7 (external, cli)','x-stainless-runtime-version':'v22.99.0','x-stainless-package-version':'0.99.0','anthropic-beta':'fixture-beta'}}));assert.equal(rows(a.body.system)[1].text,'new identity');assert.match(String(rows(a.body.system)[0].text),/cc_version=9\.8\.7\.[a-f0-9]{3};/);
 const b=transformRequest(wire(codex(),'openai-responses'),ctx('openai-responses','codex',{version:'9.8.7',originator:'fixture_cli',extraHeaders:{originator:'fixture_cli','user-agent':'fixture_cli/9.8.7 (Windows 10.0.26100; x86_64) unknown'}}));assert.equal(b.headers.get('originator'),'fixture_cli');
});
test('UA SDK runtime beta API session and entrypoint header drift fails atomically',()=>{
 const names=['user-agent','x-stainless-runtime-version','x-stainless-package-version','anthropic-beta','anthropic-version','x-stainless-runtime','x-stainless-lang','x-stainless-os','x-stainless-arch','x-stainless-retry-count','x-app','x-claude-code-session-id','x-client-request-id'];
 for(const name of names){const w=wire(claude(),'anthropic-messages'),before=JSON.stringify(w.body),headers=hdr(w.headers);assert.throws(()=>transformRequest(w,ctx('anthropic-messages','claude-code',{extraHeaders:{[name]:'profile-conflict'}})),code('INCONSISTENT_PROFILE_HEADER'));assert.equal(JSON.stringify(w.body),before);assert.deepEqual(hdr(w.headers),headers);}
 assert.throws(()=>transformRequest(wire(codex(),'openai-responses'),ctx('openai-responses','codex',{extraHeaders:{originator:'other_cli'}})),code('INCONSISTENT_PROFILE_HEADER'));
});
test('opposite-client unknown identity and removed SDK helper extraHeaders fail explicitly',()=>{
 for(const name of ['originator','session_id','openai-client','anthropic-client','x-stainless-helper-method','x-stainless-unknown'])assert.throws(()=>transformRequest(wire(claude(),'anthropic-messages'),ctx('anthropic-messages','claude-code',{extraHeaders:{[name]:'fixture'}})),code('UNSUPPORTED_IDENTITY_HEADER'));
 for(const name of ['anthropic-beta','anthropic-version','x-app','x-stainless-runtime','x-codex-unknown'])assert.throws(()=>transformRequest(wire(codex(),'openai-responses'),ctx('openai-responses','codex',{extraHeaders:{[name]:'fixture'}})),code('UNSUPPORTED_IDENTITY_HEADER'));
});
test('independent core rejects private extraHeader suffixes without reflecting values',()=>{
 for(const name of ['authorization','proxy-authorization','cookie','set-cookie','api-key','x-api-key','x-stainless-api-key','X-Stainless-ApiKey','x-stainless-api_key','x-codex-auth-token','x-stainless-secret','x-stainless-password','x-stainless-credential','x-stainless-account-id','x-stainless-device-id'])assert.throws(()=>transformRequest(wire(claude(),'anthropic-messages'),ctx('anthropic-messages','claude-code',{extraHeaders:{[name]:'private-sentinel-value'}})),e=>code('PRIVATE_OVERRIDE_HEADER')(e)&&e instanceof Error&&!e.message.includes('private-sentinel-value'));
});
test('independent extraHeaders enforce host bounds names strings and no control whitespace',()=>{
 const cases:unknown[]=[null,[],{'x-business':'v'},{'user-agent':3},{'user-agent':'line\r\nnext'},{'user-agent':' value '},Object.fromEntries(Array.from({length:65},(_,i)=>['x-stainless-n'+i,'v']))];
 for(const value of cases)assert.throws(()=>transformRequest(wire(claude(),'anthropic-messages'),ctx('anthropic-messages','claude-code',{extraHeaders:value as Record<string,string>})),code('INVALID_EXTRA_HEADERS'));
});
test('independent structured overrides validate types versions beta tokens and active client scope',()=>{
 const bad:unknown[]=[{version:'bad'},{sdkVersion:'0.bad.0'},{runtimeVersion:'node-latest'},{identity:''},{beta:['same','same']},{beta:['with,comma']},{beta:[12]},{metadataFormat:'other'},{originator:'codex-only'},{instructions:'codex-only'},{unknown:'field'}];
 for(const value of bad)assert.throws(()=>transformRequest(wire(claude(),'anthropic-messages'),ctx('anthropic-messages','claude-code',value as ProfileOverrides)),code('INVALID_PROFILE_OVERRIDES'));
 for(const value of [{identity:'claude-only'},{runtimeVersion:'v22.0.0'},{beta:[]},{metadataFormat:'legacy'},{originator:'bad space'},{instructions:''}])assert.throws(()=>transformRequest(wire(codex(),'openai-responses'),ctx('openai-responses','codex',value as ProfileOverrides)),code('INVALID_PROFILE_OVERRIDES'));
});
test('configured provider credentials remain untouched even under SDK family prefixes',()=>{
 const w=wire(claude(),'anthropic-messages');w.headers.set('x-stainless-api-key','fixture-provider-key');w.headers.set('x-codex-auth-token','fixture-provider-token');w.headers.set('cookie','fixture-provider-cookie');const r=transformRequest(w,ctx('anthropic-messages'));assert.equal(r.headers.get('authorization'),'Bearer fixture-key');assert.equal(r.headers.get('x-stainless-api-key'),'fixture-provider-key');assert.equal(r.headers.get('x-codex-auth-token'),'fixture-provider-token');assert.equal(r.headers.get('cookie'),'fixture-provider-cookie');assert.equal(r.headers.get('x-stainless-helper-method'),null);
});
test('invalid structured or private overrides fail before accessing body/header getters',()=>{
 let reads=0;const w={url:'unused',method:'POST',get body():JsonObject{reads++;throw new Error('body read');},get headers():Headers{reads++;throw new Error('header read');}};
 assert.throws(()=>transformRequest(w,ctx('anthropic-messages','claude-code',{version:'invalid'})),code('INVALID_PROFILE_OVERRIDES'));assert.throws(()=>transformRequest(w,ctx('anthropic-messages','claude-code',{extraHeaders:{'x-stainless-api-key':'sentinel'}})),code('PRIVATE_OVERRIDE_HEADER'));assert.equal(reads,0);
});
test('none and model filter also skip throwing override getters',()=>{
 let reads=0;const w={url:'unused',method:'POST',get body():JsonObject{reads++;throw new Error('body read');},get headers():Headers{reads++;throw new Error('header read');}};
 const a=ctx('anthropic-messages','none');Object.defineProperty(a.rule,'overrides',{get(){reads++;throw new Error('override read');}});assert.equal(transformRequest(w,a).changed,false);
 const b=ctx('anthropic-messages');b.rule.modelIds=['other-model'];Object.defineProperty(b.rule,'overrides',{get(){reads++;throw new Error('override read');}});assert.equal(transformRequest(w,b).changed,false);assert.equal(reads,0);
});
test('extra session UUID must match preserved source metadata identity rather than override it',()=>{
 const originalSession='8c1fdad8-0736-4a3b-b93c-93050d631941',b=claude();b.metadata={user_id:'user_'+DEVICE+'_account_'+ACCOUNT+'_session_'+originalSession,tag:'retain'};
 assert.throws(()=>transformRequest(wire(b,'anthropic-messages'),ctx('anthropic-messages','claude-code',{extraHeaders:{'x-claude-code-session-id':SESSION}})),code('INCONSISTENT_PROFILE_HEADER'));
 const r=transformRequest(wire(b,'anthropic-messages'),ctx('anthropic-messages','claude-code',{extraHeaders:{'x-claude-code-session-id':originalSession}}));assert.equal(r.headers.get('x-claude-code-session-id'),originalSession);assert.match(String(obj(r.body.metadata).user_id),new RegExp(originalSession+'$'));assert.equal(obj(r.body.metadata).tag,'retain');
});

test('persisted private account/device IDs survive Claude to Codex switching without entering Codex wire',()=>{
 const privateAccount='a1fc7b26-02dc-4d06-8050-fc63a170af1f',privateDevice='b'.repeat(64),c=ctx('anthropic-messages','claude-code',{accountId:privateAccount,deviceId:privateDevice}),w=wire(claude(),'anthropic-messages'),original=JSON.stringify(w.body);
 delete c.rule.profile;c.rule.client='codex';const stored=JSON.stringify(c.rule),r=transformRequest(w,c);assert.equal(JSON.stringify(c.rule),stored);assert.equal(c.rule.overrides?.accountId,privateAccount);assert.equal(c.rule.overrides?.deviceId,privateDevice);assert.equal(r.targetProtocol,'openai-responses');assert.equal(r.body.instructions,CODEX_UPSTREAM_INSTRUCTIONS);assert.equal(JSON.stringify(w.body),original);assert.ok(!JSON.stringify(r.body).includes(privateAccount));assert.ok(!JSON.stringify(r.body).includes(privateDevice));assert.equal(r.headers.get('x-stainless-account-id'),null);assert.equal(r.headers.get('x-stainless-device-id'),null);
 c.rule.client='claude-code';const back=transformRequest(w,c);assert.equal(obj(back.body.metadata).user_id,'user_'+privateDevice+'_account_'+privateAccount+'_session_'+SESSION);
});


// Compatibility cases above are explicit; missing profile below selects interactive SOURCE.
function sourceCtx(protocol:WireProtocol,overrides?:ProfileOverrides):TransformContext {const value=ctx(protocol,'claude-code',overrides);delete value.rule.profile;return value;}
function sourceProfile(){const p=resolveProfile({client:'claude-code'});if(p.client!=='claude-code')throw new Error('profile kind');return p;}

test('SOURCE default is interactive CLI identity, cli entrypoint and published SDK 0.74.0',()=>{
 const p=sourceProfile();assert.equal(p.id,'claude-code/2.1.63-source');assert.equal(p.mode,'source-api-key');assert.equal(p.entrypoint,'cli');assert.equal(p.identity,"You are Claude Code, Anthropic's official CLI for Claude.");assert.equal(p.sdkVersion,'0.74.0');assert.equal(p.runtimeVersion,process.version);assert.equal(p.evidence.kind,'public-source');assert.equal(p.evidence.captureVerified,false);
});
test('SOURCE headers match SDK defaults and omit unsupported session request timeout and helper extensions',()=>{
 const r=transformRequest(wire(claude(),'anthropic-messages'),sourceCtx('anthropic-messages'));assert.equal(r.headers.get('user-agent'),'claude-cli/2.1.63 (external, cli)');assert.equal(r.headers.get('x-app'),'cli');assert.equal(r.headers.get('accept'),'application/json');assert.equal(r.headers.get('anthropic-dangerous-direct-browser-access'),'true');assert.equal(r.headers.get('x-stainless-package-version'),'0.74.0');assert.equal(r.headers.get('x-stainless-runtime-version'),process.version);assert.equal(r.headers.get('x-stainless-retry-count'),'0');for(const name of ['x-stainless-timeout','x-claude-code-session-id','x-client-request-id','x-stainless-helper-method'])assert.equal(r.headers.get(name),null);assert.equal(r.headers.get('authorization'),'Bearer fixture-key');
});
test('SOURCE org cache groups main text in order with two no-ttl slots and no billing cache',()=>{
 const b=claude();b.system=[{type:'text',text:'first',cache_control:{type:'ephemeral',ttl:'1h'}},{type:'text',text:'The current date is 2026/11/25.'},{type:'text',text:'last'}];b.messages=[{role:'user',content:[{type:'text',text:'latest turn'}]}];const before=JSON.stringify(b),r=transformRequest(wire(b,'anthropic-messages'),sourceCtx('anthropic-messages')),s=rows(r.body.system);assert.equal(s.length,3);assert.equal(s[0].cache_control,undefined);assert.equal(s[1].cache_control,undefined);assert.deepEqual(s[2].cache_control,{type:'ephemeral'});assert.deepEqual(rows(rows(r.body.messages)[0].content)[0].cache_control,{type:'ephemeral'});assert.equal(s[2].text,"first\n\nToday's date is 2026-11-25.\n\nlast");assert.equal(JSON.stringify(b),before);
});
test('SOURCE account defaults empty even with context UUID while other metadata stays exact',()=>{
 const b=claude();b.metadata={tag:'keep',nested:{business:true},account_id:'business-account'};const r=transformRequest(wire(b,'anthropic-messages'),sourceCtx('anthropic-messages'));assert.equal(obj(r.body.metadata).user_id,'user_'+DEVICE+'_account__session_'+SESSION);for(const [k,v] of Object.entries(obj(b.metadata)))assert.deepEqual(obj(r.body.metadata)[k],v);assert.equal(obj(b.metadata).user_id,undefined);
});
test('SOURCE preserves an existing legacy empty-account identity and source session',()=>{
 const b=claude();b.metadata={user_id:'user_'+DEVICE+'_account__session_e160cccf-7795-47bd-abbb-ecf450d1693e'};const r=transformRequest(wire(b,'anthropic-messages'),sourceCtx('anthropic-messages'));assert.equal(obj(r.body.metadata).user_id,obj(b.metadata).user_id);
});
test('SOURCE retains supplied account UUID and accepts explicit private account override',()=>{
 const b=claude();b.metadata={user_id:'user_'+DEVICE+'_account_'+ACCOUNT+'_session_'+SESSION};assert.equal(obj(transformRequest(wire(b,'anthropic-messages'),sourceCtx('anthropic-messages')).body.metadata).user_id,obj(b.metadata).user_id);assert.equal(obj(transformRequest(wire(claude(),'anthropic-messages'),sourceCtx('anthropic-messages',{accountId:ACCOUNT})).body.metadata).user_id,obj(b.metadata).user_id);
});
test('SOURCE version suffix matches shipped golden vectors and UTF16 rather than code-point indexing',()=>{
 const c=sourceProfile().billing;for(const [input,suffix] of [['','257'],['Hi','257'],['original user','3bb'],['abcdefghijklmnopqrstuvwxyz','e4a'],['😀abcdefghijklmnopqrstuv','b31']])assert.equal(claudeVersionSuffix(input,'2.1.63',c),suffix);assert.equal(constructClaudeBillingHeader({messages:[{role:'user',content:'abcdefghijklmnopqrstuvwxyz'}]},'2.1.63','cli',c),'x-anthropic-billing-header: cc_version=2.1.63.e4a; cc_entrypoint=cli; cch=00000;');
});
test('SOURCE first-user selection samples only first direct text block and never later users or nested tool text',()=>{
 assert.equal(firstAnthropicUserText({messages:[{role:'assistant',content:'before'},{role:'user',content:[{type:'image',source:{}},{type:'text',text:'first'},{type:'text',text:'second'}]},{role:'user',content:'later'}]}),'first');assert.equal(firstAnthropicUserText({messages:[{role:'user',content:[{type:'tool_result',content:'nested'}]},{role:'user',content:'later'}]}),'');assert.equal(firstAnthropicUserText({messages:[{role:'user',content:'direct'}]}),'direct');
});
test('SOURCE emits observed cch constructor, not an invented system hash or final transport checksum',()=>{
 const a=claude(),b=claude();a.system='developer A';b.system='developer B';const aa=transformRequest(wire(a,'anthropic-messages'),sourceCtx('anthropic-messages')),bb=transformRequest(wire(b,'anthropic-messages'),sourceCtx('anthropic-messages'));assert.equal(rows(aa.body.system)[0].text,rows(bb.body.system)[0].text);assert.match(String(rows(aa.body.system)[0].text),/cc_version=2\.1\.63\.3bb; cc_entrypoint=cli; cch=00000;$/);
});
test('SOURCE beta branch follows model markers and respects complete structured beta override',()=>{
 const p=sourceProfile();assert.deepEqual(claudeBetas(p,'claude-sonnet-4-6'),['claude-code-20250219','interleaved-thinking-2025-05-14','prompt-caching-scope-2026-01-05']);assert.deepEqual(claudeBetas(p,'claude-3-5-haiku'),['prompt-caching-scope-2026-01-05','claude-code-20250219']);assert.ok(claudeBetas(p,'claude-sonnet-4-6[1m]').includes('context-1m-2025-08-07'));assert.equal(transformRequest(wire(claude(),'anthropic-messages'),sourceCtx('anthropic-messages',{beta:['fixture-beta']})).headers.get('anthropic-beta'),'fixture-beta');
});
test('SOURCE repeated native and serialized replay preserve exactly one injected prefix',()=>{
 const c=sourceCtx('anthropic-messages'),a=transformRequest(wire(claude(),'anthropic-messages'),c),w:WireRequest={url:a.url,method:a.method,headers:new Headers(a.headers),body:JSON.parse(JSON.stringify(a.body))};assert.deepEqual(transformRequest(a,c).body,a.body);assert.deepEqual(transformRequest(w,c).body,a.body);assert.deepEqual(hdr(transformRequest(w,c).headers),hdr(a.headers));assert.equal(rows(transformRequest(w,c).body.system).filter(x=>String(x.text).startsWith('x-anthropic-billing-header:')).length,1);
});
test('SOURCE chat conversion preserves all developer user and tool text and reverse proxy names',()=>{
 const user="Today's date: 2026/11/25 proxy_Read",b:JsonObject={model:'claude-sonnet-4-6',messages:[{role:'system',content:'first'},{role:'developer',content:'second'},{role:'user',content:user},{role:'assistant',content:null,tool_calls:[{type:'function',id:'c_source',function:{name:'proxy_Read',arguments:'{"name":"proxy_Read"}'}}]},{role:'tool',tool_call_id:'c_source',content:'proxy_Read result'}],tools:[{type:'function',function:{name:'proxy_Read',parameters:{type:'object'}}}],metadata:{tag:'keep'}},c=sourceCtx('openai-chat-completions'),r=transformRequest(wire(b,'openai-chat-completions'),c);assert.equal(rows(r.body.system)[2].text,'first\n\nsecond');assert.equal(rows(rows(r.body.messages)[0].content)[0].text,user);assert.equal(rows(rows(r.body.messages)[2].content)[0].content,'proxy_Read result');assert.equal(r.toolNames.Read,'proxy_Read');assert.equal(r.originalProtocol,'openai-chat-completions');assert.equal(obj(r.body.metadata).tag,'keep');assert.deepEqual(transformRequest(r,c).body,r.body);assert.deepEqual(transformRequest(r,c).toolNames,r.toolNames);
});
test('SOURCE Responses conversion preserves original instructions developer input and user text',()=>{
 const b:JsonObject={model:'claude-sonnet-4-6',instructions:'original top',input:[{role:'developer',content:'original developer'},{role:'user',content:'original user'}],metadata:{tag:'keep'}},r=transformRequest(wire(b,'openai-responses'),sourceCtx('openai-responses'));assert.equal(rows(r.body.system)[2].text,'original top\n\noriginal developer');assert.equal(rows(rows(r.body.messages)[0].content)[0].text,'original user');assert.equal(r.body.instructions,undefined);assert.equal(r.body.input,undefined);assert.equal(obj(r.body.metadata).tag,'keep');
});
test('compatibility independently keeps requested system 1h cache and UUID extensions with corrected SDK',()=>{
 const p=resolveProfile({client:'claude-code',profile:'claude-code/2.1.63'});if(p.client!=='claude-code')throw new Error('profile kind');assert.equal(p.mode,'compatibility');assert.equal(p.evidence.kind,'reference-specification');assert.equal(p.evidence.captureVerified,false);assert.equal(p.sdkVersion,'0.74.0');const r=transformRequest(wire(claude(),'anthropic-messages'),ctx('anthropic-messages'));for(const s of rows(r.body.system))assert.deepEqual(s.cache_control,{type:'ephemeral',ttl:'1h'});assert.equal(obj(r.body.metadata).user_id,'user_'+DEVICE+'_account_'+ACCOUNT+'_session_'+SESSION);assert.equal(r.headers.get('x-client-request-id'),REQUEST);assert.match(String(rows(r.body.system)[0].text),/cc_version=2\.1\.63\.3bb;.*cch=00000;/);
});
test('SOURCE compatibility switching restores original boundaries and appropriate account policy',()=>{
 const b=claude();b.system=[{type:'text',text:'first'},{type:'text',text:'second'}];const w=wire(b,'anthropic-messages'),c=sourceCtx('anthropic-messages'),a=transformRequest(w,c);assert.equal(rows(a.body.system).length,3);c.rule.profile='claude-code/2.1.63';const next=transformRequest(a,c);assert.equal(rows(next.body.system).length,4);assert.equal(rows(next.body.system)[2].text,'first');assert.equal(rows(next.body.system)[3].text,'second');assert.equal(obj(next.body.metadata).user_id,'user_'+DEVICE+'_account_'+ACCOUNT+'_session_'+SESSION);delete c.rule.profile;assert.deepEqual(transformRequest(next,c).body,a.body);assert.deepEqual(w.body,b);
});
test('SOURCE canonical extras assert coherent generated values and unsupported helper/session headers fail',()=>{
 const r=transformRequest(wire(claude(),'anthropic-messages'),sourceCtx('anthropic-messages',{extraHeaders:{'x-stainless-package-version':'0.74.0','x-stainless-runtime-version':process.version,'user-agent':'claude-cli/2.1.63 (external, cli)'}}));assert.equal(r.headers.get('x-stainless-package-version'),'0.74.0');for(const name of ['x-client-request-id','x-claude-code-session-id','x-stainless-timeout','x-stainless-helper-method'])assert.throws(()=>transformRequest(wire(claude(),'anthropic-messages'),sourceCtx('anthropic-messages',{extraHeaders:{[name]:'fixture'}})),code('UNSUPPORTED_IDENTITY_HEADER'));
});
test('SOURCE to Codex carries no Anthropic browser-access header or injected Claude instruction prefix',()=>{
 const w=wire(claude(),'anthropic-messages'),c=sourceCtx('anthropic-messages'),a=transformRequest(w,c);c.rule.client='codex';const r=transformRequest(a,c);assert.equal(r.targetProtocol,'openai-responses');assert.equal(r.headers.get('anthropic-dangerous-direct-browser-access'),null);assert.equal(r.headers.get('anthropic-beta'),null);assert.equal(r.body.instructions,CODEX_UPSTREAM_INSTRUCTIONS);assert.equal(rows(rows(r.body.input)[0].content)[0].text,'original developer');assert.ok(!JSON.stringify(r.body.input).includes('x-anthropic-billing-header:'));
});
test('SOURCE system grouping fails atomically rather than losing unmergeable block fields',()=>{
 const b=claude();b.system=[{type:'text',text:'keep',extra:{business:true}}];const w=wire(b,'anthropic-messages'),before=JSON.stringify(b),headers=hdr(w.headers);assert.throws(()=>transformRequest(w,sourceCtx('anthropic-messages')),code('UNMERGEABLE_SYSTEM_BLOCK'));assert.equal(JSON.stringify(b),before);assert.deepEqual(hdr(w.headers),headers);
});

test('other provider none remains unchanged after active provider transformation',()=>{
 const a=wire(claude(),'anthropic-messages');transformRequest(a,ctx('anthropic-messages'));const b=wire(claude(),'anthropic-messages'),c=ctx('anthropic-messages','none');c.identity.providerId='provider-b';const r=transformRequest(b,c);assert.equal(r.changed,false);assert.equal(r.body,b.body);assert.equal(r.headers,b.headers);assert.equal(b.headers.get('user-agent'),null);assert.equal(obj(a.body.metadata??{}).user_id,undefined);
});
