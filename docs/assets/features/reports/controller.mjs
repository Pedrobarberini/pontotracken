import {escapeHTML as e} from '../../shared/dom.mjs?v=hr-operations-1';
import {administrativeWorkbook,saveReport} from './export.mjs?v=hr-operations-1';
import {loadSpreadsheet} from '../../shared/spreadsheet-loader.mjs?v=hr-operations-1';
export function createAdministrativeReports({host,api,getUser,save=saveReport,loadPDF=()=>import('../../vendor/administrative-report-pdf.mjs?v=hr-operations-1'),loadExcel=loadSpreadsheet}) {
  if(!host?.querySelector)return {reset(){}};
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  host.innerHTML=`<section class="people-card"><div class="card-heading"><div><h2>Relatórios administrativos</h2><p>Férias, documentos, avaliações e indicadores em um único arquivo.</p></div></div><form data-report-form><div class="people-form-grid"><label>Início<input type="date" name="from" value="${today.slice(0,4)}-01-01" required></label><label>Fim<input type="date" name="to" value="${today}" required></label></div><label>Colaborador<select name="uid" data-report-person><option value="">Todas as pessoas</option></select></label><div class="hr-actions"><button type="submit" name="format" value="pdf" class="button primary">Baixar PDF</button><button type="submit" name="format" value="xlsx" class="button secondary">Baixar Excel</button></div><p class="data-error" data-report-error role="alert" hidden></p><p data-report-status class="field-hint" aria-live="polite"></p></form><p class="field-hint">Disponível para RH e ADMIN. Período de até 366 dias. Nenhum conteúdo de documento ou comentário de avaliação é exportado. O arquivo inclui os critérios de cada seção.</p></section>`;
  const $=selector=>host.querySelector(selector);let epoch=0,busy=false;
  $('[data-report-form]').onsubmit=async event=>{
    event.preventDefault();if(busy)return;const format=event.submitter?.value;if(!['pdf','xlsx'].includes(format))return;
    const generation=epoch,owner=getUser()?.uid,form=new FormData(event.target),query='&'+['from','to','uid'].map(key=>key+'='+encodeURIComponent(form.get(key)||'')).join('&');busy=true;
    $('[data-report-error]').hidden=true;$('[data-report-status]').textContent='Preparando relatório…';for(const button of host.querySelectorAll('[type="submit"]'))button.disabled=true;
    try {
      const report=await api('hr-administrative-report',{query});if(generation!==epoch||getUser()?.uid!==owner)return;
      let bytes;if(format==='pdf')bytes=await (await loadPDF()).administrativeReportPDF(report);else bytes=administrativeWorkbook(report,await loadExcel());
      if(generation!==epoch||getUser()?.uid!==owner)return;
      save(bytes,format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','TrackenPessoas-relatorio-RH-'+report.from+'_'+report.to+'.'+format);
      $('[data-report-status]').textContent=(report.demo?'Arquivo demonstrativo gerado. ':'Arquivo gerado. ')+report.sections.reduce((sum,section)=>sum+section.rows.length,0)+' linhas nas seções.';
    }catch(error){if(generation!==epoch)return;$('[data-report-error]').textContent=error.message;$('[data-report-error]').hidden=false;$('[data-report-status]').textContent='';}
    finally{if(generation===epoch){busy=false;for(const button of host.querySelectorAll('[type="submit"]'))button.disabled=false;}}
  };
  const setPeople=people=>$('[data-report-person]').innerHTML='<option value="">Todas as pessoas</option>'+people.map(person=>`<option value="${e(person.uid)}">${e(person.name)}</option>`).join('');
  return {setPeople,async loadPeople(){const generation=epoch;try{const data=await api('hr-report-directory');if(generation===epoch)setPeople(data.people);}catch(error){if(generation===epoch){$('[data-report-error]').textContent=error.message;$('[data-report-error]').hidden=false;}}},reset(){epoch++;busy=false;$('[data-report-error]').hidden=true;$('[data-report-status]').textContent='';setPeople([]);for(const button of host.querySelectorAll('[type="submit"]'))button.disabled=false;}};
}
