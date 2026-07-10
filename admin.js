/* ══════════════════════════════════════════════════════════
   Auricélia Transportes · Central Financeira
   admin.js — Cadastros do gestor: caixas, contas, pessoas, categorias, usuários e equipa
   (script clássico: as funções aqui são globais para o HTML)
══════════════════════════════════════════════════════════ */

/* ════════ CONFIG: CAIXAS (gestor) ════════ */
function addCaixa(){
  if(CR!=='gestor')return;
  const nome=v('cx_nome').trim();if(!nome){toast('Informe o nome do caixa.','err');return;}
  const cor=v('cx_cor')||'var(--mkt)';
  const parceria=v('cx_parceria').trim();
  const comissao=Math.max(0,Math.min(100,parseFloat(v('cx_comissao'))||0));
  S.caixas.push({id:'cx_'+uid(),nome,cor,parceria,comissao,t:new Date().toISOString()});
  log('Gestor criou caixa: '+nome+(comissao?' (comissão '+comissao+'% · '+(parceria||'parceria')+')':''));save();
  clr('cx_nome','cx_parceria','cx_comissao');renderCaixaList();renderCaixaAssignSelect();renderUsers();
}
function delCaixa(id){
  const c=S.caixas.find(x=>x.id===id);if(!c)return;
  const usados=S.flux.filter(e=>e.caixaId===id).length;
  const atrib=S.users.filter(u=>u.caixaId===id).length;
  if(!confirm('Remover o caixa "'+c.nome+'"?'+(usados?' '+usados+' lançamento(s) ficarão sem caixa.':'')+(atrib?' '+atrib+' usuário(s) perderão a atribuição.':'')))return;
  S.flux.forEach(e=>{if(e.caixaId===id)e.caixaId='';});
  S.users.forEach(u=>{if(u.caixaId===id)u.caixaId='';});
  S.caixas=S.caixas.filter(x=>x.id!==id);
  log('Gestor removeu caixa: '+c.nome);save();renderCaixaList();renderCaixaAssignSelect();renderUsers();
}
function renameCaixa(id,nome){const c=S.caixas.find(x=>x.id===id);if(!c)return;c.nome=nome.trim()||c.nome;log('Gestor renomeou caixa: '+c.nome);save();renderCaixaList();renderCaixaAssignSelect();renderUsers();}
function renderCaixaList(){
  const el=document.getElementById('caixaList');if(!el)return;
  if(!S.caixas.length){el.innerHTML=emptyState('🏪','Nenhum caixa cadastrado','Crie um caixa para cada ponto/agência (ex: Imperatriz, Goiânia). Depois você filtra o financeiro por caixa e gera relatórios separados.');return;}
  el.innerHTML=S.caixas.map(c=>{
    const atrib=S.users.filter(u=>u.caixaId===c.id).map(u=>u.name);
    const nLanc=S.flux.filter(e=>e.caixaId===c.id).length;
    const com=c.comissao||0;
    return`<div class="row" style="flex-wrap:wrap;gap:8px">
      <div style="display:flex;align-items:center;gap:10px;min-width:0;flex:1">
        <span style="width:12px;height:12px;border-radius:50%;background:${c.cor};flex-shrink:0"></span>
        <div style="min-width:0"><input value="${esc(c.nome)}" onchange="renameCaixa('${c.id}',this.value)" style="font-weight:600;max-width:200px"><div class="rsub">${atrib.length?'Atribuído a: '+esc(atrib.join(', ')):'Sem usuário atribuído'} · ${nLanc} lançamento(s)</div></div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        <input value="${esc(c.parceria||'')}" onchange="setCaixaParceria('${c.id}',this.value)" placeholder="Parceria" style="max-width:140px;font-size:12px;padding:4px 8px">
        <input type="number" step="0.1" min="0" max="100" value="${com||''}" onchange="setCaixaComissao('${c.id}',this.value)" placeholder="%" title="Comissão % sobre entradas" style="max-width:70px;font-size:12px;padding:4px 8px">
        <span style="font-size:12px;color:var(--t3)">%</span>
        <button class="btn btnsm" style="border-color:#F09595;color:var(--dngt)" onclick="delCaixa('${c.id}')">Remover</button>
      </div>
    </div>`;
  }).join('');
}
function setCaixaParceria(id,val){const c=S.caixas.find(x=>x.id===id);if(!c)return;c.parceria=val.trim();save();renderCaixaList();}
function setCaixaComissao(id,val){const c=S.caixas.find(x=>x.id===id);if(!c)return;c.comissao=Math.max(0,Math.min(100,parseFloat(val)||0));log('Ajustou comissão do caixa '+c.nome+': '+c.comissao+'%');save();renderCaixaList();renderComissoes&&renderComissoes();}
/* ── COMISSÕES DE PARCERIA ── */
function dadosComissoes(per){
  // caixas com comissão > 0; entradas do período (exclui movimentações pessoais)
  return S.caixas.filter(c=>(c.comissao||0)>0).map(c=>{
    let ents=S.flux.filter(e=>e.caixaId===c.id&&e.tipo==='entrada'&&!e.pessoal);
    ents=fpd(ents.map(e=>({...e})),'d',per);
    const recebido=ents.reduce((s,e)=>s+e.val,0);
    const comissao=recebido*(c.comissao/100);
    return {id:c.id,nome:c.nome,cor:c.cor,parceria:c.parceria||'',pct:c.comissao,recebido,comissao,n:ents.length};
  }).sort((a,b)=>b.comissao-a.comissao);
}
function renderComissoes(){
  const mg=document.getElementById('com_meses');if(mg&&!mg.children.length)mg.innerHTML=opcoesMeses();
  const per=v('com_per')||'mes';
  const dados=dadosComissoes(per);
  const totalRec=dados.reduce((s,d)=>s+d.recebido,0);
  const totalCom=dados.reduce((s,d)=>s+d.comissao,0);
  const kpis=document.getElementById('comKpis');
  if(kpis)kpis.innerHTML=
     met('Recebido (caixas c/ parceria)',money(totalRec),'var(--pos)',labelPeriodo(per))
    +met('Comissão total devida',money(totalCom),'var(--com)','A pagar às parcerias')
    +met('Caixas com comissão',dados.length,'var(--text)');
  const el=document.getElementById('comissoesBody');if(!el)return;
  if(!dados.length){el.innerHTML='<div class="empty-rich"><span class="ei">🤝</span><div class="et">Nenhuma comissão configurada</div><div class="es">Defina a % de comissão de cada caixa em Configurações → Caixas. Aqui você verá quanto a empresa deve a cada parceria.</div></div>';return;}
  el.innerHTML=dados.map(d=>`
    <div class="card" style="margin-bottom:.8rem">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div style="display:flex;align-items:center;gap:12px;min-width:0">
          <span style="width:12px;height:12px;border-radius:50%;background:${d.cor};flex-shrink:0"></span>
          <div style="min-width:0">
            <div style="font-weight:700;font-size:15px">${esc(d.nome)}</div>
            <div class="rsub">${d.parceria?esc(d.parceria)+' · ':''}${d.pct}% sobre entradas · ${d.n} recebimento(s)</div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:.05em">Comissão devida</div>
          <div style="font-size:22px;font-weight:700;color:var(--com)">${money(d.comissao)}</div>
        </div>
      </div>
      <div class="ir" style="margin-top:10px;gap:14px;font-size:13px;align-items:center;flex-wrap:wrap">
        <span style="color:var(--t2)">Recebido no período: <strong style="color:var(--pos)">${money(d.recebido)}</strong></span>
        <span style="color:var(--t2)">Cálculo: <strong>${money(d.recebido)} × ${d.pct}%</strong></span>
        <span style="flex:1"></span>
        ${d.comissao>0?`<button class="btn btnsm" style="border-color:var(--com);color:var(--warnt)" onclick="gerarContaComissao('${d.id}')">📄 Gerar conta a pagar</button>`:''}
      </div>
    </div>`).join('');
}
/* transforma a comissão calculada do período numa conta a pagar */
function gerarContaComissao(caixaId){
  const per=v('com_per')||'mes';
  const d=dadosComissoes(per).find(x=>x.id===caixaId);
  if(!d||d.comissao<=0){toast('Nada a gerar para este caixa no período.','err');return;}
  const forn=d.parceria||('Parceria — '+d.nome);
  const descr='Comissão '+d.pct+'% de '+labelPeriodo(per)+' — caixa '+d.nome;
  // evita duplicar: mesma descrição em aberto
  if(S.pagar.find(p=>p.status==='aberto'&&p.desc===descr)){toast('Já existe uma conta a pagar em aberto desta comissão/período.','err');return;}
  if(!confirm('Gerar conta a pagar de '+money(d.comissao)+' para "'+forn+'"?\n\n'+descr+'\nVencimento: 7 dias.'))return;
  const venc=new Date();venc.setDate(venc.getDate()+7);
  const cat=garanteCategoria('Comissões de parceria','saida');
  S.pagar.push({id:uid(),forn,venc:venc.toISOString().slice(0,10),desc:descr,cat,cc:'',val:+d.comissao.toFixed(2),juros:0,multa:0,status:'aberto',origem:'comissao',by:CU,t:new Date().toISOString()});
  log('Gerou conta a pagar de comissão: '+forn+' ('+money(d.comissao)+')');save();renderPagar();
  toast('Conta a pagar criada: '+forn+' — '+money(d.comissao)+' (venc. 7 dias).','ok');
}
function imprimirComissoes(){
  const per=v('com_per')||'mes';
  const dados=dadosComissoes(per);
  if(!dados.length){toast('Nenhum caixa com comissão configurada no período.','err');return;}
  const totalRec=dados.reduce((s,d)=>s+d.recebido,0);
  const totalCom=dados.reduce((s,d)=>s+d.comissao,0);
  const resumo=`<div class="resumo"><span>Recebido total: <b>${money(totalRec)}</b></span><span>Comissão total devida: <b style="color:#A32D2D">${money(totalCom)}</b></span></div>`;
  const linhas=dados.map(d=>`<tr>
    <td>${esc(d.nome)}</td><td>${esc(d.parceria||'—')}</td>
    <td class="t">${d.pct}%</td>
    <td class="v">${money(d.recebido)}</td>
    <td class="v" style="color:#A32D2D">${money(d.comissao)}</td>
  </tr>`).join('');
  const cab=[{txt:'Caixa'},{txt:'Parceria'},{txt:'%',cls:'t'},{txt:'Recebido',cls:'v'},{txt:'Comissão',cls:'v'}];
  abrirDocPDF('Comissões de Parceria',`Período: ${labelPeriodo(per)}`,resumo,cab,linhas);
}
/* preenche o select de atribuição de caixa no form de usuário */
function renderCaixaAssignSelect(selected){
  const el=document.getElementById('cu_caixa');if(!el)return;
  const cur=selected!==undefined?selected:el.value;
  el.innerHTML='<option value="">Sem caixa atribuído</option>'+S.caixas.map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('');
  el.value=cur||'';
}

/* ════════ CONFIG: CONTAS BANCÁRIAS (gestor) ════════ */
function addConta(){
  if(CR!=='gestor')return;
  const nome=v('ct_nome').trim();if(!nome){toast('Informe o nome da conta bancária (ex: Banco do Brasil - CC 12345).','err');return;}
  S.contas.push({id:'ct_'+uid(),nome,t:new Date().toISOString()});
  log('Gestor criou conta bancária: '+nome);save();
  clr('ct_nome');renderContaList();renderContaSelect();
}
function delConta(id){
  const c=S.contas.find(x=>x.id===id);if(!c)return;
  const usados=S.flux.filter(e=>e.contaId===id).length;
  if(!confirm('Remover a conta "'+c.nome+'"?'+(usados?' '+usados+' lançamento(s) ficarão sem conta.':'')))return;
  S.flux.forEach(e=>{if(e.contaId===id)e.contaId='';});
  S.contas=S.contas.filter(x=>x.id!==id);
  log('Gestor removeu conta bancária: '+c.nome);save();renderContaList();renderContaSelect();
}
function renameConta(id,nome){const c=S.contas.find(x=>x.id===id);if(!c)return;c.nome=nome.trim()||c.nome;log('Gestor renomeou conta: '+c.nome);save();renderContaList();renderContaSelect();}
function contaNome(id){const c=S.contas.find(x=>x.id===id);return c?c.nome:'';}
function renderContaList(){
  const el=document.getElementById('contaList');if(!el)return;
  if(!S.contas.length){el.innerHTML=emptyState('🏦','Nenhuma conta bancária','Cadastre os bancos da empresa (BB, Sicoob, Caixa). Ao lançar, você escolhe em qual conta o dinheiro entrou ou saiu.');return;}
  el.innerHTML=S.contas.map(c=>{
    const nLanc=S.flux.filter(e=>e.contaId===c.id||e.contaDe===c.id||e.contaPara===c.id).length;
    const sc=saldoConta(c.id);
    return`<div class="row">
      <div style="display:flex;align-items:center;gap:10px;min-width:0">
        <span style="flex-shrink:0">🏦</span>
        <div style="min-width:0"><input value="${esc(c.nome)}" onchange="renameConta('${c.id}',this.value)" style="font-weight:600;max-width:260px"><div class="rsub">${nLanc} lançamento(s) · saldo <strong style="color:${sc>=0?'var(--pos)':'var(--neg)'}">${money(sc)}</strong></div></div>
      </div>
      <button class="btn btnsm" style="border-color:#F09595;color:var(--dngt)" onclick="delConta('${c.id}')">Remover</button>
    </div>`;
  }).join('');
}
/* preenche o select de conta bancária no formulário de lançamento */
function renderContaSelect(){
  const el=document.getElementById('fx_conta');if(!el)return;
  const cur=el.value;
  el.innerHTML='<option value="">Conta bancária (opcional)</option>'+S.contas.map(c=>`<option value="${c.id}">🏦 ${esc(c.nome)}</option>`).join('');
  el.value=cur||'';
}

/* ════════ PESSOAS (Movimentações Pessoais) ════════ */
function socioNome(id){const s=S.socios.find(x=>x.id===id);return s?s.nome:'';}
function addSocio(){
  if(!canSeeSocios())return;
  const nome=v('so_nome').trim();if(!nome){toast('Informe o nome da pessoa.','err');return;}
  S.socios.push({id:'so_'+uid(),nome,t:new Date().toISOString()});
  log('Cadastrou pessoa: '+nome);save();clr('so_nome');renderSocioList();renderSocioSelect();renderSociosConta();
}
function delSocio(id){
  const s=S.socios.find(x=>x.id===id);if(!s)return;
  const usados=S.flux.filter(e=>e.socioId===id).length;
  if(!confirm('Remover a pessoa "'+s.nome+'"?'+(usados?' '+usados+' movimentação(ões) ficarão sem pessoa.':'')))return;
  S.flux.forEach(e=>{if(e.socioId===id)e.socioId='';});
  S.socios=S.socios.filter(x=>x.id!==id);
  log('Removeu pessoa: '+s.nome);save();renderSocioList();renderSocioSelect();renderSociosConta();
}
function renameSocio(id,nome){const s=S.socios.find(x=>x.id===id);if(!s)return;s.nome=nome.trim()||s.nome;log('Renomeou pessoa: '+s.nome);save();renderSocioList();renderSocioSelect();renderSociosConta();}
/* select de sócio no formulário de lançamento */
function renderSocioSelect(){
  const el=document.getElementById('fx_socio');if(!el)return;
  const cur=el.value;
  el.innerHTML='<option value="">Selecione a pessoa…</option>'+S.socios.map(s=>`<option value="${s.id}">${esc(s.nome)}</option>`).join('');
  el.value=cur||'';
}
/* preenche o datalist de categorias do fluxo conforme o tipo escolhido */
function renderFxCats(){
  const sel=document.getElementById('fx_cat');if(!sel)return;
  const tipo=v('fx_tipo')||'entrada';
  const cur=sel.value;
  sel.innerHTML='<option value="">Categoria…</option>'+(tipo==='entrada'?CAT_ENTRADA_():CAT_SAIDA_()).map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');
  sel.value=cur||'';
}
/* mostra/oculta a linha de retirada conforme o tipo (saída=retirada, entrada=devolução) */
function onFxTipoChange(){
  renderFxCats(); // categoria acompanha o tipo
  const tipo=v('fx_tipo');
  preencheFormas('fx_forma',tipo); // "recebimento" nas entradas, "pagamento" nas saídas
  const wrap=document.getElementById('fx_socio_wrap');
  const lbl=document.getElementById('fx_retirada_lbl');
  if(wrap)wrap.style.display='flex';
  if(lbl)lbl.textContent=tipo==='saida'?'Saída pessoal':'Entrada pessoal';
}
/* liga/desliga o seletor de sócio */
function toggleRetirada(){
  const chk=document.getElementById('fx_retirada');if(!chk)return; // opção removida do form manual (fica só na conciliação)
  const on=chk.checked;
  const sel=document.getElementById('fx_socio'),hint=document.getElementById('fx_socio_hint');
  if(sel){sel.style.display=on?'':'none';renderSocioSelect();}
  if(hint)hint.style.display=on?'':'none';
}
/* lista de sócios na config */
function renderSocioList(){
  const el=document.getElementById('socioList');if(!el)return;
  if(!S.socios.length){el.innerHTML=emptyState('👤','Nenhuma pessoa cadastrada','Cadastre as pessoas abaixo para acompanhar as movimentações de cada uma.');return;}
  el.innerHTML=S.socios.map(s=>{
    const nLanc=S.flux.filter(e=>e.socioId===s.id).length;
    return`<div class="row">
      <div style="display:flex;align-items:center;gap:10px;min-width:0">
        <span style="flex-shrink:0">👤</span>
        <div style="min-width:0"><input value="${esc(s.nome)}" onchange="renameSocio('${s.id}',this.value)" style="font-weight:600;max-width:240px"><div class="rsub">${nLanc} movimentação(ões)</div></div>
      </div>
      <button class="btn btnsm" style="border-color:#F09595;color:var(--dngt)" onclick="delSocio('${s.id}')">Remover</button>
    </div>`;
  }).join('');
}
/* calcula o saldo de conta-corrente de cada sócio */
function saldoSocios(){
  return S.socios.map(s=>{
    const lanc=S.flux.filter(e=>e.socioId===s.id);
    // retirada = saída pessoal (tirou da empresa); devolução = entrada marcada como do sócio (repôs)
    const retirou=lanc.filter(e=>e.tipo==='saida').reduce((a,e)=>a+e.val,0);
    const devolveu=lanc.filter(e=>e.tipo==='entrada').reduce((a,e)=>a+e.val,0);
    return {id:s.id,nome:s.nome,retirou,devolveu,saldo:retirou-devolveu,n:lanc.length};
  }).sort((a,b)=>b.saldo-a.saldo);
}
/* tela Movimentações Pessoais */
function renderSociosConta(){
  const el=document.getElementById('sociosContaBody');if(!el)return;
  const dados=saldoSocios();
  const totalRet=dados.reduce((s,d)=>s+d.retirou,0);
  const totalDev=dados.reduce((s,d)=>s+d.devolveu,0);
  const totalSaldo=totalRet-totalDev;
  const kpis=document.getElementById('sociosKpis');
  if(kpis)kpis.innerHTML=
     met('Total de saídas',money(totalRet),'var(--neg)','Saiu do caixa da empresa')
    +met('Total reposto',money(totalDev),'var(--pos)','Devolvido à empresa')
    +met('Saldo em aberto',money(totalSaldo),totalSaldo>0?'var(--neg)':'var(--pos)','Impacto no capital de giro')
    +met('Pessoas',dados.length,'var(--text)');
  if(!dados.length){el.innerHTML=emptyState('👤','Nenhuma pessoa cadastrada','Cadastre as pessoas para acompanhar as movimentações pessoais de cada uma separadamente.');return;}
  el.innerHTML=dados.map(d=>{
    const deve=d.saldo>0;
    return`<div class="card" style="margin-bottom:.8rem">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div style="display:flex;align-items:center;gap:12px">
          <span style="width:40px;height:40px;border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:18px">👤</span>
          <div><div style="font-weight:700;font-size:15px">${esc(d.nome)}</div><div class="rsub">${d.n} lançamento(s)</div></div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:var(--t3);text-transform:uppercase;letter-spacing:.05em">${deve?'Em aberto com a empresa':(d.saldo<0?'A empresa deve':'Quitado')}</div>
          <div style="font-size:22px;font-weight:700;color:${deve?'var(--neg)':(d.saldo<0?'var(--pos)':'var(--t2)')}">${money(Math.abs(d.saldo))}</div>
        </div>
      </div>
      <div class="ir" style="margin-top:10px;gap:20px;font-size:13px">
        <span style="color:var(--t2)">Saídas: <strong style="color:var(--neg)">${money(d.retirou)}</strong></span>
        <span style="color:var(--t2)">Reposições: <strong style="color:var(--pos)">${money(d.devolveu)}</strong></span>
      </div>
    </div>`;
  }).join('');
}

/* ════════ CONFIG: CATEGORIAS (gestor) ════════ */
function addCategoria(){
  if(CR!=='gestor')return;
  const nome=v('cat_nome').trim();if(!nome){toast('Informe o nome da categoria.','err');return;}
  const tipo=v('cat_tipo')||'saida';const cor=v('cat_cor')||'var(--t3)';
  if(S.categorias.find(c=>c.nome.toLowerCase()===nome.toLowerCase()&&c.tipo===tipo)){toast('Já existe uma categoria com esse nome.','err');return;}
  S.categorias.push({id:'cat_'+uid(),nome,tipo,cor});
  log('Gestor criou categoria: '+nome+' ('+(tipo==='entrada'?'receita':'despesa')+')');save();
  clr('cat_nome');renderCategorias();
}
function renameCategoria(id,nome){const c=S.categorias.find(x=>x.id===id);if(!c)return;const old=c.nome;nome=nome.trim();if(!nome)return;
  // renomeia também nos lançamentos existentes
  S.flux.forEach(e=>{if(e.cat===old)e.cat=nome;});
  S.pagar.forEach(x=>{if(x.cat===old)x.cat=nome;});S.receber.forEach(x=>{if(x.cat===old)x.cat=nome;});
  c.nome=nome;log('Gestor renomeou categoria: '+old+' → '+nome);save();renderCategorias();renderAll();
}
function setCategoriaCor(id,cor){const c=S.categorias.find(x=>x.id===id);if(!c)return;c.cor=cor;save();renderCategorias();}
function delCategoria(id){
  const c=S.categorias.find(x=>x.id===id);if(!c)return;
  const uso=S.flux.filter(e=>e.cat===c.nome).length;
  if(!confirm('Remover a categoria "'+c.nome+'"?'+(uso?' '+uso+' lançamento(s) usam ela e manterão o texto.':'')))return;
  S.categorias=S.categorias.filter(x=>x.id!==id);
  log('Gestor removeu categoria: '+c.nome);save();renderCategorias();
}
const CORES_CAT=[['var(--peace)','Terracota'],['var(--com)','Âmbar'],['var(--gr)','Azul'],['var(--nipi)','Verde'],['var(--ment)','Violeta'],['var(--mkt)','Rosa'],['var(--t3)','Cinza']];
function corOptions(sel){return CORES_CAT.map(([v2,n])=>`<option value="${v2}" ${sel===v2?'selected':''}>${n}</option>`).join('');}
function renderCategorias(){
  ['entrada','saida'].forEach(tipo=>{
    const el=document.getElementById(tipo==='entrada'?'catListEntrada':'catListSaida');if(!el)return;
    const lista=S.categorias.filter(c=>c.tipo===tipo);
    if(!lista.length){el.innerHTML='<div class="empty">Nenhuma</div>';return;}
    el.innerHTML=lista.map(c=>{
      const uso=S.flux.filter(e=>e.cat===c.nome).length;
      return`<div class="row">
        <div style="display:flex;align-items:center;gap:10px;min-width:0">
          <span style="width:14px;height:14px;border-radius:4px;background:${c.cor};flex-shrink:0"></span>
          <div style="min-width:0"><input value="${esc(c.nome)}" onchange="renameCategoria('${c.id}',this.value)" style="font-weight:600;max-width:220px"><div class="rsub">${uso} lançamento(s)</div></div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <select onchange="setCategoriaCor('${c.id}',this.value)" style="width:auto;font-size:12px;padding:4px 8px">${corOptions(c.cor)}</select>
          <button class="btn btnsm" style="border-color:#F09595;color:var(--dngt)" onclick="delCategoria('${c.id}')">✕</button>
        </div>
      </div>`;
    }).join('');
  });
}

/* ════════ CONFIG: USUÁRIOS (gestor) ════════ */
function renderAreaSelect(){
  const el=document.getElementById('cu_area');if(!el)return;
  if(el.children.length)return;
  el.innerHTML=Object.keys(DEPTL).map(k=>`<option value="${k}">${DEPTL[k]}</option>`).join('');
}
function onRoleChange(){
  const role=v('cu_role');
  const wrap=document.getElementById('cu_modwrap');
  // membros escolhem painéis; papéis de visão completa têm tudo
  if(wrap)wrap.style.display=role==='membro'?'block':'none';
  // atribuição de caixa só faz sentido para membro
  const cxwrap=document.getElementById('cu_caixawrap');
  if(cxwrap)cxwrap.style.display=role==='membro'?'flex':'none';
  // sugestão de área
  const area=document.getElementById('cu_area');
  if(area){if(role==='membro')area.value='caixa';else if(role==='dona')area.value='diretoria';else if(role==='operacional')area.value='financeiro';else area.value='diretoria';}
}
function renderModChecks(containerId,selected){
  const el=document.getElementById(containerId);if(!el)return;
  el.innerHTML=MODS.map(m=>`<label class="modchk"><input type="checkbox" value="${m.id}" ${selected.includes(m.id)?'checked':''}>${esc(m.l)}</label>`).join('');
}
function addUser(){
  if(CR!=='gestor')return;
  const name=v('cu_name').trim();if(!name){toast('Indique o nome do usuário.','err');return;}
  const role=v('cu_role')||'membro';const area=v('cu_area')||'caixa';
  const email=(v('cu_email')||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast('Informe um e-mail válido (o mesmo cadastrado no Firebase).','err');return;}
  if(S.users.find(u=>(u.email||'').toLowerCase()===email)){toast('Já existe um usuário com este e-mail.','err');return;}
  let access;
  if(role==='membro'){
    access=[...document.querySelectorAll('#cu_mods input:checked')].map(c=>c.value);
    if(!access.length){toast('Selecione pelo menos um painel para o membro.','err');return;}
  }else{access=[...ALLMODS];}
  const caixaId=role==='membro'?(v('cu_caixa')||''):'';
  const rec={user:name.toLowerCase().replace(/\s+/g,'_')+'_'+uid(),email,name,role,area,access,caixaId,t:new Date().toISOString()};
  S.users.push(rec);
  if(!S.mem.find(m=>m.n===name))S.mem.push({n:name,d:area,t:rec.t});
  log('Gestor criou usuário: '+name+' ('+ROLE_LABEL[role]+') · '+email+(caixaId?' · '+caixaNome(caixaId):''));save();
  clr('cu_name','cu_email');renderModChecks('cu_mods',[]);renderCaixaAssignSelect('');renderUsers();renderEquipa();
  const precisaClaim=(role==='gestor'||role==='operacional'||role==='dona');
  alert('Usuário "'+name+'" criado.\n\nIMPORTANTE:\n1) Cadastre este e-mail em Authentication no Firebase (com uma senha).'+(precisaClaim?'\n2) Rode o script de papéis para dar o papel "'+role+'" a este e-mail (custom claim).':'')+'\n\nSem esses passos, a pessoa não consegue entrar.');
}
function setUserCaixa(uid_,caixaId){const u=S.users.find(x=>x.user===uid_);if(!u)return;u.caixaId=caixaId;log('Gestor atribuiu caixa a '+u.name+': '+(caixaId?caixaNome(caixaId):'nenhum'));save();renderCaixaList();}
function setUserField(uid_,field,val){
  const u=S.users.find(x=>x.user===uid_);if(!u)return;
  if(field==='pin'){if(!/^[0-9]{4}$/.test(val)){toast('PIN deve ter 4 dígitos.','err');renderUsers();return;}u.pin=val;}
  else if(field==='name')u.name=val.trim();
  else u[field]=val;
  if(field==='role'){u.access=val==='membro'?(u.access&&u.access.length?u.access:[...ALLMODS]):[...ALLMODS];}
  log('Gestor editou usuário: '+u.name);save();renderUsers();renderEquipa();
}
function toggleUserMod(uid_,mod,on){const u=S.users.find(x=>x.user===uid_);if(!u)return;u.access=u.access||[];if(on){if(!u.access.includes(mod))u.access.push(mod);}else{u.access=u.access.filter(m=>m!==mod);}save();}
/* gestor define a janela de dias visíveis de um usuário (vazio = padrão do papel; 0 = sem limite) */
function setUserDias(uid_,val){
  const u=S.users.find(x=>x.user===uid_);if(!u)return;
  const t=(val||'').toString().trim();
  u.dias=t===''?'':Math.max(0,parseInt(t)||0);
  log('Ajustou janela de '+u.name+': '+(t===''?'padrão':(u.dias===0?'sem limite':u.dias+' dias')));
  save();
}
/* gestor escolhe quais páginas um usuário operacional/dona vê */
function toggleUserPage(uid_,pid,on){
  const u=S.users.find(x=>x.user===uid_);if(!u)return;
  // inicia da lista completa na primeira personalização
  if(!Array.isArray(u.pages)||!u.pages.length)u.pages=[...PAGES_FULL];
  if(on){
    if(!u.pages.includes(pid))u.pages.push(pid);
  }else{
    if(u.pages.length<=1){toast('O usuário precisa ver ao menos uma página.','err');renderUsers();return;}
    u.pages=u.pages.filter(p=>p!==pid);
  }
  log('Ajustou páginas de '+u.name+': '+(on?'+ ':'− ')+pid);
  save();renderUsers();
}
function removeUser(uid_){
  const u=S.users.find(x=>x.user===uid_);if(!u)return;
  if(u.role==='gestor'&&S.users.filter(x=>x.role==='gestor').length<=1){toast('Não pode remover o único gestor administrador.','err');return;}
  if(!confirm('Remover o usuário "'+u.name+'"?'))return;
  S.users=S.users.filter(x=>x.user!==uid_);log('Gestor removeu usuário: '+u.name);save();renderUsers();renderEquipa();
}
function renderUsers(){
  const el=document.getElementById('userlist');if(!el)return;
  if(!S.users.length){el.innerHTML='<div class="empty">Nenhum usuário</div>';return;}
  const PAGE_LABEL={};NAV.forEach(n=>PAGE_LABEL[n.id]=n.l);
  el.innerHTML=S.users.map(u=>{
    const isMembro=u.role==='membro';
    const isFullRole=u.role==='operacional'||u.role==='dona';
    let mods;
    if(isMembro){
      mods=MODS.map(m=>`<label class="modchk"><input type="checkbox" ${(u.access||[]).includes(m.id)?'checked':''} onchange="toggleUserMod('${u.user}','${m.id}',this.checked)">${esc(m.l)}</label>`).join('');
    }else if(isFullRole){
      // gestor escolhe quais páginas este usuário vê; sem personalização = todas marcadas
      const ativas=Array.isArray(u.pages)&&u.pages.length?u.pages:PAGES_FULL;
      mods=PAGES_FULL.map(pid=>`<label class="modchk"><input type="checkbox" ${ativas.includes(pid)?'checked':''} onchange="toggleUserPage('${u.user}','${pid}',this.checked)">${esc(PAGE_LABEL[pid]||pid)}</label>`).join('');
    }else{
      mods=`<span style="font-size:12px;color:var(--t2)">Visão completa de finanças + administração do sistema.</span>`;
    }
    return`<div class="ucard">
      <div class="uhead">
        <input value="${esc(u.name)}" onchange="setUserField('${u.user}','name',this.value)" style="max-width:180px;font-weight:600">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span class="pin-badge" title="E-mail de acesso (Firebase)">✉ ${esc(u.email||'sem e-mail')}</span>
          <input value="${esc(u.email||'')}" type="email" placeholder="e-mail" onchange="setUserField('${u.user}','email',this.value)" style="width:180px;font-size:12px;padding:4px 8px">
          <select onchange="setUserField('${u.user}','area',this.value)" style="width:auto;font-size:12px;padding:4px 8px">${Object.keys(DEPTL).map(k=>`<option value="${k}" ${u.area===k?'selected':''}>${DEPTL[k]}</option>`).join('')}</select>
          <select onchange="setUserField('${u.user}','role',this.value)" style="width:auto;font-size:12px;padding:4px 8px">
            <option value="membro" ${u.role==='membro'?'selected':''}>Membro</option>
            <option value="operacional" ${u.role==='operacional'?'selected':''}>Gestor operacional</option>
            <option value="dona" ${u.role==='dona'?'selected':''}>Dona</option>
            <option value="gestor" ${u.role==='gestor'?'selected':''}>Gestor admin</option>
          </select>
          <button class="btn btnsm" style="border-color:#F09595;color:var(--dngt)" onclick="removeUser('${u.user}')">Remover</button>
        </div>
      </div>
      ${u.role!=='gestor'?`<div style="display:flex;align-items:center;gap:8px;margin:0 0 8px;flex-wrap:wrap"><span style="font-size:11px;color:var(--t2);font-weight:600">Vê os últimos</span><input type="number" min="0" step="1" value="${u.dias===undefined||u.dias===null||u.dias===''?'':u.dias}" placeholder="${u.role==='membro'?'7':'sem limite'}" onchange="setUserDias('${u.user}',this.value)" style="width:76px;font-size:12px;padding:4px 8px;text-align:center"><span style="font-size:11px;color:var(--t2);font-weight:600">dias</span><span style="font-size:10.5px;color:var(--t3)">(vazio = ${u.role==='membro'?'padrão 7 dias':'sem limite'} · 0 = sem limite · 1 = só hoje)</span></div>`:''}
      <div class="stitle" style="margin:0 0 5px">${isMembro?'Painéis visíveis para este membro':(isFullRole?'Páginas visíveis para este usuário':'Permissões')}</div>
      <div class="modgrid">${mods}</div>
      ${isMembro?`<div style="margin-top:8px;display:flex;align-items:center;gap:8px"><span style="font-size:11px;color:var(--t2);font-weight:600">Caixa atribuído:</span><select onchange="setUserCaixa('${u.user}',this.value)" style="width:auto;font-size:12px;padding:4px 8px"><option value="">Sem caixa</option>${S.caixas.map(c=>`<option value="${c.id}" ${u.caixaId===c.id?'selected':''}>${esc(c.nome)}</option>`).join('')}</select></div>`:''}
    </div>`;
  }).join('');
}

/* ════════ EQUIPA ════════ */
function renderEquipa(){
  const mb=document.getElementById('membros');
  if(mb)mb.innerHTML=S.users.length?S.users.map(u=>`<div class="row"><div style="display:flex;align-items:center;gap:10px"><div style="width:34px;height:34px;border-radius:9px;background:${u.role==='gestor'?'var(--text)':(DEPTC[u.area]||'var(--t3)')};color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600">${esc(initials(u.name))}</div><div><div class="rlabel">${esc(u.name)}</div><div class="rsub">${esc(DEPTL[u.area]||u.area||'')}</div></div></div><span class="badge ${u.role==='gestor'?'bnipi':(u.role==='membro'?'bgray':'binfo')}">${ROLE_LABEL[u.role]||'Membro'}</span></div>`).join(''):'<div class="empty">Nenhum</div>';
  const hg=document.getElementById('histglobal');
  if(hg)hg.innerHTML=S.hist.length?S.hist.slice(0,40).map(h=>`<div class="hist">${esc(h.a)}<div class="histwho">${esc(h.u)} · ${new Date(h.t).toLocaleString('pt-BR')}</div></div>`).join(''):'<div class="empty">Nenhuma alteração registada</div>';
}

/* ── RESET ── */
/* ── COMPROVANTES (anexo de imagem por lançamento) ── */
const ANEXO_LS='nipihub_anexos_v1';
let ANEXO_ATUAL=null;

function lsAnexos(){try{return JSON.parse(localStorage.getItem(ANEXO_LS)||'{}');}catch(e){return{}}}
function lsAnexoSet(id,obj){const m=lsAnexos();if(obj)m[id]=obj;else delete m[id];try{localStorage.setItem(ANEXO_LS,JSON.stringify(m));}catch(e){toast('Sem espaço neste aparelho para o comprovante.','err');}}
function anexarComprovante(id){
  const e=S.flux.find(x=>x.id===id);if(!e)return;
  if(!isFull()&&e.byId!==CUID){toast('Você só pode anexar nos seus lançamentos.','err');return;}
  const inp=document.createElement('input');inp.type='file';inp.accept='image/*';
  inp.onchange=()=>{
    const f=inp.files[0];if(!f)return;
    const img=new Image();const rd=new FileReader();
    rd.onload=()=>{img.src=rd.result;};
    img.onload=()=>{
      const MAX=1100;let w=img.width,h=img.height;
      if(w>MAX||h>MAX){const r=Math.min(MAX/w,MAX/h);w=Math.round(w*r);h=Math.round(h*r);}
      const cv=document.createElement('canvas');cv.width=w;cv.height=h;
      cv.getContext('2d').drawImage(img,0,0,w,h);
      let dataUrl=cv.toDataURL('image/jpeg',.72);
      if(dataUrl.length>900000)dataUrl=cv.toDataURL('image/jpeg',.5);
      if(dataUrl.length>900000){toast('Imagem grande demais mesmo comprimida — tire a foto mais de perto ou com menos resolução.','err');return;}
      salvarAnexo(id,dataUrl,f.name);
    };
    rd.readAsDataURL(f);
  };
  inp.click();
}


function fecharAnexo(){document.getElementById('anexoOverlay').style.display='none';ANEXO_ATUAL=null;}

/* ── TRANSFERÊNCIAS E SALDO POR CONTA ── */
/* saldo de uma conta bancária (ou do dinheiro em espécie/sem conta, id='') */
function saldoConta(id){
  return S.flux.reduce((s,e)=>{
    if(e.tipo==='transf'){
      if((e.contaPara||'')===id)s+=e.val;
      if((e.contaDe||'')===id)s-=e.val;
      return s;
    }
    if((e.contaId||'')!==id)return s;
    return s+(e.tipo==='entrada'?e.val:-e.val);
  },0);
}
function addTransfer(){
  if(!isFull()){toast('Sem permissão para transferir.','err');return;}
  const d=vData('tr_d'),de=v('tr_de'),para=v('tr_para'),val=parseFloat(v('tr_val'));
  if(!d){toast('Informe a data.','err');return;}
  if(de===para){toast('Escolha contas diferentes de origem e destino.','err');return;}
  if(!val||val<=0||isNaN(val)){toast('Informe um valor válido.','err');return;}
  if(bloqueiaMesFechado(d))return;
  const nomeDe=de?contaNome(de):'Espécie/Caixa',nomePara=para?contaNome(para):'Espécie/Caixa';
  S.flux.push({id:uid(),d,desc:'Transferência: '+nomeDe+' → '+nomePara,cat:'Transferência',tipo:'transf',val,contaDe:de,contaPara:para,by:CU,byId:CUID,t:new Date().toISOString()});
  log('Transferiu '+money(val)+': '+nomeDe+' → '+nomePara);save();
  clr('tr_val');renderFluxo();renderDash();renderContaList();
  toast('Transferência registrada: '+nomeDe+' → '+nomePara+' ('+money(val)+').','ok');
}
function renderTransferCard(){
  const card=document.getElementById('transfCard');if(!card)return;
  card.style.display=isFull()?'':'none';
  if(!isFull())return;
  const opts='<option value="">💵 Espécie/Caixa</option>'+S.contas.map(x=>`<option value="${x.id}">🏦 ${esc(x.nome)}</option>`).join('');
  const de=document.getElementById('tr_de'),pa=document.getElementById('tr_para');
  if(de){const c1=de.value;de.innerHTML=opts;de.value=c1;}
  if(pa){const c2=pa.value;pa.innerHTML=opts;pa.value=c2;}
  const dd=document.getElementById('tr_d');if(dd&&!dd.value)dd.value=hojeBR();
  // saldos por conta
  const el=document.getElementById('saldosContas');if(!el)return;
  const linhas=[{id:'',nome:'💵 Espécie/Caixa'}].concat(S.contas.map(x=>({id:x.id,nome:'🏦 '+x.nome})));
  el.innerHTML=linhas.map(l=>{
    const s=saldoConta(l.id);
    return `<span style="display:inline-flex;align-items:center;gap:6px;background:var(--surface2);border-radius:8px;padding:5px 10px;font-size:12px">${esc(l.nome)}: <strong style="color:${s>=0?'var(--pos)':'var(--neg)'}">${money(s)}</strong></span>`;
  }).join('');
}
/* ── ORÇAMENTO MENSAL POR CATEGORIA ── */
function setOrcamento(nome,val){
  if(CR!=='gestor')return;
  const n=parseFloat(val)||0;
  if(n>0)S.orcamentos[nome]=n;else delete S.orcamentos[nome];
  log('Orçamento de '+nome+': '+(n>0?money(n)+'/mês':'removido'));
  save();renderDashOrcamento();
}
function renderOrcamentoList(){
  const el=document.getElementById('orcamentoList');if(!el)return;
  const cats=CAT_SAIDA_();
  if(!cats.length){el.innerHTML='<div class="empty">Cadastre categorias de despesa primeiro.</div>';return;}
  el.innerHTML=cats.map(n=>`<div class="row">
    <div class="rlabel">${esc(n)}</div>
    <div style="display:flex;align-items:center;gap:6px"><span style="font-size:12px;color:var(--t3)">R$</span>
    <input type="number" step="10" min="0" value="${S.orcamentos[n]||''}" placeholder="—" onchange="setOrcamento('${esc(n).replace(/'/g,"\\'")}',this.value)" style="width:110px;font-size:12.5px;padding:5px 8px;text-align:right">
    <span style="font-size:11px;color:var(--t3)">/mês</span></div>
  </div>`).join('');
}
function renderDashOrcamento(){
  const el=document.getElementById('dashOrcamento');if(!el)return;
  const nomes=Object.keys(S.orcamentos||{});
  if(!isFull()||!nomes.length){el.innerHTML='';return;}
  const cm=new Date().toISOString().slice(0,7);
  const linhas=nomes.map(n=>{
    const meta=S.orcamentos[n];
    const gasto=S.flux.filter(e=>e.tipo==='saida'&&!e.pessoal&&e.cat===n&&e.d.slice(0,7)===cm).reduce((s,e)=>s+e.val,0);
    const pct=Math.min(100,meta>0?gasto/meta*100:0);
    const cor=gasto>meta?'var(--neg)':(pct>=80?'var(--com)':'var(--pos)');
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px">
        <span style="font-weight:600">${esc(n)}</span>
        <span style="color:${cor}">${money(gasto)} de ${money(meta)}${gasto>meta?' · <strong>estourou '+money(gasto-meta)+'</strong>':''}</span>
      </div>
      <div style="height:7px;background:var(--surface2);border-radius:5px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${cor};border-radius:5px;transition:width .3s"></div></div>
    </div>`;
  }).join('');
  el.innerHTML=`<div class="card" style="margin-bottom:1.1rem"><div class="ctitle">Orçamento do mês</div>${linhas}</div>`;
}
/* ── FECHAMENTO DE PERÍODO (exclusivo do gestor) ── */
function fecharMes(){
  if(CR!=='gestor'){toast('Apenas o gestor pode fechar um mês.','err');return;}
  const m=v('fech_mes');if(!m){toast('Escolha o mês para fechar.','err');return;}
  if(S.fechados.includes(m)){toast('Este mês já está fechado.','err');return;}
  if(!confirm('Fechar '+monthLabel(m)+'? Ninguém poderá lançar, editar ou remover movimentações deste mês até você reabrir.'))return;
  S.fechados.push(m);S.fechados.sort();
  log('Gestor fechou o mês '+m+'.');save();renderFechados();
  toast(monthLabel(m)+' fechado.','ok');
}
function reabrirMes(m){
  if(CR!=='gestor'){toast('Apenas o gestor pode reabrir um mês.','err');return;}
  if(!confirm('Reabrir '+monthLabel(m)+'? As movimentações dele voltam a poder ser alteradas.'))return;
  S.fechados=S.fechados.filter(x=>x!==m);
  log('Gestor reabriu o mês '+m+'.');save();renderFechados();
  toast(monthLabel(m)+' reaberto.','ok');
}
function renderFechados(){
  const el=document.getElementById('fechadosList');if(!el)return;
  if(!S.fechados.length){el.innerHTML='<div class="empty" style="padding:.6rem">Nenhum mês fechado.</div>';return;}
  el.innerHTML=S.fechados.map(m=>`<div class="row"><div class="rlabel">🔒 ${monthLabel(m)}</div><button class="btn btnsm" onclick="reabrirMes('${m}')">Reabrir</button></div>`).join('');
}
/* ── BACKUP E RESTAURAÇÃO (exclusivo do gestor) ── */
function exportBackup(){
  if(CR!=='gestor'){toast('Apenas o gestor pode exportar o backup.','err');return;}
  const pacote={sistema:'Auricélia Transportes · Central Financeira',versao:3,exportadoEm:new Date().toISOString(),por:CU,dados:S};
  const nome='backup_auricelia_'+new Date().toISOString().slice(0,16).replace('T','_').replace(':','h')+'.json';
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify(pacote)],{type:'application/json'}));
  a.download=nome;a.click();
  log('Gestor exportou backup completo.');save();
  toast('Backup exportado: '+nome,'ok');
}
function importBackup(file){
  if(CR!=='gestor'){toast('Apenas o gestor pode restaurar um backup.','err');return;}
  if(!file)return;
  const rd=new FileReader();
  rd.onload=()=>{
    let pacote;
    try{pacote=JSON.parse(rd.result);}catch(e){toast('Arquivo inválido — não é um backup deste sistema.','err');return;}
    const dados=pacote&&pacote.dados;
    if(!dados||!Array.isArray(dados.flux)||!Array.isArray(dados.users)){toast('Arquivo inválido — não é um backup deste sistema.','err');return;}
    const info=(pacote.exportadoEm?new Date(pacote.exportadoEm).toLocaleString('pt-BR'):'data desconhecida');
    const resp=prompt('⚠ RESTAURAR BACKUP de '+info+'?\n\nIsto SUBSTITUI todos os dados atuais (deste aparelho e da nuvem) pelos do arquivo. Não pode ser desfeito — se quiser, exporte um backup do estado atual antes.\n\nPara confirmar, digite RESTAURAR (em maiúsculas):');
    if(resp===null)return;
    if(resp.trim()!=='RESTAURAR'){toast('Confirmação incorreta — nada foi alterado. Digite exatamente RESTAURAR.','err');return;}
    S={...JSON.parse(JSON.stringify(DEF)),...dados};
    normalizaListas();
    resetEspelho();   // força reescrever tudo na nuvem, item por item
    log('Gestor restaurou backup de '+info+'.');
    save();renderAll();buildSidebar();
    toast('Backup restaurado com sucesso.','ok');
  };
  rd.readAsText(file);
}
/* apaga o core e todos os documentos das coleções (usado pelo resetData) */

/* limpa SÓ as movimentações (para testes/demonstrações) — mantém usuários, caixas, contas, pessoas, categorias e veículos */
function limparMovimentacoes(){
  if(CR!=='gestor'){toast('Apenas o gestor pode limpar as movimentações.','err');return;}
  const resp=prompt('Limpar as MOVIMENTAÇÕES (lançamentos do fluxo, contas a receber, contas a pagar, boletos e extrato importado)?\n\nSerão MANTIDOS: usuários, caixas, contas bancárias, pessoas, categorias e veículos.\nA limpeza vale para a nuvem e todos os aparelhos. Não pode ser desfeita.\n\nPara confirmar, digite LIMPAR (em maiúsculas):');
  if(resp===null)return; // cancelou
  if(resp.trim()!=='LIMPAR'){toast('Confirmação incorreta — nada foi apagado. Digite exatamente LIMPAR.','err');return;}
  S.flux=[];S.receber=[];S.pagar=[];S.boletos=[];S.ofx=[];
  log('Gestor limpou as movimentações (estrutura mantida).');
  save();
  renderAll();
  toast('Movimentações limpas. Estrutura (usuários, caixas, contas) mantida.','ok');
}
function zerarDadosFinanceiros(){
  if(CR!=='gestor'){toast('Apenas o gestor pode zerar os dados.','err');return;}
  // confirmação forte: exige digitar APAGAR para evitar cliques acidentais
  const resp=prompt('⚠ ATENÇÃO: isto vai zerar TODOS os dados financeiros (lançamentos, contas, boletos, veículos, caixas e relatórios) deste aparelho E da nuvem, para todos.\n\nOs usuários serão mantidos. Esta ação NÃO pode ser desfeita.\n\nPara confirmar, digite APAGAR (em maiúsculas):');
  if(resp===null)return; // cancelou
  if(resp.trim()!=='APAGAR'){toast('Confirmação incorreta — nada foi apagado. Digite exatamente APAGAR.','err');return;}
  S.flux=[];S.receber=[];S.pagar=[];S.boletos=[];S.veiculos=[];S.ofx=[];S.caixas=[];S.mem=[];S.hist=[];
  log('Gestor zerou os dados financeiros (usuários mantidos).');
  save();
  toast('Dados financeiros zerados. O sistema está pronto para os dados reais.','ok');
  T(allowedPages()[0]||'fluxo');
}
function resetData(){
  if(CR!=='gestor'){toast('Apenas o gestor pode fazer o reset completo.','err');return;}
  // confirmação forte: exige digitar APAGAR TUDO — é a ação mais destrutiva do sistema
  const resp=prompt('🚨 RESET COMPLETO: isto apaga TODOS os dados — INCLUINDO OS USUÁRIOS E ACESSOS — deste aparelho E da nuvem, para todos os aparelhos.\n\nO sistema volta ao estado de fábrica. Esta ação NÃO pode ser desfeita.\n\nPara confirmar, digite APAGAR TUDO (em maiúsculas):');
  if(resp===null)return; // cancelou
  if(resp.trim()!=='APAGAR TUDO'){toast('Confirmação incorreta — nada foi apagado. Digite exatamente APAGAR TUDO.','err');return;}
  // limpa local
  localStorage.removeItem(KEY);
  // limpa nuvem antes de recarregar (core + todas as coleções)
  if(nuvemPronta()){
    suspendeNuvem(true);
    limparNuvem()
      .catch(e=>console.warn('Falha ao limpar nuvem:',e))
      .finally(()=>location.reload());
  }else{
    location.reload();
  }
}
