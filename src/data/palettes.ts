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
  {
    id: 'plasmodio',
    name: 'Plasmódio',
    background: '#1b0e38',
    blobVariants: [
      {
        stops: [
          { offset: 0,   color: '#ff2ead', alpha: 1.0  }, // º0 magenta core
          { offset: 0.2, color: '#ff713a', alpha: 0.95 }, // º1 orange
          { offset: 0.4, color: '#9f75ff', alpha: 0.85 }, // º2 lavender
          { offset: 0.6, color: '#4acbd6', alpha: 0.6  }, // º3 teal-cyan
          { offset: 0.8, color: '#3a1c71', alpha: 0.4  }, // º4 deep indigo
          { offset: 1,   color: '#000000', alpha: 0    }, // Borda (fade)
        ],
      },
    ],
  },
  {
    id: 'vacuo-lilas',
    name: 'Vácuo Lilás',
    background: '#14112e',
    blobVariants: [
      {
        stops: [
          { offset: 0,   color: '#4acbd6', alpha: 1.0  }, // º0 teal-cyan core
          { offset: 0.2, color: '#9f75ff', alpha: 0.95 }, // º1 lavender
          { offset: 0.4, color: '#ff2ead', alpha: 0.85 }, // º2 magenta
          { offset: 0.6, color: '#ff713a', alpha: 0.6  }, // º3 orange
          { offset: 0.8, color: '#3a1c71', alpha: 0.4  }, // º4 deep indigo
          { offset: 1,   color: '#000000', alpha: 0    }, // Borda (fade)
        ],
      },
    ],
  },
  {
    id: 'hertz',
    name: 'Hertz',
    background: '#241047',
    blobVariants: [
      {
        stops: [
          { offset: 0,   color: '#ff713a', alpha: 1.0  }, // º0 orange core
          { offset: 0.2, color: '#ff2ead', alpha: 0.95 }, // º1 magenta
          { offset: 0.4, color: '#9f75ff', alpha: 0.85 }, // º2 lavender
          { offset: 0.6, color: '#4acbd6', alpha: 0.6  }, // º3 teal-cyan
          { offset: 0.8, color: '#3a1c71', alpha: 0.4  }, // º4 deep indigo
          { offset: 1,   color: '#000000', alpha: 0    }, // Borda (fade)
        ],
      },
    ],
  },
  // Extra presets — peculiar names across PT / ES / EN.
  {
    id: 'quasar',
    name: 'Quasar',
    background: '#0a0a1f',
    blobVariants: [
      {
        stops: [
          { offset: 0,   color: '#aef9ff', alpha: 1.0  }, // º0 icy cyan
          { offset: 0.2, color: '#4cc9f0', alpha: 0.95 }, // º1 cyan
          { offset: 0.4, color: '#7b2ff7', alpha: 0.85 }, // º2 violet
          { offset: 0.6, color: '#f72585', alpha: 0.6  }, // º3 magenta
          { offset: 0.8, color: '#240046', alpha: 0.4  }, // º4 deep purple
          { offset: 1,   color: '#000000', alpha: 0    }, // Borda (fade)
        ],
      },
    ],
  },
  {
    id: 'brasa',
    name: 'Brasa',
    background: '#1a0805',
    blobVariants: [
      {
        stops: [
          { offset: 0,   color: '#ffe66d', alpha: 1.0  }, // º0 amarelo
          { offset: 0.2, color: '#ff9f1c', alpha: 0.95 }, // º1 âmbar
          { offset: 0.4, color: '#ff5400', alpha: 0.85 }, // º2 laranja-fogo
          { offset: 0.6, color: '#c1121f', alpha: 0.6  }, // º3 vermelho
          { offset: 0.8, color: '#5c0a0a', alpha: 0.4  }, // º4 bordô
          { offset: 1,   color: '#000000', alpha: 0    }, // Borda (fade)
        ],
      },
    ],
  },
  {
    id: 'niebla',
    name: 'Niebla',
    background: '#1c1b29',
    blobVariants: [
      {
        stops: [
          { offset: 0,   color: '#fef9ef', alpha: 1.0  }, // º0 crema
          { offset: 0.2, color: '#c6d8d3', alpha: 0.95 }, // º1 salvia
          { offset: 0.4, color: '#8e9aaf', alpha: 0.85 }, // º2 azul pizarra
          { offset: 0.6, color: '#cbc0d3', alpha: 0.6  }, // º3 lavanda gris
          { offset: 0.8, color: '#4a4e69', alpha: 0.4  }, // º4 índigo apagado
          { offset: 1,   color: '#000000', alpha: 0    }, // Borda (fade)
        ],
      },
    ],
  },
  {
    id: 'veludo',
    name: 'Veludo',
    background: '#14040f',
    blobVariants: [
      {
        stops: [
          { offset: 0,   color: '#ffd6e8', alpha: 1.0  }, // º0 rosa claro
          { offset: 0.2, color: '#ff5d8f', alpha: 0.95 }, // º1 rosé
          { offset: 0.4, color: '#c9184a', alpha: 0.85 }, // º2 carmim
          { offset: 0.6, color: '#7b2cbf', alpha: 0.6  }, // º3 púrpura
          { offset: 0.8, color: '#240046', alpha: 0.4  }, // º4 violeta profundo
          { offset: 1,   color: '#000000', alpha: 0    }, // Borda (fade)
        ],
      },
    ],
  },
  {
    id: 'brine',
    name: 'Brine',
    background: '#04141a',
    blobVariants: [
      {
        stops: [
          { offset: 0,   color: '#d8f3dc', alpha: 1.0  }, // º0 mint
          { offset: 0.2, color: '#52b788', alpha: 0.95 }, // º1 sea green
          { offset: 0.4, color: '#2c7da0', alpha: 0.85 }, // º2 teal-blue
          { offset: 0.6, color: '#1d3557', alpha: 0.6  }, // º3 navy
          { offset: 0.8, color: '#081c2c', alpha: 0.4  }, // º4 deep tide
          { offset: 1,   color: '#000000', alpha: 0    }, // Borda (fade)
        ],
      },
    ],
  },
  {
    id: 'nightfall',
    name: 'Nightfall',
    background: '#1a0d3d',
    blobVariants: [
      {
        stops: [
          { offset: 0,   color: '#ffd479', alpha: 1.0  }, // º0 hot core
          { offset: 0.2, color: '#ff7a4d', alpha: 0.95 }, // º1
          { offset: 0.4, color: '#ec4899', alpha: 0.85 }, // º2
          { offset: 0.6, color: '#6b46c1', alpha: 0.6  }, // º3
          { offset: 0.8, color: '#3a1d6d', alpha: 0.4  }, // º4
          { offset: 1,   color: '#000000', alpha: 0    }, // Borda (fade)
        ],
      },
    ],
  },
  {
    id: 'eclipse',
    name: 'Eclipse',
    background: '#1f0a3d',
    blobVariants: [
      {
        stops: [
          { offset: 0,   color: '#ffe0b0', alpha: 1.0  }, // º0
          { offset: 0.2, color: '#ffa066', alpha: 0.95 }, // º1
          { offset: 0.4, color: '#ff4d6d', alpha: 0.85 }, // º2
          { offset: 0.6, color: '#9d3a72', alpha: 0.6  }, // º3
          { offset: 0.8, color: '#4d1a4a', alpha: 0.4  }, // º4
          { offset: 1,   color: '#000000', alpha: 0    }, // Borda (fade)
        ],
      },
    ],
  },
  {
    id: 'aurora',
    name: 'Aurora',
    background: '#2d0e6e',
    blobVariants: [
      {
        stops: [
          { offset: 0,   color: '#ffd479', alpha: 1.0  }, // º0
          { offset: 0.2, color: '#ff8855', alpha: 0.95 }, // º1
          { offset: 0.4, color: '#d946ef', alpha: 0.85 }, // º2
          { offset: 0.6, color: '#7c3aed', alpha: 0.6  }, // º3
          { offset: 0.8, color: '#4c1d95', alpha: 0.4  }, // º4
          { offset: 1,   color: '#000000', alpha: 0    }, // Borda (fade)
        ],
      },
      {
        stops: [
          { offset: 0,   color: '#e0f5ff', alpha: 1.0  }, // º0 ultra-bright
          { offset: 0.2, color: '#67e8f9', alpha: 0.95 }, // º1 cyan
          { offset: 0.4, color: '#ff8855', alpha: 0.85 }, // º2
          { offset: 0.6, color: '#d946ef', alpha: 0.6  }, // º3
          { offset: 0.8, color: '#4c1d95', alpha: 0.4  }, // º4
          { offset: 1,   color: '#000000', alpha: 0    }, // Borda (fade)
        ],
      },
    ],
    variantWeights: [0.7, 0.3],
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
