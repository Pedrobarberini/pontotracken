const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function localStamp(value){const parts=Object.fromEntries(formatter.formatToParts(new Date(value)).map(part=>[part.type,part.value]));return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;}
function fromLocalStamp(value){
  if(typeof value!=='string'||!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error('Informe data e horário válidos de São Paulo.');
  const target=Date.parse(value+':00.000Z');if(!Number.isFinite(target)||new Date(target).toISOString().slice(0,16)!==value)throw new Error('Informe data e horário válidos de São Paulo.');
  let time=target;for(let attempt=0;attempt<3;attempt++){const observed=Date.parse(localStamp(time)+':00.000Z');time+=target-observed;}
  if(localStamp(time)!==value)throw new Error('Esse horário não existe no fuso de São Paulo. Escolha outro horário.');
  return new Date(time).toISOString();
}
export {localStamp,fromLocalStamp};
