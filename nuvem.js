/* ════════════════════════════════════════
   FIREBASE · sincronização em nuvem (Firestore)
════════════════════════════════════════ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, getDocs, writeBatch }
  from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";


let FB_DB=null, FB_OK=false, FB_AUTH=null, FB_READY=false, FB_SUSPEND=false;
let FB_PULLED=false;    // true só depois da primeira leitura bem-sucedida da nuvem
let SEED_PENDING=false; // a semente de categorias foi completada e precisa ser gravada
let MIGRANDO=false;     // migração do documento antigo em andamento

/* ── COMO OS DADOS FICAM ORGANIZADOS NA NUVEM ──────────────────────────
   ANTES: um único documento com TUDO dentro. Duas pessoas salvando ao mesmo
   tempo enviavam o pacote inteiro e uma apagava o trabalho da outra.

   AGORA:
     auricelia/core          → cadastros (usuários, caixas, contas, categorias…)
     auricelia_flux/{id}     → um documento por lançamento
     auricelia_receber/{id}  → um documento por conta a receber
     auricelia_pagar/{id}    → um documento por conta a pagar
     auricelia_boletos/{id}  → um documento por boleto
     auricelia_hist/{id}     → histórico (só acrescenta, nunca reescreve)
     auricelia_anexos/{id}   → comprovantes

   Cada gravação envia apenas o que mudou. Dois usuários lançando ao mesmo
   tempo escrevem em documentos diferentes e não se atropelam.
──────────────────────────────────────────────────────────────────────── */
const CORE_DOC   = ()=>doc(FB_DB,'auricelia','core');
const LEGADO_DOC = ()=>doc(FB_DB,'auricelia','dados'); // documento antigo (migração automática)
const COLS = { flux:'auricelia_flux', receber:'auricelia_receber', pagar:'auricelia_pagar',
               boletos:'auricelia_boletos', hist:'auricelia_hist' };
const CORE_KEYS = ['users','caixas','contas','categorias','socios','veiculos','ofx','regrasCat','orcamentos','fechados','mem'];

/* espelho do que sabemos estar na nuvem, para gravar só as diferenças */
let MIRROR = {core:'', flux:{}, receber:{}, pagar:{}, boletos:{}, hist:{}};
function mirrorLimpo(){return {core:'', flux:{}, receber:{}, pagar:{}, boletos:{}, hist:{}};}

const firebaseConfig = {
  apiKey: "AIzaSyDA6abgq3H_FLApBqatM-pXN1addl5rHiw",
  authDomain: "auricelia-tranporte.firebaseapp.com",
  projectId: "auricelia-tranporte",
  storageBucket: "auricelia-tranporte.firebasestorage.app",
  messagingSenderId: "296487475525",
  appId: "1:296487475525:web:98d03bf4fa871ea8ff462c",
  measurementId: "G-VD5TELX4QV"
};

try{
  const fbApp=initializeApp(firebaseConfig);
  FB_DB=getFirestore(fbApp);
  FB_AUTH=getAuth(fbApp);
  FB_OK=true;
}catch(e){console.warn('Firebase não inicializou, usando apenas dados locais.',e);}

/* status visual da nuvem */
function cloudStatus(txt,cls){
  const el=document.getElementById('ss');if(!el)return;
  el.textContent=txt;
  el.style.color=cls==='ok'?'var(--pos)':cls==='sync'?'var(--gr)':cls==='err'?'var(--peace)':'var(--t3)';
}
function horaCurta(){return new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});}

/* assinatura estável: a ordem das chaves não pode mudar o resultado,
   senão o sistema acharia que houve mudança onde não houve. */
function sigEstavel(obj){
  const ordena=(v)=>{
    if(Array.isArray(v))return v.map(ordena);
    if(v&&typeof v==='object'&&!(v instanceof Date))
      return Object.keys(v).sort().reduce((o,k)=>{if(v[k]!==undefined)o[k]=ordena(v[k]);return o;},{});
    return v;
  };
  try{return JSON.stringify(ordena(obj));}catch(e){return Math.random().toString();}
}
/* limpa valores que o Firestore não aceita (undefined) */
function limpaDoc(o){return JSON.parse(JSON.stringify(o));}
/* quem pode alterar os cadastros (documento core) */
function podeGravarCore(){return MIGRANDO||isFull();}

/* ── GRAVA NA NUVEM APENAS O QUE MUDOU ── */
async function cloudSync(){
  if(!FB_OK||FB_SUSPEND||!FB_READY)return;
  // TRAVA: nunca grava antes de ter lido o que já existe lá.
  if(!FB_PULLED){console.warn('cloudSync bloqueado: a nuvem ainda não foi lida.');return;}
  try{
    cloudStatus('Sincronizando…','sync');
    let lote=writeBatch(FB_DB), ops=0;
    const enviaLote=async()=>{if(ops){await lote.commit();lote=writeBatch(FB_DB);ops=0;}};

    // 1) coleções: um documento por item
    for(const k of Object.keys(COLS)){
      const col=COLS[k];
      const lista=Array.isArray(S[k])?S[k]:[];
      const vistos=new Set();
      for(const item of lista){
        if(!item.id)item.id=uid();
        vistos.add(item.id);
        const assinatura=sigEstavel(item);
        if(MIRROR[k][item.id]!==assinatura){
          lote.set(doc(FB_DB,col,item.id),limpaDoc(item));
          MIRROR[k][item.id]=assinatura;
          if(++ops>=400)await enviaLote();
        }
      }
      // removidos localmente → apaga na nuvem
      for(const id of Object.keys(MIRROR[k])){
        if(!vistos.has(id)){
          lote.delete(doc(FB_DB,col,id));
          delete MIRROR[k][id];
          if(++ops>=400)await enviaLote();
        }
      }
    }

    // 2) documento core (cadastros) — só quem tem visão completa altera
    if(podeGravarCore()){
      const core={};CORE_KEYS.forEach(k=>core[k]=S[k]);
      const assinatura=sigEstavel(core);
      if(assinatura!==MIRROR.core){
        lote.set(CORE_DOC(),{payload:JSON.stringify(core),updatedAt:Date.now()});
        MIRROR.core=assinatura;
        ops++;
      }
    }

    await enviaLote();
    cloudStatus('Nuvem ✓ '+horaCurta(),'ok');
  }catch(e){
    console.warn('Falha ao sincronizar com a nuvem:',e);
    const msg=String(e&&e.message||'');
    if(msg.includes('permission')||msg.includes('PERMISSION'))
      cloudStatus('Sem permissão para gravar','err');
    else
      cloudStatus('Offline (salvo local)','err');
  }
}

/* ── LEITURA INICIAL ── */
function normalizaListas(){
  ['flux','receber','pagar','boletos','veiculos','ofx','caixas','contas','categorias','socios','users','mem','hist']
    .forEach(k=>{if(!Array.isArray(S[k]))S[k]=[];});
  if(!Array.isArray(S.fechados))S.fechados=[];
  if(!S.orcamentos||typeof S.orcamentos!=='object')S.orcamentos={};
  if(!S.regrasCat||typeof S.regrasCat!=='object')S.regrasCat={};
  // todo item precisa de id próprio (vira o nome do documento na nuvem)
  Object.keys(COLS).forEach(k=>S[k].forEach(i=>{if(!i.id)i.id=uid();}));
}

/* migra o documento único antigo para a nova estrutura (uma única vez) */
async function migrarLegado(){
  const antigo=await getDoc(LEGADO_DOC());
  if(!antigo.exists()||!antigo.data().payload)return false;
  const dados=JSON.parse(antigo.data().payload);
  cloudStatus('Reorganizando os dados…','sync');
  S={...DEF,...dados};
  normalizaListas();
  garanteSemente();
  MIRROR=mirrorLimpo();
  FB_PULLED=true;MIGRANDO=true;
  await cloudSync();          // grava tudo já separado por documentos
  MIGRANDO=false;
  // guarda o antigo como cópia de segurança, marcado como migrado
  try{await setDoc(LEGADO_DOC(),{migradoEm:Date.now(),obs:'Backup do formato antigo. Os dados vivos estão em auricelia/core e nas coleções auricelia_*.'},{merge:true});}catch(e){}
  persistLocal();
  cloudStatus('Dados reorganizados ✓','ok');
  return true;
}

/* puxa uma vez no arranque (caso já exista algo na nuvem) */
async function cloudInit(){
  if(!FB_OK){
    cloudStatus('Sem conexão com o servidor','err');
    const msg=document.getElementById('lg_msg');
    if(msg){msg.style.color='var(--dngt)';msg.textContent='Servidor de login indisponível. Verifique a conexão e recarregue a página.';}
    const btn=document.getElementById('lg_btn');if(btn)btn.disabled=true;
    return;
  }
  // com login por e-mail, a autenticação acontece quando a pessoa entra.
  // aqui só observamos o estado: se já há sessão ativa (voltou ao app), retomamos.
  onAuthStateChanged(FB_AUTH,async(user)=>{
    if(user){
      FB_READY=true;
      cloudStatus('Autenticado','ok');
      await entrarComUsuario(user);
    }else{
      FB_READY=false;
      // mostra a tela de login
      document.getElementById('app').style.display='none';
      document.getElementById('login').style.display='flex';
    }
  });
}
/* faz login com e-mail e senha (Firebase Authentication) */
async function fazerLogin(){
  const email=(document.getElementById('lg_email').value||'').trim();
  const senha=document.getElementById('lg_senha').value||'';
  const msg=document.getElementById('lg_msg');const btn=document.getElementById('lg_btn');
  msg.style.color='var(--dngt)';
  if(!email||!senha){msg.textContent='Informe e-mail e senha.';return;}
  if(!FB_OK||!FB_AUTH){msg.textContent='Conexão com o servidor indisponível. Tente novamente.';return;}
  btn.disabled=true;btn.textContent='Entrando…';msg.style.color='var(--t3)';msg.textContent='Verificando…';
  try{
    await signInWithEmailAndPassword(FB_AUTH,email,senha);
    // onAuthStateChanged assume daqui (chama entrarComUsuario)
    msg.style.color='var(--pos)';msg.textContent='Bem-vindo!';
    document.getElementById('lg_senha').value='';
  }catch(e){
    msg.style.color='var(--dngt)';
    const cod=(e&&e.code)||'';
    if(cod.includes('invalid-credential')||cod.includes('wrong-password')||cod.includes('user-not-found'))
      msg.textContent='E-mail ou senha incorretos.';
    else if(cod.includes('too-many-requests'))
      msg.textContent='Muitas tentativas. Aguarde alguns minutos e tente de novo.';
    else if(cod.includes('invalid-email'))
      msg.textContent='E-mail inválido.';
    else msg.textContent='Não foi possível entrar. Verifique os dados e a conexão.';
  }finally{btn.disabled=false;btn.textContent='Entrar';}
}
/* redefinição de senha por e-mail (o Firebase envia o link) */
async function esqueciSenha(){
  const email=(document.getElementById('lg_email').value||'').trim();
  const msg=document.getElementById('lg_msg');
  if(!email){msg.style.color='var(--dngt)';msg.textContent='Digite o seu e-mail acima primeiro.';return;}
  if(!FB_OK||!FB_AUTH){msg.style.color='var(--dngt)';msg.textContent='Servidor indisponível.';return;}
  try{
    await sendPasswordResetEmail(FB_AUTH,email);
    msg.style.color='var(--pos)';msg.textContent='Enviamos um link de redefinição para o seu e-mail.';
  }catch(e){
    msg.style.color='var(--dngt)';msg.textContent='Não foi possível enviar. Verifique o e-mail digitado.';
  }
}
/* após autenticar: lê o papel do custom claim (inviolável) e monta a sessão */
async function entrarComUsuario(user){
  try{
    const tok=await user.getIdTokenResult(true); // força refresh p/ pegar claims atualizados
    const claimRole=tok.claims.role||tok.claims.papel||null; // papel vindo do custom claim

    // 1) LÊ A NUVEM PRIMEIRO. Nunca mexer nos dados antes de saber o que já existe lá —
    //    senão um aparelho novo (com dados locais vazios) sobrescreveria tudo.
    const ehGestao=['gestor','operacional','dona'].includes(claimRole||'');
    await cloudFirstPull(ehGestao);

    // 2) só agora procura o registro deste e-mail, já com a lista real de usuários
    const email=(user.email||'').toLowerCase();
    let reg=S.users.find(u=>(u.email||'').toLowerCase()===email);
    let novoRegistro=false, adotou=false;

    if(!reg){
      // não achou por e-mail: tenta ADOTAR um registro antigo sem e-mail cujo nome bata
      // (evita duplicar Edson/Janaína/Auricília da semente ao migrarem para login por e-mail)
      const apelido=email.split('@')[0].replace(/[._-]+/g,' ').trim().toLowerCase();
      const nomeClaim=(user.displayName||'').trim().toLowerCase();
      reg=S.users.find(u=>!(u.email||'').trim() && (
            (u.name||'').toLowerCase()===apelido ||
            (nomeClaim && (u.name||'').toLowerCase()===nomeClaim) ||
            (u.user||'').toLowerCase()===apelido));
      if(reg){reg.email=user.email;adotou=true;}
    }
    if(!reg){
      // primeiro acesso mesmo: cria um registro base.
      // Acesso mínimo por segurança — o gestor libera o resto no painel de usuários.
      novoRegistro=true;
      reg={user:'u_'+user.uid.slice(0,8),uid:user.uid,email:user.email,
           name:user.displayName||email.split('@')[0],
           role:claimRole||'membro',area:claimRole?'operacional':'caixa',
           access:claimRole?[...ALLMODS]:['dashboard','fluxo'],
           caixaId:'',t:new Date().toISOString()};
      S.users.push(reg);
    }
    // o papel SEMPRE vem do claim quando existe (fonte de verdade); registro é só complemento
    if(claimRole)reg.role=claimRole;
    reg.uid=user.uid; // garante o vínculo

    // 3) monta a sessão (define CR) e só então grava, se houver o que gravar
    startSession(reg);
    if(novoRegistro||adotou||(SEED_PENDING&&CR==='gestor')){SEED_PENDING=false;save();}
    if(novoRegistro&&!claimRole)toast('Primeiro acesso. Seu caixa e permissões precisam ser configurados pelo gestor.','info');
  }catch(e){
    console.warn('Erro ao montar sessão:',e);
    const msg=document.getElementById('lg_msg');
    if(msg){msg.style.color='var(--dngt)';msg.textContent='Erro ao carregar seu perfil. Contate o gestor.';}
  }
}

async function cloudFirstPull(ehGestao){
  if(!FB_OK||!FB_READY)return;
  try{
    const coreSnap=await getDoc(CORE_DOC());

    if(!coreSnap.exists()){
      // nuvem ainda sem a nova estrutura
      if(ehGestao){
        const migrou=await migrarLegado();
        if(!migrou){ // instalação nova e vazia: envia o estado local
          MIRROR=mirrorLimpo();FB_PULLED=true;MIGRANDO=true;
          await cloudSync();
          MIGRANDO=false;
        }
      }else{
        FB_PULLED=true; // membro entra antes do gestor: trabalha, mas não cria cadastros
        cloudStatus('Aguardando o gestor configurar','err');
      }
      cloudListen();
      return;
    }

    // core existe → carrega cadastros + todas as coleções
    const core=JSON.parse(coreSnap.data().payload||'{}');
    MIRROR=mirrorLimpo();
    MIRROR.core=sigEstavel(core);
    CORE_KEYS.forEach(k=>{if(core[k]!==undefined)S[k]=core[k];});

    const snaps=await Promise.all(Object.values(COLS).map(col=>getDocs(collection(FB_DB,col))));
    Object.keys(COLS).forEach((k,i)=>{
      const arr=[];
      snaps[i].forEach(d=>{const v=d.data();arr.push(v);MIRROR[k][d.id]=sigEstavel(v);});
      if(k==='hist')arr.sort((a,b)=>String(b.t||'').localeCompare(String(a.t||'')));
      S[k]=arr;
    });

    normalizaListas();
    SEED_PENDING=garanteSemente();
    persistLocal();
    FB_PULLED=true;
    if(document.getElementById('app').style.display!=='none')renderAll();
    cloudStatus('Nuvem ✓','ok');
    cloudListen();
  }catch(e){
    console.warn('Não foi possível ler a nuvem; trabalhando só com dados locais.',e);
    // FB_PULLED continua false → nada será enviado, protegendo os dados da nuvem
    cloudStatus('Offline (somente local)','err');
  }
}

/* ── TEMPO REAL: escuta cada parte separadamente ── */
let RERENDER_T=null;
function rerenderSuave(){
  clearTimeout(RERENDER_T);
  RERENDER_T=setTimeout(()=>{
    if(document.getElementById('app').style.display!=='none')renderAll();
  },120);
}
let LISTENING=false;
function cloudListen(){
  if(!FB_OK||LISTENING)return;
  LISTENING=true;

  onSnapshot(CORE_DOC(),(snap)=>{
    if(!snap.exists()||FB_SUSPEND)return;
    let core;try{core=JSON.parse(snap.data().payload||'{}');}catch(e){return;}
    const assinatura=sigEstavel(core);
    if(assinatura===MIRROR.core)return;   // foi a nossa própria gravação
    MIRROR.core=assinatura;
    CORE_KEYS.forEach(k=>{if(core[k]!==undefined)S[k]=core[k];});
    garanteSemente();persistLocal();rerenderSuave();
    cloudStatus('Atualizado da nuvem','ok');
  },(err)=>{console.warn('Listener core:',err);cloudStatus('Offline (salvo local)','err');});

  Object.keys(COLS).forEach(k=>{
    onSnapshot(collection(FB_DB,COLS[k]),(snap)=>{
      if(FB_SUSPEND)return;
      const arr=[],m={};
      snap.forEach(d=>{const v=d.data();arr.push(v);m[d.id]=sigEstavel(v);});
      // se nada mudou em relação ao que já conhecemos, ignora
      const iguais=Object.keys(m).length===Object.keys(MIRROR[k]).length &&
                   Object.keys(m).every(id=>MIRROR[k][id]===m[id]);
      if(iguais)return;
      if(k==='hist')arr.sort((a,b)=>String(b.t||'').localeCompare(String(a.t||'')));
      S[k]=arr;MIRROR[k]=m;
      persistLocal();rerenderSuave();
      cloudStatus('Atualizado da nuvem','ok');
    },(err)=>{console.warn('Listener '+k+':',err);});
  });
}



async function logout(){
  try{if(FB_OK&&FB_AUTH)await signOut(FB_AUTH);}catch(e){}
  FB_PULLED=false;SEED_PENDING=false;MIRROR=mirrorLimpo(); // próximo login relê a nuvem antes de gravar
  document.getElementById('app').style.display='none';
  document.getElementById('login').style.display='flex';
  CU='';CUID='';CD='';CR='';CA=[];CCX='';CPAGES=null;CDIAS=null;
  const s=document.getElementById('lg_senha');if(s)s.value='';
  const m=document.getElementById('lg_msg');if(m)m.textContent='';
}

function anexoDocRef(id){return doc(FB_DB,'auricelia_anexos',id);}

async function salvarAnexo(id,dataUrl,nome){
  const e=S.flux.find(x=>x.id===id);if(!e)return;
  let naNuvem=false;
  if(FB_OK&&FB_READY){
    try{await setDoc(anexoDocRef(id),{dataUrl,nome:nome||'comprovante',t:Date.now()});naNuvem=true;}
    catch(err){console.warn('Anexo: nuvem falhou, guardando local',err);}
  }
  if(!naNuvem)lsAnexoSet(id,{dataUrl,nome:nome||'comprovante',t:Date.now()});
  e.anexo=true;
  log('Anexou comprovante em: '+(e.desc||id));save();renderFluxo();
  toast('Comprovante anexado'+(naNuvem?' (sincronizado na nuvem).':' — guardado só neste aparelho.'),naNuvem?'ok':'info');
}

async function verComprovante(id){
  const e=S.flux.find(x=>x.id===id);if(!e)return;
  let an=null;
  if(FB_OK&&FB_READY){
    try{const snap=await getDoc(anexoDocRef(id));if(snap.exists())an=snap.data();}catch(err){}
  }
  if(!an)an=lsAnexos()[id]||null;
  if(!an||!an.dataUrl){toast('Comprovante não encontrado (pode ter sido anexado noutro aparelho sem nuvem).','err');return;}
  ANEXO_ATUAL=id;
  document.getElementById('anexoImg').src=an.dataUrl;
  document.getElementById('anexoTitulo').textContent='Comprovante — '+(e.desc||'');
  document.getElementById('anexoOverlay').style.display='flex';
}

async function removerAnexo(){
  const id=ANEXO_ATUAL;if(!id)return;
  if(!confirm('Remover este comprovante?'))return;
  if(FB_OK&&FB_READY){try{await deleteDoc(anexoDocRef(id));}catch(err){}}
  lsAnexoSet(id,null);
  const e=S.flux.find(x=>x.id===id);if(e){e.anexo=false;save();}
  fecharAnexo();renderFluxo();
  toast('Comprovante removido.','ok');
}

async function limparNuvem(){
  const lote0=writeBatch(FB_DB);
  lote0.set(CORE_DOC(),{payload:JSON.stringify({}),updatedAt:Date.now()});
  await lote0.commit();
  for(const k of Object.keys(COLS)){
    const snap=await getDocs(collection(FB_DB,COLS[k]));
    let lote=writeBatch(FB_DB),n=0;
    for(const d of snap.docs){lote.delete(d.ref);if(++n>=400){await lote.commit();lote=writeBatch(FB_DB);n=0;}}
    if(n)await lote.commit();
  }
  MIRROR=mirrorLimpo();
}

/* (a lista antiga de exposição saiu: funções de scripts clássicos já são globais) */

/* ── PONTES para o código clássico (que não enxerga os símbolos do Firebase) ── */
function nuvemPronta(){return FB_OK&&FB_READY;}
function nuvemLida(){return FB_PULLED;}
function suspendeNuvem(v){FB_SUSPEND=!!v;}
function resetEspelho(){MIRROR=mirrorLimpo();}

/* funções deste módulo precisam ser publicadas para os handlers do HTML
   e para os scripts clássicos (que rodaram antes deste arquivo) */
Object.assign(window,{
  cloudStatus,cloudSync,cloudFirstPull,cloudInit,cloudListen,
  fazerLogin,esqueciSenha,logout,
  salvarAnexo,verComprovante,removerAnexo,
  limparNuvem,normalizaListas,
  nuvemPronta,nuvemLida,suspendeNuvem,resetEspelho
});

/* ── ARRANQUE ──
   Este módulo é o último a carregar: os scripts clássicos já definiram
   utils, telas e regras de negócio. Aqui ligamos a nuvem e a autenticação. */
load();
document.getElementById('login').style.display='flex';
document.getElementById('app').style.display='none';
cloudStatus('Conectando…','sync');
cloudInit();
