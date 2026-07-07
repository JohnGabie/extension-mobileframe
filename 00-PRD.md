# PRD — Phone Frame Simulator (extensão Chrome)

## 1. Objetivo
Extensão de Chrome que mostra um **mockup de celular** (Android/Samsung ou iPhone 13) ao lado da janela do navegador, exibindo a página atual dentro da moldura do aparelho, com **scroll sincronizado** e **reload sincronizado (F5)**. Uso principal: designers/devs validando como um site se comporta em "tela de celular real" sem precisar abrir DevTools.

Referência visual: o "Simulador de telemóvel" que você já usa (celular renderizado ao lado da tela, sincronizado).

## 2. Público-alvo
Você mesmo (uso pessoal/interno primeiro). Se dar certo, pode virar extensão pública.

## 3. Escopo do MVP (v1)
- [ ] Painel lateral do Chrome (Side Panel) com moldura de celular.
- [ ] 2 templates de aparelho: **Samsung (Android)** e **iPhone 13**.
- [ ] Troca de aparelho por um seletor simples (dropdown ou 2 botões).
- [ ] A "tela" do celular mostra a aba ativa (via iframe, ver limitações em `01-ARQUITETURA.md`).
- [ ] Scroll da aba principal reflete no scroll dentro do celular (e idealmente vice-versa).
- [ ] F5 / reload na aba principal recarrega também dentro do celular.
- [ ] Molduras são **imagens prontas (PNG)**, não desenhadas em CSS/SVG — zero trabalho de design vetorial.
- [ ] Visual "premium": moldura realista, sombra, fundo neutro, sem UI poluída — mas **funcional antes de bonito**.

## 4. Fora do escopo do MVP (v2+)
- Rotação retrato/paisagem.
- Múltiplos modelos de aparelho (Pixel, iPhone 15, dobráveis).
- Captura por screenshot para sites que bloqueiam iframe (ver arquitetura).
- Sincronização de cliques/toques (interação bidirecional completa).
- Loja/publicação pública (Chrome Web Store).

## 5. Critério de sucesso
Você abre um site qualquer permitido, ativa o painel, escolhe "iPhone 13", rola a página principal e vê o celular rolando junto, aperta F5 e o celular recarrega junto — sem gambiarra visual quebrando a moldura.

## 6. Restrição conhecida e aceita
Nem todo site pode ser embutido em iframe (bloqueio por `X-Frame-Options` / CSP `frame-ancestors` — ex: bancos, alguns SaaS). Isso é uma limitação do próprio navegador, não da extensão. O MVP assume "funciona nos sites que permitem iframe" e trata o resto como fallback (mensagem de aviso), não como bug a resolver agora.
