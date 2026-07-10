# Auricélia Transportes · Central Financeira — estrutura do projeto

## Arquivos

```
index.html            estrutura das telas (só HTML)
css/estilo.css        aparência (cores, tipografia, layout)
js/nucleo.js          estado, usuários, permissões, utilidades, sidebar, busca
js/painel.js          fluxo de caixa, transferências, dashboard, automações
js/contas.js          contas a receber, contas a pagar, boletos
js/admin.js           cadastros do gestor: caixas, contas, pessoas, categorias, usuários
js/avancado.js        conciliação, relatórios, comissões, backup, fechamento, comprovantes
js/nuvem.js           Firebase: autenticação, sincronização e arranque  ← único módulo
firestore.rules       regras de segurança para publicar no Firebase
```

Os cinco primeiros arquivos `js/` são **scripts clássicos**: compartilham o mesmo
escopo, então uma função de um enxerga a de outro sem importações. O `nuvem.js` é
um **módulo** (precisa de `import` para o Firebase) e carrega por último — quando
tudo o mais já está definido. Ele publica as suas funções para os demais.

**A ordem das tags no `index.html` importa.** Não reordene sem necessidade.

## Como publicar no GitHub Pages

Envie a pasta inteira, preservando os subdiretórios `css/` e `js/`.
O `index.html` precisa ficar na raiz do repositório (ou da pasta publicada).

> ⚠️ **Não abra o `index.html` com duplo clique** (endereço `file://`). Módulos
> JavaScript exigem um servidor — pelo GitHub Pages funciona normalmente.

## Como os dados ficam na nuvem

| Onde | O que guarda |
|---|---|
| `auricelia/core` | cadastros: usuários, caixas, contas, categorias, orçamentos, fechamentos |
| `auricelia_flux/{id}` | um documento por lançamento |
| `auricelia_receber/{id}` | um documento por conta a receber |
| `auricelia_pagar/{id}` | um documento por conta a pagar |
| `auricelia_boletos/{id}` | um documento por boleto |
| `auricelia_hist/{id}` | histórico (só acrescenta, nunca reescreve) |
| `auricelia_anexos/{id}` | comprovantes |

Cada gravação envia **apenas o que mudou**. Duas pessoas lançando ao mesmo tempo
escrevem em documentos diferentes e não apagam o trabalho uma da outra.

O documento antigo (`auricelia/dados`) é **migrado automaticamente** na primeira
vez que um usuário de gestão entrar, e fica guardado como cópia de segurança.

## Passos no Firebase (uma vez)

1. **Authentication → Sign-in method** → ative **E-mail/senha**.
2. **Authentication → Users** → crie o e-mail e a senha de cada pessoa.
3. **Firestore → Rules** → cole o conteúdo de `firestore.rules` → **Publish**.
4. Rode o `definir-papeis.js` (no Cloud Shell) para carimbar os papéis.
5. **O gestor deve entrar primeiro.** É o login dele que migra os dados e
   organiza a nova estrutura.

## O que as regras protegem

- Um operador de caixa **não consegue** criar usuários, mexer em contas bancárias,
  alterar categorias, fechar períodos nem se promover a gestor.
- Ele registra lançamentos e edita/apaga **apenas os seus**.
- O histórico não pode ser reescrito por ninguém — só o gestor administrador apaga.
- Sem estar autenticado, nada é acessível.

---

*Sistema desenvolvido por NIPI · Núcleo Internacional de Políticas Inovadoras.*
