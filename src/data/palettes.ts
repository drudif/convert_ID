import type { Palette } from '../types';

// Build a heatmap-convention palette from a background + 6 colours (º0 core →
// Borda edge), with the standard Custom alphas (all stops visible).
function grad(
  id: string,
  name: string,
  background: string,
  colors: [string, string, string, string, string, string],
): Palette {
  const alpha = [1.0, 0.95, 0.85, 0.6, 0.4, 1.0];
  const offset = [0, 0.2, 0.4, 0.6, 0.8, 1];
  return {
    id,
    name,
    background,
    blobVariants: [{ stops: colors.map((color, i) => ({ offset: offset[i], color, alpha: alpha[i] })) }],
  };
}

export const PALETTES: Palette[] = [
  // Brand palettes — built from the Convert ID colour set
  // (Deep Indigo #3A1C71, Neon Magenta #FF2EAD, Saturated Orange #FF713A,
  //  Teal-Cyan #4ACBD6, Soft Lavender #9F75FF).
  {
    id: 'convert',
    name: 'CONVERT',
    background: '#2a1c71', // deep indigo
    blobVariants: [
      {
        // Cores da identidade Convert: amarelo, laranja, magenta, menta, azul +
        // indigo (fundo/borda). Alphas iguais ao Custom (buildCustomPalette).
        stops: [
          { offset: 0,   color: '#eee959', alpha: 1.0  }, // º0 amarelo
          { offset: 0.2, color: '#f39e2a', alpha: 0.95 }, // º1 laranja
          { offset: 0.4, color: '#ea33a0', alpha: 0.85 }, // º2 magenta
          { offset: 0.6, color: '#89d6bc', alpha: 0.6  }, // º3 menta
          { offset: 0.8, color: '#2e2bc6', alpha: 0.4  }, // º4 azul
          { offset: 1,   color: '#2a1c71', alpha: 1.0  }, // Borda deep indigo (visível)
        ],
      },
    ],
  },
  {
    id: 'convert-offw',
    name: 'CONVERT_OFFW',
    background: '#ededea', // off-white
    blobVariants: [
      {
        // Variante off-white do CONVERT (fundo/borda claros). O º1 foi removido no
        // design original — presets não guardam "deletado", então a cor do º1 é
        // colapsada na do º2 (magenta) p/ o laranja sumir igual ao layout salvo.
        stops: [
          { offset: 0,   color: '#eee959', alpha: 1.0  }, // º0 amarelo
          { offset: 0.2, color: '#ea33a0', alpha: 0.95 }, // º1 (colapsado → magenta)
          { offset: 0.4, color: '#ea33a0', alpha: 0.85 }, // º2 magenta
          { offset: 0.6, color: '#2e2bc6', alpha: 0.6  }, // º3 azul
          { offset: 0.8, color: '#89d6bc', alpha: 0.4  }, // º4 menta
          { offset: 1,   color: '#ededea', alpha: 1.0  }, // Borda off-white (visível)
        ],
      },
    ],
  },

  // Convert mixes — APENAS as cores do preset CONVERT (#2a1c71 indigo, #eee959
  // amarelo, #f39e2a laranja, #ea33a0 magenta, #89d6bc menta, #2e2bc6 azul) + dois
  // neutros do pool (#ededea off-white, #04141a quase-preto). Ordens/quantidades
  // variadas, porém harmônicas. Cada array = º0 (núcleo) → Borda (borda externa).
  grad('cv-solar',  'Solar',  '#04141a', ['#eee959', '#f39e2a', '#ea33a0', '#2e2bc6', '#2a1c71', '#04141a']),
  grad('cv-lirio',  'Lírio',  '#2a1c71', ['#ededea', '#89d6bc', '#2e2bc6', '#ea33a0', '#2a1c71', '#2a1c71']),
  grad('cv-brasa',  'Brasa',  '#04141a', ['#eee959', '#f39e2a', '#f39e2a', '#ea33a0', '#2a1c71', '#04141a']),
  grad('cv-abismo', 'Abismo', '#04141a', ['#89d6bc', '#2e2bc6', '#2a1c71', '#ea33a0', '#f39e2a', '#04141a']),
  // VERUS — estilo com forma própria: cores + º2/º3 deletados + parâmetros padrão.
  {
    ...grad('cv-gelo', 'VERUS', '#04141a', ['#ededea', '#89d6bc', '#2e2bc6', '#2e2bc6', '#32524e', '#04141a']),
    deletedColors: [3, 4],
    style: {
      ringWeights: [0.04, 0.15, 0.18, 0.21, 0.24, 0.85],
      ringFluidez: [0.25, 0.25, 0.25, 0.25, 0.51, 0.25],
      blobCount: 3,
      blobSizeMin: 0.12,
      blobSizeMax: 0.28,
      blobSizeVar: 1,
      warp: 0.55,
      irregularity: 0.95,
      warpScale: 0.73,
    },
  },
  grad('cv-neon',   'Néon',   '#2a1c71', ['#ea33a0', '#f39e2a', '#eee959', '#89d6bc', '#2e2bc6', '#2a1c71']),
  grad('cv-vinho',  'Vinho',  '#04141a', ['#ea33a0', '#ea33a0', '#2a1c71', '#2e2bc6', '#89d6bc', '#04141a']),
  grad('cv-ocaso',  'Ocaso',  '#ededea', ['#eee959', '#f39e2a', '#ea33a0', '#2a1c71', '#2e2bc6', '#89d6bc']),
  grad('cv-veu',    'Véu',    '#2a1c71', ['#89d6bc', '#2e2bc6', '#2a1c71', '#2a1c71', '#ea33a0', '#04141a']),
  grad('cv-pomar',  'Pomar',  '#04141a', ['#f39e2a', '#eee959', '#89d6bc', '#2e2bc6', '#ea33a0', '#2a1c71']),
];

export function buildCustomPalette(
  colors: [string, string, string, string, string, string, string],
): Palette {
  return {
    id: 'custom',
    name: 'Custom',
    background: colors[0],
    blobVariants: [
      {
        stops: [
          { offset: 0,   color: colors[1], alpha: 1.0  }, // º0
          { offset: 0.2, color: colors[2], alpha: 0.95 }, // º1
          { offset: 0.4, color: colors[3], alpha: 0.85 }, // º2
          { offset: 0.6, color: colors[4], alpha: 0.6  }, // º3
          { offset: 0.8, color: colors[5], alpha: 0.4  }, // º4
          { offset: 1,   color: colors[6], alpha: 1.0  }, // Borda (user-picked, visible)
        ],
      },
    ],
  };
}
