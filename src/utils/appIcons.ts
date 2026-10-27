export type AppIconId =
  | 'obsidian-scale'
  | 'emerald-pulse'
  | 'xiaomi-bia-electrodes'
  | 'minimal-monogram'
  | 'cyber-bmi-gauge'
  | 'zen-feather-oled';

export interface AppIconVariant {
  id: AppIconId;
  name: string;
  subtitle: string;
  accentHex: string;
  tag: string;
  description: string;
  svgContent: string;
}

export const APP_ICON_VARIANTS: AppIconVariant[] = [
  {
    id: 'obsidian-scale',
    name: 'Obsidian Scale (Originale)',
    subtitle: 'Balance connectée & écran OLED',
    accentHex: '#10B981',
    tag: 'Classique',
    description: 'Plateau en verre trempé noir profond avec écran matriciel LED vert émeraude et 4 capteurs.',
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
      <rect width="512" height="512" rx="116" fill="#000000"/>
      <rect x="44" y="44" width="424" height="424" rx="88" fill="#09090B" stroke="#27272A" stroke-width="6"/>
      <rect x="132" y="92" width="248" height="86" rx="22" fill="#000000" stroke="#10B981" stroke-width="5"/>
      <text x="256" y="150" font-family="monospace" font-weight="bold" font-size="46" fill="#10B981" text-anchor="middle">70.0</text>
      <circle cx="152" cy="258" r="38" fill="#18181B" stroke="#3F3F46" stroke-width="5"/>
      <circle cx="360" cy="258" r="38" fill="#18181B" stroke="#3F3F46" stroke-width="5"/>
      <circle cx="152" cy="366" r="38" fill="#18181B" stroke="#3F3F46" stroke-width="5"/>
      <circle cx="360" cy="366" r="38" fill="#18181B" stroke="#3F3F46" stroke-width="5"/>
      <path d="M 136 408 Q 256 358 376 408" stroke="#10B981" stroke-width="7" fill="none" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: 'emerald-pulse',
    name: 'Courbe Émeraude',
    subtitle: 'Trajectoire pondérale & objectif',
    accentHex: '#10B981',
    tag: 'Analytique',
    description: 'Courbe de progression lissée sur fond True Black #000000 avec point de ciblage lumineux.',
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
      <defs>
        <linearGradient id="pulseGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#10B981" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#10B981" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="#000000"/>
      <rect x="40" y="40" width="432" height="432" rx="92" fill="#050706" stroke="#18181B" stroke-width="6"/>
      <line x1="88" y1="160" x2="424" y2="160" stroke="#18181B" stroke-width="4" stroke-dasharray="10 10"/>
      <line x1="88" y1="340" x2="424" y2="340" stroke="#38BDF8" stroke-width="4" stroke-dasharray="8 8"/>
      <path d="M 88 180 C 160 190, 200 280, 270 265 C 330 250, 365 320, 416 310 L 416 400 L 88 400 Z" fill="url(#pulseGrad)"/>
      <path d="M 88 180 C 160 190, 200 280, 270 265 C 330 250, 365 320, 416 310" fill="none" stroke="#10B981" stroke-width="14" stroke-linecap="round"/>
      <circle cx="88" cy="180" r="12" fill="#000000" stroke="#10B981" stroke-width="6"/>
      <circle cx="270" cy="265" r="12" fill="#000000" stroke="#10B981" stroke-width="6"/>
      <circle cx="416" cy="310" r="16" fill="#10B981" stroke="#FFFFFF" stroke-width="5"/>
    </svg>`,
  },
  {
    id: 'xiaomi-bia-electrodes',
    name: 'Xiaomi BIA 304L',
    subtitle: '4 Électrodes & Onde Bio-Impédance',
    accentHex: '#38BDF8',
    tag: 'Matériel BLE',
    description: 'Inspirée de la Xiaomi Mi Body Composition Scale 2 avec ses 4 électrodes métalliques et anneau central.',
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
      <rect width="512" height="512" rx="116" fill="#000000"/>
      <rect x="44" y="44" width="424" height="424" rx="90" fill="#090D14" stroke="#1E293B" stroke-width="6"/>
      <circle cx="156" cy="156" r="58" fill="#1E293B" stroke="#94A3B8" stroke-width="6"/>
      <circle cx="356" cy="156" r="58" fill="#1E293B" stroke="#94A3B8" stroke-width="6"/>
      <circle cx="156" cy="356" r="58" fill="#1E293B" stroke="#94A3B8" stroke-width="6"/>
      <circle cx="356" cy="356" r="58" fill="#1E293B" stroke="#94A3B8" stroke-width="6"/>
      <circle cx="256" cy="256" r="46" fill="none" stroke="#38BDF8" stroke-width="5" stroke-opacity="0.4"/>
      <circle cx="256" cy="256" r="24" fill="none" stroke="#10B981" stroke-width="7"/>
      <line x1="256" y1="68" x2="256" y2="196" stroke="#1E293B" stroke-width="4"/>
      <line x1="256" y1="316" x2="256" y2="444" stroke="#1E293B" stroke-width="4"/>
      <line x1="68" y1="256" x2="196" y2="256" stroke="#1E293B" stroke-width="4"/>
      <line x1="316" y1="256" x2="444" y2="256" stroke="#1E293B" stroke-width="4"/>
    </svg>`,
  },
  {
    id: 'minimal-monogram',
    name: 'Monogramme KO Noir Pur',
    subtitle: 'Ultra-minimaliste OLED 95% éteint',
    accentHex: '#FAFAFA',
    tag: 'Minimaliste',
    description: 'Typographie géométrique sur fond 100% noir pur pour une économie d’énergie maximale sur écran AMOLED.',
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
      <rect width="512" height="512" rx="116" fill="#000000"/>
      <rect x="36" y="36" width="440" height="440" rx="96" fill="#000000" stroke="#27272A" stroke-width="4"/>
      <path d="M 148 164 L 148 348 M 148 256 L 236 164 M 182 222 L 244 348" stroke="#FFFFFF" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle cx="332" cy="256" r="78" stroke="#10B981" stroke-width="22" fill="none"/>
      <circle cx="332" cy="256" r="18" fill="#10B981"/>
    </svg>`,
  },
  {
    id: 'cyber-bmi-gauge',
    name: 'Anneau Clinique IMC',
    subtitle: 'Spectre OMS 4 zones & aiguille',
    accentHex: '#F59E0B',
    tag: 'Santé & IMC',
    description: 'Cadran circulaire représentant les plages cliniques de l’IMC (Bleu, Émeraude, Ambre, Rose) sur fond noir.',
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
      <rect width="512" height="512" rx="116" fill="#000000"/>
      <circle cx="256" cy="256" r="196" fill="#070709" stroke="#18181B" stroke-width="6"/>
      <path d="M 126 346 A 158 158 0 0 1 138 150" fill="none" stroke="#38BDF8" stroke-width="24" stroke-linecap="round"/>
      <path d="M 156 132 A 158 158 0 0 1 356 132" fill="none" stroke="#10B981" stroke-width="24" stroke-linecap="round"/>
      <path d="M 374 150 A 158 158 0 0 1 386 346" fill="none" stroke="#F59E0B" stroke-width="24" stroke-linecap="round"/>
      <line x1="256" y1="268" x2="256" y2="136" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round"/>
      <circle cx="256" cy="268" r="22" fill="#10B981"/>
      <text x="256" y="368" font-family="monospace" font-weight="bold" font-size="42" fill="#FFFFFF" text-anchor="middle">IMC</text>
    </svg>`,
  },
  {
    id: 'zen-feather-oled',
    name: 'Équilibre & Légèreté',
    subtitle: 'Feuille géométrique & goutte d’eau',
    accentHex: '#34D399',
    tag: 'Bien-être',
    description: 'Symbole épuré d’équilibre métabolique et d’hydratation corporelle avec lignes fines sur noir absolu.',
    svgContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
      <rect width="512" height="512" rx="116" fill="#000000"/>
      <rect x="44" y="44" width="424" height="424" rx="90" fill="#040806" stroke="#14532D" stroke-width="5"/>
      <path d="M 256 96 C 340 160, 376 248, 376 312 C 376 378, 322 416, 256 416 C 190 416, 136 378, 136 312 C 136 248, 172 160, 256 96 Z" fill="none" stroke="#10B981" stroke-width="14" stroke-linejoin="round"/>
      <path d="M 256 148 L 256 412" stroke="#34D399" stroke-width="8" stroke-linecap="round"/>
      <path d="M 256 240 L 312 196 M 256 300 L 196 250 M 256 340 L 318 292" stroke="#34D399" stroke-width="8" stroke-linecap="round"/>
    </svg>`,
  },
];

export function svgStringToDataUrl(svgString: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString.trim())}`;
}

export function applyFaviconInDom(svgString: string): void {
  const dataUrl = svgStringToDataUrl(svgString);
  let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/svg+xml';
  link.href = dataUrl;
}

export async function downloadIconAsPng(
  svgString: string,
  filename: string,
  size: number = 512
): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (blob) {
          const pngUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(pngUrl);
        }
        resolve();
      }, 'image/png');
    };

    img.src = url;
  });
}
