/* ══════════════════════════════════════════════════════════
   Auricélia Transportes · Central Financeira
   nucleo.js — Estado, usuários, permissões, utilidades, sidebar e busca
   (script clássico: as funções aqui são globais para o HTML)
══════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════
   NIPI FINANÇAS · sistema de usuários
   Papéis: gestor (admin) · operacional · dona · membro
════════════════════════════════════════ */
const KEY='nipihub_fin_v3';
const DEF={flux:[],receber:[],pagar:[],boletos:[],veiculos:[],ofx:[],caixas:[],contas:[],categorias:[],regrasCat:{},socios:[],users:[],mem:[],hist:[],fechados:[],orcamentos:{}};
let S={...DEF};
let CU='',CUID='',CD='',CR='',CA=[],CPAGES=null,CCX='',CDIAS=null;  // current user name, id, dept, role, access, custom pages, caixaId, janela de dias
let CAIXA_FILTER='__all__';            // filtro de caixa selecionado (telas de visão completa)

/* ── PAPÉIS ──
   gestor      = administrador (Edson): usuários, equipa, config + tudo
   operacional = gestor operacional (Janaína): visão completa de finanças
   dona        = dona (Auricélia): visão completa de finanças
   membro      = operador de caixa: só o PRÓPRIO fluxo + dashboard do próprio caixa
*/
const ROLE_LABEL={gestor:'Gestor administrador',operacional:'Gestor operacional',dona:'Dona',membro:'Membro'};

/* módulos liberáveis a MEMBROS (gestor escolhe). Papéis de visão completa recebem tudo automaticamente */
const MODS=[
  {id:'dashboard',l:'Dashboard (próprio caixa)'},
  {id:'fluxo',l:'Fluxo de Caixa (próprio)'}
];
const ALLMODS=MODS.map(m=>m.id);

/* páginas de cada papel */
const PAGES_FULL=['dashboard','fluxo','receber','pagar','pagas','boletos','dre','placas','rateio','concil','relatorios','socios','comissoes']; // operacional + dona (visão completa + ferramentas avançadas)
const PAGES_ADMIN=['dashboard','fluxo','receber','pagar','pagas','boletos','dre','placas','rateio','concil','relatorios','socios','comissoes','equipa','categorias','config']; // gestor admin (tudo + sistema)

/* áreas */
const DEPTL={diretoria:'Diretoria',financeiro:'Financeiro',administrativo:'Administrativo',operacional:'Operacional',comercial:'Comercial',caixa:'Caixa'};
const DEPTC={diretoria:'var(--pos)',financeiro:'var(--gr)',administrativo:'var(--ment)',operacional:'var(--peace)',comercial:'var(--com)',caixa:'var(--mkt)'};

/* SEED inicial */
const SEED=[
  {user:'edson',name:'Edson',role:'gestor',area:'diretoria',email:'',access:[...ALLMODS]},
  {user:'janaina',name:'Janaína',role:'operacional',area:'financeiro',email:'',access:[...ALLMODS]},
  {user:'auricelia',name:'Auricélia',role:'dona',area:'diretoria',email:'',access:[...ALLMODS]}
];

function load(){try{const d=localStorage.getItem(KEY);if(d)S={...DEF,...JSON.parse(d)};}catch(e){}
  ['flux','receber','pagar','boletos','veiculos','ofx','caixas','contas','categorias','socios','users','mem','hist'].forEach(k=>{if(!Array.isArray(S[k]))S[k]=[];});
  if(!S.users.length)S.users=SEED.map(s=>({...s,t:new Date().toISOString()}));
  if(!S.categorias.length)S.categorias=seedCategorias();
  else{ garanteSemente(); }
  if(!S.socios.length)S.socios=[{id:'so_auricelia',nome:'Auricélia',t:new Date().toISOString()}];
  if(!Array.isArray(S.fechados))S.fechados=[];
  if(!S.orcamentos||typeof S.orcamentos!=='object')S.orcamentos={};
  // Dados de exemplo removidos — sistema sobe vazio para os dados reais.
  // (veículos, caixas e lançamentos são criados pelo usuário no app)
  S.users.forEach(u=>{if(!Array.isArray(u.access))u.access=[...ALLMODS];if(u.email===undefined)u.email='';if(u.caixaId===undefined)u.caixaId='';});
  if(!S.regrasCat||typeof S.regrasCat!=='object'||Array.isArray(S.regrasCat))S.regrasCat={};
}
function persistLocal(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}
function save(){
  persistLocal();
  if(nuvemPronta()&&!nuvemLida()){
    // a leitura inicial falhou (queda de rede). Não grava por cima:
    // tenta reler a nuvem; se conseguir, o estado de lá prevalece.
    cloudStatus('Reconectando…','sync');
    cloudFirstPull(isFull());
    return;
  }
  cloudSync();                      // envia só o que mudou (assíncrono)
}

/* ── UTILS ── */
function uid(){return Math.random().toString(36).slice(2,9)}
function esc(s){return(s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
/* estado vazio acolhedor: ícone + título + orientação */
function emptyState(ic,titulo,sub){
  return `<div class="empty-rich"><span class="ei">${ic}</span><div class="et">${esc(titulo)}</div><div class="es">${esc(sub)}</div></div>`;
}
/* ── BUSCA GLOBAL ── */
let GS_TIMER=null;
function buscaGlobal(q){
  clearTimeout(GS_TIMER);
  GS_TIMER=setTimeout(()=>execBuscaGlobal(q),160); // debounce leve
}
function execBuscaGlobal(q){
  const box=document.getElementById('gsearchResults');if(!box)return;
  q=(q||'').trim().toLowerCase();
  if(q.length<2){box.classList.remove('show');box.innerHTML='';return;}
  const hit=(s)=>(s||'').toString().toLowerCase().includes(q);
  const hitVal=(v)=>String(v).replace('.',',').includes(q)||String(v).includes(q);
  const MAX=6;
  // lançamentos: respeita o escopo (membro só vê os seus)
  let fl=aplicaJanela(isFull()?S.flux:S.flux.filter(e=>e.byId===CUID));
  const rFlux=fl.filter(e=>hit(e.desc)||hit(e.cat)||hit(e.by)||hitVal(e.val)).slice(0,MAX);
  const rRec=isFull()?S.receber.filter(c=>hit(c.cli)||hit(c.desc)||hit(c.cat)||hitVal(c.val)).slice(0,MAX):[];
  const rPag=isFull()?S.pagar.filter(c=>hit(c.forn)||hit(c.desc)||hit(c.cat)||hitVal(c.val)).slice(0,MAX):[];
  const rBol=isFull()?S.boletos.filter(b=>hit(b.forn)||hit(b.desc)||hitVal(b.val)).slice(0,MAX):[];
  let h='';
  const sec=(titulo,items,render)=>{if(items.length)h+=`<div class="gs-sec">${titulo}</div>`+items.map(render).join('');};
  sec('Fluxo de Caixa',rFlux,e=>`<div class="gs-item" onclick="gsIr('fluxo','fx_search','${esc(e.desc).replace(/'/g,"\\'")}')">
    <span class="gi">${e.tipo==='entrada'?'↑':'↓'}</span>
    <span class="gt"><span class="g1">${esc(e.desc||'—')}</span><span class="g2">${fmt(e.d)}${e.cat?' · '+esc(e.cat):''}</span></span>
    <span class="gv" style="color:${e.tipo==='entrada'?'var(--pos)':'var(--peace)'}">${e.tipo==='entrada'?'+':'−'}${money(e.val)}</span></div>`);
  sec('Contas a Receber',rRec,c=>`<div class="gs-item" onclick="gsIr('receber',null,'${esc(c.cli).replace(/'/g,"\\'")}')">
    <span class="gi">💰</span>
    <span class="gt"><span class="g1">${esc(c.cli)}</span><span class="g2">${esc(c.desc||'')} · venc. ${fmt(c.venc)} · ${c.status==='aberto'?'em aberto':'recebido'}</span></span>
    <span class="gv" style="color:var(--pos)">${money(c.val)}</span></div>`);
  sec('Contas a Pagar',rPag,c=>`<div class="gs-item" onclick="gsIr('pagar',null,'${esc(c.forn).replace(/'/g,"\\'")}')">
    <span class="gi">📄</span>
    <span class="gt"><span class="g1">${esc(c.forn)}</span><span class="g2">${esc(c.desc||'')} · venc. ${fmt(c.venc)} · ${c.status==='aberto'?'em aberto':'pago'}</span></span>
    <span class="gv" style="color:var(--peace)">${money(c.val)}</span></div>`);
  sec('Boletos',rBol,b=>`<div class="gs-item" onclick="gsIr('boletos',null,null)">
    <span class="gi">🧾</span>
    <span class="gt"><span class="g1">${esc(b.forn)}</span><span class="g2">${esc(b.desc||'')} · venc. ${fmt(b.venc)}</span></span>
    <span class="gv">${money(b.val)}</span></div>`);
  if(!h)h=`<div class="gs-none">Nada encontrado para "${esc(q)}"</div>`;
  box.innerHTML=h;box.classList.add('show');
}
/* navega até a tela e aplica a busca no filtro local dela (quando existir) */
function gsIr(page,inputId,valor){
  const box=document.getElementById('gsearchResults');if(box){box.classList.remove('show');}
  const gs=document.getElementById('gsearch');if(gs)gs.value='';
  sp(page);
  if(inputId&&valor){
    const inp=document.getElementById(inputId);
    if(inp){inp.value=valor;inp.dispatchEvent(new Event('input'));}
  }
}
/* fecha o dropdown ao clicar fora */
document.addEventListener('click',ev=>{
  const w=document.getElementById('gsearchWrap');
  if(w&&!w.contains(ev.target)){const b=document.getElementById('gsearchResults');if(b)b.classList.remove('show');}
});
/* notificação discreta (substitui alert para avisos/sucessos) */
function toast(msg,tipo){
  const wrap=document.getElementById('toastWrap');if(!wrap){return;}
  const ic={ok:'✓',err:'⚠',info:'ℹ'}[tipo||'ok'];
  const el=document.createElement('div');
  el.className='toast '+(tipo||'ok');
  el.innerHTML=`<span class="ti">${ic}</span><span>${esc(msg)}</span>`;
  wrap.appendChild(el);
  const dur=Math.min(6000,Math.max(2600,msg.length*55));
  setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),320);},dur);
}
/* toast com botão de ação (ex: Desfazer). onAction roda ao clicar; some após ~6s */
function toastAction(msg,btnLabel,onAction,tipo){
  const wrap=document.getElementById('toastWrap');if(!wrap){onAction&&0;return;}
  const el=document.createElement('div');
  el.className='toast '+(tipo||'info');
  const bid='ub_'+uid();
  el.innerHTML=`<span class="ti">↩</span><span style="flex:1">${esc(msg)}</span><button id="${bid}" class="toast-act">${esc(btnLabel)}</button>`;
  wrap.appendChild(el);
  let done=false;
  const close=()=>{if(!el.isConnected)return;el.classList.add('out');setTimeout(()=>el.remove(),320);};
  el.querySelector('#'+bid).onclick=()=>{if(done)return;done=true;onAction&&onAction();close();};
  setTimeout(close,6000);
}
/* remove um item guardando cópia para desfazer (substitui confirm de exclusão) */
function removerComDesfazer(arrKey,id,renderFn,label){
  const arr=S[arrKey];if(!Array.isArray(arr))return;
  const idx=arr.findIndex(x=>x.id===id);if(idx<0)return;
  const removido=arr[idx];
  arr.splice(idx,1);
  log('Removeu '+label);save();renderFn&&renderFn();renderDash();
  toastAction(label+' removido.','Desfazer',()=>{
    S[arrKey].splice(Math.min(idx,S[arrKey].length),0,removido);
    log('Desfez remoção: '+label);save();renderFn&&renderFn();renderDash();
    toast('Remoção desfeita.','ok');
  });
}
function fmt(d){if(!d)return'—';const[y,m,dd]=d.split('-');return dd+'/'+m+'/'+y}
/* ── data BR digitável (dd/mm/aaaa) ── */
function toBR(iso){if(!iso)return'';const p=iso.split('-');if(p.length!==3)return'';return `${p[2]}/${p[1]}/${p[0]}`;}
function parseBR(br){if(!br)return'';const m=br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!m)return'';const d=+m[1],mo=+m[2],y=+m[3];if(d<1||d>31||mo<1||mo>12||y<1900)return'';return `${m[3]}-${m[2]}-${m[1]}`;}
function maskDate(el){
  let x=el.value.replace(/\D/g,'').slice(0,8);
  if(x.length>=5)el.value=x.slice(0,2)+'/'+x.slice(2,4)+'/'+x.slice(4);
  else if(x.length>=3)el.value=x.slice(0,2)+'/'+x.slice(2);
  else el.value=x;
}
/* pega valor de um campo de data BR como ISO (yyyy-mm-dd) */
function vData(id){const el=document.getElementById(id);if(!el)return'';return parseBR(el.value);}
function hojeBR(){return toBR(new Date().toISOString().slice(0,10));}
function inc(hay,needle){return(hay||'').toString().toLowerCase().includes((needle||'').toLowerCase())}
function v(id){return(document.getElementById(id)||{}).value||''}
function clr(...ids){ids.forEach(id=>{const el=document.getElementById(id);if(el)el.value='';})}
function log(a){S.hist.unshift({id:uid(),u:CU,d:CD,a,t:new Date().toISOString()});} // histórico é só-acrescenta (cada entrada é um documento)
function money(n){return (Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function monthLabel(mk){const[y,m]=mk.split('-');return new Date(y,Number(m)-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}
function met(l,val,color,sub){return `<div class="met" style="border-left-color:${color||'var(--text)'}"><div class="mlabel">${esc(l)}</div><div class="mval" style="color:${color||'var(--text)'}">${val}</div>${sub?`<div class="msub">${esc(sub)}</div>`:''}</div>`}
function initials(name){return (name||'?').trim().split(/\s+/).map(w=>w[0]||'').slice(0,2).join('').toUpperCase()||'?'}
function days(d){const t=new Date(d+'T12:00:00'),h=new Date();h.setHours(0,0,0,0);return Math.round((t-h)/86400000)}
function isFull(){return CR==='operacional'||CR==='dona'||CR==='gestor'}  // visão completa de finanças
/* quem enxerga a tela e os valores das Movimentações Pessoais: Edson (gestor), Janaína (operacional/financeiro), Auricélia (dona) */
/* fechamento de período: meses fechados não aceitam lançar/editar/remover */
function mesFechado(d){return (S.fechados||[]).includes((d||'').slice(0,7));}
function bloqueiaMesFechado(d){
  if(!mesFechado(d))return false;
  toast('O mês '+monthLabel((d||'').slice(0,7))+' está fechado. Reabra em Configurações → Fechamento para alterar.','err');
  return true;
}
function canSeeSocios(){
  if(CR==='gestor')return true;
  // operacional/dona: só se a página de Movimentações Pessoais estiver liberada para este usuário
  return (CR==='operacional'||CR==='dona')&&allowedPages().includes('socios');
}

/* ── LOGIN: seletor de perfis ── */
/* ── Login por e-mail/senha substituiu a tela de perfis + PIN.
   Stubs abaixo mantêm compatibilidade com chamadas antigas sem efeito. ── */
function renderProfiles(){/* não há mais grade de perfis */}
function askPin(){/* obsoleto */}
function backToPicker(){/* obsoleto */}
function pinPress(){}function pinDel(){}function pinClear(){}

/* ── permissões de páginas ── */
function allowedPages(){
  if(CR==='gestor')return PAGES_ADMIN; // gestor sempre vê tudo (evita trancar-se fora)
  if(CR==='operacional'||CR==='dona'){
    // páginas personalizadas pelo gestor para este usuário; sem personalização = todas
    if(Array.isArray(CPAGES)&&CPAGES.length)return PAGES_FULL.filter(p=>CPAGES.includes(p));
    return PAGES_FULL;
  }
  // membro: só o que o gestor liberou (dashboard próprio / fluxo próprio)
  return (CA||[]).filter(id=>ALLMODS.includes(id));
}

function startSession(u){
  CU=u.name;CUID=u.uid||u.user;CD=u.area||'diretoria';CR=u.role||'membro';CA=Array.isArray(u.access)?u.access:[...ALLMODS];CPAGES=Array.isArray(u.pages)?u.pages:null;CCX=u.caixaId||'';CDIAS=(u.dias===undefined||u.dias===null||u.dias==='')?null:parseInt(u.dias)||0;
  CAIXA_FILTER='__all__';
  document.getElementById('login').style.display='none';
  document.getElementById('app').style.display='flex';
  document.getElementById('uchipName').textContent=u.name;
  document.getElementById('uchipDot').style.background=u.role==='gestor'?'var(--text)':(DEPTC[u.area]||'var(--t3)');
  document.getElementById('tdept').textContent='· '+(ROLE_LABEL[CR]||'Membro');
  document.getElementById('ddate').textContent=new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const dd=document.getElementById('fx_d');if(dd&&!dd.value)dd.value=hojeBR();
  document.getElementById('dashTitle').textContent=isFull()?'Dashboard':'Meu Caixa';
  buildSidebar();
  if(isFull())gerarRecorrentesAuto();
  const first=allowedPages()[0]||'fluxo';
  sp(first);renderAll();
}


/* ── SIDEBAR ── */
const NAV=[
  {id:'dashboard',l:'Dashboard',dot:'var(--pos)',sec:''},
  {id:'fluxo',l:'Fluxo de Caixa',dot:'var(--gr)',sec:'Operação'},
  {id:'receber',l:'Contas a Receber',dot:'var(--pos)',sec:''},
  {id:'pagar',l:'Contas a Pagar',dot:'var(--peace)',sec:''},
  {id:'pagas',l:'Movimento (Pagas/Receb.)',dot:'var(--pos)',sec:''},
  {id:'boletos',l:'Boletos',dot:'var(--com)',sec:''},
  {id:'dre',l:'DRE Operacional',dot:'var(--ment)',sec:'Análise'},
  {id:'placas',l:'Por Placa',dot:'var(--gr)',sec:''},
  {id:'rateio',l:'Rateio de Custos',dot:'var(--mkt)',sec:''},
  {id:'comissoes',l:'Comissão por Caixa',dot:'var(--com)',sec:''},
  {id:'concil',l:'Conciliação OFX',dot:'var(--com)',sec:''},
  {id:'relatorios',l:'Relatórios',dot:'var(--text)',sec:''},
  {id:'socios',l:'Movimentações Pessoais',dot:'var(--mkt)',sec:''},
  {id:'equipa',l:'Equipa',ico:'◷',sec:'Sistema'},
  {id:'categorias',l:'Categorias',ico:'🏷',sec:'Gestor'},
  {id:'config',l:'Configurações',ico:'⚙',sec:'Gestor'},
];
function buildSidebar(){
  const vis=allowedPages();let h='';let ls='';
  NAV.forEach(item=>{
    if(!vis.includes(item.id))return;
    if(item.sec!==ls){if(item.sec)h+=`<div class="nsec">${item.sec}</div>`;ls=item.sec;}
    const ico=item.dot?`<span class="ndot" style="background:${item.dot}"></span>`:`<span style="font-size:13px;width:7px;display:inline-block">${item.ico||'·'}</span>`;
    h+=`<button class="nitem" data-page="${item.id}" onclick="sp('${item.id}')">${ico} ${item.l}</button>`;
  });
  document.getElementById('sidebar').innerHTML=h;
}
function sp(id){
  if(!allowedPages().includes(id))return;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nitem').forEach(b=>b.classList.remove('active'));
  const pg=document.getElementById('page-'+id);if(pg)pg.classList.add('active');
  document.querySelectorAll('[data-page="'+id+'"]').forEach(b=>b.classList.add('active'));
  closeMenu();           // fecha o menu mobile ao navegar
  window.scrollTo(0,0);  // volta ao topo da nova tela
  renderAll();
}

/* ── MENU MOBILE ── */
function toggleMenu(){
  const sb=document.getElementById('sidebar');
  const ov=document.getElementById('sidebarOverlay');
  const open=sb.classList.toggle('open');
  if(ov)ov.classList.toggle('show',open);
}
function closeMenu(){
  const sb=document.getElementById('sidebar');
  const ov=document.getElementById('sidebarOverlay');
  if(sb)sb.classList.remove('open');
  if(ov)ov.classList.remove('show');
}

/* ── TABS ── */
document.addEventListener('click',e=>{
  const t=e.target.closest('.tab');if(!t)return;
  const pg=t.closest('.page');if(!pg)return;
  pg.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
  pg.querySelectorAll('.sp').forEach(x=>x.classList.remove('on'));
  t.classList.add('on');
  const s=document.getElementById(t.dataset.s);if(s)s.classList.add('on');
});
