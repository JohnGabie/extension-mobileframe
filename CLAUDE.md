# CLAUDE.md

Contexto para o Claude (Code) trabalhar neste repositório. Leia isso antes de mexer em qualquer arquivo.

## O que é este projeto
Extensão de Chrome (Manifest V3) chamada **Phone Frame Simulator**. Ela abre um **side panel** que mostra a aba ativa do navegador dentro de uma **moldura de celular (imagem PNG)** — Samsung ou iPhone 13 — com **scroll sincronizado** e **reload sincronizado (F5)** entre a aba real e o "espelho" dentro do painel.

Documentos de referência (ler antes de planejar mudanças grandes):
- `00-PRD.md` — objetivo, escopo do MVP, o que é fora de escopo.
- `01-ARQUITETURA.md` — como a sincronização funciona tecnicamente, riscos conhecidos.
- `02-ASSETS-FRAMES.md` — como as imagens de moldura funcionam (coordenadas de tela).
- `03-ROADMAP.md` — ordem das fases de implementação.

## Regra mais importante do projeto
Como ferramenta de dev, a extensão **tenta ativamente embutir qualquer site** no espelho, contornando os bloqueios de iframe (`X-Frame-Options` / CSP `frame-ancestors`). Isso é feito de forma **intencional e restrita ao iframe do espelho**:
- `background.js` usa `declarativeNetRequest` para remover os headers `X-Frame-Options` e `Content-Security-Policy` **apenas** em `resourceTypes: ['sub_frame']` — a navegação normal do usuário na aba real não é afetada.
- `content-script.js` (contexto `isMirror`) neutraliza frame-busting via JS, redefinindo `window.top` / `window.parent` / `frameElement`.

Quando, mesmo assim, o embed falhar (ex.: conexão recusada, redirect que quebra), a solução correta é mostrar o **aviso amigável** no painel — não insistir com hacks adicionais (proxy externo, reescrita de HTML, etc. continuam fora de escopo).

## Stack e convenções
- **Vanilla JS + HTML/CSS puro.** Sem framework, sem build step (webpack/vite/etc). Se em algum momento parecer necessário adicionar um bundler, perguntar antes — não é a decisão default deste projeto.
- Manifest V3.
- Nenhuma dependência externa via npm neste momento. Se precisar de uma lib, justificar antes de adicionar.
- Estrutura de pastas (ver `01-ARQUITETURA.md` para detalhes):
  ```
  manifest.json
  background.js
  content-script.js
  sidepanel/panel.html, panel.js, panel.css
  assets/frames/*.png
  assets/frame-config.json
  ```

## Convenções de código
- Nomes de arquivo de moldura: `assets/frames/{fabricante}-{modelo}.png` (ex: `iphone-13.png`).
- Coordenadas de tela de cada moldura ficam em `assets/frame-config.json`, nunca hardcoded no CSS/JS — ao adicionar um novo device, só se mexe nesse JSON.
- O content script roda tanto na aba real quanto no iframe do painel (`all_frames: true`). Ele precisa se identificar de que lado está antes de agir (`window.self !== window.top` + marcador combinado com o painel) — nunca assumir que só existe uma instância rodando.
- Mensageria entre aba real ↔ painel sempre passa pelo `background.js` (service worker) como intermediário — não tentar comunicação direta cross-context sem passar por ele.

## Como testar localmente
1. `chrome://extensions` → ativar "Modo do desenvolvedor" → "Carregar sem compactação" → selecionar a pasta do projeto.
2. Após qualquer mudança em `manifest.json` ou `background.js`, clicar em "recarregar" na própria página de extensões do Chrome (não recarrega sozinho).
3. Mudanças em `content-script.js` exigem recarregar a extensão **e** dar F5 nas abas abertas (o script antigo continua rodando até a página recarregar).
4. Testar sempre em pelo menos 2 sites: um simples e um SPA pesado, pra pegar cedo qualquer regressão de sincronização.

## O que NÃO fazer
- Não adicionar Chrome Web Store / publicação — fora de escopo por enquanto (ver PRD).
- Não implementar captura por screenshot (`chrome.tabs.captureVisibleTab`) a menos que explicitamente pedido — é a Fase 6/v2, não o MVP.
- O contorno de bloqueios de iframe é feito **só** pela remoção de headers em `sub_frame` + frame-busting via JS (ver "Regra mais importante" acima). Não adicionar outros métodos (proxy externo, reescrita de HTML no servidor, etc.) — esses continuam fora de escopo.
- Não introduzir framework de UI (React/Vue) nem bundler sem confirmação explícita.
- **Nunca criar molduras de dispositivo em SVG/CSS/canvas.** Toda moldura de aparelho deve ser uma foto PNG real do device. Para adicionar novo modelo: pedir foto ao usuário → rodar o script de flood fill para medir a área transparente → preencher `frame-config.json`. Zero design em código.

## Estado atual
Extensão funcional implementada (Fases 0–5). Arquivos presentes:
- `manifest.json`, `background.js`, `content-script.js`
- `sidepanel/panel.html`, `panel.js`, `panel.css`
- `assets/frame-config.json`, `assets/frames/iphone-13.png` (foto real, medida automaticamente)
- `icons/icon16.png`, `icon48.png`, `icon128.png`

Próximos passos possíveis: adicionar mais dispositivos (Samsung etc.) quando o usuário fornecer as fotos.
