/**
 * tailwind-config.js — Makeni Central SDA
 * Shared Tailwind Play-CDN config, used by every page.
 *
 * Load order matters — this must come AFTER the Tailwind CDN script
 * and BEFORE sda-shared.css / any markup using these utility classes:
 *
 *   <script src="https://cdn.tailwindcss.com"></script>
 *   <script src="../tailwind-config.js"></script>
 *   <link rel="stylesheet" href="../sda-shared.css"/>
 *
 * Replaces the inline <script id="tailwind-config">...</script>
 * block that was previously pasted into each page separately.
 */
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "secondary": "#755b00",
        "on-surface": "#1a1c1c",
        "error": "#ba1a1a",
        "tertiary-container": "#1c2c40",
        "on-primary": "#ffffff",
        "on-primary-container": "#8392b7",
        "inverse-surface": "#2f3131",
        "secondary-container": "#fed977",
        "secondary-fixed": "#ffe08f",
        "on-tertiary-fixed-variant": "#38485d",
        "on-primary-fixed": "#0a1a3a",
        "primary-fixed": "#d9e2ff",
        "inverse-on-surface": "#f0f1f1",
        "surface-container": "#eeeeee",
        "on-secondary-container": "#785d00",
        "on-surface-variant": "#45464e",
        "on-primary-fixed-variant": "#384668",
        "surface-tint": "#4f5e81",
        "primary-fixed-dim": "#b7c6ee",
        "primary-container": "#1b2a4a",
        "on-background": "#1a1c1c",
        "surface": "#f9f9f9",
        "on-secondary": "#ffffff",
        "background": "#f9f9f9",
        "surface-bright": "#f9f9f9",
        "surface-container-lowest": "#ffffff",
        "outline-variant": "#c5c6cf",
        "on-tertiary": "#ffffff",
        "on-tertiary-fixed": "#0b1c30",
        "inverse-primary": "#b7c6ee",
        "surface-container-high": "#e8e8e8",
        "surface-container-low": "#f3f3f4",
        "on-error": "#ffffff",
        "secondary-fixed-dim": "#e6c364",
        "on-secondary-fixed-variant": "#584400",
        "surface-dim": "#dadada",
        "on-secondary-fixed": "#241a00",
        "outline": "#75777f",
        "error-container": "#ffdad6",
        "primary": "#041534",
        "on-error-container": "#93000a",
        "tertiary-fixed": "#d3e4fe",
        "tertiary": "#06172a",
        "on-tertiary-container": "#8393ac",
        "tertiary-fixed-dim": "#b7c8e1",
        "surface-variant": "#e2e2e2",
        "surface-container-highest": "#e2e2e2"
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "12px",
        "full": "9999px"
      },
      spacing: {
        "section-gap": "120px",
        "margin-desktop": "80px",
        "margin-mobile": "20px",
        "gutter": "32px",
        "base": "4px"
      },
      fontFamily: {
        "label-md": ["Inter"],
        "headline-lg": ["Playfair Display"],
        "display-lg": ["Playfair Display"],
        "body-lg": ["Inter"],
        "title-lg": ["Inter"],
        "body-md": ["Inter"],
        "headline-md": ["Playfair Display"],
        "headline-lg-mobile": ["Playfair Display"]
      },
      fontSize: {
        "label-md": ["14px", { "lineHeight": "1.2", "letterSpacing": "0.08em", "fontWeight": "600" }],
        "headline-lg": ["40px", { "lineHeight": "1.2", "fontWeight": "700" }],
        "display-lg": ["56px", { "lineHeight": "1.1", "letterSpacing": "-0.02em", "fontWeight": "700" }],
        "body-lg": ["18px", { "lineHeight": "1.7", "fontWeight": "400" }],
        "title-lg": ["20px", { "lineHeight": "1.5", "letterSpacing": "0.01em", "fontWeight": "600" }],
        "body-md": ["16px", { "lineHeight": "1.6", "fontWeight": "400" }],
        "headline-md": ["32px", { "lineHeight": "1.3", "fontWeight": "600" }],
        "headline-lg-mobile": ["32px", { "lineHeight": "1.2", "fontWeight": "700" }]
      }
    }
  }
};