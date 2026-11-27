# Theme system notes

Neo Player retains its existing Neo, Material, and Windows theme identities and shared React/component architecture. The theme is selected through persisted personalization settings and applied to the root `data-ui-theme` attribute. Playback state and player instances are independent of theme presentation.

The shared surface vocabulary remains `liquid-glass`, `liquid-glass-elevated`, and `liquid-glass-subtle`. Their rendering is theme-aware:

- **Neo:** preserves the original colorful liquid-glass treatment and user-adjustable blur.
- **Material:** uses restrained tonal surfaces, thin outlines, and minimal elevation; backdrop blur is intentionally disabled for visual clarity and predictable rendering.
- **Windows:** uses Fluent-inspired translucent Mica surfaces over a softly tinted ambient canvas, with measured backdrop blur and a solid fallback when blur is unsupported or reduced transparency is requested.

The Windows treatment is an original Fluent/Mica-inspired implementation, not a pixel-perfect reproduction of proprietary Windows UI. All themes continue to use existing screens, controls, navigation, library and player logic. Avoid adding a theme-specific player or remounting playback components when changing the theme.

Verify the themes at compact, tablet and desktop widths in both light and dark modes. Respect `prefers-reduced-motion` and `prefers-reduced-transparency`. On Android devices with limited GPU resources, prefer the existing solid/reduced-transparency option if blur impacts scrolling or battery use.
