import React, { createContext, useContext, useState, useEffect } from 'react';

export const FONT_SIZE_PRESETS = [
  { id: 'small', label: 'Tê (Small)', shortLabel: 'A-', scale: '90%', px: '14.4px', desc: 'Compact view for more data' },
  { id: 'normal', label: 'A Pangngai (Default)', shortLabel: 'A', scale: '100%', px: '16px', desc: 'Current default font size' },
  { id: 'large', label: 'Lian (Large)', shortLabel: 'A+', scale: '112.5%', px: '18px', desc: 'Comfortable reading' },
  { id: 'xlarge', label: 'Lian Lehzual (Extra Large)', shortLabel: 'A++', scale: '125%', px: '20px', desc: 'Maximum legibility' }
];

const FontSizeContext = createContext({
  fontSize: 'normal',
  setFontSize: () => {},
  currentPreset: FONT_SIZE_PRESETS[1],
  cycleFontSize: () => {},
  presets: FONT_SIZE_PRESETS
});

export function FontSizeProvider({ children }) {
  const [fontSize, setFontSizeState] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('pathian_ram_font_size');
      if (saved && FONT_SIZE_PRESETS.some(p => p.id === saved)) {
        return saved;
      }
    }
    return 'normal'; // Current font size as default
  });

  const applySize = (sizeId) => {
    const preset = FONT_SIZE_PRESETS.find(p => p.id === sizeId) || FONT_SIZE_PRESETS[1];
    if (typeof document !== 'undefined') {
      document.documentElement.style.fontSize = preset.scale;
      document.documentElement.style.setProperty('--app-font-scale', preset.scale);
      document.documentElement.setAttribute('data-font-size', preset.id);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('pathian_ram_font_size', preset.id);
    }
  };

  useEffect(() => {
    applySize(fontSize);
  }, [fontSize]);

  const setFontSize = (sizeId) => {
    if (FONT_SIZE_PRESETS.some(p => p.id === sizeId)) {
      setFontSizeState(sizeId);
      applySize(sizeId);
    }
  };

  const cycleFontSize = () => {
    const currentIndex = FONT_SIZE_PRESETS.findIndex(p => p.id === fontSize);
    const nextIndex = (currentIndex + 1) % FONT_SIZE_PRESETS.length;
    setFontSize(FONT_SIZE_PRESETS[nextIndex].id);
  };

  const currentPreset = FONT_SIZE_PRESETS.find(p => p.id === fontSize) || FONT_SIZE_PRESETS[1];

  return (
    <FontSizeContext.Provider value={{ fontSize, setFontSize, currentPreset, cycleFontSize, presets: FONT_SIZE_PRESETS }}>
      {children}
    </FontSizeContext.Provider>
  );
}

export function useFontSize() {
  const context = useContext(FontSizeContext);
  if (!context) {
    throw new Error('useFontSize must be used within a FontSizeProvider');
  }
  return context;
}
