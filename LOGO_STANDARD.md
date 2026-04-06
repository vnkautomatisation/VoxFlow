# VoxFlow — Standard Logo

## Règle absolue
**Jamais** écrire `Vox Flow`, `VoxFlow` en texte brut, ou recréer le logo manuellement.
**Toujours** utiliser `<VoxFlowLogo />` ou les assets du dossier `/public/logo/`.

## Utilisation React (frontend Next.js)
```tsx
import { VoxFlowLogo } from '@/components/shared/VoxFlowLogo'

// Sidebar / navbar
<VoxFlowLogo size="md" />

// Avec icône signal
<VoxFlowLogo size="md" showIcon />

// Fond clair
<VoxFlowLogo size="md" variant="light" />

// Tailles disponibles : sm (16px) | md (22px) | lg (32px) | xl (44px)
// Variants : dark (défaut) | light | mono
```

## Utilisation HTML statique
```html
<!-- Logo texte CSS pur -->
<span class="voxflow-logo">
  <span class="vox">Vox</span><span class="flow">Flow</span>
</span>
<!-- Inclure /public/logo/logo.css -->

<!-- Logo image -->
<img src="/logo/voxflow-logo.svg" alt="VoxFlow" height="32" />
<img src="/logo/logo-md.png"      alt="VoxFlow" height="32" />
```

## Assets disponibles dans /public/
```
logo/
  voxflow-logo.svg     ← SVG master horizontal (source de vérité)
  voxflow-icon.svg     ← Icône carrée seule
  logo-sm.png          ← 240×60
  logo-md.png          ← 480×120
  logo-lg.png          ← 960×240

icons/
  favicon.ico          ← Multi-tailles 16/32/48
  favicon.svg          ← Vectoriel (navigateurs modernes)
  favicon-16.png       ← 16×16
  favicon-32.png       ← 32×32
  apple-touch-icon-180.png  ← iOS
  icon-192.png         ← PWA Android
  icon-512.png         ← PWA splash
  og-image.png         ← 1200×630 Open Graph
  twitter-card.png     ← 1200×600
```

## Couleurs officielles
| Usage    | Hex       | Variable CSS       |
|----------|-----------|--------------------|
| Vox      | `#7b61ff` | `var(--color-vox)` |
| Flow     | `#00d4aa` | `var(--color-flow)`|
| Fond     | `#0e0e1c` | `var(--color-bg)`  |

## Nouvelles pages / layouts
1. Importer `VoxFlowLogo` depuis `@/components/shared/VoxFlowLogo`
2. Ne JAMAIS écrire `<span>Vox</span><span>Flow</span>` manuellement
3. Le `app/layout.tsx` gère déjà toutes les balises favicon/OG — ne pas dupliquer

## Chrome Extension
Les icônes sont dans `chrome-extension/icons/`.
L'icône du dialer (`icon_dialer.png`) est conservée séparément — ne pas remplacer.
