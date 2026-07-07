# Assets — Molduras de celular (imagens prontas, sem codar frame)

## 1. Ideia
Cada moldura é **uma imagem PNG com fundo transparente**, contendo o desenho do aparelho (bordas, notch/ilha, botões) e um **buraco transparente** exatamente onde fica a tela. O iframe com o conteúdo do site fica posicionado atrás/dentro desse buraco via CSS `position: absolute`, usando coordenadas fixas que você mede uma vez por imagem.

Isso elimina 100% do trabalho de desenhar frame em CSS/SVG — você só precisa saber 4 números por imagem (x, y, largura, altura da área de tela).

## 2. Onde conseguir as imagens (sem precisar desenhar)
Opções prontas, gratuitas ou baratas, com PNG transparente de alta resolução:
- **Mockuuups Studio** / **Smartmockups** — templates de iPhone e Samsung com "device only", export PNG transparente.
- **Facebook Design Devices** (freebie clássico, iPhone/Android em PSD/PNG).
- **Figma Community** — buscar "iPhone 13 mockup png transparent" ou "Samsung Galaxy frame png" — muitos arquivos free com camadas já separadas (frame vs tela).
- **Unsplash/Pexels** não servem (são fotos com fundo, não moldura isolada) — priorize os bancos acima que entregam o device "recortado".

Critério de escolha: baixe a versão **"apenas moldura, tela vazia/transparente"**, resolução mínima ~1200px de altura, para não pixelizar ao redimensionar no painel.

## 3. Estrutura de coordenadas (`assets/frame-config.json`)
```json
{
  "iphone13": {
    "image": "frames/iphone13.png",
    "imageWidth": 1200,
    "imageHeight": 2400,
    "screen": { "x": 60, "y": 110, "width": 1080, "height": 2180 },
    "borderRadius": 48
  },
  "samsung": {
    "image": "frames/samsung.png",
    "imageWidth": 1200,
    "imageHeight": 2450,
    "screen": { "x": 55, "y": 90, "width": 1090, "height": 2250 },
    "borderRadius": 36
  }
}
```
`screen.x/y/width/height` são **pixels dentro da imagem original** — você mede isso abrindo o PNG num editor (Figma, Photoshop, até Preview do Mac/Paint no Windows com régua) e anotando onde começa/termina a área transparente da tela.

## 4. Como isso vira CSS no `panel.html`
```html
<div class="phone-frame" style="width: 300px; aspect-ratio: 1200/2400;">
  <img class="frame-art" src="assets/frames/iphone13.png" />
  <div class="screen-cutout" style="
      position: absolute;
      left: calc(60 / 1200 * 100%);
      top: calc(110 / 2400 * 100%);
      width: calc(1080 / 1200 * 100%);
      height: calc(2180 / 2400 * 100%);
      border-radius: 24px;
      overflow: hidden;">
    <iframe id="mirror" src="about:blank"></iframe>
  </div>
</div>
```
Usar `%` (não px fixo) baseado nas proporções da imagem garante que a moldura escale bem em qualquer tamanho de painel — sem precisar "não avançar" ou distorcer a imagem, como você pediu.

## 5. Checklist de qualidade visual ("premium porém objetivo")
- [ ] Fundo do painel neutro (cinza claro ou escuro sólido), sem gradientes chamativos.
- [ ] Sombra sutil (`box-shadow`) atrás da moldura pra dar profundidade, só isso.
- [ ] Sem animações supérfluas — troca de device é instantânea (troca de `<img src>` + recálculo do cutout via JS lendo o JSON).
- [ ] Um único seletor visível (dropdown "Samsung / iPhone 13"), resto da UI escondido até precisar.

## 6. Nomeando arquivos (convenção)
`assets/frames/{fabricante}-{modelo}.png` — ex: `iphone-13.png`, `samsung-s23.png`. Facilita adicionar mais modelos na v2 sem reescrever código, só adicionar entrada no `frame-config.json`.
