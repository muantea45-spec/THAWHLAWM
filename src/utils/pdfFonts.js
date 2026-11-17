import { Font } from '@react-pdf/renderer';

let fontsRegistered = false;

/**
 * Registers Unicode TrueType Roboto fonts (Regular, Bold, Italic) with @react-pdf/renderer.
 * Ensures the Indian Rupee symbol (₹ / U+20B9) and Unicode characters render
 * crisply in all PDF viewers without disappearing or showing tofu boxes.
 */
export function registerPdfFonts() {
  if (fontsRegistered) return;
  try {
    const getFontSrc = (fontName) => {
      if (typeof window !== 'undefined' && window.location) {
        const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL)
          ? import.meta.env.BASE_URL.replace(/\/$/, '')
          : '';
        return `${window.location.origin}${base}/fonts/${fontName}`;
      }
      return `/fonts/${fontName}`;
    };

    Font.register({
      family: 'Roboto',
      fonts: [
        { src: getFontSrc('Roboto-Regular.ttf'), fontWeight: 'normal' },
        { src: getFontSrc('Roboto-Bold.ttf'), fontWeight: 'bold' },
        { src: getFontSrc('Roboto-Italic.ttf'), fontStyle: 'italic' },
      ],
    });
    fontsRegistered = true;
  } catch (err) {
    console.warn('PDF Roboto font registration failed:', err);
  }
}

// Auto-register on import
registerPdfFonts();
