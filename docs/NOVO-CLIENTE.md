# Como criar o painel para um novo cliente

Para atender uma academia nova **não é preciso mexer no código**. Basta criar uma pasta para o cliente
(configuração, logo e ícone) e rodar os comandos de build.

Neste guia, o exemplo é o **Studio Norte**, com o id `studio-norte`.

> **Resumo:** copiar a pasta → trocar logo e ícone → editar `cliente.json` → `validar` → `desktop:dev` →
> `desktop:build` → testar o instalador → entregar.

---

## Sumário

0. [Pré-requisitos](#0-pré-requisitos-só-uma-vez)
1. [Criar a pasta do cliente](#1-criar-a-pasta-do-cliente)
2. [Logo e ícone](#2-logo-e-ícone)
3. [Editar o `cliente.json`](#3-editar-o-clientejson)
4. [Validar a configuração](#4-validar-a-configuração)
5. [Ver o app antes do build](#5-ver-o-app-antes-do-build)
6. [Gerar o instalador](#6-gerar-o-instalador)
7. [Testar o instalador](#7-testar-o-instalador-no-seu-computador)
8. [Entregar ao cliente](#8-entregar-ao-cliente)
9. [Atualizar um cliente existente](#9-atualizar-um-cliente-existente)
10. [Problemas comuns](#10-problemas-comuns)

---

## 0. Pré-requisitos (só uma vez)

Só o computador **de quem gera o programa** precisa disto; o computador do cliente não precisa de nada.

| Ferramenta | Para quê |
| --- | --- |
| [Node.js](https://nodejs.org) (LTS) | interface e scripts |
| [Rust](https://rustup.rs) (toolchain MSVC) | parte nativa (Tauri) |
| Visual Studio C++ Build Tools | compilador usado pelo Rust no Windows |

Depois de instalar, dentro da pasta `painel-avaliacoes`:

```powershell
npm install
```

**Abrir o terminal no lugar certo:** no VS Code, abra a pasta `painel-avaliacoes` e use
**Terminal > Novo Terminal** (`` Ctrl+` ``). Todos os comandos deste guia rodam a partir dela.

---

## 1. Criar a pasta do cliente

Copie a pasta `clientes/forja` e cole como `clientes/forjaemplo-2`:

```powershell
Copy-Item -Recurse clientes/forja clientes/forjaemplo-2
```

O **nome da pasta é o id do cliente**, usado em todos os comandos.

- Só **letras minúsculas, números e hífen**.
- Sem espaços e sem acentos.

```text
clientes/
  forja/
  studio-norte/     ← nova
    cliente.json
    logo.svg              ← será trocado
    icone.svg             ← será trocado
```

---

## 2. Logo e ícone

Coloque os arquivos do cliente dentro de `clientes/forjaemplo-2/` e apague os da Forja Academia que não forem usados.

| Arquivo | Onde aparece | Requisitos |
| --- | --- | --- |
| **Logo** (ex.: `logo.png`) | faixa no topo do painel | horizontal, **fundo transparente**, **versão clara** (a faixa é escura). Formatos: `png`, `jpg`, `jpeg`, `svg`, `webp`. É exibida com 36 px de altura. |
| **Ícone** (ex.: `icone.png`) | `.exe`, atalhos, barra de tarefas e instalador | **quadrado, 1024 × 1024 px**, `png` ou `svg`. Prefira um símbolo simples: ele aparece bem pequeno. |

> Se o cliente só tiver a logo escura, há duas saídas: pedir a versão clara ou usar uma `barraTopo` clara
> no `cliente.json` (passo 3).

---

## 3. Editar o `cliente.json`

Abra `clientes/forjaemplo-2/cliente.json` no VS Code:

```json
{
  "nome": "Studio Norte",
  "nomeCurto": "Studio Norte",
  "produto": "Studio Norte Painel",
  "executavel": "StudioNorte-Painel",
  "identificador": "br.com.studionorte.painel",
  "banco": "studio-norte.db",
  "prefixoBackup": "studionorte-backup",
  "versao": "1.0.0",
  "logo": "logo.png",
  "icone": "icone.png",
  "cores": {
    "primaria": "#e63946",
    "barraTopo": "#1d1d1d"
  },
  "mensagens": {
    "hoje": "Olá, {{nome}}! Aqui é da Studio Norte. Sua avaliação física é hoje, às {{horario}}. Te esperamos!",
    "futura": "Olá, {{nome}}! Aqui é da Studio Norte. Sua avaliação física está marcada para {{data}}, às {{horario}}. Te esperamos!"
  }
}
```

### Campos

| Campo | Exemplo | Para que serve | Regras |
| --- | --- | --- | --- |
| `nome` | `Studio Norte` | nome da empresa; publicador do instalador e texto da logo | 2 a 60 caracteres |
| `nomeCurto` | `Studio Norte` | título da janela e do LEIA-ME | 2 a 30 caracteres |
| `produto` | `Studio Norte Painel` | nome do programa, dos atalhos e da pasta de instalação | letras, números, espaço e hífen |
| `executavel` | `StudioNorte-Painel` | nome do `.exe` | **sem espaços e sem acentos** |
| `identificador` | `br.com.studionorte.painel` | identidade do programa no Windows; **define a pasta dos dados** | minúsculas, pelo menos 3 partes separadas por ponto, **único por cliente** |
| `banco` | `studio-norte.db` | arquivo SQLite com as avaliações | minúsculas, termina em `.db` |
| `prefixoBackup` | `studionorte-backup` | início do nome dos arquivos de backup | minúsculas e hífen |
| `versao` | `1.0.0` | versão do programa e do instalador | formato `X.Y.Z` |
| `logo` / `icone` | `logo.png` | arquivos dentro da pasta do cliente | só o nome do arquivo, sem caminho |
| `cores.primaria` | `#e63946` | botões, destaques, foco, ícones | `#rrggbb`, `rgb()`, `hsl()` ou `oklch()` |
| `cores.barraTopo` | `#1d1d1d` | faixa do topo, atrás da logo | idem |
| `mensagens.hoje` | — | lembrete de avaliação **no dia** | **opcional**; precisa de `{{nome}}` e `{{horario}}` |
| `mensagens.futura` | — | lembrete de avaliação **futura** | **opcional**; precisa de `{{nome}}`, `{{data}}` e `{{horario}}` |

**Cores opcionais (ajuste fino).** Se omitidas, são calculadas a partir da `primaria`:

| Campo | Para que serve |
| --- | --- |
| `cores.primariaSuave` | fundos suaves (cards de ícones, item selecionado) |
| `cores.primariaTexto` | texto sobre fundo suave |
| `cores.primariaContraste` | texto sobre a cor primária (padrão: branco) |

> **Dica de cores:** pegue o código hex direto da logo. No VS Code, ao digitar uma cor como `"#e63946"`
> aparece um quadradinho clicável com seletor de cor.

> **Mensagens sem emoji.** O redirecionamento do `wa.me` troca emojis por "�". A validação recusa
> mensagens com emoji. Acentos funcionam normalmente. Sem o bloco `mensagens`, vale o texto padrão.

---

## 4. Validar a configuração

```powershell
npm run cliente:validar
```

Se estiver tudo certo:

```text
ok  studio-norte Studio Norte Painel (br.com.studionorte.painel, studio-norte.db)
ok  forja        Forja Painel (br.com.forja.painel, forja.db)
```

Se houver erro, a mensagem diz o campo e o motivo, por exemplo:

```text
clientes/forjaemplo-2/cliente.json inválido:
  - "executavel": nome do .exe sem espaços nem acentos (recebido: "Studio Norte Painel")
```

Também vale rodar os testes, que conferem todos os clientes (inclusive que nenhum repete o
`identificador` ou o `banco` de outro):

```powershell
npm test
```

---

## 5. Ver o app antes do build

```powershell
npm run desktop:dev -- studio-norte
```

> Os **`--`** antes do id são obrigatórios: é assim que o `npm` repassa o nome do cliente.

O app abre com a marca nova. Confira:

- [ ] logo legível na faixa do topo
- [ ] cores dos botões e destaques
- [ ] título da janela
- [ ] cadastrar uma avaliação e clicar em **Lembrete**: confira o texto no WhatsApp (não precisa enviar)

Para encerrar: feche a janela e aperte `Ctrl+C` no terminal.

> Os dados criados aqui ficam em `%APPDATA%\br.com.studionorte.painel` (veja o passo 7 para apagar).

---

## 6. Gerar o instalador

```powershell
npm run desktop:build -- studio-norte
```

Leva de **4 a 5 minutos** e termina com `Pronto:`. Resultado:

```text
painel-avaliacoes/distribuicao/studio-norte/
  Instalador/
    Studio Norte Painel_1.0.0_x64-setup.exe   ← o que o cliente instala
    LEIA-ME.txt                            ← guia de uso já com os dados do cliente
  StudioNorte-Painel-Portatil/
    StudioNorte-Painel.exe                    ← versão sem instalar
    LEIA-ME.txt
```

O que o comando faz por trás:

1. Valida o `cliente.json`.
2. Gera os ícones em todos os tamanhos a partir do ícone do cliente (`tauri icon`).
3. Gera a configuração do Tauri do cliente em `src-tauri/clientes-gerado/studio-norte/`.
4. Compila o Angular, empacota a API NestJS com uma cópia do Node e compila a janela em Rust (Tauri).
5. Cria o instalador NSIS e monta a pasta `distribuicao/studio-norte/`.

---

## 7. Testar o instalador no seu computador

Antes de entregar, teste o instalador como se fosse o cliente:

1. Dê dois cliques em `Studio Norte Painel_1.0.0_x64-setup.exe`.
   - Se aparecer **"O Windows protegeu o computador"**, clique em **Mais informações** e depois em
     **Executar assim mesmo**. É normal em programas sem assinatura digital paga.
2. Avance até concluir (não pede administrador).
3. Confira o atalho **Studio Norte Painel** na Área de Trabalho e no Menu Iniciar e abra o programa.
4. Desinstale em **Configurações > Aplicativos > Studio Norte Painel > Desinstalar**.
5. **Apague os dados de teste**, para não ficarem no seu computador:
   - na barra de endereço do Explorer, digite `%APPDATA%\br.com.studionorte.painel` e apague a pasta.

> Testar no seu computador **não mexe** nos dados de outros clientes: cada cliente tem
> sua própria pasta de dados (definida pelo `identificador`).

### Teste automático (opcional)

Os testes do Playwright (`npm run test:e2e`) exercitam a mesma interface e a mesma API que vão
dentro do instalador. Rode-os antes de gerar uma versão nova.

---

## 8. Entregar ao cliente

1. Copie a pasta `distribuicao/studio-norte` para o pendrive.
2. No computador da academia, rode o instalador da pasta `Instalador`.
   - Não precisa de administrador.
   - Se faltar o WebView2 (raro no Windows 10/11 atualizado), o instalador baixa sozinho; precisa de internet nesse momento.
3. Mostre ao cliente o `LEIA-ME.txt`: explica uso, **backup semanal** e restauração.

---

## 9. Atualizar um cliente existente

1. Faça a alteração (código, logo, cores, mensagens…).
2. No `cliente.json`, **aumente a `versao`**: `1.0.0` → `1.0.1` (correção) ou `1.1.0` (novidade).
3. Rode `npm run desktop:build -- studio-norte`.
4. O cliente roda o novo instalador **por cima** do antigo. As avaliações continuam lá.

> **Nunca altere `identificador` nem `banco` de um cliente que já usa o programa.**
> O programa novo procuraria os dados em outro lugar e o painel apareceria vazio. Os dados não se perdem,
> continuam na pasta antiga, mas o cliente vai achar que sumiram. Por isso a Forja Academia mantém
> `br.com.forja.painel` e `forja.db`, e um teste garante isso.

Alterações no código (`src/`, `src-tauri/`) valem para **todos** os clientes: gere de novo o build de
cada um que deve receber a atualização.

---

## 10. Problemas comuns

| Sintoma | Causa e solução |
| --- | --- |
| `Cliente "x" não encontrado` | o id do comando não bate com o nome da pasta em `clientes/` (confira os `--` antes do id) |
| `"logo": arquivo logo.png não encontrado` | o nome no `cliente.json` difere do arquivo; atenção a `.PNG` × `.png` e `.jpg` × `.jpeg` |
| Erro ao gerar os ícones | o ícone não é quadrado ou é pequeno demais; use PNG 1024 × 1024 |
| `Port 1420 is already in use` | ficou um `desktop:dev` aberto; feche aquele terminal (`Ctrl+C`) |
| Logo some na faixa do topo | logo escura sobre faixa escura; use versão clara ou `barraTopo` mais clara |
| Build falha com erro do Rust/linker | faltam Rust ou Visual Studio C++ Build Tools (passo 0) |
| Painel vazio após atualizar | `identificador` ou `banco` foi alterado; volte aos valores anteriores (passo 9) |
| WhatsApp mostra "�" na mensagem | emoji na mensagem; a validação bloqueia, então rode `npm run cliente:validar` |

---

## Onde fica cada coisa

| Caminho | O que é |
| --- | --- |
| `clientes/<id>/` | configuração, logo e ícone de cada cliente (**o único lugar que você edita por cliente**) |
| `distribuicao/<id>/` | instalador e versão portátil prontos para entregar (gerado) |
| `src-tauri/clientes-gerado/<id>/` | ícones e configuração do Tauri gerados no build (não editar) |
| `docs/LEIA-ME-CLIENTE.txt` | modelo do guia do cliente; `{{produto}}`, `{{banco}}` etc. são preenchidos no build |
| `scripts/cliente-config.mjs` | carrega e valida o `cliente.json` |
| `scripts/cliente.mjs` | comandos `validar`, `dev` e `build` por cliente |
| `%APPDATA%\<identificador>\` | dados do cliente no computador onde o programa roda |
