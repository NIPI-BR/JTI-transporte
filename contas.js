/* ══════════════════════════════════════════════════════════
   Auricélia Transportes · Central Financeira
   contas.js — Contas a receber, contas a pagar e boletos
   (script clássico: as funções aqui são globais para o HTML)
══════════════════════════════════════════════════════════ */

/* ════════ CONTAS A RECEBER ════════ */
function addReceber(){
  const cli=v('rc_cli').trim(),venc=vData('rc_venc'),desc=v('rc_desc').trim(),val=parseFloat(v('rc_val'));
  const cc=v('rc_cc').trim(),juros=parseFloat(v('rc_juros'))||0,multa=parseFloat(v('rc_multa'))||0;
  const recorr=v('rc_recorr')||'unica',nrec=parseInt(v('rc_nrec'))||1;
  if(!cli){toast('Informe o cliente.','err');return;}
  if(!venc){toast('Informe o vencimento.','err');return;}
  if(!val||val<=0){toast('Informe um valor válido.','err');return;}
  const cat=v('rc_cat'); // categoria escolhida da lista do gestor
  const n=recorr==='unica'?1:nrec;const grupo=n>1?uid():null;
  const autoRecorr=recorr!=='unica'?(grupo||uid()):null;
  for(let i=0;i<n;i++){
    const vdt=n>1?avancaDataConta(venc,i,recorr):venc;
    S.receber.push({id:uid(),cli,venc:vdt,desc:desc+(n>1?` (${i+1}/${n})`:''),cat,cc,val,juros,multa,status:'aberto',grupo,autoRecorr,freq:recorr!=='unica'?recorr:null,by:CU,t:new Date().toISOString()});
  }
  if(cat&&desc)aprdCategoria(desc,cat); // aprende categoria
  log('Adicionou conta a receber: '+cli+' ('+money(val)+(n>1?' x'+n:'')+')');save();
  clr('rc_cli','rc_cnpj','rc_venc','rc_desc','rc_val','rc_cc','rc_juros','rc_multa');renderReceber();
}
function receberConta(id){
  const c=S.receber.find(x=>x.id===id);if(!c)return;
  if(bloqueiaMesFechado(new Date().toISOString().slice(0,10)))return;
  const acr=acrescimo(c);const total=c.val+acr;
  c.status='recebido';c.recebidoEm=new Date().toISOString().slice(0,10);c.valRecebido=total;
  S.flux.push({id:uid(),d:c.recebidoEm,desc:'Recebido: '+c.desc+' ('+c.cli+')'+(acr>0?' [+juros/multa]':''),cat:c.cat||'Recebimentos',cc:c.cc||'',tipo:'entrada',val:total,by:CU,byId:CUID,t:new Date().toISOString()});
  log('Recebeu conta: '+c.cli+(acr>0?' (com acréscimo '+money(acr)+')':''));save();renderReceber();renderDash();renderFluxo();renderPagas();
}
function delReceber(id){const c=S.receber.find(x=>x.id===id);if(!c)return;removerComDesfazer('receber',id,renderReceber,'Conta a receber de '+(c.cli||'—'));}
/* gera mensagem de cobrança pronta para copiar */
function cobrar(id){
  const c=S.receber.find(x=>x.id===id);if(!c)return;
  const d=days(c.venc);const acr=acrescimo(c);const total=c.val+acr;
  let msg;
  if(d<0)msg=`Olá! Consta em aberto a cobrança "${c.desc||c.cli}" no valor de ${money(c.val)}, vencida em ${fmt(c.venc)} (${Math.abs(d)} dia(s) em atraso).`+(acr>0?` Com juros e multa, o total atualizado é ${money(total)}.`:'')+` Por gentileza, regularizar. Obrigado!`;
  else if(d===0)msg=`Olá! Lembrete: a cobrança "${c.desc||c.cli}" no valor de ${money(c.val)} vence HOJE (${fmt(c.venc)}). Obrigado!`;
  else msg=`Olá! Lembrete: a cobrança "${c.desc||c.cli}" no valor de ${money(c.val)} vence em ${fmt(c.venc)} (${d} dia(s)). Obrigado!`;
  navigator.clipboard&&navigator.clipboard.writeText(msg);
  alert('Mensagem de cobrança copiada:\n\n'+msg);
}
function renderReceber(){
  const mg=document.getElementById('rc_meses');if(mg&&!mg.children.length)mg.innerHTML=opcoesMeses();
  const sel=document.getElementById('rc_cat');if(sel){const cur=sel.value;sel.innerHTML='<option value="">Categoria…</option>'+CAT_ENTRADA_().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');sel.value=cur||'';}
  renderCCList();
  const abertos=S.receber.filter(c=>c.status==='aberto');
  const tot=abertos.reduce((s,c)=>s+c.val,0);
  const venc=abertos.filter(c=>days(c.venc)<0).reduce((s,c)=>s+valorAtualizado(c),0);
  const sem=abertos.filter(c=>days(c.venc)>=0&&days(c.venc)<=7).reduce((s,c)=>s+c.val,0);
  const k=document.getElementById('recKpis');
  if(k)k.innerHTML=met('Total a receber',money(tot),'var(--pos)')
    +met('Vencido (c/ juros)',money(venc),'var(--peace)')
    +met('Vence em 7 dias',money(sem),'var(--com)');
  const tb=document.getElementById('recTable');
  const list=[...abertos].sort((a,b)=>a.venc.localeCompare(b.venc));
  if(tb)tb.innerHTML=list.length?list.map(c=>{
    const d=days(c.venc);const bdg=d<0?`<span class="badge bdanger">Vencido ${Math.abs(d)}d</span>`:d<=7?`<span class="badge bwarn">${d}d</span>`:`<span class="badge bgray">${d}d</span>`;
    const acr=acrescimo(c);
    const valTxt=acr>0?`<span style="font-weight:600;color:var(--pos)">${money(c.val+acr)}</span> <span class="rsub">(+${money(acr)})</span>`:`<span style="font-weight:600;color:var(--pos)">${money(c.val)}</span>`;
    return`<div class="row"><div style="min-width:0"><div class="rlabel">${esc(c.cli)}</div><div class="rsub">${esc(c.desc||'')}${c.cat?' · '+esc(c.cat):''}${c.cc?' · 🏷 '+esc(c.cc):''} · venc. ${fmt(c.venc)}</div></div><div class="rright">${bdg}${valTxt}<button class="btn btnsm" onclick="cobrar('${c.id}')" title="Gerar cobrança">✉</button><button class="btn btnsm btnnipi" onclick="receberConta('${c.id}')">Receber</button><button class="btn btnsm" onclick="delReceber('${c.id}')">✕</button></div></div>`;
  }).join(''):emptyState('💰','Nenhuma conta a receber','Cadastre o que os clientes têm a pagar. Você acompanha vencimentos e pode gerar cobranças por aqui.');
}

/* ════════ CONTAS A PAGAR ════════ */
function addPagar(){
  const forn=v('pg_forn').trim(),venc=vData('pg_venc'),desc=v('pg_desc').trim(),val=parseFloat(v('pg_val'));
  const cc=v('pg_cc').trim(),juros=parseFloat(v('pg_juros'))||0,multa=parseFloat(v('pg_multa'))||0;
  const recorr=v('pg_recorr')||'unica',nrec=parseInt(v('pg_nrec'))||1;
  if(!forn){toast('Informe o fornecedor.','err');return;}
  if(!venc){toast('Informe o vencimento.','err');return;}
  if(!val||val<=0){toast('Informe um valor válido.','err');return;}
  const cat=v('pg_cat'); // categoria escolhida da lista do gestor
  const n=recorr==='unica'?1:nrec;const grupo=n>1?uid():null;
  const autoRecorr=recorr!=='unica'?(grupo||uid()):null;
  for(let i=0;i<n;i++){
    const vdt=n>1?avancaDataConta(venc,i,recorr):venc;
    S.pagar.push({id:uid(),forn,venc:vdt,desc:desc+(n>1?` (${i+1}/${n})`:''),cat,cc,val,juros,multa,status:'aberto',grupo,autoRecorr,freq:recorr!=='unica'?recorr:null,by:CU,t:new Date().toISOString()});
  }
  if(cat&&desc)aprdCategoria(desc,cat); // aprende categoria
  log('Adicionou conta a pagar: '+forn+' ('+money(val)+(n>1?' x'+n:'')+')');save();
  clr('pg_forn','pg_cnpj','pg_boleto','pg_venc','pg_desc','pg_val','pg_cc','pg_juros','pg_multa');renderPagar();
}
function pagarConta(id){
  const c=S.pagar.find(x=>x.id===id);if(!c)return;
  if(bloqueiaMesFechado(new Date().toISOString().slice(0,10)))return;
  const acr=acrescimo(c);const total=c.val+acr;
  c.status='pago';c.pagoEm=new Date().toISOString().slice(0,10);c.valPago=total;
  S.flux.push({id:uid(),d:c.pagoEm,desc:'Pago: '+c.desc+' ('+c.forn+')'+(acr>0?' [+juros/multa]':''),cat:c.cat||'Pagamentos',cc:c.cc||'',tipo:'saida',val:total,by:CU,byId:CUID,t:new Date().toISOString()});
  log('Pagou conta: '+c.forn+(acr>0?' (com acréscimo '+money(acr)+')':''));save();renderPagar();renderDash();renderFluxo();renderPagas();
}
function delPagar(id){const c=S.pagar.find(x=>x.id===id);if(!c)return;removerComDesfazer('pagar',id,renderPagar,'Conta a pagar de '+(c.forn||'—'));}
function renderPagar(){
  const mg=document.getElementById('pg_meses');if(mg&&!mg.children.length)mg.innerHTML=opcoesMeses();
  const sel=document.getElementById('pg_cat');if(sel){const cur=sel.value;sel.innerHTML='<option value="">Categoria…</option>'+CAT_SAIDA_().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');sel.value=cur||'';}
  renderCCList();
  const abertos=S.pagar.filter(c=>c.status==='aberto');
  const tot=abertos.reduce((s,c)=>s+c.val,0);
  const venc=abertos.filter(c=>days(c.venc)<0).reduce((s,c)=>s+valorAtualizado(c),0);
  const sem=abertos.filter(c=>days(c.venc)>=0&&days(c.venc)<=7).reduce((s,c)=>s+c.val,0);
  const k=document.getElementById('payKpis');
  if(k)k.innerHTML=met('Total a pagar',money(tot),'var(--peace)')
    +met('Vencido (c/ juros)',money(venc),'var(--peace)')
    +met('Vence em 7 dias',money(sem),'var(--com)');
  const tb=document.getElementById('payTable');
  const list=[...abertos].sort((a,b)=>a.venc.localeCompare(b.venc));
  if(tb)tb.innerHTML=list.length?list.map(c=>{
    const d=days(c.venc);const bdg=d<0?`<span class="badge bdanger">Vencido ${Math.abs(d)}d</span>`:d<=7?`<span class="badge bwarn">${d}d</span>`:`<span class="badge bgray">${d}d</span>`;
    const acr=acrescimo(c);
    const valTxt=acr>0?`<span style="font-weight:600;color:var(--peace)">${money(c.val+acr)}</span> <span class="rsub">(+${money(acr)})</span>`:`<span style="font-weight:600;color:var(--peace)">${money(c.val)}</span>`;
    return`<div class="row"><div style="min-width:0"><div class="rlabel">${esc(c.forn)}</div><div class="rsub">${esc(c.desc||'')}${c.cat?' · '+esc(c.cat):''}${c.cc?' · 🏷 '+esc(c.cc):''} · venc. ${fmt(c.venc)}</div></div><div class="rright">${bdg}${valTxt}<button class="btn btnsm btnp" onclick="pagarConta('${c.id}')">Pagar</button><button class="btn btnsm" onclick="delPagar('${c.id}')">✕</button></div></div>`;
  }).join(''):emptyState('📄','Nenhuma conta a pagar','Cadastre as contas da empresa (fornecedores, boletos, impostos) para acompanhar os vencimentos e não perder prazos.');
}

/* ════════ BOLETOS ════════ */
function addBoleto(){
  const forn=v('bl_forn').trim(),venc=vData('bl_venc'),desc=v('bl_desc').trim(),val=parseFloat(v('bl_val'));
  if(!forn){toast('Informe o fornecedor.','err');return;}
  if(!venc){toast('Informe o vencimento.','err');return;}
  if(!val||val<=0){toast('Informe um valor válido.','err');return;}
  S.boletos.push({id:uid(),forn,venc,desc,val,by:CU,t:new Date().toISOString()});
  log('Adicionou boleto: '+forn+' ('+money(val)+')');save();
  clr('bl_forn','bl_venc','bl_desc','bl_val');renderBoletos();
}
function pagarBoleto(id){
  const b=S.boletos.find(x=>x.id===id);if(!b)return;
  S.flux.push({id:uid(),d:new Date().toISOString().slice(0,10),desc:'Boleto: '+b.forn,cat:'Boletos',tipo:'saida',val:b.val,by:CU,byId:CUID,t:new Date().toISOString()});
  S.boletos=S.boletos.filter(x=>x.id!==id);
  log('Pagou boleto: '+b.forn);save();renderBoletos();renderDash();renderFluxo();
}
function delBoleto(id){const b=S.boletos.find(x=>x.id===id);if(!b)return;removerComDesfazer('boletos',id,renderBoletos,'Boleto de '+(b.forn||'—'));}
function renderBoletos(){
  const tot=S.boletos.reduce((s,b)=>s+b.val,0);
  const urg=S.boletos.filter(b=>days(b.venc)<=3);
  const k=document.getElementById('bolKpis');
  if(k)k.innerHTML=met('Total em boletos',money(tot),'var(--com)')
    +met('Urgentes (≤3d)',urg.length,'var(--peace)',money(urg.reduce((s,b)=>s+b.val,0)))
    +met('Total de boletos',S.boletos.length,'var(--text)');
  const tb=document.getElementById('bolTable');
  const list=[...S.boletos].sort((a,b)=>a.venc.localeCompare(b.venc));
  if(tb)tb.innerHTML=list.length?list.map(b=>{
    const d=days(b.venc);const bdg=d<0?`<span class="badge bdanger">Vencido ${Math.abs(d)}d</span>`:d<=3?`<span class="badge bdanger">${d===0?'Hoje':d+'d'}</span>`:d<=7?`<span class="badge bwarn">${d}d</span>`:`<span class="badge bgray">${d}d</span>`;
    return`<div class="row"><div style="min-width:0"><div class="rlabel">${esc(b.forn)}</div><div class="rsub">${esc(b.desc||'')} · venc. ${fmt(b.venc)}</div></div><div class="rright">${bdg}<span style="font-weight:600;color:var(--com)">${money(b.val)}</span><button class="btn btnsm btnp" onclick="pagarBoleto('${b.id}')">Pagar</button><button class="btn btnsm" onclick="delBoleto('${b.id}')">✕</button></div></div>`;
  }).join(''):emptyState('🧾','Nenhum boleto a vencer','Os boletos cadastrados com vencimento próximo aparecem aqui para você não esquecer de pagar.');
}
