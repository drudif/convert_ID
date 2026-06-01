import type { Palette } from '../types';

export const PALETTES: Palette[] = [
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
