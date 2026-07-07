# Arquitetura — Phone Frame Simulator

## 1. Viabilidade (resumo da análise)

**É possível fazer no Chrome, com uma ressalva importante:**

| Abordagem | Como funciona | Prós | Contras |
|---|---|---|---|
| **A. Side Panel + iframe** (recomendada p/ MVP) | `chrome.sidePanel` mostra um HTML com a moldura (imagem) + um `<iframe>` carregando a mesma URL da aba ativa | Rápido de fazer, scroll/reload sincronizáveis via content script, tela realmente "viva" (interativa) | Sites com `X-Frame-Options: DENY` ou CSP `frame-ancestors` **não deixam** ser embutidos (ex: muitos bancos, alguns dashboards). Não tem solução — é bloqueio do site, não do Chrome. |
| **B. Screenshot mirror** | `chrome.tabs.captureVisibleTab` tira print da aba a cada scroll/reload e mostra a imagem dentro da moldura | Funciona em **qualquer site**, sem bloqueio de iframe | Não é interativo (só espelho visual), tem leve delay, mais código pra sincronizar captura |

**Recomendação:** construir a **Abordagem A** primeiro (MVP rápido). Deixar a **B como fallback futuro (v2)** só se você sentir falta em sites bloqueados.

## 2. Por que a sincronização de scroll é possível (insight chave)
O iframe do side panel, ao carregar a mesma URL da aba, é **apenas mais um frame navegando para aquele domínio**. Se o `content_script` da extensão for declarado com `"matches": ["<all_urls>"]` e `"all_frames": true`, ele roda **tanto na aba principal quanto dentro do iframe do painel**. Ou seja: os dois lados têm o mesmo script rodando, e podem se comunicar via `chrome.runtime.sendMessage` / `chrome.runtime.onMessage`, repassado pelo `background` (service worker).

Fluxo:
1. Content script na **aba principal** escuta `scroll` → manda `{type: "scroll", y: window.scrollY}` pro background.
2. Background repassa pro **side panel** (que tem seu próprio contexto de extensão).
3. Side panel repassa a mensagem pro content script **dentro do iframe** (via `postMessage` no `iframe.contentWindow`, já que o painel consegue endereçar seu próprio iframe).
4. Content script do iframe recebe e faz `window.scrollTo(0, y)`.

Mesmo mecanismo para o reload: aba principal dispara evento (`beforeunload` ou `chrome.tabs.onUpdated` com `status: "loading"` no background) → background avisa o side panel → side panel faz `iframe.src = iframe.src` (reload).

## 3. Estrutura de arquivos sugerida
```
phone-simulator/
├── manifest.json
├── background.js          # service worker: repassa mensagens, escuta tabs.onUpdated
├── content-script.js       # injetado em <all_urls>, roda na aba real E no iframe
├── sidepanel/
│   ├── panel.html          # HTML com a moldura + iframe
│   ├── panel.js            # lógica: troca de device, repassa scroll/reload pro iframe
│   └── panel.css
├── assets/
│   ├── frames/
│   │   ├── samsung.png
│   │   └── iphone13.png
│   └── frame-config.json   # coordenadas da "tela" dentro de cada imagem (ver 02-ASSETS)
└── icons/
```

## 4. manifest.json (esqueleto mínimo, MV3)
```json
{
  "manifest_version": 3,
  "name": "Phone Frame Simulator",
  "version": "0.1.0",
  "permissions": ["sidePanel", "tabs", "scripting", "storage"],
  "host_permissions": ["<all_urls>"],
  "background": { "service_worker": "background.js" },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "all_frames": true,
      "js": ["content-script.js"],
      "run_at": "document_start"
    }
  ],
  "side_panel": { "default_path": "sidepanel/panel.html" },
  "action": {}
}
```

## 5. Detectando "sou o iframe do painel ou a aba real?"
No `content-script.js`, checar `window.self !== window.top` (está dentro de um iframe) **e** um marcador que o `panel.js` injeta na URL do iframe (ex: query param `?__pfs_mirror=1`) ou via `window.name`. Isso evita o content script tentar sincronizar em qualquer iframe aleatório da própria página (ex: anúncios, widgets).

## 6. Riscos técnicos a validar cedo (spike de 1-2h antes de codar tudo)
1. Confirmar que `chrome.sidePanel` permite `<iframe src="https://qualquer-site.com">` sem CSP da própria extensão bloqueando (ajustar `content_security_policy` no manifest se precisar).
2. Testar em 2-3 sites reais (um simples tipo blog, um SPA pesado tipo React app, um que provavelmente bloqueia tipo banco) pra já sentir a taxa de "funciona vs bloqueado".
3. Confirmar que `all_frames: true` realmente injeta no iframe do painel (painéis de extensão às vezes têm contexto isolado — testar com `console.log` simples primeiro).

## 7. Stack
Vanilla JS + HTML/CSS puro. **Sem framework** — o objetivo é rapidez, não escala. Nada de build step (webpack/vite) na v1; se crescer, migrar depois.
