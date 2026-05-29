import type { Palette } from '../types';

export const PALETTES: Palette[] = [
  {
    id: 'nightfall',
    name: 'Nightfall',
    background: '#1a0d3d',
    blobVariants: [
      {
        stops: [
          { offset: 0,    color: '#ff7a4d', alpha: 1.0 },
          { offset: 0.35, color: '#ec4899', alpha: 0.9 },
          { offset: 0.65, color: '#6b46c1', alpha: 0.5 },
          { offset: 1,    color: '#000000', alpha: 0   },
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
          { offset: 0,   color: '#ffa066', alpha: 1.0  },
          { offset: 0.4, color: '#ff4d6d', alpha: 0.85 },
          { offset: 1,   color: '#000000', alpha: 0    },
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
          { offset: 0,   color: '#ff8855', alpha: 1.0 },
          { offset: 0.5, color: '#d946ef', alpha: 0.7 },
          { offset: 1,   color: '#000000', alpha: 0   },
        ],
      },
      {
        stops: [
          { offset: 0,   color: '#67e8f9', alpha: 1.0 },
          { offset: 0.2, color: '#ff8855', alpha: 0.9 },
          { offset: 0.6, color: '#d946ef', alpha: 0.5 },
          { offset: 1,   color: '#000000', alpha: 0   },
        ],
      },
    ],
    variantWeights: [0.7, 0.3],
  },
];

export function buildCustomPalette(
  colors: [string, string, string, string, string],
): Palette {
  return {
    id: 'custom',
    name: 'Custom',
    background: colors[0],
    blobVariants: [
      {
        stops: [
          { offset: 0,    color: colors[1], alpha: 1.0  },
          { offset: 0.33, color: colors[2], alpha: 0.85 },
          { offset: 0.66, color: colors[3], alpha: 0.5  },
          { offset: 1,    color: colors[4], alpha: 1.0  },
        ],
      },
    ],
  };
}
