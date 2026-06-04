# Histórico do projeto — convert_ID_GEN (ex-auragen)

Ferramenta de arte generativa (Vite + React + TS) que renderiza num `<canvas>` um
campo de metaballs ("blobs") com anéis aninhados. Dois modos de visualização
(**Heat map** e **Mesh** topográfico), paletas, grão, export PNG e MP4.

- **Repositório:** `git@github.com:drudif/convert_ID.git`
- **Branches/worktrees:**
  - `feat/v1.1` → pasta `auragen/` — base + features estáticas (commitado/pushado)
  - `feat/mesh-animation` → pasta `convert_ID_GEN-anim/` — animação + export MP4 (worktree)

---

## Fase 1 — base estática (branch `feat/v1.1`)

### Render / campo
- **Campo de metaballs**: cada blob tem 8 "minis" idênticos que se espalham com a
  **irregularidade** (centroide único, sem pico dominante). Seis anéis aninhados
  `º0…º4 + Borda`, cada um com Tamanho (limiar de campo) e Fluidez (blur da borda).
- **º0 em tamanhos pequenos** ([render.ts]): limiares de cada anel passam a ser
  limitados ao **pico real do campo** (`thrCeil`/`coreThrCeil`, amostrado por grade
  grossa), pra o núcleo não sumir por completo quando encolhido.
- **º0 sob irregularidade** (`RING0_SPREAD`): o º0 renderiza de uma cópia **menos
  espalhada** dos minis, então mantém brilho/tamanho e distorção sem diluir quando
  a irregularidade sobe.
- **Tamanho default dos blobs** reduzido (`RADIUS_MIN/MAX = 0.12/0.28`) — poucos
  blobs não cobrem o frame inteiro.

### Modo Mesh (topográfico)
- **Curvas de nível** via marching squares ([contour.ts], [mesh.ts]): o mesmo campo
  dos blobs vira isolinhas, fundo sólido + linhas finas.
- **Relevo extra** = remap gamma **monotônico** do campo (`H = blobNorm^gamma`):
  adiciona linhas concêntricas seguindo a forma das curvas externas, sem criar
  novas irregularidades (o fBm inicial foi descartado).
- **Cor da linha**: sólida (cor escolhida) ou **seguir paleta** (amostra o gradiente
  por altura).
- **Grão** também no mesh; depois **defaults por modo** (heatmap 0.25 / mesh 0.2),
  cada modo guarda seu valor.

### Paletas
- **Salvar paletas** ([savedPalettes.ts]): grava as 7 cores no **localStorage**,
  com **export/import JSON** e nome via prompt. Chips selecionáveis + apagar.
- Default vira a **paleta Custom** já com as cores da marca.
- **Presets da marca** (cores Convert ID — Deep Indigo `#3A1C71`, Neon Magenta
  `#FF2EAD`, Saturated Orange `#FF713A`, Teal-Cyan `#4ACBD6`, Soft Lavender
  `#9F75FF`): **Plasmódio**, **Vácuo Lilás**, **Hertz**.
- **+5 presets** (nomes peculiares PT/ES/EN): **Quasar**, **Brasa**, **Niebla**,
  **Veludo**, **Brine**.

### UI / formato / export
- **Formato**: Orientação (Horizontal/Quadrado/Vertical) × Qualidade (1080/4K),
  substituindo inputs manuais. **Default 4K**.
- **Zoom** Fit / 100% (com rolagem) no preview.
- Botão **Randomize** movido pra logo abaixo do slider de blobs.
- **Irregularidade default = 1**.
- Projeto **renomeado** `auragen` → `convert_ID_GEN` (package, título, heading,
  nomes de download). Chave de localStorage mantida.

### Commits (feat/v1.1)
- `e84c42c` mesh mode, saved palettes, smaller blobs, robust º0 core
- `6eb34fe` rename → convert_ID_GEN
- `91489a4` brand palettes, custom default, zoom, format controls (default 4K)
- `789785b` +5 presets (Quasar/Brasa/Niebla/Veludo/Brine)

---

## Fase 2 — animação + MP4 (branch `feat/mesh-animation`, worktree)

### Infra de animação
- `time` em `RenderParams`; [Preview.tsx] roda um loop **requestAnimationFrame**
  com **Play/Pause** e **Velocidade** (relógio num `ref`, sem re-render do React).
  Durante o Play limita a resolução (≤640px) pra manter fluidez.
- [animate.ts] `morphOffset`: cada mini oscila numa trajetória periódica com fase
  própria → morph orgânico da forma. Generalizado com freq/ganho/fase/riqueza
  (default preserva o comportamento base).

### Mesh animado
- **Fluxo de contornos**: os níveis fazem scroll no tempo (efeito mapa-vivo),
  com **direção** Pra fora / Pra dentro (`meshFlowDir`).

### Heatmap animado (fluido / líquido)
- **Correnteza** (`drift`): com `drift>0`, a composição estática é trocada por um
  **fluxo contínuo e não-loopável** de blobs que entram, **atravessam o frame e
  saem**, repostos por novos (determinístico no tempo). **Direção aleatória por
  blob** + meandro curvo. Fade in/out suave (sem "pulo" de cor nas bordas).
- **Surgimento**: blobs transientes que **aparecem/somem no lugar** (fade), por
  cima do fluxo. Controles: taxa, duração, tamanho.
- **Deformação ativa no fluxo** (feature fixa): blobs do fluxo morfam mais rápido,
  com 2 harmônicas e fase própria — "nadam" pelo meio em vez de deslizar chapados.

### Export MP4 1080
- [exportVideo.ts]: render **offline frame a frame** (o `render` é função pura do
  tempo) → **WebCodecs `VideoEncoder` (H.264)** + **`mp4-muxer`** → MP4 real.
  10s @ 30fps, resolução 1080 conforme a orientação. Negocia o codec (High/Main/
  Baseline). **Lazy-loaded** (chunk separado, só no clique).

### Notas de ambiente
- Worktree com Vite: **NÃO** usar `node_modules` symlinkado — causa **duplicação
  do React** (Invalid hook call / `useState` null). Usar `npm install` real na
  worktree + limpar `node_modules/.vite` ao trocar.

### Status
- Fase 2 ainda **não commitada** no branch `feat/mesh-animation`.

---

## Mapa de arquivos-chave
- `src/renderer/render.ts` — heatmap (campo, anéis, fluxo/surgimento)
- `src/renderer/mesh.ts` — modo mesh (curvas de nível)
- `src/renderer/contour.ts` — marching squares
- `src/renderer/animate.ts` — morph de forma
- `src/renderer/exportVideo.ts` — export MP4 (WebCodecs + mp4-muxer)
- `src/renderer/export.ts` — export PNG
- `src/data/palettes.ts` — presets + buildCustomPalette
- `src/data/savedPalettes.ts` — paletas salvas (localStorage / JSON)
- `src/components/Controls.tsx` — sidebar
- `src/components/Preview.tsx` — canvas + zoom + loop de animação
- `src/App.tsx` — estado e orquestração
