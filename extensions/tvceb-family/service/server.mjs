import http from 'node:http';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes, timingSafeEqual, createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export const PREFIX='/api/extensions/tvceb-family';
export const isParent=user=>user?.role==='admin'||['dad','mom','parent'].includes(user?.family_role);
class HttpError extends Error {constructor(status,message){super(message);this.status=status;}}
const fail=(status,message)=>{throw new HttpError(status,message);};
const cookieValue=(raw,name)=>String(raw||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'';
export function openStore(file=':memory:'){
  const db=new DatabaseSync(file);db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS articles (id INTEGER PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','published','archived')),author_id INTEGER NOT NULL,version INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL);`);
  return db;
}
const defaultSettings={services:{photos:'',photoprism:'',vaultwarden:'',homeassistant:''},knowledgebaseEditing:'everyone',whatsappGroupName:'TVceb Family',whatsappInviteUrl:''};
export function validateSettings(input){
  if(!input||typeof input!=='object'||Array.isArray(input))fail(400,'Invalid family settings.');
  const result=structuredClone(defaultSettings);
  if(input.knowledgebaseEditing!==undefined&&!['everyone','parents'].includes(input.knowledgebaseEditing))fail(400,'Choose who can edit articles.');
  result.knowledgebaseEditing=input.knowledgebaseEditing||'everyone';
  for(const name of Object.keys(result.services)){
    const value=String(input.services?.[name]||'').trim();if(!value)continue;
    let url;try{url=new URL(value);}catch{fail(400,'Enter a complete service URL.');}
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.hash||url.search)fail(400,'Service URLs cannot contain credentials, query strings or fragments.');
    if(url.protocol==='http:'&&!/^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(url.hostname))fail(400,'Use HTTPS except for a private LAN address.');
    result.services[name]=url.href;
  }
  result.whatsappGroupName=String(input.whatsappGroupName||'TVceb Family').trim().slice(0,100);
  if(input.whatsappInviteUrl){let url;try{url=new URL(input.whatsappInviteUrl);}catch{fail(400,'Invalid WhatsApp group invite.');}
    if(url.origin!=='https://chat.whatsapp.com'||url.username||url.password||!/^\/[A-Za-z0-9_-]+$/.test(url.pathname)||url.search||url.hash)fail(400,'Use an official WhatsApp group invite URL.');
    result.whatsappInviteUrl=url.href;
  }
  return result;
}
export function createHandler({db,coreUrl,publicOrigin,fetcher=fetch,initialSettings=defaultSettings,secure=true,cacheMs=2000}){
  const origin=new URL(publicOrigin).origin,identities=new Map();
  if(secure&&!origin.startsWith('https://'))throw Error('The family portal must use HTTPS.');
  const getSettings=()=>db.prepare('SELECT value FROM settings WHERE id=1').get()?.value;
  if(!getSettings())db.prepare('INSERT INTO settings VALUES (1,?)').run(JSON.stringify(validateSettings(initialSettings)));
  async function identity(raw){
    const cookie=String(raw||'').split(';').map(x=>x.trim()).filter(x=>/^(yuvomi|oikos)\.sid=/.test(x)).join('; ');
    if(!cookie||cookie.length>4096)fail(401,'Sign in to the family portal.');
    const key=createHash('sha256').update(cookie).digest('hex');const cached=identities.get(key);if(cached&&cached.until>Date.now())return cached.value;
    const opts={headers:{cookie},redirect:'error',signal:AbortSignal.timeout(5000)};
    const meResponse=await fetcher(new URL('/api/v1/auth/me',coreUrl),opts);if(!meResponse.ok)fail(meResponse.status===401?401:503,'Cannot verify the portal session.');
    const me=await meResponse.json();if(!Number.isSafeInteger(me.user?.id)||me.user.access_scope&&me.user.access_scope!=='family')fail(403,'A family account is required.');
    const registered=await fetcher(new URL('/api/v1/modules',coreUrl),opts);if(!registered.ok)fail(503,'Cannot check the enabled family modules.');
    const modules=(await registered.json()).data;
    if(!Array.isArray(modules)||!modules.some(m=>m.id==='tvceb-family'&&m.enabled&&!m.error))fail(403,'Family home is disabled.');
    me.enabled=new Set(modules.filter(m=>m.enabled&&!m.error).map(m=>m.id));
    if(identities.size>=256)identities.delete(identities.keys().next().value);
    identities.set(key,{value:me,until:Date.now()+cacheMs});return me;
  }
  const access=(me,id)=>me.user.role==='admin'?'write':me.permissions?.modules?.['ext:'+id]||'none';
  async function jsonBody(req){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>40000)fail(413,'Article is too large.');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{fail(400,'Invalid JSON.');}}
  return async(req,res)=>{
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
    res.setHeader('Cache-Control','no-store, private');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cross-Origin-Resource-Policy','same-origin');
    try{
      const url=new URL(req.url,'http://sidecar');if(url.pathname==='/health'&&req.method==='GET')return send(200,{ok:true});
      if(!url.pathname.startsWith(PREFIX+'/'))fail(404,'Not found.');
      const me=await identity(req.headers.cookie);if(access(me,'tvceb-family')==='none')fail(403,'Family home is unavailable for this account.');
      const parent=isParent(me.user),admin=me.user.role==='admin',route=url.pathname.slice(PREFIX.length);
      if(!['GET','POST','PATCH','PUT'].includes(req.method))fail(405,'Method not allowed.');
      if(req.method!=='GET'){
        if(req.headers.origin!==origin)fail(403,'The request must come from the family portal.');
        const a=cookieValue(req.headers.cookie,'tvceb_family_csrf'),b=String(req.headers['x-family-csrf']||'');
        if(!/^[a-f0-9]{64}$/.test(a)||a.length!==b.length||!timingSafeEqual(Buffer.from(a),Buffer.from(b)))fail(403,'Refresh the page before saving.');
      }
      if(route==='/context'&&req.method==='GET'){
        const existing=cookieValue(req.headers.cookie,'tvceb_family_csrf'),token=/^[a-f0-9]{64}$/.test(existing)?existing:randomBytes(32).toString('hex');res.setHeader('Set-Cookie',`tvceb_family_csrf=${token}; Path=${PREFIX}/; SameSite=Strict${secure?'; Secure':''}`);
        const canMessages=me.enabled.has('tvceb-whatsapp')&&access(me,'tvceb-whatsapp')!=='none';
        const settings=JSON.parse(getSettings());if(!canMessages&&!admin){settings.whatsappInviteUrl='';settings.whatsappGroupName='';}
        const write=me.enabled.has('tvceb-knowledgebase')&&access(me,'tvceb-knowledgebase')==='write';
        return send(200,{user:{id:me.user.id,role:me.user.role,family_role:me.user.family_role},availableModules:[...me.enabled],canEdit:write&&(parent||settings.knowledgebaseEditing==='everyone'),canPublish:write&&parent,canSubmit:write,canMessages,settings,csrf:token});
      }
      if(route==='/settings'){
        if(!admin)fail(403,'Only the system administrator can configure family services.');
        if(req.method==='GET')return send(200,{data:JSON.parse(getSettings())});
        if(req.method!=='PUT')fail(405,'Method not allowed.');
        const value=validateSettings(await jsonBody(req));db.prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify(value));return send(200,{data:value});
      }
      if(!me.enabled.has('tvceb-knowledgebase')||access(me,'tvceb-knowledgebase')==='none')fail(403,'Knowledgebase access is disabled.');
      const canWrite=access(me,'tvceb-knowledgebase')==='write';
      if(route==='/articles'&&req.method==='GET')return send(200,{data:db.prepare("SELECT id,title,status,author_id,version,updated_at FROM articles WHERE ? OR status='published' OR (author_id=? AND status='pending') ORDER BY updated_at DESC,id DESC").all(parent?1:0,me.user.id)});
      const match=route.match(/^\/articles\/([1-9][0-9]*)$/);
      if(match&&req.method==='GET'){
        const row=db.prepare('SELECT * FROM articles WHERE id=?').get(Number(match[1]));
        if(!row||!parent&&row.status!=='published'&&!(row.status==='pending'&&row.author_id===me.user.id))fail(404,'Article not found.');return send(200,{data:row});
      }
      if(route==='/articles'&&req.method==='POST'||match&&req.method==='PATCH'){
        if(!canWrite)fail(403,'This account has read-only access.');
        const existing=match?db.prepare('SELECT * FROM articles WHERE id=?').get(Number(match[1])):null;
        if(match&&!existing)fail(404,'Article not found.');
        if(match&&!parent){
          if(existing.status!=='published'&&!(existing.status==='pending'&&existing.author_id===me.user.id))fail(404,'Article not found.');
          if(JSON.parse(getSettings()).knowledgebaseEditing!=='everyone')fail(403,'Parents edit and publish articles.');
        }
        const body=await jsonBody(req);if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'Invalid article.');
        const title=String(body.title||'').trim(),content=String(body.body||'').trim();
        if(!title||title.length>180||!content||content.length>20000)fail(400,'Enter a title and article text within the size limits.');
        const status=parent?body.status||'pending':existing?.status||'pending';if(!['pending','published','archived'].includes(status))fail(400,'Invalid article status.');
        const now=new Date().toISOString();let id;
        if(match){if(!Number.isSafeInteger(body.version)||body.version<1)fail(400,'Reload the article before editing.');id=Number(match[1]);const result=db.prepare('UPDATE articles SET title=?,body=?,status=?,updated_at=?,version=version+1 WHERE id=? AND version=?').run(title,content,status,now,id,body.version);if(!result.changes)fail(409,'This article changed. Reload it before saving.');}
        else id=Number(db.prepare('INSERT INTO articles(title,body,status,author_id,updated_at) VALUES(?,?,?,?,?)').run(title,content,status,me.user.id,now).lastInsertRowid);
        return send(match?200:201,{data:db.prepare('SELECT * FROM articles WHERE id=?').get(id)});
      }
      fail(404,'Not found.');
    }catch(error){send(error instanceof HttpError?error.status:503,{error:error instanceof HttpError?error.message:'The family service is temporarily unavailable.'});}
  };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  fs.mkdirSync('/data',{recursive:true});
  const initial=process.env.FAMILY_SERVICE_CONFIG_FILE?JSON.parse(fs.readFileSync(process.env.FAMILY_SERVICE_CONFIG_FILE,'utf8')):defaultSettings;
  const db=openStore(process.env.FAMILY_DB_PATH||'/data/family-hub.sqlite');
  const server=http.createServer(createHandler({db,coreUrl:process.env.YUVOMI_INTERNAL_URL||'http://tvceb:3000',publicOrigin:process.env.FAMILY_PUBLIC_ORIGIN,initialSettings:initial}));
  server.requestTimeout=15000;server.headersTimeout=10000;server.listen(3030,'0.0.0.0');
  const stop=()=>server.close(()=>{db.close();process.exitCode=0;});process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
