import { escapeHTML as e } from '../../shared/dom.mjs?v=demand-notices-1';
import {shell,conversationForm,conversationEndForm,cycleForm,goalForm,progressForm,reviewForm,confirmationForm,indicatorsView} from './views.mjs?v=demand-notices-1';
import {fromLocalStamp} from './time.mjs?v=demand-notices-1';

export function createDevelopment({state,api,busy,toast}) {
  let context=null, tab='conversations', uid='', cycleId='', rows=[], cycles=[], reviews=[], nextOffset=null, reviewOffset=null, generation=0, epoch=0, range={};
  const dialog=document.createElement('dialog');dialog.className='confirm-dialog development-dialog';dialog.setAttribute('aria-labelledby','development-dialog-title');document.body.append(dialog);
  const rootFor=view=>document.querySelector(view==='indicadores'?'#people-indicators-content':'#development-content');
  const current=(token,view)=>token===generation&&state.view===view&&Boolean(state.session?.user);
  const run=async work=>{try{await work();}catch(error){toast(error.message,true);}};
  function reset(){generation++;epoch++;context=null;tab='conversations';uid=cycleId='';rows=cycles=reviews=[];nextOffset=reviewOffset=null;range={};dialog.close();dialog.replaceChildren();for(const view of ['desenvolvimento','indicadores']){const root=rootFor(view);root?.replaceChildren();root?.setAttribute('aria-busy','false');}}
  async function open(view){
    const token=++generation,root=rootFor(view);if(!root)return;
    root.setAttribute('aria-busy','true');root.innerHTML='<div class="empty-state" role="status">Carregando desenvolvimento…</div>';
    try{
      const requestedEpoch=epoch, result=await api('development-context');
      if(!current(token,view)||requestedEpoch!==epoch)return;
      context=result;
      if(view==='indicadores')await loadIndicators();else await load();
    }catch(error){if(current(token,view))failure(root,error.message,view);}
  }
  function failure(root,message,view){root.setAttribute('aria-busy','false');root.innerHTML=`<p class="data-error" role="alert">${e(message)}</p><button class="button secondary" data-development-retry>Tentar novamente</button>`;root.querySelector('[data-development-retry]').onclick=()=>run(()=>open(view));}
  async function load(append=false){
    const token=++generation,requestedTab=tab,requestedUid=uid,requestedCycle=cycleId,root=rootFor('desenvolvimento'),previous=append?[...rows]:[],offset=append?nextOffset||0:0;
    root.setAttribute('aria-busy','true');
    const query=`&uid=${encodeURIComponent(requestedUid)}&offset=${offset}`;
    try{
      if(requestedTab==='cycles'){
        const result=await api('development-cycles',{query:`&offset=${offset}`});
        if(!current(token,'desenvolvimento'))return;
        cycles=append?[...cycles,...result.rows]:result.rows;cycleId=cycles.some(row=>row.id===requestedCycle)?requestedCycle:cycles[0]?.id||'';
        const page=cycleId?await api('development-reviews',{query:`&uid=${encodeURIComponent(requestedUid)}&cycleId=${encodeURIComponent(cycleId)}`}):{rows:[]};
        if(!current(token,'desenvolvimento'))return;
        reviews=page.rows;reviewOffset=page.nextOffset??null;rows=[];nextOffset=result.nextOffset;
      }else{
        const result=await api(requestedTab==='goals'?'development-goals':'development-conversations',{query});
        if(!current(token,'desenvolvimento'))return;
        rows=[...previous,...result.rows];nextOffset=result.nextOffset;
      }
      root.innerHTML=shell({tab:requestedTab,context,uid:requestedUid,rows,nextOffset,reviewOffset,cycleId,reviews,cycles});root.setAttribute('aria-busy','false');bind(root);
    }catch(error){if(current(token,'desenvolvimento'))failure(root,error.message,'desenvolvimento');}
  }
  function bind(root){
    root.querySelectorAll('[data-development-tab]').forEach(button=>button.onclick=()=>{tab=button.dataset.developmentTab;cycleId='';run(()=>load());});
    root.querySelector('#development-person').onchange=event=>{uid=event.target.value;run(()=>tab==='cycles'?loadSelectedReviews():load());};
    root.querySelector('[data-development-refresh]').onclick=()=>run(()=>open('desenvolvimento'));
    root.querySelector('[data-development-more]')?.addEventListener('click',()=>run(()=>load(true)));
    root.querySelector('[data-development-review-more]')?.addEventListener('click',()=>run(loadReviewsMore));
    root.querySelector('[data-development-new]')?.addEventListener('click',()=>edit());
    root.querySelectorAll('[data-development-edit]').forEach(button=>button.onclick=()=>edit(rows.find(row=>row.id===button.dataset.developmentEdit)));
    root.querySelectorAll('[data-development-next]').forEach(button=>button.onclick=()=>edit(rows.find(row=>row.id===button.dataset.developmentNext),true));
    for(const [selector,key,status] of [['[data-development-finish]','developmentFinish','completed'],['[data-development-cancel]','developmentCancel','cancelled']])root.querySelectorAll(selector).forEach(button=>button.onclick=()=>endConversation(rows.find(row=>row.id===button.dataset[key]),status));
    root.querySelectorAll('[data-development-progress]').forEach(button=>button.onclick=()=>progress(rows.find(row=>row.id===button.dataset.developmentProgress)));
    root.querySelector('#development-cycle')?.addEventListener('change',event=>{cycleId=event.target.value;run(loadSelectedReviews);});
    root.querySelector('[data-development-edit-cycle]')?.addEventListener('click',()=>edit(cycles.find(row=>row.id===cycleId)));
    root.querySelector('[data-development-cycle-transition]')?.addEventListener('click',event=>transitionCycle(event.target.dataset.developmentCycleTransition));
    root.querySelectorAll('[data-development-review]').forEach(button=>button.onclick=()=>editReview(button.dataset.developmentReview,button.dataset.kind));
    root.querySelectorAll('[data-development-edit-review]').forEach(button=>button.onclick=()=>{const row=reviews.find(item=>item.id===button.dataset.developmentEditReview);editReview(row.uid,row.kind,row);});
    root.querySelectorAll('[data-development-publish]').forEach(button=>button.onclick=()=>publish(reviews.find(row=>row.id===button.dataset.developmentPublish)));
  }
  function show(html,action,build){
    const requestedEpoch=epoch;let lastSignature='',requestId='';dialog.innerHTML=html;dialog.querySelectorAll('[data-development-close]').forEach(button=>button.onclick=()=>dialog.close());dialog.showModal();
    const form=dialog.querySelector('form');form.onsubmit=async event=>{event.preventDefault();const error=dialog.querySelector('#development-form-error');error.hidden=true;try{
      await busy(form.querySelector('[type=submit]'),async()=>{const values=build(new FormData(form)),signature=JSON.stringify(values);if(signature!==lastSignature){requestId=crypto.randomUUID();lastSignature=signature;}const data={...values,requestId},result=await api(action,{method:'POST',data});if(requestedEpoch!==epoch||!state.session?.user)return;dialog.close();toast('Registro salvo.');if(data.uid&&action.endsWith('-save'))uid=data.uid;if(action==='development-cycle-save')cycleId=result.record.id;if(state.view==='desenvolvimento')await load();});
    }catch(cause){if(requestedEpoch===epoch){error.textContent=cause.message;error.hidden=false;}}};
  }
  async function loadReviewsMore(){const token=++generation,root=rootFor('desenvolvimento'),requestedCycle=cycleId,requestedUid=uid,offset=reviewOffset;root.setAttribute('aria-busy','true');try{const result=await api('development-reviews',{query:`&uid=${encodeURIComponent(requestedUid)}&cycleId=${encodeURIComponent(requestedCycle)}&offset=${offset}`});if(!current(token,'desenvolvimento')||tab!=='cycles'||cycleId!==requestedCycle||uid!==requestedUid)return;reviews=[...reviews,...result.rows];reviewOffset=result.nextOffset;root.innerHTML=shell({tab,context,uid,rows,nextOffset,reviewOffset,cycleId,reviews,cycles});root.setAttribute('aria-busy','false');bind(root);}catch(error){if(current(token,'desenvolvimento'))failure(root,error.message,'desenvolvimento');}}
  async function loadSelectedReviews(){const token=++generation,root=rootFor('desenvolvimento'),requestedCycle=cycleId,requestedUid=uid;root.setAttribute('aria-busy','true');try{const result=requestedCycle?await api('development-reviews',{query:`&uid=${encodeURIComponent(requestedUid)}&cycleId=${encodeURIComponent(requestedCycle)}`}):{rows:[],nextOffset:null};if(!current(token,'desenvolvimento')||tab!=='cycles'||cycleId!==requestedCycle||uid!==requestedUid)return;reviews=result.rows;reviewOffset=result.nextOffset;root.innerHTML=shell({tab,context,uid,rows,nextOffset,reviewOffset,cycleId,reviews,cycles});root.setAttribute('aria-busy','false');bind(root);}catch(error){if(current(token,'desenvolvimento'))failure(root,error.message,'desenvolvimento');}}
  function edit(row=null,next=false){
    if(tab==='cycles'){show(cycleForm(context,row),'development-cycle-save',form=>({id:row?.id||undefined,version:row?.version||0,title:form.get('title'),startOn:form.get('startOn'),endOn:form.get('endOn'),participants:form.getAll('participants')}));return;}
    if(tab==='goals'){show(goalForm(context,uid,row),'development-goal-save',form=>({id:row?.id||undefined,version:row?.version||0,uid:row?.uid||form.get('uid'),title:form.get('title'),description:form.get('description'),dueOn:form.get('dueOn')}));return;}
    show(conversationForm(context,uid,row,next),'development-conversation-save',form=>({id:!next?row?.id||undefined:undefined,version:!next?row?.version||0:0,uid:row?.uid||form.get('uid'),title:form.get('title'),scheduledAt:fromLocalStamp(form.get('scheduledAt')),cadenceDays:Number(form.get('cadenceDays'))}));
  }
  function endConversation(row,status){show(conversationEndForm(row,status),'development-conversation-transition',form=>({id:row.id,version:row.version,status,notes:form.get('notes')||'',reason:form.get('reason')}));}
  function progress(row){show(progressForm(context,row),'development-goal-progress',form=>({id:row.id,version:row.version,progress:Number(form.get('progress')),status:form.get('status'),reason:form.get('reason')}));}
  function transitionCycle(status){const row=cycles.find(item=>item.id===cycleId);show(confirmationForm(status==='open'?'Abrir ciclo':'Encerrar ciclo',status==='open'?'As respostas serão permitidas dentro das datas configuradas. Os participantes serão mantidos.':'Encerrar bloqueia novas respostas e preserva as avaliações existentes.',true),'development-cycle-transition',form=>({id:row.id,version:row.version,status,reason:form.get('reason')}));}
  function editReview(personUid,kind,row=null){const person=context.people.find(person=>person.uid===personUid)||cycles.find(c=>c.id===cycleId).participants.find(person=>person.uid===personUid);show(reviewForm(person,kind,row),'development-review-save',form=>({id:row?.id||undefined,version:row?.version||0,cycleId,uid:personUid,kind,rating:Number(form.get('rating')),comment:form.get('comment')}));}
  function publish(row){show(confirmationForm('Publicar avaliação','A avaliação ficará visível ao colaborador e à gestão autorizada. Após publicar, o conteúdo não poderá ser editado.'),'development-review-publish',()=>({id:row.id,version:row.version}));}
  async function loadIndicators(){const token=++generation,root=rootFor('indicadores');root.setAttribute('aria-busy','true');try{const query=range.from?`&from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`:'';const result=await api('development-indicators',{query});if(!current(token,'indicadores'))return;range=result.range;root.innerHTML=indicatorsView(result);root.setAttribute('aria-busy','false');root.querySelector('form').onsubmit=event=>{event.preventDefault();const values=new FormData(event.target);range={from:values.get('from'),to:values.get('to')};run(loadIndicators);};}catch(error){if(current(token,'indicadores'))failure(root,error.message,'indicadores');}}
  return {open,reset};
}
