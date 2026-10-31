import {api} from '/api.js';
import {t} from '/i18n.js';
import {esc} from '/utils/html.js';
import {familyContext,familyRequest} from './client.js';
const select=(value,options)=>options.map(([v,label])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(label)}</option>`).join('');
export async function render(container,{section,user,signal}){
  container.replaceChildren();if(section!=='household'||user?.role!=='admin')return;
  container.insertAdjacentHTML('beforeend','<p role="status" id="family-admin-status">Loading family settings…</p><div id="family-admin-content"></div>');
  const root=container.querySelector('#family-admin-content'),status=container.querySelector('#family-admin-status');
  const report=e=>{if(!signal?.aborted)status.textContent=e.message;};
  const on=(node,event,handler)=>node.addEventListener(event,handler,{signal});
  try{
    const [context,catalogResponse,preferences]=await Promise.all([familyContext(signal),api.get('/permissions/catalog'),api.get('/preferences')]);if(signal?.aborted)return;
    const settings=context.settings,catalog=catalogResponse.data;
    root.insertAdjacentHTML('beforeend',`<h3>Family home and connected services</h3><p>Use private service addresses. Photos uses the existing Family Photo Share installation; PhotoPrism is the advanced library. No Immich connection is used.</p><form id="family-services-form">${[['photos','Family Photo Share'],['photoprism','PhotoPrism'],['vaultwarden','Vaultwarden'],['homeassistant','Home Assistant']].map(([key,name])=>`<div class="form-group"><label class="label" for="service-${key}">${name} URL</label><input class="input" id="service-${key}" name="${key}" type="url" value="${esc(settings.services[key]||'')}" /></div>`).join('')}<div class="form-group"><label class="label" for="family-group-name">WhatsApp family group name</label><input class="input" id="family-group-name" name="groupName" maxlength="100" value="${esc(settings.whatsappGroupName)}" /></div><div class="form-group"><label class="label" for="family-group-invite">Private WhatsApp group invite (optional)</label><input class="input" id="family-group-invite" name="groupInvite" type="url" value="${esc(settings.whatsappInviteUrl)}" /></div><div class="form-group"><label class="label" for="kb-editing">Who can edit knowledgebase articles?</label><select class="input" id="kb-editing" name="editing">${select(settings.knowledgebaseEditing,[['everyone','Everyone with edit access'],['parents','Parents only']])}</select><p>Parents publish and archive. New articles from children wait for parent review.</p></div><p><label><input type="checkbox" name="simple" ${preferences.data.family_simple_navigation?'checked':''} /> Use the simple family menu for everyone</label></p><button class="btn btn--primary" type="submit">Save family settings</button></form><h3>Accounts and modules</h3><p>Set each member’s family role and module access below. System administrator rights, invitations and sign-in settings stay in <a href="/settings/admin/family">Family accounts</a>. <a href="/settings/admin/permissions">Role defaults and advanced permissions</a>.</p><div id="family-members"></div>`);
    on(root.querySelector('#family-services-form'),'submit',async e=>{
      e.preventDefault();const f=e.currentTarget,b=f.querySelector('[type=submit]');b.disabled=true;
      try{
        await familyRequest('/settings',{method:'PUT',body:{services:Object.fromEntries(['photos','photoprism','vaultwarden','homeassistant'].map(k=>[k,f.elements[k].value])),knowledgebaseEditing:f.elements.editing.value,whatsappGroupName:f.elements.groupName.value,whatsappInviteUrl:f.elements.groupInvite.value},signal});
        await api.put('/preferences',{family_simple_navigation:f.elements.simple.checked});status.textContent='Family settings saved. Reload the portal to apply its menu.';
      }catch(error){report(error);}finally{b.disabled=false;}
    });
    const members=root.querySelector('#family-members');
    for(const member of catalog.members.filter(m=>m.role!=='admin'&&(!m.access_scope||m.access_scope==='family'))){
      const detail=document.createElement('details');const summary=document.createElement('summary');summary.textContent=member.display_name||member.username;detail.append(summary);members.append(detail);
      let loaded=false;
      on(detail,'toggle',async()=>{
        if(!detail.open||loaded)return;loaded=true;
        try{
          const {data:overrides}=await api.get('/permissions/user/'+member.id);if(signal?.aborted)return;
          const form=document.createElement('form');
          form.insertAdjacentHTML('beforeend',`<div class="form-group"><label class="label" for="family-name-${member.id}">Display name</label><input class="input" id="family-name-${member.id}" name="displayName" maxlength="100" required value="${esc(member.display_name)}" /></div><div class="form-group"><label class="label" for="family-role-${member.id}">Family role</label><select class="input" id="family-role-${member.id}" name="familyRole">${select(member.family_role,['dad','mom','parent','child','grandparent','relative','other'].map(r=>[r,r]))}</select></div><p>Knowledgebase: “Use / edit” lets members edit according to the household setting above. Parents publish and archive; children can submit new articles.</p>${catalog.modules.map(m=>`<div class="form-group"><label class="label" for="family-module-${member.id}-${esc(m.key)}">${esc(m.label||t(m.labelKey))}</label><select class="input" id="family-module-${member.id}-${esc(m.key)}" data-module="${esc(m.key)}">${select(overrides.modules?.[m.key]||'',[['','Use family-role default'],['write','Use / edit'],['read','Read only'],['none','Unavailable']])}</select></div>`).join('')}<button class="btn btn--primary" type="submit">Save this member</button>`);
          on(form,'submit',async e=>{
            e.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;
            try{
              await api.patch('/auth/users/'+member.id,{display_name:form.elements.displayName.value,family_role:form.elements.familyRole.value});
              const modules=Object.fromEntries([...form.querySelectorAll('[data-module]')].filter(s=>s.value).map(s=>[s.dataset.module,s.value]));
              await api.put('/permissions/user/'+member.id,{...overrides,modules});summary.textContent=form.elements.displayName.value;status.textContent='Member settings and module access saved.';
            }catch(error){report(error);}finally{button.disabled=false;}
          });detail.append(form);
        }catch(error){loaded=false;report(error);}
      });
    }
    status.textContent='';
  }catch(error){report(error);}
}
