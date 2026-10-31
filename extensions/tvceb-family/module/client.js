const PREFIX='/api/extensions/tvceb-family';
export async function familyContext(signal){
  const r=await fetch(PREFIX+'/context',{credentials:'same-origin',cache:'no-store',signal});
  const data=await r.json();if(!r.ok)throw Error(data.error||'Family home is not connected.');return data;
}
export async function familyRequest(path,{method='GET',body,signal}={}){
  const context=method==='GET'?null:await familyContext(signal);
  const r=await fetch(PREFIX+path,{method,credentials:'same-origin',cache:'no-store',signal,headers:body?{'Content-Type':'application/json','X-Family-CSRF':context.csrf}:{},body:body?JSON.stringify(body):undefined});
  const data=await r.json();if(!r.ok)throw Error(data.error||'Could not save. Please try again.');return data;
}
