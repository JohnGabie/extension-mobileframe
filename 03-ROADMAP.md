# Roadmap — do zero ao MVP funcionando

## Fase 0 — Spike de viabilidade (fazer ANTES de tudo, ~1-2h)
- [ ] Criar extensão mínima só com `sidePanel` mostrando um `<iframe src="https://exemplo.com">`.
- [ ] Confirmar que abre sem erro de CSP da própria extensão.
- [ ] Testar em 3 sites: um simples (ex: `example.com`), um SPA (ex: seu próprio app), um provável bloqueado (ex: banco).
- [ ] Confirmar via `console.log` que `content-script.js` roda dentro do iframe do painel (não só na aba).

> Se o spike falhar em algo essencial (ex: `all_frames` não injeta no painel), voltar pro `01-ARQUITETURA.md` e ajustar a abordagem antes de continuar.

## Fase 1 — Esqueleto da extensão
- [ ] `manifest.json` completo (ver arquitetura).
- [ ] `background.js` — abre o side panel ao clicar no ícone da extensão (`chrome.sidePanel.setPanelBehavior`).
- [ ] `panel.html/js/css` — layout básico, sem moldura ainda, só iframe carregando `chrome.tabs.query({active:true})` pra pegar a URL da aba atual.

## Fase 2 — Molduras
- [ ] Baixar/organizar as 2 imagens (Samsung, iPhone 13) — ver `02-ASSETS-FRAMES.md`.
- [ ] Medir coordenadas de tela de cada imagem, preencher `frame-config.json`.
- [ ] Implementar troca de device (dropdown) lendo o JSON e recalculando o cutout.

## Fase 3 — Sincronização de scroll
- [ ] Content script: detectar se está na aba real ou no iframe-espelho (`window.self !== window.top` + marcador).
- [ ] Aba real → manda scroll pro background → background repassa pro painel.
- [ ] Painel → repassa pro content script do iframe via `postMessage`.
- [ ] Testar scroll suave (throttle com `requestAnimationFrame` pra não travar).

## Fase 4 — Sincronização de reload (F5)
- [ ] Background escuta `chrome.tabs.onUpdated` (status `loading`) da aba ativa.
- [ ] Manda mensagem pro painel → painel dá reload no iframe (`iframe.src = iframe.src` ou `contentWindow.location.reload()`).

## Fase 5 — Polimento "premium porém objetivo"
- [ ] Sombra, fundo neutro, tipografia limpa no painel (ver checklist em `02-ASSETS-FRAMES.md`).
- [ ] Mensagem de fallback amigável quando o site bloqueia iframe (`X-Frame-Options`) — detectar erro de carregamento do iframe e mostrar aviso simples, sem quebrar o layout.
- [ ] Ícone da extensão.

## Fase 6 (opcional, v2)
- [ ] Modo screenshot-mirror pra sites bloqueados (abordagem B da arquitetura).
- [ ] Mais modelos de aparelho.
- [ ] Rotação retrato/paisagem.

---
**Ordem de prioridade se o tempo for curto:** Fase 0 → Fase 1 → Fase 2 → Fase 5 (parcial, só o visual básico) → Fase 3 → Fase 4. Ou seja: tenha algo **visualmente pronto e mostrável** cedo, sincronização vem depois — assim você já sente o "premium" rápido, mesmo antes do scroll sincronizar perfeitamente.
