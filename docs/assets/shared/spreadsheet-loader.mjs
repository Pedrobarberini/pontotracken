let loading;
export function loadSpreadsheet(){
  if(globalThis.XLSX?.utils)return Promise.resolve(globalThis.XLSX);
  if(!loading)loading=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.async=true;
    script.src=new URL('../xlsx.full.min.js?v=hr-operations-1',import.meta.url).href;
    script.onload=()=>{if(globalThis.XLSX?.utils)resolve(globalThis.XLSX);else{loading=null;script.remove();reject(new Error('Não foi possível iniciar a exportação Excel. Tente novamente.'));}};
    script.onerror=()=>{loading=null;script.remove();reject(new Error('Não foi possível carregar o exportador Excel. Verifique sua conexão e tente novamente.'));};
    document.head.append(script);
  });
  return loading;
}
