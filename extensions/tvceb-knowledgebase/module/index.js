import {esc} from '/utils/html.js';
import {renderPageHeader,renderPageTitle,renderPageBody} from '/utils/page-layout.js';
import {familyContext,familyRequest} from '/api/v1/modules/assets/tvceb-family/client.js';
export async function render(container,{signal}){
  container.replaceChildren();
  container.insertAdjacentHTML('beforeend',renderPageHeader({title:renderPageTitle('Knowledgebase')})+renderPageBody({content:'<p role="status" id="kb-status">Loading family articles…</p><div id="kb-content"></div>'}));
  const status=container.querySelector('#kb-status'),root=container.querySelector('#kb-content');
  const report=e=>{if(!signal?.aborted)status.textContent=e.message;};
  const listen=(node,event,handler)=>node.addEventListener(event,handler,{signal});
  try{
    const context=await familyContext(signal);if(signal?.aborted)return;
    async function list(){
      const {data}=await familyRequest('/articles',{signal});if(signal?.aborted)return;
      root.replaceChildren();root.insertAdjacentHTML('beforeend',`<p>Read our family guides, tips and useful information.</p>${context.canSubmit?'<button class="btn btn--primary" id="kb-new">Write a new article</button>':''}<label class="label" for="kb-search">Find an article</label><input class="input" id="kb-search" type="search" placeholder="Search article titles" /><div class="kb-list" id="kb-list"></div>`);
      const draw=()=>{
        const query=root.querySelector('#kb-search').value.toLocaleLowerCase(),rows=data.filter(a=>a.title.toLocaleLowerCase().includes(query));
        const links=root.querySelector('#kb-list');links.replaceChildren();
        links.insertAdjacentHTML('beforeend',rows.length?rows.map(a=>`<button class="kb-item" data-article="${a.id}"><strong>${esc(a.title)}</strong>${a.status!=='published'?` <span>· ${a.status==='pending'?'Waiting for parent review':'Archived'}</span>`:''}</button>`).join(''):'<p>No articles yet. Start with something helpful for your family.</p>');
        links.querySelectorAll('[data-article]').forEach(b=>listen(b,'click',()=>open(Number(b.dataset.article)).catch(report)));
      };
      listen(root.querySelector('#kb-search'),'input',draw);draw();
      if(context.canSubmit)listen(root.querySelector('#kb-new'),'click',()=>edit());
      status.textContent='';
    }
    async function open(id){
      const {data}=await familyRequest('/articles/'+id,{signal});if(signal?.aborted)return;
      root.replaceChildren();root.insertAdjacentHTML('beforeend',`<button class="btn btn--secondary" id="kb-back">All articles</button><h2>${esc(data.title)}</h2>${data.status!=='published'?'<p role="status">This article is not published yet.</p>':''}<div class="kb-text">${esc(data.body)}</div>${context.canEdit?'<div class="kb-actions"><button class="btn btn--primary" id="kb-edit">Edit article</button></div>':''}`);
      listen(root.querySelector('#kb-back'),'click',()=>list().catch(report));
      if(context.canEdit)listen(root.querySelector('#kb-edit'),'click',()=>edit(data));status.textContent='';
    }
    function edit(article){
      root.replaceChildren();root.insertAdjacentHTML('beforeend',`<h2>${article?'Edit article':'New article'}</h2><p>${context.canPublish?'You can save a draft or publish for the family.':article?.status==='published'?'Save your changes to this shared family article.':'A parent will review your new article before it is shared.'}</p><form class="kb-form"><label class="label" for="kb-title">Title</label><input class="input" id="kb-title" name="title" maxlength="180" required value="${esc(article?.title||'')}" /><label class="label" for="kb-body">Article</label><textarea class="input" id="kb-body" name="body" maxlength="20000" required>${esc(article?.body||'')}</textarea>${context.canPublish?`<label class="label" for="kb-state">Sharing</label><select class="input" id="kb-state" name="status"><option value="pending">Draft / parent review</option><option value="published" ${article?.status==='published'?'selected':''}>Published for everyone</option><option value="archived" ${article?.status==='archived'?'selected':''}>Archived</option></select>`:''}<div class="kb-actions"><button class="btn btn--primary" type="submit">${context.canPublish||article?'Save article':'Send for parent review'}</button><button class="btn btn--secondary" id="kb-cancel" type="button">Cancel</button></div></form>`);
      listen(root.querySelector('#kb-cancel'),'click',()=>list().catch(report));
      listen(root.querySelector('form'),'submit',async e=>{
        e.preventDefault();const form=e.currentTarget,button=form.querySelector('[type=submit]');button.disabled=true;
        try{const {data}=await familyRequest('/articles'+(article?'/'+article.id:''),{method:article?'PATCH':'POST',body:{title:form.elements.title.value,body:form.elements.body.value,status:context.canPublish?form.elements.status.value:article?.status||'pending',version:article?.version},signal});await open(data.id);status.textContent=context.canPublish||article?.status==='published'?'Article saved.':'Your article is waiting for parent review.';}
        catch(error){report(error);button.disabled=false;}
      });
    }
    await list();
  }catch(error){report(error);}
}
