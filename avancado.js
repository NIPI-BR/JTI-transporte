/* ══════════════════════════════════════════════════════════
   Auricélia Transportes · Central Financeira
   avancado.js — Conciliação, relatórios, comissões, backup, fechamento e comprovantes
   (script clássico: as funções aqui são globais para o HTML)
══════════════════════════════════════════════════════════ */

/* ════════ FERRAMENTAS AVANÇADAS (Auricélia) ════════ */
const CF_CATS=['Salários, Encargos e Benefícios','Aluguel e Condomínio','Energia Elétrica','Água','Telefone e Internet','Sistemas (softwares)','Serviços Contratados','Material de Escritório','Taxas e Contribuições','Taxas Bancárias'];
const CD_CATS=['Combustível','Taxa de Pedágio','Taxa de Embarque','Frete de Ônibus','Manutenção de Veículos','Multas','Pagamento Operacional'];
/* categorias para selects de despesa (saída) e receita (entrada) */
/* categorias-semente (nome, tipo, cor) — viram editáveis em S.categorias */
function seedCategorias(){
  /* Lista-padrão definitiva (grafia preservada conforme o cliente).
     O gestor adiciona/remove pela aba Categorias quando precisar. */
  const entrada=[
    ['Receita com vendas','var(--nipi)'],
    ['Receita com serviços','var(--nipi)'],
    ['TRANSFERÊNCIAS ENTRE CONTAS BANCARIAS','var(--gr)'],
    ['RECIBOMENTO DE DINHEIRO','var(--nipi)'],
    ['DEMONSTRATIVO','var(--nipi)'],
    ['RECEBIMENTO DE PIX','var(--nipi)'],
    ['Venda de ativo fixo','var(--ment)'],
    ['Obtenção de empréstimo','var(--mkt)'],
    ['Aporte de capital','var(--mkt)']
  ];
  const saida=[
    ['Custos produto vendido','var(--peace)'],
    ['Impostos sobre receita','var(--mkt)'],
    ['Custo serviço prestado','var(--peace)'],
    ['SISTEMAS','var(--gr)'],
    ['Salários, encargos e benefícios','var(--gr)'],
    ['Luz','var(--com)'],
    ['Aluguel e condomínio','var(--mkt)'],
    ['Serviços contratados','var(--peace)'],
    ['Material de escritório','var(--t3)'],
    ['Despesas financeiras','var(--com)'],
    ['Taxas e contribuições','var(--com)'],
    ['Tarifa bancária','var(--com)'],
    ['Telefone e Internet','var(--ment)'],
    ['Água','var(--gr)'],
    ['Outras despesas','var(--t3)'],
    ['TRANSFERÊNCIAS ENTRE CONTAS BANCARIAS','var(--gr)'],
    ['FATURA CARTAO DE CREDITO','var(--com)'],
    ['TAXAS DE EMBARQUE','var(--com)'],
    ['DESPESAS COMBUSTIVEL','var(--peace)'],
    ['PAGAMENTO OPERACIONAL','var(--peace)'],
    ['MULTAS','var(--peace)'],
    ['FRETE DE ONIBUS','var(--peace)'],
    ['TAXA PEDAGIO','var(--ment)'],
    ['MANUTENÇÃO','var(--com)'],
    ['Compra de ativo fixo','var(--ment)'],
    ['IMOBILIARIO','var(--ment)'],
    ['Pagamento de empréstimo','var(--mkt)'],
    ['Retirada de capital','var(--mkt)'],
    ['EMPRESTIMO BANCARIO','var(--mkt)'],
    ['FINANCIAMENTO','var(--mkt)']
  ];
  const mk=(arr,tipo)=>arr.map(([nome,cor])=>({id:'cat_'+uid(),nome,tipo,cor}));
  return [...mk(entrada,'entrada'),...mk(saida,'saida')];
}
/* garante que as categorias-semente existam, sem duplicar nem apagar as do usuário.
   Chamada em TODO ponto onde os dados entram (local e nuvem) para a lista-padrão
   nunca ser engolida por um documento antigo salvo na nuvem. */
function garanteSemente(){
  if(!Array.isArray(S.categorias))S.categorias=[];
  if(!S.categorias.length){S.categorias=seedCategorias();return true;}
  const nomes=new Set(S.categorias.map(c=>c.nome.toLowerCase()+'|'+c.tipo));
  let mudou=false;
  seedCategorias().forEach(sc=>{if(!nomes.has(sc.nome.toLowerCase()+'|'+sc.tipo)){S.categorias.push(sc);mudou=true;}});
  return mudou;
}
/* listas dinâmicas a partir de S.categorias */
function catsByTipo(tipo){return S.categorias.filter(c=>c.tipo===tipo).map(c=>c.nome);}
/* se a categoria digitada é nova, cadastra automaticamente (aparece nas próximas vezes) */
function garanteCategoria(nome,tipo){
  nome=(nome||'').trim();if(!nome)return'';
  const existe=S.categorias.find(c=>c.nome.toLowerCase()===nome.toLowerCase()&&c.tipo===tipo);
  if(existe)return existe.nome; // usa a grafia já cadastrada
  S.categorias.push({id:'cat_'+uid(),nome,tipo,cor:'var(--t3)'});
  log('Categoria criada automaticamente: '+nome+' ('+(tipo==='entrada'?'receita':'despesa')+')');
  return nome;
}
function catColor(nome){const c=S.categorias.find(x=>x.nome===nome);return c?c.cor:'var(--t3)';}
function catOptions(lista,sel){return lista.map(c=>`<option value="${c}" ${sel===c?'selected':''}>${esc(c)}</option>`).join('');}
/* getters compatíveis com o resto do código */
function CAT_SAIDA_(){return catsByTipo('saida');}
function CAT_ENTRADA_(){return catsByTipo('entrada');}

function depM(v){return v&&v.valorCompra>0?((v.valorCompra-(v.valorResidual||0))/(v.vidaUtil||120)):0;}
function depFrota(){return S.veiculos.filter(v=>v.status==='Ativo').reduce((s,v)=>s+depM(v),0);}
function fpd(lista,campo,per){
  const now=new Date();
  if(per==='mes')return lista.filter(l=>l[campo].startsWith(now.toISOString().slice(0,7)));
  if(per==='trim'){const t=Math.floor(now.getMonth()/3)*3;return lista.filter(l=>{const m=parseInt(l[campo].slice(5,7))-1;return l[campo].startsWith(String(now.getFullYear()))&&m>=t&&m<=t+2});}
  if(per==='ano')return lista.filter(l=>l[campo].startsWith(String(now.getFullYear())));
  // mês específico no formato YYYY-MM
  if(/^\d{4}-\d{2}$/.test(per))return lista.filter(l=>l[campo]&&l[campo].startsWith(per));
  return lista;
}
/* rótulo amigável do período (aceita mes/trim/ano/tudo ou YYYY-MM) */
function labelPeriodo(per){
  const meses=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  if(/^\d{4}-\d{2}$/.test(per)){const[y,m]=per.split('-');return meses[parseInt(m)-1]+'/'+y;}
  return {mes:'Mês atual',trim:'Trimestre',ano:'Ano',tudo:'Todo o período'}[per]||per;
}
/* gera as opções <option> dos últimos 18 meses para selects de período mensal */
function opcoesMeses(){
  const meses=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  let out='';const now=new Date();
  for(let i=0;i<18;i++){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const val=d.toISOString().slice(0,7);
    out+=`<option value="${val}">${meses[d.getMonth()]}/${d.getFullYear()}</option>`;
  }
  return out;
}

/* ── DRE: lançar custo fixo / operacional ── */
// avança uma data conforme a frequência
function avancaData(base,i,freq){
  const dt=new Date(base);
  if(freq==='semanal')dt.setDate(base.getDate()+i*7);
  else if(freq==='quinzenal')dt.setDate(base.getDate()+i*14);
  else dt.setMonth(base.getMonth()+i); // mensal
  return dt;
}
const FREQ_LBL={mensal:'mês',semanal:'semana',quinzenal:'quinzena'};
function addCustoFixo(){
  const d=vData('dcf_d')||new Date().toISOString().slice(0,10);
  const desc=v('dcf_desc').trim();
  const cat=v('dcf_cat');
  const val=parseFloat(v('dcf_val'));
  const tipo=v('dcf_tipo')||'unico';
  if(!desc){toast('Informe a descrição do custo.','err');return;}
  if(!val||val<=0||isNaN(val)){toast('Informe um valor válido.','err');return;}
  const base=new Date(d+'T12:00:00');

  if(tipo==='parcelado'){
    const freq=v('dcf_freq')||'mensal';
    const n=parseInt(v('dcf_n'))||6;
    const grupo=uid(); // id do grupo de parcelas
    for(let i=0;i<n;i++){
      const dt=avancaData(base,i,freq);
      S.flux.push({id:uid(),d:dt.toISOString().slice(0,10),desc:desc+' ('+(i+1)+'/'+n+')',cat,tipo:'saida',val,placa:'',motorista:'',by:CU,byId:CUID,grupo,parcela:(i+1)+'/'+n,t:new Date().toISOString()});
    }
    const fim=avancaData(base,n-1,freq);
    log('Lançou parcelado: '+desc+' ('+money(val)+' x'+n+' '+FREQ_LBL[freq]+')');
    toast(n+' parcelas de '+money(val)+' lançadas ('+FREQ_LBL[freq]+').','ok');
  }else if(tipo==='recorrente'){
    const freq=v('dcf_freq')||'mensal';
    const n=parseInt(v('dcf_n'))||12;
    for(let i=0;i<n;i++){
      const dt=avancaData(base,i,freq);
      S.flux.push({id:uid(),d:dt.toISOString().slice(0,10),desc:desc+(i>0?' (recorrente)':''),cat,tipo:'saida',val,placa:'',motorista:'',by:CU,byId:CUID,recorrente:true,t:new Date().toISOString()});
    }
    log('Lançou recorrente: '+desc+' ('+money(val)+' x'+n+' '+FREQ_LBL[freq]+')');
    toast('Custo recorrente lançado por '+n+' '+(freq==='mensal'?'meses':freq==='semanal'?'semanas':'quinzenas')+'.','ok');
  }else{
    S.flux.push({id:uid(),d,desc,cat,tipo:'saida',val,placa:'',motorista:'',by:CU,byId:CUID,t:new Date().toISOString()});
    log('Lançou custo: '+desc+' ('+money(val)+')');
  }
  save();
  clr('dcf_desc','dcf_val');
  document.getElementById('dcf_preview').style.display='none';
  renderDRE();renderDash();renderFluxo();renderRateio();
}
function onDcfTipoChange(){
  const tipo=v('dcf_tipo');
  const freq=document.getElementById('dcf_freq');
  const n=document.getElementById('dcf_n');
  const show=(tipo==='parcelado'||tipo==='recorrente');
  if(freq)freq.style.display=show?'block':'none';
  if(n)n.style.display=show?'block':'none';
  updateDcfPreview();
}
function updateDcfPreview(){
  const tipo=v('dcf_tipo');const pv=document.getElementById('dcf_preview');if(!pv)return;
  if(tipo!=='parcelado'&&tipo!=='recorrente'){pv.style.display='none';return;}
  const val=parseFloat(v('dcf_val'))||0;
  const freq=v('dcf_freq')||'mensal';
  const n=parseInt(v('dcf_n'))||6;
  const d=vData('dcf_d')||new Date().toISOString().slice(0,10);
  const base=new Date(d+'T12:00:00');
  const fim=avancaData(base,n-1,freq);
  const total=val*n;
  pv.style.display='block';
  if(tipo==='parcelado'){
    pv.innerHTML=`<strong>${n}×</strong> de <strong>${money(val)}</strong> (${freq}) · de ${fmt(d)} a ${fmt(fim.toISOString().slice(0,10))} · total <strong>${money(total)}</strong>`;
  }else{
    pv.innerHTML=`Repete <strong>${n}×</strong> (${freq}) a partir de ${fmt(d)} · ${money(val)} cada`;
  }
}

/* ── DRE ── */
function renderDRE(){
  const dcd=document.getElementById('dcf_d');if(dcd&&!dcd.value)dcd.value=hojeBR();
  const dcs=document.getElementById('dcf_cat');if(dcs){const cur=dcs.value;dcs.innerHTML=catOptions(CAT_SAIDA_(),cur);}
  const per=v('dre_per')||'mes';const meta=parseFloat(v('dre_meta')||'15')/100;
  const dep=depFrota();
  const ls=fpd(S.flux,'d',per);
  const SUM=(cats,tp)=>ls.filter(l=>cats.includes(l.cat)&&l.tipo===(tp||'saida')).reduce((s,l)=>s+l.val,0);
  const recF=SUM(['Receita com Frete'],'entrada');
  const recOut=ls.filter(l=>l.tipo==='entrada'&&l.cat!=='Receita com Frete').reduce((s,l)=>s+l.val,0);
  const recB=recF+recOut;
  const imp=SUM(['Impostos sobre Receita']);const recL=recB-imp;
  const comb=SUM(['Combustível']),ped=SUM(['Taxa de Pedágio']),manut=SUM(['Manutenção de Veículos']);
  const emb=SUM(['Taxa de Embarque']),mult=SUM(['Multas']),pop=SUM(['Pagamento Operacional']);
  const cDir=comb+ped+manut+emb+mult+pop;const lB=recL-cDir;const mbB=recL>0?(lB/recL*100):0;
  const sal=SUM(['Salários, Encargos e Benefícios']),alug=SUM(['Aluguel e Condomínio']),luz=SUM(['Energia Elétrica']);
  const agua=SUM(['Água']),tel=SUM(['Telefone e Internet']),sis=SUM(['Sistemas (softwares)']);
  const serv=SUM(['Serviços Contratados']),tax=SUM(['Taxas e Contribuições']),tb=SUM(['Taxas Bancárias']);
  const outrosAdm=ls.filter(l=>l.tipo==='saida'&&!CD_CATS.includes(l.cat)&&!CF_CATS.includes(l.cat)&&l.cat!=='Impostos sobre Receita').reduce((s,l)=>s+l.val,0);
  const desp=sal+alug+luz+agua+tel+sis+serv+tax+tb+outrosAdm;
  const ebitda=lB-desp;const ebit=ebitda-dep;const mbL=recL>0?(ebit/recL*100):0;
  const nF=ls.filter(l=>l.cat==='Receita com Frete').length;
  document.getElementById('dreKpis').innerHTML=
    met('Receita Líquida',money(recL),'var(--pos)')
   +met('Lucro Bruto',money(lB),lB>=0?'var(--pos)':'var(--peace)','Margem '+mbB.toFixed(1)+'%')
   +met('EBITDA',money(ebitda),ebitda>=0?'var(--pos)':'var(--peace)')
   +met('Lucro Líquido',money(ebit),ebit>=0?'var(--pos)':'var(--peace)','Margem '+mbL.toFixed(1)+'%');
  const R=(l,val,ind,strong,color)=>`<div class="row" ${strong?'style="font-weight:600"':''}><div class="rlabel" style="${ind?'padding-left:18px;color:var(--t2);font-size:12.5px':''}">${l}</div><div class="mono" style="font-weight:${strong?'700':'500'};${color?'color:'+color:''}">${money(val)}</div></div>`;
  const head=(t)=>`<div style="font-size:10px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin:12px 0 4px">${t}</div>`;
  document.getElementById('dreTable').innerHTML=
    head('Receita')
    +R('Receita com Frete',recF,1)+R('Outras receitas',recOut,1)
    +R('(−) Impostos',imp,1,false,'var(--peace)')+R('Receita Líquida',recL,0,true)
    +head('Custos Diretos')
    +R('Combustível',comb,1,false,'var(--peace)')+R('Pedágio',ped,1,false,'var(--peace)')+R('Manutenção',manut,1,false,'var(--peace)')
    +R('Embarque/Multas/Operacional',emb+mult+pop,1,false,'var(--peace)')
    +R('Lucro Bruto · '+mbB.toFixed(1)+'%',lB,0,true,lB>=0?'var(--pos)':'var(--peace)')
    +head('Despesas Administrativas')
    +R('Salários e encargos',sal,1,false,'var(--peace)')+R('Aluguel',alug,1,false,'var(--peace)')
    +R('Utilidades (luz/água/tel)',luz+agua+tel,1,false,'var(--peace)')+R('Sistemas e serviços',sis+serv,1,false,'var(--peace)')
    +R('Taxas e outras',tax+tb+outrosAdm,1,false,'var(--peace)')
    +`<div class="row" style="font-weight:600;background:var(--bg);margin:0 -1.2rem;padding:10px 1.2rem"><div class="rlabel">EBITDA</div><div class="mono" style="font-weight:700">${money(ebitda)}</div></div>`
    +R('(−) Depreciação da frota',dep,1,false,'var(--peace)')
    +`<div class="row" style="font-weight:700;background:var(--side);color:#fff;margin:8px -1.2rem 0;padding:12px 1.2rem;border:1px solid var(--border2);border-radius:8px"><div class="rlabel" style="color:#fff">LUCRO LÍQUIDO · ${mbL.toFixed(1)}%</div><div class="mono" style="font-weight:700;color:${ebit>=0?'#7EE0B0':'#F6A8A8'}">${money(ebit)}</div></div>`
    +`<div class="row" style="font-size:12px;color:var(--t2)"><div>Meta ${(meta*100).toFixed(0)}% → ${money(recL*meta)}</div><div class="mono" style="color:${ebit-recL*meta>=0?'var(--pos)':'var(--peace)'}">Gap: ${ebit-recL*meta>=0?'+':''}${money(ebit-recL*meta)}</div></div>`;
}

/* ── POR PLACA ── */
function openVeicForm(){document.getElementById('veicFormCard').style.display='block';}
function addVeic(){
  const placa=v('ve_pl').trim().toUpperCase();if(!placa){toast('Informe a placa.','err');return;}
  S.veiculos.push({id:uid(),placa,modelo:v('ve_mod').trim(),tipo:'Truck',motorista:v('ve_mot').trim(),ano:v('ve_ano'),status:v('ve_st')||'Ativo',valorCompra:parseFloat(v('ve_vc'))||0,valorResidual:parseFloat(v('ve_vr'))||0,vidaUtil:parseInt(v('ve_vu'))||120,kmMes:parseInt(v('ve_km'))||0,kmAtual:0});
  log('Cadastrou veículo: '+placa);save();
  clr('ve_pl','ve_mod','ve_mot','ve_vc','ve_vr','ve_km','ve_ano');document.getElementById('veicFormCard').style.display='none';renderPlacas();
}
function delVeic(id){const veh=S.veiculos.find(x=>x.id===id);if(!veh)return;if(!confirm('Remover veículo '+veh.placa+'?'))return;S.veiculos=S.veiculos.filter(x=>x.id!==id);log('Removeu veículo: '+veh.placa);save();renderPlacas();}
function renderPlacas(){
  const per=v('pl_per')||'mes';const ls=fpd(S.flux,'d',per);
  const placas=new Set([...S.veiculos.map(v=>v.placa),...ls.filter(l=>l.placa).map(l=>l.placa)]);
  const cards=[...placas].map(placa=>{
    const veh=S.veiculos.find(v=>v.placa===placa)||{placa};
    const ll=ls.filter(l=>l.placa===placa);
    const rec=ll.filter(l=>l.tipo==='entrada').reduce((s,l)=>s+l.val,0);
    const cst=ll.filter(l=>l.tipo==='saida').reduce((s,l)=>s+l.val,0);
    const dep=depM(veh);const ct=cst+dep;const res=rec-ct;const mg=rec>0?(res/rec*100):0;
    const km=veh.kmMes||0;const cpkm=km>0?(ct/km):0;
    return{placa,veh,rec,cst,dep,ct,res,mg,km,cpkm};
  }).sort((a,b)=>b.res-a.res);
  document.getElementById('placaGrid').innerHTML='<div class="g3">'+cards.map(c=>`
    <div class="card" style="margin-bottom:0">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div><span style="background:var(--nipi);color:#fff;font-size:12px;font-weight:600;padding:3px 9px;border-radius:7px;font-family:ui-monospace,monospace">${c.placa}</span><div style="font-size:12px;font-weight:500;margin-top:6px">${esc(c.veh.modelo||'Veículo')}</div><div style="font-size:11px;color:var(--t3)">${esc(c.veh.motorista||'')}</div></div>
        <div style="text-align:right"><div style="font-family:'DM Serif Display',serif;font-size:17px;color:${c.res>=0?'var(--pos)':'var(--peace)'}">${money(c.res)}</div><div style="font-size:10px;color:var(--t3);text-transform:uppercase">resultado real</div></div>
      </div>
      <div class="g3" style="gap:5px;margin-bottom:10px">
        <div style="background:var(--ok);border-radius:7px;padding:7px;text-align:center"><div style="font-size:9px;color:var(--pos);font-weight:600;text-transform:uppercase">Receita</div><div style="font-size:12px;font-weight:600;color:var(--pos)">${money(c.rec)}</div></div>
        <div style="background:var(--pl);border-radius:7px;padding:7px;text-align:center"><div style="font-size:9px;color:var(--peace);font-weight:600;text-transform:uppercase">Custo+Dep</div><div style="font-size:12px;font-weight:600;color:var(--peace)">${money(c.ct)}</div></div>
        <div style="background:var(--bg);border-radius:7px;padding:7px;text-align:center"><div style="font-size:9px;color:var(--t3);font-weight:600;text-transform:uppercase">Margem</div><div style="font-size:12px;font-weight:600;color:${c.mg>=15?'var(--pos)':c.mg>=0?'var(--text)':'var(--peace)'}">${c.mg.toFixed(1)}%</div></div>
      </div>
      ${c.veh.valorCompra>0?`<div style="background:var(--cl);border-radius:7px;padding:8px 10px;font-size:11px;margin-bottom:8px"><div style="font-weight:600;color:var(--com);text-transform:uppercase;font-size:9px;letter-spacing:.05em;margin-bottom:4px">📉 Depreciação</div><div style="display:flex;justify-content:space-between"><span style="color:var(--t3)">Dep./mês</span><strong style="color:var(--com)">${money(c.dep)}</strong></div>${c.km>0?`<div style="display:flex;justify-content:space-between"><span style="color:var(--t3)">Custo/km</span><strong>${money(c.cpkm)}</strong></div>`:''}</div>`:'<div style="font-size:11px;color:var(--peace);margin-bottom:8px">⚠ Sem depreciação configurada</div>'}
      <div style="text-align:right"><button class="btn btnsm" onclick="delVeic('${c.veh.id||''}')" ${!c.veh.id?'style="display:none"':''}>Remover</button></div>
    </div>`).join('')+'</div>';
}

/* ── RATEIO ── */
function popMesRateio(){
  const sel=document.getElementById('rat_mes');if(!sel)return;
  const meses=[...new Set(S.flux.map(l=>l.d.slice(0,7)))].sort().reverse();
  if(!meses.length){sel.innerHTML='<option>—</option>';return;}
  const html=meses.map(m=>`<option value="${m}">${monthLabel(m)}</option>`).join('');
  if(sel.innerHTML!==html)sel.innerHTML=html;
}
function renderRateio(){
  popMesRateio();
  const mes=v('rat_mes');if(!mes||mes==='—')return;
  const ls=S.flux.filter(l=>l.d.startsWith(mes));
  const ativos=S.veiculos.filter(v=>v.status==='Ativo');
  const fixos=ls.filter(l=>l.tipo==='saida'&&CF_CATS.includes(l.cat));
  const tF=fixos.reduce((s,l)=>s+l.val,0);
  const tD=ativos.reduce((s,v)=>s+depM(v),0);const tR=tF+tD;
  const viagens=ls.filter(l=>l.cat==='Receita com Frete'&&l.tipo==='entrada');
  const tRec=viagens.reduce((s,l)=>s+l.val,0);
  const cdP={};ls.filter(l=>l.tipo==='saida'&&l.placa&&CD_CATS.includes(l.cat)).forEach(l=>{cdP[l.placa]=(cdP[l.placa]||0)+l.val;});
  document.getElementById('ratKpis').innerHTML=
    met('Custos Fixos',money(tF),'var(--text)')
   +met('Depreciação',money(tD),'var(--com)')
   +met('Total a Ratear',money(tR),'var(--peace)')
   +met('Receita Fretes',money(tRec),'var(--nipi)',viagens.length+' viagens');
  const byCat={};fixos.forEach(l=>{byCat[l.cat]=(byCat[l.cat]||0)+l.val;});
  let fh=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([k,vl])=>`<div class="row"><div class="rlabel">${esc(k)}</div><div class="mono" style="font-weight:600">${money(vl)}</div></div>`).join('');
  ativos.filter(v=>depM(v)>0).forEach(v=>{fh+=`<div class="row" style="background:var(--cl);margin:0 -1.2rem;padding:7px 1.2rem"><div class="rlabel" style="color:var(--com)">📉 ${esc(v.placa)}</div><div class="mono" style="font-weight:600;color:var(--com)">${money(depM(v))}</div></div>`;});
  fh+=`<div class="row" style="font-weight:700;border-top:2px solid var(--border2)"><div class="rlabel">TOTAL</div><div class="mono">${money(tR)}</div></div>`;
  document.getElementById('ratFixos').innerHTML=fh||'<div class="empty">Sem custos fixos no mês</div>';
  document.getElementById('ratViagens').innerHTML=viagens.length?viagens.map(l=>{
    const p=tRec>0?l.val/tRec:0;const fR=tR*p;const cd=l.placa?(cdP[l.placa]||0)*p:0;
    const cT=fR+cd;const mg=l.val>0?((l.val-cT)/l.val*100):0;
    return`<div class="row"><div style="min-width:0"><div class="rlabel">${esc(l.desc.length>26?l.desc.slice(0,25)+'…':l.desc)}</div><div class="rsub">${fmt(l.d)}${l.placa?' · '+esc(l.placa):''} · rateio ${money(fR)}</div></div><div class="rright"><span style="font-weight:600;color:var(--pos)">${money(l.val)}</span><span class="badge ${mg>=15?'bok':mg>=0?'bwarn':'bdanger'}">${mg.toFixed(0)}%</span></div></div>`;
  }).join(''):emptyState('🚚','Nenhuma viagem no mês','Lance receitas com a categoria "Receita com Frete" para ver o rateio de custos por viagem e a margem de cada frete.');
}

/* ── CONCILIAÇÃO OFX ── */
let OFXLIST=[];
function parseOFX(txt){
  const items=[];const rx=/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;let m;
  while((m=rx.exec(txt))!==null){
    const b=m[1];const g=(t)=>{const r=new RegExp('<'+t+'>([^<\r\n]*)','i');const x=r.exec(b);return x?x[1].trim():'';};
    const amt=parseFloat(g('TRNAMT').replace(',','.'));const ds=g('DTPOSTED');
    if(!ds||isNaN(amt))continue;
    const dt=ds.length>=8?`${ds.slice(0,4)}-${ds.slice(4,6)}-${ds.slice(6,8)}`:'';
    if(!dt)continue;
    const tipo=amt>=0?'entrada':'saida';
    items.push({fitid:g('FITID'),tipo,d:dt,memo:g('MEMO')||g('NAME')||'—',val:Math.abs(amt),status:'pend',cat:'',sel:true});
  }
  return items;
}
function conciliar(){
  const tol=parseFloat(v('concil_tol'))||0.10;
  const usados=new Set(); // lançamentos do fluxo já casados nesta conciliação
  OFXLIST=OFXLIST.map(item=>{
    const t=new Date(item.d+'T12:00:00');
    const dias=l=>Math.abs(new Date(l.d+'T12:00:00')-t)/86400000;
    // 1) casamento EXATO: mesmo tipo, valor dentro da tolerância, data ±3 dias
    const exatos=S.flux.filter(l=>
      l.tipo===item.tipo && !usados.has(l.id) &&
      Math.abs(l.val-item.val)<=tol && dias(l)<=3
    ).sort((a,b)=>dias(a)-dias(b));
    const match=exatos[0];
    if(match){usados.add(match.id);
      return {...item,status:'ok',matchId:match.id,matchDesc:match.desc,cat:match.cat,sel:false,diff:0};
    }
    // 2) casamento DIVERGENTE: parecido mas valor não bate exato
    //    (diferença até 5% do valor OU até R$ 50, e data ±5 dias) — pega taxas, descontos
    const divergentes=S.flux.filter(l=>{
      if(l.tipo!==item.tipo||usados.has(l.id))return false;
      const dv=Math.abs(l.val-item.val);
      if(dv<=tol)return false; // esse seria exato, já tratado
      const relOk=dv<=item.val*0.05, absOk=dv<=50;
      return (relOk||absOk)&&dias(l)<=5;
    }).sort((a,b)=>Math.abs(a.val-item.val)-Math.abs(b.val-item.val));
    const div=divergentes[0];
    if(div){usados.add(div.id);
      return {...item,status:'div',matchId:div.id,matchDesc:div.desc,matchVal:div.val,diff:item.val-div.val,cat:div.cat,sel:false};
    }
    // 3) SEM par: novo lançamento
    const aprendida=sugereCategoria(item.memo);
    const catSug=item.cat||aprendida||(item.tipo==='entrada'?'Recebimentos':'Outras Despesas');
    return {...item,status:'new',matchId:null,matchDesc:'',cat:catSug,sel:true,diff:0};
  });
}
function dropOFX(e){e.preventDefault();document.getElementById('ofxDrop').style.borderColor='var(--border2)';const f=e.dataTransfer.files[0];if(f)readOFX(f);}
function fileOFX(e){const f=e.target.files[0];if(f)readOFX(f);}
/* parser de CSV: detecta colunas de data, descrição e valor */
function parseCSV(txt){
  const linhas=txt.split(/\r?\n/).filter(l=>l.trim());
  if(!linhas.length)return[];
  // detecta separador (; ou ,)
  const sep=(linhas[0].match(/;/g)||[]).length>=(linhas[0].match(/,/g)||[]).length?';':',';
  const split=(l)=>{const out=[];let cur='',q=false;for(let i=0;i<l.length;i++){const ch=l[i];if(ch==='"'){q=!q;}else if(ch===sep&&!q){out.push(cur);cur='';}else cur+=ch;}out.push(cur);return out.map(x=>x.trim().replace(/^"|"$/g,''));};
  // identifica cabeçalho
  let header=split(linhas[0]).map(h=>h.toLowerCase());
  const temHeader=header.some(h=>/data|date|valor|value|amount|hist|desc/.test(h));
  let iData=header.findIndex(h=>/data|date/.test(h));
  let iVal=header.findIndex(h=>/valor|value|amount|montante/.test(h));
  let iDesc=header.findIndex(h=>/hist|desc|memo|lanç|lanc|detalhe/.test(h));
  if(!temHeader){iData=0;iDesc=1;iVal=2;} // sem cabeçalho: assume data, descrição, valor
  if(iData<0)iData=0;if(iVal<0)iVal=temHeader?header.length-1:2;if(iDesc<0)iDesc=1;
  const items=[];
  const start=temHeader?1:0;
  for(let li=start;li<linhas.length;li++){
    const cols=split(linhas[li]);if(cols.length<2)continue;
    let dRaw=(cols[iData]||'').trim();
    let vRaw=(cols[iVal]||'').replace(/[R$\s]/g,'').replace(/\.(?=\d{3})/g,'').replace(',','.');
    const val=parseFloat(vRaw);
    if(isNaN(val))continue;
    // data: aceita dd/mm/aaaa ou yyyy-mm-dd
    let iso='';
    let m1=dRaw.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
    let m2=dRaw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(m1){const y=m1[3].length===2?'20'+m1[3]:m1[3];iso=`${y}-${m1[2]}-${m1[1]}`;}
    else if(m2){iso=dRaw;}
    else continue;
    const tipo=val>=0?'entrada':'saida';
    items.push({fitid:'',tipo,d:iso,memo:(cols[iDesc]||'—').trim()||'—',val:Math.abs(val),status:'pend',cat:'',sel:true});
  }
  return items;
}
function readOFX(f){
  const r=new FileReader();
  r.onload=ev=>{
    const txt=ev.target.result;
    const isOFX=/<OFX|<STMTTRN/i.test(txt);
    OFXLIST=isOFX?parseOFX(txt):parseCSV(txt);
    if(!OFXLIST.length){toast('Nenhuma transação encontrada no arquivo. Verifique se é um OFX válido ou um CSV com colunas de data, descrição e valor.','err');return;}
    conciliar();
    document.getElementById('ofxIcon').textContent='✅';
    document.getElementById('ofxTitle').textContent=f.name+' · '+OFXLIST.length+' transações ('+(isOFX?'OFX':'CSV')+')';
    document.getElementById('ofxSub').textContent=OFXLIST.filter(i=>i.status==='ok').length+' já conciliadas, '+OFXLIST.filter(i=>i.status==='new').length+' novas para importar';
    document.getElementById('concilMetrics').style.display='';
    document.getElementById('concilActions').style.display='';
    document.getElementById('concilFiltros').style.display='';
    renderConcil();
  };
  r.readAsText(f,'latin1');
}
/* atualiza subtítulo do cabeçalho */
function atualizaConcilSub(){
  const sub=document.getElementById('concilSub');if(!sub)return;
  const imp=OFXLIST.length;
  const pend=OFXLIST.filter(i=>i.status==='new'&&!i.ignorado).length;
  const divs=OFXLIST.filter(i=>i.status==='div'&&!i.ignorado).length;
  sub.textContent=`Confira o extrato contra o sistema · ${imp} importados · ${pend} pendentes`+(divs?` · ${divs} com divergência`:'');
}
/* atualiza categoria/seleção de um item */
function ofxSetCat(i,cat){if(OFXLIST[i])OFXLIST[i].cat=cat;}
/* destino da transação: 'empresa' (categoria normal) ou 'socio' (retirada/devolução) */
function ofxSetDestino(i,destino){
  if(!OFXLIST[i])return;
  OFXLIST[i].destino=destino;
  if(destino!=='socio')OFXLIST[i].socioId='';
  renderConcil();
}
function ofxSetSocio(i,socioId){if(OFXLIST[i])OFXLIST[i].socioId=socioId;}
/* resolve uma divergência de valor: ajustar (mesma transação, registra a diferença) | separado (novo lançamento) | ignorar */
function resolverDiv(i,acao){
  const item=OFXLIST[i];if(!item||item.status!=='div')return;
  if(acao==='ignorar'){item.ignorado=true;item.sel=false;renderConcil();return;}
  if(acao==='separado'){
    // trata como novo lançamento comum — some o vínculo com o lançamento existente
    item.status='new';item.matchId=null;item.matchDesc='';item.diff=0;item.sel=true;
    renderConcil();return;
  }
  if(acao==='ajustar'){
    if(bloqueiaMesFechado(item.d))return;
    const dif=item.diff; // banco − sistema
    const absd=Math.abs(dif);
    // registra a diferença como um lançamento de ajuste, para o saldo do sistema bater com o banco
    // dif>0: banco recebeu/pagou MAIS que o sistema → se entrada, +ajuste; se saída, +ajuste na saída
    let tipoAjuste,catAjuste,descAjuste;
    if(item.tipo==='entrada'){
      // entrada: banco maior = recebemos a mais (ajuste entrada +); banco menor = taxa/desconto (ajuste saída)
      tipoAjuste=dif>0?'entrada':'saida';
      catAjuste=dif>0?'Outras Receitas':'Taxas financeiras / maquininha';
      descAjuste='Ajuste de conciliação — '+item.memo;
    }else{
      // saída: banco maior = pagamos a mais (ajuste saída +); banco menor = pagamos menos (ajuste entrada, estorno)
      tipoAjuste=dif>0?'saida':'entrada';
      catAjuste=dif>0?'Taxas financeiras / maquininha':'Outras Receitas';
      descAjuste='Ajuste de conciliação — '+item.memo;
    }
    let caixaId=isFull()?(CAIXA_FILTER!=='__all__'&&CAIXA_FILTER!=='__none__'?CAIXA_FILTER:''):CCX;
    S.flux.push({id:uid(),d:item.d,desc:descAjuste,cat:catAjuste,cc:'',tipo:tipoAjuste,val:absd,placa:'',motorista:'',caixaId,origem:'ajuste_concil',by:CU,byId:CUID,t:new Date().toISOString()});
    item.status='ok';item.sel=false;item.matchDesc='conciliado (ajuste de '+money(absd)+')';
    log('Conciliou com ajuste de '+money(absd)+': '+item.memo);save();renderConcil();renderFluxo();renderDash();
    return;
  }
}
function ofxToggle(i,on){if(OFXLIST[i])OFXLIST[i].sel=on;atualizaContadorSel();}
function ofxSelAll(on){OFXLIST.forEach(it=>{if(it.status==='new'&&!it.ignorado)it.sel=on;});renderConcil();}
function atualizaContadorSel(){
  const n=OFXLIST.filter(i=>i.status==='new'&&i.sel).length;
  const c=document.getElementById('concilSelCount');if(c)c.textContent=n+' selecionado(s)';
}
let CONCIL_FILTER='';
let CONCIL_VIEW='ambas'; // ambas | entrada | saida
let CONCIL_PERIODO=null; // {de, ate} em ISO, ou null
function filterC(f){CONCIL_FILTER=f;renderConcil();}
function aplicarFiltroPeriodo(){
  const de=vData('concil_de'),ate=vData('concil_ate');
  if(!de&&!ate){toast('Informe ao menos uma data para filtrar.','err');return;}
  CONCIL_PERIODO={de:de||'0000-00-00',ate:ate||'9999-99-99'};
  renderConcil();
}
function limparFiltroConcil(){
  CONCIL_PERIODO=null;
  const de=document.getElementById('concil_de'),ate=document.getElementById('concil_ate'),b=document.getElementById('concil_busca');
  if(de)de.value='';if(ate)ate.value='';if(b)b.value='';
  renderConcil();
}
/* aplica período, busca e ordenação a uma lista de {item,i} */
function filtraOrdena(itens){
  const busca=(v('concil_busca')||'').toLowerCase();
  if(CONCIL_PERIODO)itens=itens.filter(x=>x.item.d>=CONCIL_PERIODO.de&&x.item.d<=CONCIL_PERIODO.ate);
  if(busca)itens=itens.filter(x=>x.item.memo.toLowerCase().includes(busca));
  const ord=v('concil_ord')||'data';
  const cmp={
    data:(a,b)=>a.item.d.localeCompare(b.item.d),
    data_desc:(a,b)=>b.item.d.localeCompare(a.item.d),
    alfa:(a,b)=>a.item.memo.localeCompare(b.item.memo,'pt'),
    alfa_desc:(a,b)=>b.item.memo.localeCompare(a.item.memo,'pt'),
    valor:(a,b)=>b.item.val-a.item.val
  }[ord]||((a,b)=>a.item.d.localeCompare(b.item.d));
  return [...itens].sort(cmp);
}
function renderConcil(){
  document.getElementById('cs_tot').textContent=OFXLIST.length||'—';
  document.getElementById('cs_ok').textContent=OFXLIST.filter(i=>i.status==='ok').length||'—';
  document.getElementById('cs_pend').textContent=OFXLIST.filter(i=>i.ignorado).length||'—';
  document.getElementById('cs_new').textContent=OFXLIST.filter(i=>i.status==='new'&&!i.ignorado).length||'—';
  atualizaConcilSub();
  // destaca o botão da visão ativa
  ['ambas','entrada','saida'].forEach(vw=>{const b=document.getElementById('cvw_'+vw);if(b)b.classList.toggle('btnp',CONCIL_VIEW===vw);});
  const el=document.getElementById('concilList');
  if(!OFXLIST.length){el.innerHTML='<div class="empty-rich"><span class="ei">🏦</span><div class="et">Comece importando o extrato</div><div class="es">Arraste o arquivo OFX ou CSV do banco na área acima. O sistema compara com seus lançamentos e mostra o que já bate e o que falta registrar.</div></div>';return;}
  const novos=OFXLIST.filter(i=>i.status==='new'&&!i.ignorado);
  // barra de filtros de status
  let head=`<div class="filter-bar" style="margin-bottom:1rem;align-items:center">
    <button class="btn btnsm ${CONCIL_FILTER===''?'btnp':''}" onclick="filterC('')">Todos (${OFXLIST.length})</button>
    <button class="btn btnsm ${CONCIL_FILTER==='new'?'btnp':''}" onclick="filterC('new')">A importar (${novos.length})</button>
    <button class="btn btnsm ${CONCIL_FILTER==='div'?'btnp':''}" onclick="filterC('div')" ${OFXLIST.filter(i=>i.status==='div'&&!i.ignorado).length?'style="border-color:var(--com)"':''}>≈ Divergências (${OFXLIST.filter(i=>i.status==='div'&&!i.ignorado).length})</button>
    <button class="btn btnsm ${CONCIL_FILTER==='ok'?'btnp':''}" onclick="filterC('ok')">Já conciliados (${OFXLIST.filter(i=>i.status==='ok').length})</button>
    <button class="btn btnsm ${CONCIL_FILTER==='ign'?'btnp':''}" onclick="filterC('ign')">Ignorados (${OFXLIST.filter(i=>i.ignorado).length})</button>
  </div>`;
  const renderItem=(item,i)=>{
    const isNew=item.status==='new'&&!item.ignorado;
    const isDiv=item.status==='div'&&!item.ignorado;
    let bdg;
    if(item.ignorado)bdg='<span class="badge bgray">⊘ Ignorado</span>';
    else if(item.status==='ok')bdg=`<span class="badge bok" title="${esc(item.matchDesc||'')}">✓ Já lançado</span>`;
    else if(isDiv)bdg='<span class="badge bwarn">≈ Diverge</span>';
    else bdg='<span class="badge bwarn">✦ Novo</span>';
    // ── item DIVERGENTE: bateu quase, mostra a diferença e as duas opções ──
    if(isDiv){
      const dif=item.diff; // extrato − sistema (positivo = banco maior)
      const sinal=dif>0?'a mais':'a menos';
      return`<div class="row" style="gap:10px;align-items:flex-start;flex-wrap:wrap;background:var(--warn);border-radius:var(--rs);padding:10px 12px;margin:4px 0">
        <div style="min-width:0;flex:1">
          <div class="rlabel">${esc(item.memo)}</div>
          <div class="rsub">${fmt(item.d)} · banco: <strong>${money(item.val)}</strong> · sistema: <strong>${money(item.matchVal)}</strong> (${esc(item.matchDesc)})</div>
          <div style="font-size:12px;color:var(--warnt);margin-top:3px">⚠ Parecido, mas com <strong>${money(Math.abs(dif))} ${sinal}</strong> no banco. É a mesma transação?</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <button class="btn btnsm btnp" onclick="resolverDiv(${i},'ajustar')" title="Concilia e registra a diferença como taxa/ajuste">✓ É a mesma — ajustar ${money(Math.abs(dif))}</button>
          <button class="btn btnsm" onclick="resolverDiv(${i},'separado')" title="São coisas diferentes — importa como novo lançamento">São diferentes — lançar novo</button>
          <button class="btn btnsm" onclick="resolverDiv(${i},'ignorar')">Ignorar</button>
        </div>
      </div>`;
    }
    const chk=isNew?`<input type="checkbox" ${item.sel?'checked':''} onchange="ofxToggle(${i},this.checked)" style="width:18px;height:18px;flex-shrink:0;cursor:pointer">`:'<span style="width:18px;flex-shrink:0"></span>';
    // destino: empresa (categoria normal) ou sócio (retirada/devolução) — só para itens novos e se houver quem veja sócios
    const ehSocio=item.destino==='socio';
    let destinoCtrl='';
    if(isNew){
      if(canSeeSocios()&&S.socios.length){
        const btnEmp=`<button class="btn btnsm ${!ehSocio?'btnp':''}" style="padding:3px 8px" onclick="ofxSetDestino(${i},'empresa')">Empresa</button>`;
        const btnSoc=`<button class="btn btnsm ${ehSocio?'btnnipi':''}" style="padding:3px 8px" onclick="ofxSetDestino(${i},'socio')">Pessoal</button>`;
        destinoCtrl=`<span style="display:inline-flex;gap:4px;flex-shrink:0">${btnEmp}${btnSoc}</span>`;
      }
    }
    // seletor de categoria (empresa) OU de sócio (retirada/devolução)
    let catSel;
    if(!isNew){
      catSel=`<span class="rsub" style="min-width:140px">${item.ignorado?'ignorado':'já no sistema'}</span>`;
    }else if(ehSocio){
      catSel=`<select onchange="ofxSetSocio(${i},this.value)" style="width:auto;min-width:150px;font-size:12px;padding:4px 8px;border-color:var(--mkt)"><option value="">${item.tipo==='saida'?'Saída pessoal — qual pessoa?':'Entrada pessoal — qual pessoa?'}</option>${S.socios.map(s=>`<option value="${s.id}" ${item.socioId===s.id?'selected':''}>${esc(s.nome)}</option>`).join('')}</select>`;
    }else{
      catSel=`<select onchange="ofxSetCat(${i},this.value)" style="width:auto;min-width:140px;font-size:12px;padding:4px 8px">${catOptions(item.tipo==='entrada'?CAT_ENTRADA_():CAT_SAIDA_(),item.cat)}</select>`;
    }
    const sub=item.status==='ok'&&item.matchDesc?`${fmt(item.d)} · casado com: ${esc(item.matchDesc)}`:`${fmt(item.d)} · ${item.tipo==='entrada'?'Crédito no banco':'Débito no banco'}${ehSocio?' · <span style="color:var(--mkt)">'+(item.tipo==='saida'?'saída pessoal':'entrada pessoal')+'</span>':''}`;
    const dim=(item.status==='ok'||item.ignorado)?'opacity:.65':'';
    return`<div class="row" style="gap:10px;align-items:center;flex-wrap:wrap;${dim}">
      ${chk}
      <div style="min-width:0;flex:1"><div class="rlabel">${esc(item.memo)}</div><div class="rsub">${sub}</div></div>
      ${destinoCtrl}
      ${catSel}
      <span style="font-weight:600;color:${item.tipo==='entrada'?'var(--pos)':'var(--peace)'};white-space:nowrap">${item.tipo==='entrada'?'+':'−'} ${money(item.val)}</span>
      ${bdg}
    </div>`;
  };
  const grupo=(tipo,titulo,cor)=>{
    let itens=OFXLIST.map((item,i)=>({item,i})).filter(x=>x.item.tipo===tipo);
    if(CONCIL_FILTER==='ok')itens=itens.filter(x=>x.item.status==='ok'&&!x.item.ignorado);
    else if(CONCIL_FILTER==='new')itens=itens.filter(x=>x.item.status==='new'&&!x.item.ignorado);
    else if(CONCIL_FILTER==='div')itens=itens.filter(x=>x.item.status==='div'&&!x.item.ignorado);
    else if(CONCIL_FILTER==='ign')itens=itens.filter(x=>x.item.ignorado);
    itens=filtraOrdena(itens); // período + busca + ordenação
    if(!itens.length)return `<div class="card" style="margin-bottom:1rem"><div class="ctitle" style="border-left:3px solid ${cor};padding-left:9px">${titulo}</div><div class="empty">Nenhuma transação neste grupo/filtro</div></div>`;
    const totalG=itens.reduce((s,x)=>s+x.item.val,0);
    // quantos NOVOS (conciliáveis) e quantos selecionados NESTE grupo
    const novosG=itens.filter(x=>x.item.status==='new'&&!x.item.ignorado);
    const selG=novosG.filter(x=>x.item.sel).length;
    const todosMarcados=novosG.length>0&&selG===novosG.length;
    // barra de ações PRÓPRIA do grupo
    const acoes=novosG.length?`
      <div class="filter-bar" style="margin:8px 0 12px;align-items:center;background:var(--bg);padding:8px 10px;border-radius:var(--rs)">
        <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:12px;font-weight:600">
          <input type="checkbox" ${todosMarcados?'checked':''} onchange="ofxSelGrupo('${tipo}',this.checked)" style="width:16px;height:16px;cursor:pointer">
          Marcar todos deste grupo
        </label>
        <span style="font-size:11px;color:var(--t3)">${selG} de ${novosG.length} selecionado(s)</span>
        <span style="flex:1"></span>
        <button class="btn btnsm btnnipi" onclick="conciliarGrupo('${tipo}')">Conciliar ${tipo==='entrada'?'entradas':'saídas'} selecionadas</button>
        <button class="btn btnsm" onclick="categorizarGrupo('${tipo}')">Categorizar</button>
        <button class="btn btnsm" onclick="ignorarGrupo('${tipo}')">Ignorar</button>
      </div>`:'';
    let h=`<div class="card" style="margin-bottom:1rem">
      <div class="ctitle" style="border-left:3px solid ${cor};padding-left:9px">${titulo} · ${itens.length} · ${money(totalG)}</div>
      ${acoes}
      ${itens.map(x=>renderItem(x.item,x.i)).join('')}
    </div>`;
    return h;
  };
  let corpo='';
  if(CONCIL_VIEW==='entrada')corpo=grupo('entrada','↑ Recebimentos (entradas)','var(--pos)');
  else if(CONCIL_VIEW==='saida')corpo=grupo('saida','↓ Pagamentos (saídas)','var(--peace)');
  else corpo=grupo('entrada','↑ Recebimentos (entradas)','var(--pos)')+grupo('saida','↓ Pagamentos (saídas)','var(--peace)');
  el.innerHTML=head+(corpo||'<div class="empty">Nenhuma transação neste filtro</div>');
}
/* visão: 'ambas' | 'entrada' | 'saida' */
function setConcilView(vw){CONCIL_VIEW=vw;renderConcil();}
/* marca/desmarca todos os NOVOS de um grupo (entrada ou saída) */
function ofxSelGrupo(tipo,on){OFXLIST.forEach(it=>{if(it.status==='new'&&!it.ignorado&&it.tipo===tipo)it.sel=on;});renderConcil();}
/* monta o objeto de lançamento a partir de uma transação do extrato,
   tratando o destino: empresa (categoria) ou sócio (retirada/devolução) */
function lancDeConcil(item,caixaId){
  const ehSocio=item.destino==='socio'&&item.socioId;
  return {
    id:uid(),d:item.d,desc:item.memo,
    cat:ehSocio?(item.tipo==='saida'?'Saída pessoal':'Entrada pessoal'):(item.cat||(item.tipo==='entrada'?'Recebimentos':'Outras Despesas')),
    cc:'',tipo:item.tipo,val:item.val,placa:'',motorista:'',
    caixaId,contaId:'',socioId:ehSocio?item.socioId:'',pessoal:!!ehSocio,
    origem:'conciliacao',by:CU,byId:CUID,t:new Date().toISOString()
  };
}
/* valida: itens marcados como sócio precisam ter o sócio escolhido */
/* remove do lote os itens que caem em mês fechado (com aviso) */
function filtraMesFechado(sel){
  const bloq=sel.filter(i=>mesFechado(i.d));
  if(bloq.length)toast(bloq.length+' transação(ões) de mês fechado foram puladas. Reabra o mês para importá-las.','err');
  return sel.filter(i=>!mesFechado(i.d));
}
function validaSocios(sel){
  const semSocio=sel.filter(i=>i.destino==='socio'&&!i.socioId);
  if(semSocio.length){toast(semSocio.length+' marcada(s) como Pessoal sem pessoa escolhida.','err');return false;}
  return true;
}
/* concilia (importa) só os selecionados de UM grupo */
function conciliarGrupo(tipo){
  let sel=OFXLIST.filter(i=>i.tipo===tipo&&i.status==='new'&&!i.ignorado&&i.sel);
  if(!sel.length){toast('Marque as '+(tipo==='entrada'?'entradas':'saídas')+' que deseja conciliar.','err');return;}
  sel=filtraMesFechado(sel);if(!sel.length)return;
  if(!validaSocios(sel))return;
  if(!confirm('Conciliar '+sel.length+' '+(tipo==='entrada'?'entrada(s)':'saída(s)')+' selecionada(s)? Elas serão importadas para o fluxo de caixa.'))return;
  let caixaId=isFull()?(CAIXA_FILTER!=='__all__'&&CAIXA_FILTER!=='__none__'?CAIXA_FILTER:''):CCX;
  sel.forEach(item=>{
    S.flux.push(lancDeConcil(item,caixaId));
    if(item.destino!=='socio'&&item.cat&&item.memo)aprdCategoria(item.memo,item.cat);
    item.status='ok';item.sel=false;item.matchDesc='importado agora';
  });
  log('Conciliou '+sel.length+' '+(tipo==='entrada'?'entradas':'saídas')+' via extrato');save();renderConcil();renderFluxo();renderDash();renderSociosConta();
  toast(sel.length+' '+(tipo==='entrada'?'entrada(s)':'saída(s)')+' conciliada(s).','ok');
}
/* categoriza em massa só os selecionados de um grupo */
function categorizarGrupo(tipo){
  const sel=OFXLIST.filter(i=>i.tipo===tipo&&i.status==='new'&&!i.ignorado&&i.sel);
  if(!sel.length){toast('Marque as transações que deseja categorizar.','err');return;}
  const lista=tipo==='entrada'?CAT_ENTRADA_():CAT_SAIDA_();
  const cat=prompt('Categoria para as '+sel.length+' '+(tipo==='entrada'?'entrada(s)':'saída(s)')+' selecionada(s):\n\nOpções: '+lista.join(', '));
  if(!cat)return;
  sel.forEach(i=>i.cat=cat.trim());
  renderConcil();
}
/* ignora só os selecionados de um grupo */
function ignorarGrupo(tipo){
  const sel=OFXLIST.filter(i=>i.tipo===tipo&&i.status==='new'&&!i.ignorado&&i.sel);
  if(!sel.length){toast('Marque as transações que deseja ignorar.','err');return;}
  if(!confirm('Ignorar '+sel.length+' transação(ões)? Não serão importadas.'))return;
  sel.forEach(i=>{i.ignorado=true;i.sel=false;});
  renderConcil();
}
/* ✦ Conciliar automaticamente: re-roda o matching e importa tudo que casou não é preciso;
   aqui, importa automaticamente os NOVOS de alta confiança (mesmo valor e data exata já casados viram 'ok').
   Como 'ok' já não duplica, o auto foca em recalcular o casamento. */
function conciliarAuto(){
  if(!OFXLIST.length){toast('Importe um extrato primeiro.','err');return;}
  conciliar();
  const jaConc=OFXLIST.filter(i=>i.status==='ok').length;
  const divs=OFXLIST.filter(i=>i.status==='div').length;
  const novos=OFXLIST.filter(i=>i.status==='new').length;
  renderConcil();
  let msg='Conciliação automática concluída.\n\n';
  msg+='✓ '+jaConc+' já lançada(s) no sistema — conciliada(s), sem duplicar.\n';
  if(divs)msg+='≈ '+divs+' com pequena divergência de valor — precisam da sua decisão (ajustar ou lançar novo).\n';
  msg+='✦ '+novos+' nova(s) para categorizar e importar.';
  if(divs)msg+='\n\nUse o filtro "Divergências" para revisar as que quase bateram.';
  alert(msg);
}
/* Categorizar em massa: aplica uma categoria a todos os NOVOS selecionados */
function categorizarMassa(){
  const sel=OFXLIST.filter(i=>i.status==='new'&&!i.ignorado&&i.sel);
  if(!sel.length){toast('Marque as transações que deseja categorizar.','err');return;}
  const temEnt=sel.some(i=>i.tipo==='entrada'),temSai=sel.some(i=>i.tipo==='saida');
  const lista=temEnt&&!temSai?CAT_ENTRADA_():(!temEnt&&temSai?CAT_SAIDA_():[...new Set([...CAT_ENTRADA_(),...CAT_SAIDA_()])]);
  const cat=prompt('Categoria a aplicar nas '+sel.length+' transação(ões) selecionada(s):\n\nOpções: '+lista.join(', '));
  if(!cat)return;
  sel.forEach(i=>i.cat=cat.trim());
  renderConcil();
}
/* Baixa automática: importa todos os NOVOS selecionados de uma vez (atalho do Conciliar) */
function baixaAutomatica(){importSelecionados();}
/* Ignorar: marca os selecionados como ignorados (não entram no fluxo, saem da lista de pendentes) */
function ignorarSelecionados(){
  const sel=OFXLIST.filter(i=>i.status==='new'&&!i.ignorado&&i.sel);
  if(!sel.length){toast('Marque as transações que deseja ignorar.','err');return;}
  if(!confirm('Ignorar '+sel.length+' transação(ões)? Elas não serão importadas nem contarão como pendentes.'))return;
  sel.forEach(i=>{i.ignorado=true;i.sel=false;});
  renderConcil();
}
/* importa apenas os itens NOVOS marcados (em lote), com a categoria escolhida */
function importSelecionados(){
  let novos=OFXLIST.filter(i=>i.status==='new'&&!i.ignorado&&i.sel);
  if(!novos.length){toast('Marque ao menos uma transação para conciliar/importar.','err');return;}
  novos=filtraMesFechado(novos);if(!novos.length)return;
  if(!validaSocios(novos))return;
  if(!confirm('Importar '+novos.length+' transação(ões) selecionada(s) para o fluxo de caixa?'))return;
  let caixaId=isFull()?(CAIXA_FILTER!=='__all__'&&CAIXA_FILTER!=='__none__'?CAIXA_FILTER:''):CCX;
  novos.forEach(item=>{
    S.flux.push(lancDeConcil(item,caixaId));
    if(item.destino!=='socio'&&item.cat&&item.memo)aprdCategoria(item.memo,item.cat); // aprende categoria
    item.status='ok';item.sel=false;item.matchDesc='importado agora';
  });
  const mt=document.getElementById('concilMarcarTodos');if(mt)mt.checked=false;
  log('Conciliou/importou '+novos.length+' lançamentos via extrato');save();renderConcil();renderFluxo();renderDash();renderSociosConta();
  toast(novos.length+' lançamento(s) importado(s).','ok');
}

/* ── RENDER ALL ── */
/* ════════ CONTAS PAGAS E RECEBIDAS ════════ */
function movimentacoesPeriodo(per){
  // Baseia-se no FLUXO DE CAIXA, que já contém tudo: conciliação bancária,
  // recebimentos/pagamentos de contas, boletos e lançamentos manuais.
  // Assim nada duplica e a conciliação aparece no relatório.
  let base=aplicaJanela(S.flux);
  // respeita o filtro de caixa da visão completa, se houver
  if(isFull()&&typeof CAIXA_FILTER!=='undefined'){
    if(CAIXA_FILTER==='__none__')base=base.filter(e=>!e.caixaId);
    else if(CAIXA_FILTER&&CAIXA_FILTER!=='__all__')base=base.filter(e=>e.caixaId===CAIXA_FILTER);
  }else if(!isFull()){
    base=base.filter(e=>e.byId===CUID);
  }
  const movs=base.map(e=>({
    kind:e.tipo==='entrada'?'recebido':'pago',
    nome:e.desc||'—',
    desc:'',
    val:e.val,
    d:e.d,
    cat:e.cat||'',
    cc:e.cc||''
  }));
  return fpd(movs,'d',per);
}
let PAGAS_CACHE=[];
function renderPagas(){
  const mg=document.getElementById('pagas_meses');if(mg&&!mg.children.length)mg.innerHTML=opcoesMeses();
  const per=v('pagas_per')||'mes';const q=v('pagas_q');const tp=v('pagas_tipo')||'todos';
  let list=movimentacoesPeriodo(per);
  if(tp!=='todos')list=list.filter(c=>c.kind===tp);
  if(q)list=list.filter(c=>inc(c.nome,q)||inc(c.desc,q)||inc(c.cat,q));
  list.sort((a,b)=>b.d.localeCompare(a.d));
  PAGAS_CACHE=list;
  const totPago=list.filter(c=>c.kind==='pago').reduce((s,c)=>s+c.val,0);
  const totRec=list.filter(c=>c.kind==='recebido').reduce((s,c)=>s+c.val,0);
  document.getElementById('pagasKpis').innerHTML=
    met('Total entradas',money(totRec),'var(--nipi)',list.filter(c=>c.kind==='recebido').length+' lanç.')
   +met('Total saídas',money(totPago),'var(--peace)',list.filter(c=>c.kind==='pago').length+' lanç.')
   +met('Saldo do período',money(totRec-totPago),(totRec-totPago)>=0?'var(--pos)':'var(--peace)')
   +met('Movimentações',list.length,'var(--text)');
  document.getElementById('pagasTable').innerHTML=list.length?list.map(c=>{
    const isRec=c.kind==='recebido';
    return`<div class="row"><div style="min-width:0"><div class="rlabel">${esc(c.nome)}</div><div class="rsub">${c.cat?esc(c.cat):''}${c.cc?' · 🏷 '+esc(c.cc):''} · ${fmt(c.d)}</div></div><div class="rright"><span class="badge ${isRec?'bok':'bdanger'}">${isRec?'↑ Entrada':'↓ Saída'}</span><span style="font-weight:600;color:${isRec?'var(--pos)':'var(--peace)'}">${isRec?'+':'−'} ${money(c.val)}</span></div></div>`;
  }).join(''):'<div class="empty">Nenhuma movimentação no período</div>';
}
function exportPagasCSV(){
  if(!PAGAS_CACHE.length){toast('Nada para exportar no período.','err');return;}
  const rows=[['Data','Nome','Descrição','Categoria','Centro de custo','Tipo','Valor']];
  PAGAS_CACHE.forEach(c=>rows.push([c.d,c.nome,c.desc||'',c.cat||'',c.cc||'',c.kind==='recebido'?'Recebido':'Pago',String(c.val.toFixed(2)).replace('.',',')]));
  const csv='\uFEFF'+rows.map(r=>r.map(x=>`"${(x||'').toString().replace(/"/g,'""')}"`).join(';')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download='contas_pagas_recebidas.csv';a.click();
}
/* gera um documento de impressão/PDF limpo, com cabeçalho NIPI */
function imprimirPagas(modo){
  const per=v('pagas_per')||'mes';const q=v('pagas_q');
  const perLabel=labelPeriodo(per);
  let list=movimentacoesPeriodo(per);
  if(modo!=='todos')list=list.filter(c=>c.kind===modo);
  if(q)list=list.filter(c=>inc(c.nome,q)||inc(c.desc,q)||inc(c.cat,q));
  list.sort((a,b)=>a.d.localeCompare(b.d));
  if(!list.length){toast('Nada para imprimir neste período/filtro.','err');return;}
  const titulo={todos:'Movimento — Entradas e Saídas',recebido:'Entradas (Recebimentos)',pago:'Saídas (Pagamentos)'}[modo];
  const totPago=list.filter(c=>c.kind==='pago').reduce((s,c)=>s+c.val,0);
  const totRec=list.filter(c=>c.kind==='recebido').reduce((s,c)=>s+c.val,0);
  const linhas=list.map(c=>{
    const isRec=c.kind==='recebido';
    return `<tr>
      <td>${fmt(c.d)}</td>
      <td>${esc(c.nome)}</td>
      <td>${esc(c.desc||'')}</td>
      <td>${esc(c.cat||'')}</td>
      <td>${esc(c.cc||'')}</td>
      <td class="t">${isRec?'Recebido':'Pago'}</td>
      <td class="v" style="color:${isRec?'#1A5C1A':'#A32D2D'}">${isRec?'+':'−'} ${money(c.val)}</td>
    </tr>`;
  }).join('');
  let resumo='';
  if(modo==='todos')resumo=`<div class="resumo"><span>Total recebido: <b style="color:#1A5C1A">${money(totRec)}</b></span><span>Total pago: <b style="color:#A32D2D">${money(totPago)}</b></span><span>Saldo do período: <b>${money(totRec-totPago)}</b></span></div>`;
  else if(modo==='recebido')resumo=`<div class="resumo"><span>Total recebido: <b style="color:#1A5C1A">${money(totRec)}</b></span><span>${list.length} conta(s)</span></div>`;
  else resumo=`<div class="resumo"><span>Total pago: <b style="color:#A32D2D">${money(totPago)}</b></span><span>${list.length} conta(s)</span></div>`;
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titulo}</title>
  <style>
    @page{size:A4;margin:14mm}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;color:#13343B;font-size:12px}
    .hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0D434E;padding-bottom:12px;margin-bottom:6px}
    .hd .badge{display:inline-flex;align-items:center;gap:8px;font-size:20px;font-weight:bold;color:#0D434E}
    .hd .badge span{background:#1D9E75;color:#fff;border-radius:6px;padding:4px 8px;font-size:13px}
    .hd .meta{text-align:right;font-size:11px;color:#5A6B70;line-height:1.6}
    h1{font-size:17px;color:#0D434E;margin:14px 0 2px}
    .sub{color:#5A6B70;font-size:11px;margin-bottom:10px}
    .resumo{display:flex;gap:24px;background:#F4F6F8;border:1px solid #e0e6e9;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px}
    table{width:100%;border-collapse:collapse}
    th{background:#0D434E;color:#fff;text-align:left;padding:7px 8px;font-size:11px}
    th.v,td.v{text-align:right;white-space:nowrap}
    th.t,td.t{text-align:center}
    td{padding:6px 8px;border-bottom:1px solid #e8ecee}
    tr:nth-child(even) td{background:#F8FAFB}
    .ft{margin-top:20px;text-align:center;color:#93A1A5;font-size:10px;border-top:1px solid #e0e6e9;padding-top:10px}
  </style></head><body>
    <div class="hd">
      <div><div class="badge"><span>AT</span> Auricélia Transportes</div></div>
      <div class="meta">Central Financeira<br>Emitido em ${toBR(new Date().toISOString().slice(0,10))} às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}<br>por ${esc(CU||'')}</div>
    </div>
    <h1>${titulo}</h1>
    <div class="sub">Período: ${perLabel}${q?' · Filtro: "'+esc(q)+'"':''}</div>
    ${resumo}
    <table>
      <thead><tr><th>Data</th><th>Nome</th><th>Descrição</th><th>Categoria</th><th>Centro custo</th><th class="t">Tipo</th><th class="v">Valor</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>
    <div class="ft">Sistema desenvolvido por NIPI — Núcleo Internacional de Políticas Inovadoras</div>
  </body></html>`;
  const w=window.open('','_blank');
  if(!w){toast('Permita pop-ups para gerar o relatório.','err');return;}
  w.document.write(html);w.document.close();
  w.onload=()=>{w.focus();w.print();};
  setTimeout(()=>{try{w.focus();w.print();}catch(e){}},400);
}

/* documento PDF reutilizável: cabeçalho NIPI + resumo + tabela */
function abrirDocPDF(titulo,subtitulo,resumoHTML,cabecalhos,linhasHTML){
  const ths=cabecalhos.map(h=>`<th class="${h.cls||''}">${h.txt}</th>`).join('');
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titulo}</title>
  <style>
    @page{size:A4;margin:14mm}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;color:#13343B;font-size:12px}
    .hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0D434E;padding-bottom:12px;margin-bottom:6px}
    .hd .badge{display:inline-flex;align-items:center;gap:8px;font-size:20px;font-weight:bold;color:#0D434E}
    .hd .badge span{background:#1D9E75;color:#fff;border-radius:6px;padding:4px 8px;font-size:13px}
    .hd .meta{text-align:right;font-size:11px;color:#5A6B70;line-height:1.6}
    h1{font-size:17px;color:#0D434E;margin:14px 0 2px}
    .sub{color:#5A6B70;font-size:11px;margin-bottom:10px}
    .resumo{display:flex;gap:24px;background:#F4F6F8;border:1px solid #e0e6e9;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;flex-wrap:wrap}
    table{width:100%;border-collapse:collapse}
    th{background:#0D434E;color:#fff;text-align:left;padding:7px 8px;font-size:11px}
    th.v,td.v{text-align:right;white-space:nowrap}
    th.t,td.t{text-align:center}
    td{padding:6px 8px;border-bottom:1px solid #e8ecee}
    tr:nth-child(even) td{background:#F8FAFB}
    .ft{margin-top:20px;text-align:center;color:#93A1A5;font-size:10px;border-top:1px solid #e0e6e9;padding-top:10px}
  </style></head><body>
    <div class="hd">
      <div><div class="badge"><span>AT</span> Auricélia Transportes</div></div>
      <div class="meta">Central Financeira<br>Emitido em ${toBR(new Date().toISOString().slice(0,10))} às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}<br>por ${esc(CU||'')}</div>
    </div>
    <h1>${titulo}</h1>
    <div class="sub">${subtitulo}</div>
    ${resumoHTML||''}
    <table><thead><tr>${ths}</tr></thead><tbody>${linhasHTML}</tbody></table>
    <div class="ft">Sistema desenvolvido por NIPI — Núcleo Internacional de Políticas Inovadoras</div>
  </body></html>`;
  const w=window.open('','_blank');
  if(!w){toast('Permita pop-ups para gerar o relatório.','err');return;}
  w.document.write(html);w.document.close();
  w.onload=()=>{w.focus();w.print();};
  setTimeout(()=>{try{w.focus();w.print();}catch(e){}},400);
}

/* imprime contas EM ABERTO (a pagar ou a receber), filtradas por período de vencimento */
function imprimirContasAbertas(tipo){
  const selId=tipo==='pagar'?'pgAbertoPer':'rcAbertoPer';
  const per=v(selId)||'tudo';
  const arr=(tipo==='pagar'?S.pagar:S.receber).filter(c=>c.status==='aberto');
  const list=fpd(arr,'venc',per).sort((a,b)=>a.venc.localeCompare(b.venc));
  if(!list.length){toast('Nenhuma conta em aberto neste período.','err');return;}
  const titulo=tipo==='pagar'?'Contas a Pagar (em aberto)':'Contas a Receber (em aberto)';
  const nomeCol=tipo==='pagar'?'Fornecedor':'Cliente';
  const cor=tipo==='pagar'?'#A32D2D':'#1A5C1A';
  const tot=list.reduce((s,c)=>s+c.val,0);
  const totAtual=list.reduce((s,c)=>s+valorAtualizado(c),0);
  const vencidas=list.filter(c=>days(c.venc)<0);
  const linhas=list.map(c=>{
    const d=days(c.venc);const st=d<0?`Vencida (${Math.abs(d)}d)`:d===0?'Vence hoje':`${d} dia(s)`;
    const acr=acrescimo(c);
    return `<tr>
      <td>${fmt(c.venc)}</td>
      <td>${esc(tipo==='pagar'?c.forn:c.cli)}</td>
      <td>${esc(c.desc||'')}</td>
      <td>${esc(c.cat||'')}</td>
      <td>${esc(c.cc||'')}</td>
      <td class="t">${st}</td>
      <td class="v" style="color:${cor}">${money(c.val)}${acr>0?' <span style="color:#93A1A5">(+'+money(acr)+')</span>':''}</td>
    </tr>`;
  }).join('');
  const resumo=`<div class="resumo">
    <span>Total em aberto: <b style="color:${cor}">${money(tot)}</b></span>
    ${totAtual>tot?`<span>Com juros/multa: <b>${money(totAtual)}</b></span>`:''}
    <span>${list.length} conta(s)</span>
    ${vencidas.length?`<span>Vencidas: <b style="color:#A32D2D">${vencidas.length}</b></span>`:''}
  </div>`;
  const cab=[{txt:'Vencimento'},{txt:nomeCol},{txt:'Descrição'},{txt:'Categoria'},{txt:'Centro custo'},{txt:'Situação',cls:'t'},{txt:'Valor',cls:'v'}];
  abrirDocPDF(titulo,'Período de vencimento: '+labelPeriodo(per),resumo,cab,linhas);
}
let REL_CACHE=null;
function renderRelCaixaSelect(){
  const el=document.getElementById('rel_caixa');if(!el)return;
  const cur=el.value;
  el.innerHTML='<option value="">Todos os caixas</option>'+S.caixas.map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('')+'<option value="__none__">Sem caixa</option>';
  el.value=cur||'';
  // datas padrão: mês atual
  const de=document.getElementById('rel_de'),ate=document.getElementById('rel_ate');
  if(de&&!de.value){const n=new Date();de.value=toBR(new Date(n.getFullYear(),n.getMonth(),1).toISOString().slice(0,10));}
  if(ate&&!ate.value)ate.value=hojeBR();
}
/* retorna os itens do relatório conforme tipo, período e caixa
   itens padronizados: {d, desc, cat, cc, caixaId, tipo:'entrada'|'saida', val, situacao} */
function dadosRelatorio(tipo,de,ate,cx,pess){
  const noCaixa=(item)=>{
    if(cx==='__none__')return !item.caixaId;
    if(cx)return item.caixaId===cx;
    return true;
  };
  if(tipo==='avencer_pagar'||tipo==='avencer_receber'){
    const fonte=tipo==='avencer_pagar'?S.pagar:S.receber;
    return fonte.filter(c=>c.status==='aberto'&&c.venc>=de&&c.venc<=ate&&noCaixa(c))
      .map(c=>({d:c.venc,desc:(tipo==='avencer_pagar'?c.forn:c.cli)+(c.desc?' — '+c.desc:''),cat:c.cat||'',cc:c.cc||'',caixaId:c.caixaId||'',
        tipo:tipo==='avencer_pagar'?'saida':'entrada',val:c.val,situacao:days(c.venc)<0?'Vencida':'A vencer'}));
  }
  // movimento/recebido/pago: base é o fluxo (inclui conciliação)
  let ls=aplicaJanela(S.flux).filter(e=>e.d>=de&&e.d<=ate&&noCaixa(e)&&e.tipo!=='transf'); // transferências internas ficam fora; respeita a janela de dias do usuário
  // filtro de movimentações pessoais: 'sem' (só empresa) | 'com' (tudo) | 'so' (somente pessoais)
  if(pess==='sem')ls=ls.filter(e=>!e.pessoal);
  else if(pess==='so')ls=ls.filter(e=>e.pessoal);
  if(tipo==='recebido')ls=ls.filter(e=>e.tipo==='entrada');
  else if(tipo==='pago')ls=ls.filter(e=>e.tipo==='saida');
  return ls.map(e=>({d:e.d,desc:e.desc,cat:e.cat||'',cc:e.cc||'',caixaId:e.caixaId||'',tipo:e.tipo,val:e.val,situacao:'',pessoal:!!e.pessoal}));
}
const REL_TIPO_LABEL={movimento:'Movimento (entradas e saídas)',recebido:'Contas recebidas (entradas)',pago:'Contas pagas (saídas)',avencer_pagar:'Contas a vencer (a pagar)',avencer_receber:'Contas a receber em aberto'};
const REL_PESS_LABEL={sem:'Sem movimentações pessoais',com:'Com movimentações pessoais',so:'Somente movimentações pessoais'};
function gerarRelatorio(){
  const de=vData('rel_de'),ate=vData('rel_ate');
  if(!de||!ate){toast('Informe as duas datas.','err');return;}
  if(de>ate){toast('A data inicial deve ser anterior à final.','err');return;}
  const cx=v('rel_caixa');const tipo=v('rel_tipo')||'movimento';
  const pess=v('rel_pessoal')||'sem';
  const ls=dadosRelatorio(tipo,de,ate,cx,pess).sort((a,b)=>a.d.localeCompare(b.d));
  REL_CACHE={de,ate,cx,tipo,pess,ls};
  const ent=ls.filter(e=>e.tipo==='entrada').reduce((s,e)=>s+e.val,0);
  const sai=ls.filter(e=>e.tipo==='saida').reduce((s,e)=>s+e.val,0);
  const res=ent-sai;
  const ehVencer=tipo==='avencer_pagar'||tipo==='avencer_receber';
  // agrupar por categoria
  const cats={};ls.forEach(e=>{const k=(e.tipo==='entrada'?'＋ ':'－ ')+(e.cat||'Sem categoria');cats[k]=(cats[k]||0)+(e.tipo==='entrada'?e.val:-e.val);});
  const catRows=Object.entries(cats).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).map(([k,vv])=>`<div class="row"><div class="rlabel">${esc(k)}</div><div class="mono" style="font-weight:600;color:${vv>=0?'var(--pos)':'var(--peace)'}">${money(vv)}</div></div>`).join('');
  // agrupar por centro de custo
  const ccs={};ls.forEach(e=>{if(!e.cc)return;ccs[e.cc]=(ccs[e.cc]||0)+(e.tipo==='entrada'?e.val:-e.val);});
  const ccRows=Object.entries(ccs).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).map(([k,vv])=>`<div class="row"><div class="rlabel">🏷 ${esc(k)}</div><div class="mono" style="font-weight:600;color:${vv>=0?'var(--pos)':'var(--peace)'}">${money(vv)}</div></div>`).join('');
  const cxNome=cx==='__none__'?'Sem caixa':(cx?caixaNome(cx):'Todos os caixas');
  // KPIs conforme tipo
  let kpis;
  if(tipo==='recebido')kpis=met('Total recebido',money(ent),'var(--pos)')+met('Lançamentos',ls.length,'var(--text)');
  else if(tipo==='pago')kpis=met('Total pago',money(sai),'var(--peace)')+met('Lançamentos',ls.length,'var(--text)');
  else if(tipo==='avencer_pagar')kpis=met('Total a pagar',money(sai),'var(--peace)')+met('Contas',ls.length,'var(--text)')+met('Vencidas',ls.filter(e=>e.situacao==='Vencida').length,'var(--com)');
  else if(tipo==='avencer_receber')kpis=met('Total a receber',money(ent),'var(--pos)')+met('Contas',ls.length,'var(--text)')+met('Vencidas',ls.filter(e=>e.situacao==='Vencida').length,'var(--com)');
  else kpis=met('Entradas',money(ent),'var(--pos)')+met('Saídas',money(sai),'var(--peace)')+met('Resultado',money(res),res>=0?'var(--pos)':'var(--peace)');
  document.getElementById('relResultado').innerHTML=`
    <div class="card">
      <div class="ctitle">${REL_TIPO_LABEL[tipo]} · ${fmt(de)} a ${fmt(ate)} · ${esc(cxNome)}${!ehVencer?' · '+REL_PESS_LABEL[pess]:''}</div>
      <div class="g3" style="margin-bottom:.5rem">${kpis}</div>
      <div class="stitle">Por categoria</div>
      ${catRows||'<div class="empty">Nenhum registro no período</div>'}
      ${ccRows?'<div class="stitle">Por centro de custo</div>'+ccRows:''}
      <div class="stitle">${ehVencer?'Contas':'Lançamentos'} (${ls.length})</div>
      ${ls.length?ls.map(e=>`<div class="row"><div style="min-width:0"><div class="rlabel">${esc(e.desc)}${e.pessoal?' <span style="font-size:10px;background:var(--pl);color:var(--peace);padding:1px 6px;border-radius:6px;vertical-align:middle">pessoal</span>':''}</div><div class="rsub">${fmt(e.d)}${e.cat?' · '+esc(e.cat):''}${e.cc?' · 🏷 '+esc(e.cc):''}${e.caixaId?' · '+esc(caixaNome(e.caixaId)):''}${e.situacao?' · '+e.situacao:''}</div></div><span style="font-weight:600;color:${e.tipo==='entrada'?'var(--pos)':'var(--peace)'}">${e.tipo==='entrada'?'+':'−'} ${money(e.val)}</span></div>`).join(''):'<div class="empty">Sem registros</div>'}
    </div>`;
}
function exportRelatorioCSV(){
  if(!REL_CACHE||!REL_CACHE.ls){toast('Gere o relatório primeiro.','err');return;}
  const rows=[['Data','Descrição','Categoria','Forma','Centro de custo','Caixa','Tipo','Situação','Valor']];
  REL_CACHE.ls.forEach(e=>{
    const fl=e.forma?formaLabel(e.forma).replace(/^\S+\s/,''):'';
    rows.push([e.d,e.desc,e.cat||'',fl,e.cc||'',e.caixaId?caixaNome(e.caixaId):'',e.tipo,e.situacao||'',String(e.val.toFixed(2)).replace('.',',')]);
  });
  const ent=REL_CACHE.ls.filter(e=>e.tipo==='entrada').reduce((s,e)=>s+e.val,0);
  const sai=REL_CACHE.ls.filter(e=>e.tipo==='saida').reduce((s,e)=>s+e.val,0);
  rows.push([]);rows.push(['','','','','','','','Entradas',String(ent.toFixed(2)).replace('.',',')]);
  rows.push(['','','','','','','','Saídas',String(sai.toFixed(2)).replace('.',',')]);
  const csv='\uFEFF'+rows.map(r=>r.map(c=>`"${(c||'').toString().replace(/"/g,'""')}"`).join(';')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  a.download=`relatorio_${REL_CACHE.tipo}_${REL_CACHE.pess||'sem'}_pessoais_${REL_CACHE.de}_a_${REL_CACHE.ate}.csv`;a.click();
}
/* gera PDF do relatório conforme o tipo selecionado */
function imprimirRelatorioTipo(){
  const de=vData('rel_de'),ate=vData('rel_ate');
  if(!de||!ate){toast('Informe as duas datas primeiro.','err');return;}
  if(de>ate){toast('A data inicial deve ser anterior à final.','err');return;}
  const cx=v('rel_caixa');const tipo=v('rel_tipo')||'movimento';
  const pess=v('rel_pessoal')||'sem';
  const ls=dadosRelatorio(tipo,de,ate,cx,pess).sort((a,b)=>a.d.localeCompare(b.d));
  if(!ls.length){toast('Nenhum registro neste período/filtro.','err');return;}
  const cxNome=cx==='__none__'?'Sem caixa':(cx?caixaNome(cx):'Todos os caixas');
  const ehV=tipo==='avencer_pagar'||tipo==='avencer_receber';
  const pessSub=ehV?'':' · '+REL_PESS_LABEL[pess];
  const ent=ls.filter(e=>e.tipo==='entrada').reduce((s,e)=>s+e.val,0);
  const sai=ls.filter(e=>e.tipo==='saida').reduce((s,e)=>s+e.val,0);
  const ehVencer=tipo==='avencer_pagar'||tipo==='avencer_receber';
  let resumo='<div class="resumo">';
  if(tipo==='movimento')resumo+=`<span>Entradas: <b style="color:#1A5C1A">${money(ent)}</b></span><span>Saídas: <b style="color:#A32D2D">${money(sai)}</b></span><span>Resultado: <b>${money(ent-sai)}</b></span>`;
  else if(tipo==='recebido')resumo+=`<span>Total recebido: <b style="color:#1A5C1A">${money(ent)}</b></span><span>${ls.length} lançamento(s)</span>`;
  else if(tipo==='pago')resumo+=`<span>Total pago: <b style="color:#A32D2D">${money(sai)}</b></span><span>${ls.length} lançamento(s)</span>`;
  else if(tipo==='avencer_pagar')resumo+=`<span>Total a pagar: <b style="color:#A32D2D">${money(sai)}</b></span><span>${ls.length} conta(s)</span><span>Vencidas: <b>${ls.filter(e=>e.situacao==='Vencida').length}</b></span>`;
  else resumo+=`<span>Total a receber: <b style="color:#1A5C1A">${money(ent)}</b></span><span>${ls.length} conta(s)</span><span>Vencidas: <b>${ls.filter(e=>e.situacao==='Vencida').length}</b></span>`;
  resumo+='</div>';
  const colSit=ehVencer;
  const linhas=ls.map(e=>{
    const isE=e.tipo==='entrada';
    return `<tr>
      <td>${fmt(e.d)}</td>
      <td>${esc(e.desc||'')}</td>
      <td>${esc(e.cat||'')}</td>
      <td>${esc(e.cc||'')}</td>
      <td>${esc(e.caixaId?caixaNome(e.caixaId):'')}</td>
      ${colSit?`<td class="t">${e.situacao}</td>`:`<td class="t">${isE?'Entrada':'Saída'}</td>`}
      <td class="v" style="color:${isE?'#1A5C1A':'#A32D2D'}">${isE?'+':'−'} ${money(e.val)}</td>
    </tr>`;
  }).join('');
  const cab=[{txt:'Data'},{txt:ehVencer?'Fornecedor/Cliente':'Descrição'},{txt:'Categoria'},{txt:'Centro custo'},{txt:'Caixa'},{txt:colSit?'Situação':'Tipo',cls:'t'},{txt:'Valor',cls:'v'}];
  abrirDocPDF(REL_TIPO_LABEL[tipo],`Período: ${fmt(de)} a ${fmt(ate)} · ${esc(cxNome)}${pessSub}`,resumo,cab,linhas);
}
/* mantém compatibilidade: PDF rápido de movimento/entrada/saída */
function imprimirRelatorio(modo){
  const map={todos:'movimento',entrada:'recebido',saida:'pago'};
  const sel=document.getElementById('rel_tipo');if(sel)sel.value=map[modo]||'movimento';
  imprimirRelatorioTipo();
}

/* ── RENDER ALL ── */
function renderAll(){
  renderDash();renderFluxo();renderReceber();renderPagar();renderBoletos();renderEquipa();
  renderPagas();renderRelCaixaSelect();
  if(canSeeSocios())renderSociosConta();
  if(isFull()){renderDRE();renderPlacas();renderRateio();renderConcil();renderComissoes();}
  if(CR==='gestor'){renderAreaSelect();renderUsers();renderCaixaList();renderContaList();renderCaixaAssignSelect();renderCategorias();renderFechados();renderOrcamentoList();const cm=document.getElementById('cu_mods');if(cm&&!cm.children.length)renderModChecks('cu_mods',[]);onRoleChange();}
}

/* ── exposição global (necessário porque o script é type="module") ── */
