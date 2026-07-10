/* ══════════════════════════════════════════════════════════
   Auricélia Transportes · Central Financeira
   painel.js — Fluxo de caixa, transferências, dashboard e automações
   (script clássico: as funções aqui são globais para o HTML)
══════════════════════════════════════════════════════════ */

/* ════════ FLUXO DE CAIXA ════════ */
/* Cada lançamento guarda by/byId (usuário) e caixaId (caixa atribuído) */
function caixaNome(id){const c=S.caixas.find(x=>x.id===id);return c?c.nome:(id?'Caixa':'Sem caixa');}
function caixaCor(id){const c=S.caixas.find(x=>x.id===id);return c?c.cor:'var(--t3)';}
/* ── FORMAS DE RECEBIMENTO / PAGAMENTO ──
   Como o dinheiro entrou (ou saiu) do caixa. Fica registrado no lançamento,
   aparece na lista e soma no resumo por forma. */
const FORMAS=[
  {id:'dinheiro',  l:'💵 Dinheiro',                cor:'var(--pos)'},
  {id:'pix',       l:'⚡ PIX',                     cor:'var(--gr)'},
  {id:'cartao',    l:'💳 Cartão',                  cor:'var(--ment)'},
  {id:'boleto',    l:'📄 Boleto',                  cor:'var(--com)'},
  {id:'transf',    l:'🏦 Transferência entre contas',cor:'var(--mkt)'}
];
function formaLabel(id){const f=FORMAS.find(x=>x.id===id);return f?f.l:'';}
function formaCor(id){const f=FORMAS.find(x=>x.id===id);return f?f.cor:'var(--t3)';}
/* preenche um select de formas, preservando a escolha atual */
function preencheFormas(elId,tipo,atual){
  const sel=document.getElementById(elId);if(!sel)return;
  const cur=atual!==undefined?atual:sel.value;
  const rot=tipo==='entrada'?'Forma de recebimento…':'Forma de pagamento…';
  sel.innerHTML=`<option value="">${rot}</option>`+FORMAS.map(f=>`<option value="${f.id}">${f.l}</option>`).join('');
  sel.value=cur||'';
}
/* resumo do que entrou (e saiu) por forma, no recorte que está na tela */
function renderFormasResumo(lista){
  const el=document.getElementById('fxFormas');if(!el)return;
  const reais=(lista||[]).filter(e=>e.tipo!=='transf'&&!e.pessoal&&e.forma);
  if(!reais.length){el.innerHTML='';return;}
  const linhas=FORMAS.map(f=>{
    const ent=reais.filter(e=>e.forma===f.id&&e.tipo==='entrada').reduce((s,e)=>s+e.val,0);
    const sai=reais.filter(e=>e.forma===f.id&&e.tipo==='saida').reduce((s,e)=>s+e.val,0);
    const n=reais.filter(e=>e.forma===f.id).length;
    return {f,ent,sai,n};
  }).filter(x=>x.n>0);
  if(!linhas.length){el.innerHTML='';return;}
  const totalEnt=linhas.reduce((s,x)=>s+x.ent,0);
  const semForma=(lista||[]).filter(e=>e.tipo!=='transf'&&!e.pessoal&&!e.forma&&e.tipo==='entrada').length;
  el.innerHTML=`<div class="card" style="margin-bottom:.9rem">
    <div class="ctitle">Recebimentos por forma <span style="font-weight:400;color:var(--t3);font-size:11px">· no período exibido</span></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${linhas.map(x=>`<div style="flex:1;min-width:150px;background:var(--surface2);border-radius:9px;padding:9px 11px">
        <div style="font-size:11.5px;color:${x.f.cor};font-weight:600;margin-bottom:3px">${x.f.l}</div>
        <div style="font-size:15px;font-weight:700;color:var(--pos)">${money(x.ent)}</div>
        <div style="font-size:10.5px;color:var(--t3);margin-top:2px">${x.n} lançamento(s)${x.sai>0?' · saídas '+money(x.sai):''}${totalEnt>0?' · '+Math.round(x.ent/totalEnt*100)+'%':''}</div>
      </div>`).join('')}
    </div>
    ${semForma?`<div style="font-size:11px;color:var(--t3);margin-top:8px">${semForma} entrada(s) sem forma informada — edite o lançamento para classificar.</div>`:''}
  </div>`;
}
function addFlux(){
  const d=vData('fx_d'),desc=v('fx_desc').trim(),tipo=v('fx_tipo')||'entrada',val=parseFloat(v('fx_val'));
  if(!d){toast('Informe a data.','err');return;}
  if(!desc){toast('Informe a descrição.','err');return;}
  if(!val||val<=0||isNaN(val)){toast('Informe um valor válido.','err');return;}
  if(bloqueiaMesFechado(d))return;
  const cat=v('fx_cat'); // categoria escolhida da lista do gestor
  // caixa: membro usa o seu; visão completa usa o filtro ativo (ou o select)
  let caixaId=CCX;
  if(isFull()){const sel=document.getElementById('fx_caixa_sel');caixaId=sel?sel.value:(CAIXA_FILTER!=='__all__'?CAIXA_FILTER:'');}
  const contaId=v('fx_conta');
  const forma=v('fx_forma'); // como o dinheiro entrou/saiu (opcional)
  // retirada (saída) ou devolução (entrada) de sócio: mexe no saldo do sócio, fora do resultado da empresa
  let socioId='',pessoal=false;
  const chk=document.getElementById('fx_retirada');
  if(chk&&chk.checked){
    socioId=v('fx_socio');
    if(!socioId){toast('Selecione a pessoa.','err');return;}
    pessoal=true;
  }
  const catFinal=pessoal?(tipo==='saida'?'Saída pessoal':'Entrada pessoal'):cat;
  S.flux.push({id:uid(),d,desc,cat:catFinal,tipo,val,forma,by:CU,byId:CUID,caixaId,contaId,socioId,pessoal,t:new Date().toISOString()});
  log('Lançou '+tipo+': '+desc+' ('+money(val)+')'+(forma?' · '+formaLabel(forma).replace(/^\S+\s/,''):'')+(pessoal?' · '+(tipo==='saida'?'Saída pessoal — ':'Entrada pessoal — ')+socioNome(socioId):'')+(caixaId?' · '+caixaNome(caixaId):'')+(contaId?' · '+contaNome(contaId):''));save();
  const rc=document.getElementById('fx_retirada');if(rc)rc.checked=false;toggleRetirada();
  clr('fx_desc','fx_cat','fx_val','fx_forma');renderFluxo();renderDash();renderSociosConta();
}
function removeFlux(id){
  const e=S.flux.find(x=>x.id===id);if(!e)return;
  // membro só remove lançamento do próprio caixa
  if(!isFull()&&e.byId!==CUID){toast('Você só pode remover lançamentos do seu próprio caixa.','err');return;}
  if(bloqueiaMesFechado(e.d))return;
  removerComDesfazer('flux',id,()=>{renderFluxo();renderSociosConta&&renderSociosConta();},(e.tipo==='entrada'?'Entrada':'Saída')+' "'+(e.desc||'—')+'"');
}
/* ── EDIÇÃO DE LANÇAMENTO ── */
let EDIT_ID=null;
function openEditLanc(id){
  const e=S.flux.find(x=>x.id===id);if(!e)return;
  if(!isFull()&&e.byId!==CUID){toast('Você só pode editar lançamentos do seu próprio caixa.','err');return;}
  EDIT_ID=id;
  document.getElementById('ed_d').value=toBR(e.d);
  document.getElementById('ed_tipo').value=e.tipo;
  document.getElementById('ed_desc').value=e.desc||'';
  document.getElementById('ed_val').value=e.val;
  document.getElementById('ed_placa').value=e.placa||'';
  const edc=document.getElementById('ed_cat');edc.dataset.cur=e.cat||'';
  const edf=document.getElementById('ed_forma');if(edf)edf.dataset.cur=e.forma||'';
  edTipoChange(); // popula categorias e formas conforme o tipo (usa dataset.cur)
  // caixa (só visão completa escolhe)
  const cxWrap=document.getElementById('ed_caixa_wrap');
  if(isFull()){
    cxWrap.style.display='';
    const sel=document.getElementById('ed_caixa');
    sel.innerHTML='<option value="">Sem caixa</option>'+S.caixas.map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('');
    sel.value=e.caixaId||'';
  }else{cxWrap.style.display='none';}
  document.getElementById('editModal').classList.add('open');
}
function edTipoChange(){
  const tipo=document.getElementById('ed_tipo').value;
  const lbl=document.getElementById('ed_forma_lbl');
  if(lbl)lbl.textContent=tipo==='entrada'?'Forma de recebimento':'Forma de pagamento';
  const ef=document.getElementById('ed_forma');
  if(ef)preencheFormas('ed_forma',tipo,ef.dataset.cur||'');
  const sel=document.getElementById('ed_cat');
  if(sel){
    const lista=(tipo==='entrada'?CAT_ENTRADA_():CAT_SAIDA_());
    const atual=sel.dataset.cur||'';
    const extra=atual&&!lista.includes(atual)?`<option value="${esc(atual)}">${esc(atual)} (antiga)</option>`:'';
    sel.innerHTML='<option value="">Categoria…</option>'+extra+lista.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    sel.value=atual;
  }
}
function closeEditLanc(){EDIT_ID=null;document.getElementById('editModal').classList.remove('open');}
function saveEditLanc(){
  const e=S.flux.find(x=>x.id===EDIT_ID);if(!e){closeEditLanc();return;}
  const d=vData('ed_d');if(!d){toast('Data inválida. Use dd/mm/aaaa.','err');return;}
  if(bloqueiaMesFechado(e.d)||bloqueiaMesFechado(d))return;
  const desc=document.getElementById('ed_desc').value.trim();if(!desc){toast('Informe a descrição.','err');return;}
  const val=parseFloat(document.getElementById('ed_val').value);if(!val||val<=0){toast('Informe um valor válido.','err');return;}
  e.d=d;e.tipo=document.getElementById('ed_tipo').value;e.desc=desc;
  e.cat=document.getElementById('ed_cat').value.trim();e.val=val;
  const ef2=document.getElementById('ed_forma');if(ef2){e.forma=ef2.value;ef2.dataset.cur=e.forma;}
  e.placa=document.getElementById('ed_placa').value.trim();
  if(isFull()){const sel=document.getElementById('ed_caixa');if(sel)e.caixaId=sel.value;}
  log('Editou lançamento: '+desc+' ('+money(val)+')');save();
  closeEditLanc();renderFluxo();renderDash();renderDRE&&renderDRE();
}
/* lista de caixas cadastrados (para filtros de visão completa) */
function caixaUsers(){return S.caixas;}
/* escopo: membro vê o próprio caixa (caixaId atribuído, ou seus lançamentos); visão completa vê todos ou filtra por caixa */
/* janela de visão: quantos dias para trás este usuário enxerga (0 = sem limite).
   padrão: membros (caixa) veem 7 dias; visão completa sem limite; gestor sempre tudo. */
function limiteDias(){
  if(CR==='gestor')return 0;
  if(CDIAS===null)return CR==='membro'?7:0; // padrão
  return CDIAS>0?CDIAS:0;
}
function dataCorte(){
  const n=limiteDias();if(!n)return null;
  const d=new Date();d.setDate(d.getDate()-(n-1)); // inclui hoje
  return d.toISOString().slice(0,10);
}
function aplicaJanela(lista){
  const corte=dataCorte();
  return corte?lista.filter(e=>e.d>=corte):lista;
}
function scopedFlux(){
  if(!isFull()){
    if(CCX)return aplicaJanela(S.flux.filter(e=>e.caixaId===CCX||e.byId===CUID));
    return aplicaJanela(S.flux.filter(e=>e.byId===CUID));
  }
  let base;
  if(CAIXA_FILTER==='__none__')base=S.flux.filter(e=>!e.caixaId);
  else if(CAIXA_FILTER&&CAIXA_FILTER!=='__all__')base=S.flux.filter(e=>e.caixaId===CAIXA_FILTER);
  else base=S.flux;
  return aplicaJanela(base);
}
function renderCaixaFilter(containerId){
  const el=document.getElementById(containerId);if(!el)return;
  if(!isFull()){el.innerHTML='';return;}
  const cxs=caixaUsers();
  let h='<div class="filter-bar"><span style="font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;font-weight:600">Filtrar por caixa:</span>';
  h+=`<button class="caixa-pill ${CAIXA_FILTER==='__all__'?'on':''}" onclick="setCaixa('__all__')">Todos os caixas</button>`;
  cxs.forEach(c=>{h+=`<button class="caixa-pill ${CAIXA_FILTER===c.id?'on':''}" onclick="setCaixa('${c.id}')"><span style="width:7px;height:7px;border-radius:50%;background:${c.cor||'var(--t3)'}"></span>${esc(c.nome)}</button>`;});
  h+=`<button class="caixa-pill ${CAIXA_FILTER==='__none__'?'on':''}" onclick="setCaixa('__none__')">Sem caixa</button>`;
  h+='</div>';
  el.innerHTML=h;
}
function setCaixa(id){CAIXA_FILTER=id;renderFluxo();renderDash();}

function buildMonthSelect(entries,current){
  const sel=document.getElementById('fx_month');if(!sel)return;
  const months=[...new Set(entries.map(e=>e.d.slice(0,7)))].sort().reverse();
  const html='<option value="">Todos os meses</option>'+months.map(m=>`<option value="${m}">${monthLabel(m)}</option>`).join('');
  if(sel.innerHTML!==html){const cur=current||'';sel.innerHTML=html;sel.value=cur;}
}
function renderFluxo(){
  const dd=document.getElementById('fx_d');if(dd&&!dd.value)dd.value=hojeBR();
  renderFxCats();
  renderContaSelect();
  renderTransferCard();
  onFxTipoChange();
  const ji=document.getElementById('fxJanelaInfo');
  if(ji){const n=limiteDias();ji.innerHTML=n?`<div style="font-size:11.5px;color:var(--t3);margin:2px 0 8px">👁 Mostrando ${rotuloJanela(n)} de movimentações.</div>`:'';}
  // escopo do fluxo
  renderCaixaFilter('fxCaixaFilter');
  // subtítulo conforme papel
  const sub=document.getElementById('fluxSub');
  if(sub)sub.textContent=isFull()?'Visão completa — lançamentos de todos os caixas.':'Seu caixa pessoal — apenas seus lançamentos.';
  const base=scopedFlux();
  const all=[...base].sort((a,b)=>((a.d+'|'+a.t)<(b.d+'|'+b.t)?-1:1));
  let run=0;const withBal=all.map(e=>{run+=(e.tipo==='entrada'?e.val:(e.tipo==='saida'?-e.val:0));return{...e,bal:run};});
  const saldo=run;
  const mk=v('fx_month');const q=v('fx_search');
  let view=withBal;
  if(mk)view=view.filter(e=>e.d.slice(0,7)===mk);
  if(q)view=view.filter(e=>inc(e.desc,q)||inc(e.cat,q)||inc(e.by,q));
  const monthSet=mk?withBal.filter(e=>e.d.slice(0,7)===mk):withBal;
  const ent=monthSet.filter(e=>e.tipo==='entrada').reduce((s,e)=>s+e.val,0);
  const sai=monthSet.filter(e=>e.tipo==='saida').reduce((s,e)=>s+e.val,0);
  const lbl=mk?' ('+monthLabel(mk)+')':' (total)';
  const k=document.getElementById('fxKpis');
  if(k)k.innerHTML=met('Saldo atual',money(saldo),saldo>=0?'var(--pos)':'var(--neg)')
    +met('Entradas'+lbl,money(ent),'var(--pos)')
    +met('Saídas'+lbl,money(sai),'var(--peace)')
    +met('Resultado'+lbl,money(ent-sai),(ent-sai)>=0?'var(--pos)':'var(--peace)');
  const disp=[...view].reverse();
  renderFormasResumo(disp); // resumo de recebimentos por forma no período visível
  const tb=document.getElementById('fxTable');
  if(tb)tb.innerHTML=disp.length?disp.map(e=>`<div class="row">
    <div style="flex:1;min-width:0"><div class="rlabel">${e.tipo==='transf'?'⇄ ':''}${esc(e.desc||'—')}</div><div class="rsub">${fmt(e.d)}${e.cat?' · '+esc(e.cat):''}${e.forma?' · <span style="color:'+formaCor(e.forma)+'">'+esc(formaLabel(e.forma))+'</span>':''}${e.caixaId?' · <span style="color:'+caixaCor(e.caixaId)+'">●</span> '+esc(caixaNome(e.caixaId)):''}${e.contaId?' · 🏦 '+esc(contaNome(e.contaId)):''}${isFull()?' · <strong>'+esc(e.by||'')+'</strong>':''}</div></div>
    <div class="rright">
      <span style="font-size:13px;font-weight:600;color:${e.tipo==='entrada'?'var(--pos)':(e.tipo==='transf'?'var(--com)':'var(--peace)')}">${e.tipo==='entrada'?'+ ':(e.tipo==='transf'?'⇄ ':'− ')}${money(e.val)}</span>
      <span class="rsub mono" style="min-width:96px;text-align:right">Saldo: ${money(e.bal)}</span>
      ${(isFull()||e.byId===CUID)?`${e.anexo?`<button class="btn btnsm" style="border-color:var(--gr)" onclick="verComprovante('${e.id}')" title="Ver comprovante">📎</button>`:`<button class="btn btnsm" style="opacity:.65" onclick="anexarComprovante('${e.id}')" title="Anexar comprovante">📎</button>`}${e.tipo!=='transf'?`<button class="btn btnsm" onclick="openEditLanc('${e.id}')" title="Editar">✎</button>`:''}<button class="btn btnsm" onclick="removeFlux('${e.id}')" title="Remover">✕</button>`:''}
    </div></div>`).join(''):emptyState('📊','Nenhum lançamento ainda','As entradas e saídas que você registrar aparecem aqui. Use o formulário acima para lançar a primeira.');
  buildMonthSelect(withBal,mk);
  buildCaixaSelect();
}
/* monta o seletor de caixa do formulário de lançamento (visão completa) */
function buildCaixaSelect(){
  const wrap=document.getElementById('fx_caixa_wrap');if(!wrap)return;
  if(!isFull()){
    // membro: mostra apenas o nome do seu caixa atribuído (se houver)
    wrap.innerHTML=CCX?`<div style="font-size:11px;color:var(--t3);padding:6px 0">Lançando no caixa: <strong style="color:${caixaCor(CCX)}">${esc(caixaNome(CCX))}</strong></div>`:'';
    return;
  }
  const opts='<option value="">Sem caixa específico</option>'+S.caixas.map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('');
  let cur=(CAIXA_FILTER&&CAIXA_FILTER!=='__all__'&&CAIXA_FILTER!=='__none__')?CAIXA_FILTER:'';
  wrap.innerHTML=`<select id="fx_caixa_sel">${opts}</select>`;
  const sel=document.getElementById('fx_caixa_sel');if(sel)sel.value=cur;
}

/* ════════ DASHBOARD ════════ */
/* painel de primeiros passos — só aparece enquanto o sistema está sendo configurado */
function renderOnboarding(){
  const el=document.getElementById('dashOnboarding');if(!el)return;
  // só para quem configura (gestor); membros não veem
  if(CR!=='gestor'){el.innerHTML='';return;}
  const temCaixa=S.caixas.length>0;
  const temConta=S.contas.length>0;
  const temLanc=S.flux.length>0;
  const temEquipe=S.users.length>1;
  // se o essencial já foi feito, não mostra nada
  if(temCaixa&&temConta&&temLanc){el.innerHTML='';return;}
  const passos=[
    {ok:temCaixa,ic:'🏪',t:'Cadastre seus caixas',s:'Um para cada ponto ou agência. Habilita filtros e relatórios por caixa.',btn:'Criar caixa',act:"sp('config')"},
    {ok:temConta,ic:'🏦',t:'Cadastre as contas bancárias',s:'Os bancos da empresa, para saber de qual conta entrou ou saiu cada valor.',btn:'Cadastrar conta',act:"sp('config')"},
    {ok:temLanc,ic:'📊',t:'Faça o primeiro lançamento',s:'Registre uma entrada ou saída no Fluxo de Caixa para o sistema ganhar vida.',btn:'Ir para o Fluxo',act:"sp('fluxo')"},
    {ok:temEquipe,ic:'👥',t:'Convide sua equipe',s:'Crie acessos para quem vai operar os caixas, cada um com seu e-mail e senha.',btn:'Gerir equipe',act:"sp('config')",opcional:true}
  ];
  const feitos=passos.filter(p=>p.ok&&!p.opcional).length;
  const totalObrig=passos.filter(p=>!p.opcional).length;
  const linhas=passos.map(p=>`
    <div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--border);${p.ok?'opacity:.55':''}">
      <span style="font-size:22px;flex-shrink:0;filter:${p.ok?'grayscale(1)':'none'}">${p.ok?'✅':p.ic}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:14px;${p.ok?'text-decoration:line-through;color:var(--t3)':''}">${esc(p.t)}${p.opcional?' <span style="font-weight:400;font-size:11px;color:var(--t3)">(opcional)</span>':''}</div>
        ${p.ok?'':`<div style="font-size:12px;color:var(--t3);line-height:1.4">${esc(p.s)}</div>`}
      </div>
      ${p.ok?'':`<button class="btn btnsm btnp" style="flex-shrink:0" onclick="${p.act}">${esc(p.btn)} →</button>`}
    </div>`).join('');
  el.innerHTML=`
    <div class="card" style="border-left:3px solid var(--com);margin-bottom:1.1rem">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:6px">
        <div style="font-family:'DM Serif Display',serif;font-size:18px">👋 Bem-vindo! Vamos configurar o sistema</div>
        <span style="font-size:12px;color:var(--t3)">${feitos} de ${totalObrig} passos essenciais</span>
      </div>
      <div style="font-size:12.5px;color:var(--t2);margin-bottom:8px">Siga os passos abaixo para deixar tudo pronto. Este guia some sozinho quando você terminar.</div>
      ${linhas}
    </div>`;
}
function renderDash(){
  const nJ=limiteDias();
  const scope=document.getElementById('dashScope');
  if(scope){
    const chip=nJ?` · 👁 ${rotuloJanela(nJ)}`:'';
    if(isFull()){renderCaixaFilter('dashScope');if(nJ){const ex=document.createElement('div');ex.style.cssText='margin:-4px 0 .8rem;font-size:11.5px;color:var(--t3)';ex.textContent='👁 Mostrando '+rotuloJanela(nJ)+' de movimentações.';scope.appendChild(ex);}}
    else{scope.innerHTML=`<div style="margin-bottom:.9rem;font-size:12px;color:var(--t3)">Resumo do seu caixa pessoal · <strong style="color:var(--t2)">${esc(CU)}</strong>${chip}</div>`;}
  }
  const dd=document.getElementById('ddate');
  if(dd)dd.textContent='Visão rápida da situação financeira · '+toBR(new Date().toISOString().slice(0,10));
  renderOnboarding();
  const all=scopedFlux();
  // quem tem janela de dias vê um painel coerente com o período visível
  if(nJ){renderDashJanela(all,nJ);return;}
  const saldo=all.reduce((s,e)=>s+(e.tipo==='entrada'?e.val:(e.tipo==='saida'?-e.val:0)),0); // saldo real (transferências internas não mudam o total)
  const cm=new Date().toISOString().slice(0,7);
  // receitas/despesas da EMPRESA excluem retiradas de sócio (pessoal)
  const mEnt=all.filter(e=>e.tipo==='entrada'&&!e.pessoal&&e.d.slice(0,7)===cm).reduce((s,e)=>s+e.val,0);
  const mSai=all.filter(e=>e.tipo==='saida'&&!e.pessoal&&e.d.slice(0,7)===cm).reduce((s,e)=>s+e.val,0);
  const lucro=mEnt-mSai;
  // retiradas de sócio no mês (fora do resultado, mas saem do caixa)
  const mRetiradas=all.filter(e=>e.pessoal&&e.d.slice(0,7)===cm).reduce((s,e)=>s+(e.tipo==='saida'?e.val:-e.val),0);
  // inadimplência: recebíveis vencidos (a receber em aberto, vencidos)
  const inadimplencia=S.receber.filter(c=>c.status==='aberto'&&days(c.venc)<0).reduce((s,c)=>s+valorAtualizado(c),0);
  // contas a vencer: a pagar em aberto ainda no prazo
  const aVencer=S.pagar.filter(c=>c.status==='aberto'&&days(c.venc)>=0).reduce((s,c)=>s+c.val,0);
  // caixa projetado: saldo + tudo a receber em aberto - tudo a pagar em aberto
  const totReceber=S.receber.filter(c=>c.status==='aberto').reduce((s,c)=>s+c.val,0);
  const totPagar=S.pagar.filter(c=>c.status==='aberto').reduce((s,c)=>s+valorAtualizado(c),0);
  const projetado=saldo+totReceber-totPagar;
  const k=document.getElementById('dashKpis');
  if(k)k.innerHTML=
     met('Saldo atual',money(saldo),saldo>=0?'var(--pos)':'var(--neg)','Contas + espécie')
    +met('Receitas do mês',money(mEnt),'var(--pos)','Recebido no mês')
    +met('Despesas do mês',money(mSai),'var(--neg)','Pago no mês (empresa)')
    +met('Lucro líquido',money(lucro),lucro>=0?'var(--pos)':'var(--neg)','Receitas − despesas')
    +met('Inadimplência',money(inadimplencia),'var(--com)','Recebíveis vencidos')
    +met('Contas a vencer',money(aVencer),'var(--gr)','Em aberto no prazo')
    +(canSeeSocios()&&mRetiradas!==0?met('Movimentações pessoais',money(mRetiradas),'var(--mkt)','Saídas pessoais no mês'):'')
    +met('Caixa projetado',money(projetado),projetado>=0?'var(--pos)':'var(--neg)','Saldo + a receber − a pagar');
  const sub=document.getElementById('dashChartSub');if(sub)sub.textContent='· Últimos 6 meses';
  const cardV=document.getElementById('dashVenc');if(cardV)cardV.style.display='';
  renderDashChart(all,cm);
  renderDashOrcamento();
  renderVencimentos();
  renderAlertas();
}
/* rótulo humano da janela: 1 dia = "hoje", senão "últimos N dias" */
function rotuloJanela(n){return n===1?'somente hoje':('últimos '+n+' dias');}
/* ── DASHBOARD DA JANELA (para usuários com visão limitada a N dias) ──
   Nada de "mês", "inadimplência" ou "projeção": só o que existe dentro do período visível. */
function renderDashJanela(all,n){
  const corte=dataCorte();
  const hoje=new Date().toISOString().slice(0,10);
  // dentro da janela, "all" já vem filtrado por scopedFlux()
  const ent=all.filter(e=>e.tipo==='entrada'&&!e.pessoal).reduce((s,e)=>s+e.val,0);
  const sai=all.filter(e=>e.tipo==='saida'&&!e.pessoal).reduce((s,e)=>s+e.val,0);
  const res=ent-sai;
  const entHoje=all.filter(e=>e.tipo==='entrada'&&!e.pessoal&&e.d===hoje).reduce((s,e)=>s+e.val,0);
  const saiHoje=all.filter(e=>e.tipo==='saida'&&!e.pessoal&&e.d===hoje).reduce((s,e)=>s+e.val,0);
  const nLanc=all.filter(e=>e.tipo!=='transf').length;
  const pess=all.filter(e=>e.pessoal).reduce((s,e)=>s+(e.tipo==='saida'?e.val:-e.val),0);
  const rot=rotuloJanela(n);
  const k=document.getElementById('dashKpis');
  if(k)k.innerHTML=
     met('Entradas · '+rot,money(ent),'var(--pos)',n===1?'Recebido hoje':'Recebido no período')
    +met('Saídas · '+rot,money(sai),'var(--neg)',n===1?'Pago hoje':'Pago no período')
    +met('Resultado do período',money(res),res>=0?'var(--pos)':'var(--neg)','Entradas − saídas')
    +met('Entradas de hoje',money(entHoje),'var(--pos)',toBR(hoje))
    +met('Saídas de hoje',money(saiHoje),'var(--neg)',toBR(hoje))
    +met('Lançamentos',String(nLanc),'var(--gr)',n===1?'Registrados hoje':'No período visível')
    +(canSeeSocios()&&pess!==0?met('Movimentações pessoais',money(pess),'var(--mkt)','No período visível'):'');
  // gráfico por DIA (não por mês)
  const sub=document.getElementById('dashChartSub');if(sub)sub.textContent='· '+(n===1?'Hoje':'Dia a dia · '+rot);
  renderDashChartDias(all,n);
  // painéis que não fazem sentido dentro da janela ficam ocultos
  const cardV=document.getElementById('dashVenc');if(cardV)cardV.style.display='none';
  const orc=document.getElementById('dashOrcamento');if(orc)orc.innerHTML='';
  const al=document.getElementById('dashAlertas');if(al)al.innerHTML='';
}
/* gráfico de barras entradas × saídas, um grupo por dia da janela */
function renderDashChartDias(all,n){
  const el=document.getElementById('dashChart');if(!el)return;
  const dias=[];
  for(let i=n-1;i>=0;i--){const x=new Date();x.setDate(x.getDate()-i);dias.push(x.toISOString().slice(0,10));}
  const G=dias.map(d=>({d,
    en:all.filter(e=>e.tipo==='entrada'&&!e.pessoal&&e.d===d).reduce((s,e)=>s+e.val,0),
    sa:all.filter(e=>e.tipo==='saida'&&!e.pessoal&&e.d===d).reduce((s,e)=>s+e.val,0)}));
  const MX=Math.max(...G.map(g=>Math.max(g.en,g.sa)),1);
  const temDado=G.some(g=>g.en>0||g.sa>0);
  if(!temDado){
    el.innerHTML=`<div class="empty" style="padding:1.6rem .6rem;text-align:center"><div style="font-size:24px;margin-bottom:6px">📊</div><div style="font-weight:600;font-size:13px;color:var(--t2)">Nenhuma movimentação ${n===1?'hoje':'no período'}</div><div style="font-size:11.5px;color:var(--t3);margin-top:3px">Os lançamentos aparecem aqui assim que forem registrados.</div></div>`;
    return;
  }
  const W=440,H=130,PB=28,PH=H-PB-8,GW=W/Math.max(G.length,1);
  const bw=Math.max(4,Math.min(15,GW/2.6));
  let bars='',lbls='';
  G.forEach((g,i)=>{
    const cx=i*GW+GW/2;
    const hE=g.en>0?Math.max(g.en/MX*PH,1):0, hS=g.sa>0?Math.max(g.sa/MX*PH,1):0;
    if(hE)bars+=`<rect x="${(cx-bw-1).toFixed(1)}" y="${(H-PB-hE).toFixed(1)}" width="${bw.toFixed(1)}" height="${hE.toFixed(1)}" rx="2" fill="#6FD69A" opacity=".9"><title>${toBR(g.d)} · entradas ${money(g.en)}</title></rect>`;
    if(hS)bars+=`<rect x="${(cx+1).toFixed(1)}" y="${(H-PB-hS).toFixed(1)}" width="${bw.toFixed(1)}" height="${hS.toFixed(1)}" rx="2" fill="#EC8B6E" opacity=".88"><title>${toBR(g.d)} · saídas ${money(g.sa)}</title></rect>`;
    // rótulo: dia/mês curto; se a janela for grande, mostra dia sim dia não
    const mostrar=G.length<=10||i%2===0||i===G.length-1;
    if(mostrar){
      const dt=g.d.slice(8,10)+'/'+g.d.slice(5,7);
      const hj=g.d===new Date().toISOString().slice(0,10);
      lbls+=`<text x="${cx}" y="${H-9}" text-anchor="middle" font-size="9.5" fill="${hj?'#C8D3F0':'#8194C6'}" font-weight="${hj?'700':'400'}">${hj?'hoje':dt}</text>`;
    }
  });
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:140px;overflow:visible">${bars}${lbls}</svg>
  <div style="display:flex;gap:14px;margin-top:6px;font-size:11px;color:var(--t2)"><span style="display:flex;align-items:center;gap:5px"><span style="width:9px;height:9px;border-radius:2px;background:#6FD69A"></span>Entradas</span><span style="display:flex;align-items:center;gap:5px"><span style="width:9px;height:9px;border-radius:2px;background:#EC8B6E"></span>Saídas</span></div>`;
}
/* painel de vencimentos próximos no dashboard (cobrança/lembretes) */
function renderVencimentos(){
  const el=document.getElementById('dashVenc');if(!el)return;
  const recAb=S.receber.filter(c=>c.status==='aberto');
  const pagAb=S.pagar.filter(c=>c.status==='aberto');
  const cabecalho='<div class="ctitle">Próximos vencimentos <button class="btn btnsm" style="border:none;background:none;color:var(--gr);padding:0" onclick="sp(\'fluxo\')">Ver fluxo →</button></div>';
  // junta a receber e a pagar em aberto, ordena por vencimento, pega os próximos 6
  const itens=[
    ...recAb.map(c=>({tipo:'rec',nome:c.cli,desc:c.desc,venc:c.venc,val:c.val,id:c.id,acr:acrescimo(c)})),
    ...pagAb.map(c=>({tipo:'pag',nome:c.forn,desc:c.desc,venc:c.venc,val:c.val,id:c.id,acr:acrescimo(c)}))
  ].sort((a,b)=>a.venc.localeCompare(b.venc)).slice(0,7);
  if(!itens.length){
    el.innerHTML=cabecalho+'<div class="empty">Nenhuma conta em aberto 🎉</div>';
    return;
  }
  const linhas=itens.map(it=>{
    const d=days(it.venc);const venc=d<0;
    const isRec=it.tipo==='rec';
    const tagCor=isRec?'background:var(--ok);color:var(--pos)':'background:var(--pl);color:var(--peace)';
    const tagTxt=isRec?'A receber':'A pagar';
    const valCor=isRec?'var(--pos)':'var(--peace)';
    const sit=venc?'<span class="badge bdanger" style="font-size:9px">vencido</span>':d===0?'<span class="badge bwarn" style="font-size:9px">hoje</span>':'';
    const btn=isRec&&venc?`<button class="btn btnsm" onclick="cobrar('${it.id}')" title="Gerar cobrança">✉</button>`:'';
    return`<div class="row" style="padding:10px 0">
      <div style="display:flex;align-items:center;gap:11px;min-width:0">
        <span style="font-size:10px;font-weight:600;padding:4px 9px;border-radius:20px;${tagCor};white-space:nowrap">${tagTxt}</span>
        <div style="min-width:0"><div class="rlabel">${esc(it.nome)}</div><div class="rsub">${esc(it.desc||'')}</div></div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:11px;color:var(--t3);margin-bottom:2px">${fmt(it.venc)} ${sit}</div>
        <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end"><span style="font-weight:600;color:${valCor}">${isRec?'':'−'}${money(it.val+it.acr)}</span>${btn}</div>
      </div>
    </div>`;
  }).join('');
  el.innerHTML=cabecalho+linhas;
}
/* painel de alertas inteligentes no dashboard */
function renderAlertas(){
  const el=document.getElementById('dashAlertas');if(!el)return;
  const alertas=alertasInteligentes();
  if(!alertas.length){el.innerHTML='';return;}
  const cor={danger:'var(--dng)',warn:'var(--com)',info:'var(--gr)'};
  const bg={danger:'#FBEAE5',warn:'#FBF3E2',info:'#E8F1FB'};
  const ico={danger:'⚠️',warn:'🔔',info:'💡'};
  el.innerHTML='<div class="card" style="margin-bottom:1rem"><div class="ctitle">Alertas inteligentes</div>'+
    alertas.map(a=>`<div style="display:flex;gap:9px;align-items:flex-start;padding:9px 11px;border-radius:var(--rs);background:${bg[a.tipo]};margin-bottom:6px;border-left:3px solid ${cor[a.tipo]}"><span>${ico[a.tipo]}</span><span style="font-size:13px;color:var(--t2);line-height:1.4">${esc(a.msg)}</span></div>`).join('')+
    '</div>';
}
function renderDashChart(all,cm){
  const el=document.getElementById('dashChart');if(!el)return;
  // últimos 6 meses entradas vs saídas
  const now=new Date();const meses=[];
  for(let i=5;i>=0;i--){const x=new Date(now);x.setMonth(x.getMonth()-i);meses.push(x.toISOString().slice(0,7));}
  const G=meses.map(m=>({m,en:all.filter(e=>e.tipo==='entrada'&&e.d.slice(0,7)===m).reduce((s,e)=>s+e.val,0),sa:all.filter(e=>e.tipo==='saida'&&e.d.slice(0,7)===m).reduce((s,e)=>s+e.val,0)}));
  const MX=Math.max(...G.map(g=>Math.max(g.en,g.sa)),1);
  const W=440,H=130,PB=28,PH=H-PB-8,GW=W/6;
  let bars='',lbls='';
  G.forEach((g,i)=>{
    const cx=i*GW+GW/2;
    const hE=Math.max(g.en/MX*PH,1),hS=Math.max(g.sa/MX*PH,1);
    bars+=`<rect x="${(cx-17).toFixed(1)}" y="${(H-PB-hE).toFixed(1)}" width="15" height="${hE.toFixed(1)}" rx="2" fill="#6FD69A" opacity=".9"/>`;
    bars+=`<rect x="${(cx+2).toFixed(1)}" y="${(H-PB-hS).toFixed(1)}" width="15" height="${hS.toFixed(1)}" rx="2" fill="#EC8B6E" opacity=".88"/>`;
    const nm=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][parseInt(g.m.slice(5,7))-1];
    lbls+=`<text x="${cx}" y="${H-9}" text-anchor="middle" font-size="10" fill="#8194C6">${nm}</text>`;
  });
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:140px;overflow:visible">${bars}${lbls}</svg>
  <div style="display:flex;gap:14px;margin-top:6px;font-size:11px;color:var(--t2)"><span style="display:flex;align-items:center;gap:5px"><span style="width:9px;height:9px;border-radius:2px;background:#6FD69A"></span>Entradas</span><span style="display:flex;align-items:center;gap:5px"><span style="width:9px;height:9px;border-radius:2px;background:#EC8B6E"></span>Saídas</span></div>`;
}

/* ── helpers compartilhados de contas ── */
function avancaDataConta(iso,i,freq){const base=new Date(iso+'T12:00:00');const dt=new Date(base);if(freq==='semanal')dt.setDate(base.getDate()+i*7);else dt.setMonth(base.getMonth()+i);return dt.toISOString().slice(0,10);}
/* calcula acréscimo de juros (ao mês, pro rata) + multa para conta vencida */
function acrescimo(c){
  const d=days(c.venc);if(d>=0)return 0;
  const atraso=Math.abs(d);
  const multa=(c.multa||0)/100*c.val;
  const juros=(c.juros||0)/100*c.val*(atraso/30); // pró-rata mensal
  return multa+juros;
}
function valorAtualizado(c){return c.val+acrescimo(c);}
/* lista de centros de custo já usados (para o datalist) */
function centrosCusto(){
  const set=new Set();
  S.flux.forEach(e=>{if(e.cc)set.add(e.cc);});
  S.pagar.forEach(c=>{if(c.cc)set.add(c.cc);});
  S.receber.forEach(c=>{if(c.cc)set.add(c.cc);});
  return [...set].sort();
}
function renderCCList(){const dl=document.getElementById('cc_list');if(dl)dl.innerHTML=centrosCusto().map(c=>`<option>${esc(c)}</option>`).join('');}

/* ════════════════════════════════════════
   AUTOMAÇÕES (sem servidor)
════════════════════════════════════════ */

/* ── 1. Boleto: extrai valor e vencimento da linha digitável ── */
function parseLinhaDigitavel(raw){
  const s=(raw||'').replace(/\D/g,'');
  // Boleto bancário: 47 dígitos. Convênio/arrecadação: 48 dígitos.
  if(s.length===47){
    // fator de vencimento: posições 33-36 (após remover dígitos verificadores dos campos)
    // estrutura: campo1(0-9) campo2(10-20) campo3(21-31) dv(32) fator(33-36) valor(37-46)
    const fator=parseInt(s.substr(33,4),10);
    const centavos=parseInt(s.substr(37,10),10);
    const val=centavos/100;
    let venc='';
    if(fator>0){
      // base 07/10/1997; a partir de 22/02/2025 o fator reinicia, mas mantemos a base clássica
      const base=new Date(1997,9,7);
      base.setDate(base.getDate()+fator);
      venc=base.toISOString().slice(0,10);
    }
    return {ok:true,tipo:'bancario',val:val>0?val:null,venc};
  }
  if(s.length===48){
    // arrecadação (concessionárias): valor nas posições 4-14
    const centavos=parseInt(s.substr(4,11),10);
    const val=centavos/100;
    return {ok:true,tipo:'arrecadacao',val:val>0?val:null,venc:''};
  }
  return {ok:false};
}

/* ── 4. Busca dados da empresa pelo CNPJ (BrasilAPI) ── */
async function buscarCNPJ(cnpj){
  const c=(cnpj||'').replace(/\D/g,'');
  if(c.length!==14)return {ok:false,erro:'CNPJ deve ter 14 dígitos.'};
  try{
    const r=await fetch('https://brasilapi.com.br/api/cnpj/v1/'+c);
    if(!r.ok)return {ok:false,erro:'CNPJ não encontrado.'};
    const d=await r.json();
    return {ok:true,nome:d.razao_social||d.nome_fantasia||'',fantasia:d.nome_fantasia||'',
      cidade:d.municipio||'',uf:d.uf||'',cnpj:c};
  }catch(e){return {ok:false,erro:'Falha ao consultar (sem internet?).'};}
}
function fmtCNPJ(c){c=(c||'').replace(/\D/g,'');if(c.length!==14)return c;return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5');}

/* ── 3. Importar XML de NF-e / NFS-e → cria conta ── */
function parseNFXML(txt){
  try{
    const doc=new DOMParser().parseFromString(txt,'text/xml');
    const g=(tags)=>{for(const t of tags){const el=doc.getElementsByTagName(t)[0];if(el&&el.textContent.trim())return el.textContent.trim();}return '';};
    // valor total
    let val=parseFloat(g(['vNF','vLiq','ValorLiquidoNfse','vServ','ValorServicos','vTotal']))||0;
    // emitente (fornecedor)
    let nome=g(['xNome','RazaoSocial','xFant'])||'Fornecedor (NF)';
    // data
    let dataRaw=g(['dhEmi','dEmi','DataEmissao','dCompet']);
    let venc='';
    if(dataRaw){const m=dataRaw.match(/(\d{4})-(\d{2})-(\d{2})/);if(m)venc=`${m[1]}-${m[2]}-${m[3]}`;}
    // número da nota
    let num=g(['nNF','Numero','nDPS']);
    return {ok:val>0,nome,val,venc,num};
  }catch(e){return {ok:false};}
}

/* ── 10/11. Categorização inteligente: aprende desc→categoria ── */
function aprdCategoria(desc,cat){
  if(!desc||!cat)return;
  if(!S.regrasCat)S.regrasCat={};
  const chave=desc.trim().toLowerCase().split(/\s+/).slice(0,2).join(' ');
  if(chave)S.regrasCat[chave]=cat;
}
function sugereCategoria(desc){
  if(!S.regrasCat||!desc)return '';
  const d=desc.trim().toLowerCase();
  // tenta casar pelas primeiras palavras
  const chave=d.split(/\s+/).slice(0,2).join(' ');
  if(S.regrasCat[chave])return S.regrasCat[chave];
  // tenta por qualquer chave contida na descrição
  for(const k in S.regrasCat){if(d.includes(k))return S.regrasCat[k];}
  return '';
}

/* ── 9. Gera contas recorrentes vencidas automaticamente ── */
function gerarRecorrentesAuto(){
  if(CR!=='gestor'&&CR!=='operacional'&&CR!=='dona')return; // só visão completa dispara
  let criadas=0;const hoje=new Date().toISOString().slice(0,10);
  ['pagar','receber'].forEach(tipo=>{
    const arr=S[tipo];
    // pega grupos recorrentes e vê se falta gerar o próximo ciclo
    const modelos={};
    arr.forEach(c=>{if(c.autoRecorr&&c.freq){const k=c.autoRecorr;if(!modelos[k]||c.venc>modelos[k].venc)modelos[k]=c;}});
    Object.values(modelos).forEach(m=>{
      let prox=avancaDataConta(m.venc,1,m.freq);
      // gera enquanto a próxima data já passou ou é hoje (evita acumular muitas)
      let guard=0;
      while(prox<=hoje&&guard<24){
        const novo={...m,id:uid(),venc:prox,status:'aberto'};
        delete novo.pagoEm;delete novo.recebidoEm;delete novo.valPago;delete novo.valRecebido;
        arr.push(novo);criadas++;
        prox=avancaDataConta(prox,1,m.freq);guard++;
      }
    });
  });
  if(criadas>0){log('Geradas '+criadas+' conta(s) recorrente(s) automaticamente');save();}
  return criadas;
}

/* ── 12. Alertas inteligentes ── */
function alertasInteligentes(){
  const out=[];
  const hoje=new Date().toISOString().slice(0,10);
  // saldo atual consolidado
  const saldo=S.flux.reduce((s,e)=>s+(e.tipo==='entrada'?e.val:(e.tipo==='saida'?-e.val:0)),0);
  // projeção 30 dias: + a receber em aberto - a pagar em aberto no período
  const lim=new Date();lim.setDate(lim.getDate()+30);const limISO=lim.toISOString().slice(0,10);
  const aReceber=S.receber.filter(c=>c.status==='aberto'&&c.venc<=limISO).reduce((s,c)=>s+c.val,0);
  const aPagar=S.pagar.filter(c=>c.status==='aberto'&&c.venc<=limISO).reduce((s,c)=>s+valorAtualizado(c),0);
  const proj=saldo+aReceber-aPagar;
  if(proj<0)out.push({tipo:'danger',msg:`Saldo projetado para 30 dias ficará NEGATIVO: ${money(proj)}. Reveja pagamentos ou acelere recebimentos.`});
  else if(proj<saldo*0.2&&saldo>0)out.push({tipo:'warn',msg:`Saldo projetado em 30 dias cai para ${money(proj)} — fluxo apertado.`});
  // contas grandes vencendo em 7 dias
  const lim7=new Date();lim7.setDate(lim7.getDate()+7);const l7=lim7.toISOString().slice(0,10);
  const grandes=S.pagar.filter(c=>c.status==='aberto'&&c.venc>=hoje&&c.venc<=l7).sort((a,b)=>b.val-a.val).slice(0,3);
  grandes.forEach(c=>{if(c.val>=1000)out.push({tipo:'warn',msg:`Conta grande vencendo: ${c.forn} — ${money(c.val)} em ${fmt(c.venc)}.`});});
  // clientes que sempre atrasam (3+ recebimentos com atraso)
  const atrasos={};
  S.receber.filter(c=>c.status==='recebido'&&c.recebidoEm&&c.recebidoEm>c.venc).forEach(c=>{atrasos[c.cli]=(atrasos[c.cli]||0)+1;});
  Object.entries(atrasos).filter(([k,n])=>n>=3).forEach(([k,n])=>out.push({tipo:'info',msg:`Cliente "${k}" já atrasou ${n} pagamentos — considere cobrança antecipada.`}));
  // total vencido a receber
  const venc=S.receber.filter(c=>c.status==='aberto'&&days(c.venc)<0);
  if(venc.length)out.push({tipo:'danger',msg:`${venc.length} cobrança(s) vencida(s), total ${money(venc.reduce((s,c)=>s+valorAtualizado(c),0))} a receber.`});
  return out;
}

/* ── Funções de interface das automações ── */
function lerBoletoPagar(){
  const raw=v('pg_boleto');if(!raw.trim()){toast('Cole a linha digitável do boleto primeiro.','err');return;}
  const r=parseLinhaDigitavel(raw);
  if(!r.ok){toast('Não reconheci o boleto. A linha digitável deve ter 47 dígitos (boleto bancário) ou 48 (concessionária).','err');return;}
  if(r.val){const el=document.getElementById('pg_val');if(el)el.value=r.val.toFixed(2);}
  if(r.venc){const el=document.getElementById('pg_venc');if(el)el.value=toBR(r.venc);}
  let msg='Boleto lido!';
  if(r.val)msg+=' Valor: '+money(r.val)+'.';else msg+=' (valor não detectado, preencha manualmente).';
  if(r.venc)msg+=' Vencimento: '+fmt(r.venc)+'.';
  alert(msg);
}
async function buscarCNPJPagar(){
  const c=v('pg_cnpj');if(!c.trim()){toast('Digite o CNPJ.','err');return;}
  const btn=event&&event.target;if(btn)btn.textContent='...';
  const r=await buscarCNPJ(c);
  if(btn)btn.textContent='🔎 CNPJ';
  if(!r.ok){toast(r.erro||'CNPJ não encontrado.','err');return;}
  document.getElementById('pg_forn').value=r.nome;
  document.getElementById('pg_cnpj').value=fmtCNPJ(r.cnpj);
}
async function buscarCNPJReceber(){
  const c=v('rc_cnpj');if(!c.trim()){toast('Digite o CNPJ.','err');return;}
  const btn=event&&event.target;if(btn)btn.textContent='...';
  const r=await buscarCNPJ(c);
  if(btn)btn.textContent='🔎 CNPJ';
  if(!r.ok){toast(r.erro||'CNPJ não encontrado.','err');return;}
  document.getElementById('rc_cli').value=r.nome;
  document.getElementById('rc_cnpj').value=fmtCNPJ(r.cnpj);
}
/* sugere categoria ao digitar a descrição (sem sobrescrever escolha manual) */
function autoCat(prefixo){
  const desc=v(prefixo+'_desc');if(!desc||desc.length<3)return;
  const sug=sugereCategoria(desc);if(!sug)return;
  const sel=document.getElementById(prefixo+'_cat');if(!sel)return;
  // só preenche se ainda não houver escolha consciente (primeira opção)
  if(sel.selectedIndex<=0){const op=[...sel.options].find(o=>o.value===sug);if(op)sel.value=sug;}
}
/* importa XML de NF e preenche o formulário de conta a pagar */
function importarNF(e){
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=ev=>{
    const nf=parseNFXML(ev.target.result);
    if(!nf.ok){toast('Não consegui ler os dados da nota neste XML. Verifique se é um XML de NF-e ou NFS-e válido.','err');e.target.value='';return;}
    document.getElementById('pg_forn').value=nf.nome;
    if(nf.val){const el=document.getElementById('pg_val');if(el)el.value=nf.val.toFixed(2);}
    if(nf.venc){const el=document.getElementById('pg_venc');if(el)el.value=toBR(nf.venc);}
    const dsc=document.getElementById('pg_desc');if(dsc)dsc.value='NF '+(nf.num||'')+' - '+nf.nome;
    autoCat('pg');
    e.target.value='';
    toast('Nota importada! Confira os dados preenchidos no formulário e clique em Adicionar.','ok');
  };
  r.readAsText(f,'utf-8');
}
