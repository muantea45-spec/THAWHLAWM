import React, { useState, useEffect } from 'react';
import {
  FileText, Printer, Download, Check, Sparkles,
  BookOpen, Layers, CheckSquare, Square, FileSpreadsheet, Eye
} from 'lucide-react';
import Modal from './common/Modal';

export default function ExportOptionsModal({
  isOpen,
  onClose,
  onExport,
  title = 'Export PDF — Document Setup',
  subtitle = 'Choose your preferred paper size, orientation, and layout before downloading',
  defaultPreset = 'ledger', // 'ledger' | 'certificate' | 'summary' | 'booklet'
  columnCount = 4,
  recordCount = 0,
  isExporting = false
}) {
  // Preset selection
  const [preset, setPreset] = useState(defaultPreset);

  // Paper & Layout settings
  const [pageSize, setPageSize] = useState('a4'); // 'a4' | 'legal' | 'a5'
  const [orientation, setOrientation] = useState(columnCount > 4 ? 'landscape' : 'portrait'); // 'portrait' | 'landscape'
  const [tone, setTone] = useState('monochrome'); // 'monochrome' | 'color'
  const [density, setDensity] = useState('compact'); // 'compact' | 'standard'
  const [bookletMode, setBookletMode] = useState('imposed'); // 'imposed' | 'sequential'

  // Content inclusions
  const [includeSealSignatures, setIncludeSealSignatures] = useState(true);
  const [includeAllocation, setIncludeAllocation] = useState(true);
  const [includeZeroGiving, setIncludeZeroGiving] = useState(false);
  const [includePageNumbers, setIncludePageNumbers] = useState(true);

  // Sync defaults when modal opens or preset changes
  useEffect(() => {
    if (isOpen) {
      setPreset(defaultPreset);
      if (defaultPreset === 'booklet') {
        if (bookletMode === 'imposed') {
          setPageSize('a4');
          setOrientation('landscape');
        } else {
          setPageSize('a5');
          setOrientation('portrait');
        }
        setDensity('compact');
      } else if (defaultPreset === 'certificate') {
        setPageSize('a4');
        setOrientation('portrait');
        setTone('color');
        setDensity('standard');
      } else if (defaultPreset === 'summary') {
        setPageSize('a4');
        setOrientation('portrait');
        setDensity('standard');
      } else {
        // ledger
        setPageSize(recordCount > 150 ? 'legal' : 'a4');
        setOrientation(columnCount > 4 ? 'landscape' : 'portrait');
        setDensity('compact');
        setTone('monochrome');
      }
    }
  }, [isOpen, defaultPreset, columnCount, recordCount, bookletMode]);

  // When user switches preset inside the modal
  const handlePresetChange = (newPreset) => {
    setPreset(newPreset);
    if (newPreset === 'booklet') {
      if (bookletMode === 'imposed') {
        setPageSize('a4');
        setOrientation('landscape');
      } else {
        setPageSize('a5');
        setOrientation('portrait');
      }
      setDensity('compact');
    } else if (newPreset === 'certificate') {
      setPageSize('a4');
      setOrientation('portrait');
      setTone('color');
      setDensity('standard');
    } else if (newPreset === 'summary') {
      setPageSize('a4');
      setOrientation('portrait');
      setDensity('standard');
    } else if (newPreset === 'ledger') {
      setPageSize(recordCount > 150 ? 'legal' : 'a4');
      setOrientation(columnCount > 4 ? 'landscape' : 'portrait');
      setDensity('compact');
      setTone('monochrome');
    }
  };

  const handleDownloadClick = () => {
    onExport({
      preset,
      pageSize,
      orientation,
      tone,
      density,
      bookletMode,
      includeSealSignatures,
      includeAllocation,
      includeZeroGiving,
      includePageNumbers
    });
  };

  const pageSizeLabels = {
    a4: 'A4 (210 × 297 mm)',
    legal: 'Legal (216 × 356 mm)',
    a5: 'A5 (148 × 210 mm)'
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-2xl">
      <Modal.Header
        title={title}
        subtitle={subtitle}
        icon={FileText}
        onClose={onClose}
      />

      <Modal.Body className="space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar py-2">
        {/* 1. DOCUMENT PRESET SELECTOR */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-semibold text-slate-700">
            1. Document Layout Format
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              {
                id: 'ledger',
                title: 'Full Ledger',
                desc: 'Tabular member rows',
                icon: FileSpreadsheet
              },
              {
                id: 'certificate',
                title: 'Certificate',
                desc: 'Letterhead & seals',
                icon: Sparkles
              },
              {
                id: 'summary',
                title: 'Executive 1-Page',
                desc: 'KPIs & Alloc %',
                icon: Layers
              },
              {
                id: 'booklet',
                title: 'A5 Booklet',
                desc: 'Church annual book',
                icon: BookOpen
              }
            ].map(p => {
              const Icon = p.icon;
              const isSelected = preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePresetChange(p.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-indigo-50/80 border-indigo-600 shadow-2xs ring-1 ring-indigo-600/30'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-indigo-600' : 'text-slate-500'}`} />
                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-900 leading-tight">
                      {p.title}
                    </span>
                    <span className="block text-[10px] text-slate-500 truncate mt-0.5">
                      {p.desc}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* BOOKLET MODE SELECTOR (Only when preset === 'booklet') */}
        {preset === 'booklet' && (
          <div className="space-y-1.5 p-3 rounded-2xl bg-indigo-50/80 border border-indigo-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                Booklet Publication Format
              </label>
              <span className="text-[10px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-200">
                {bookletMode === 'imposed' ? 'A4 2-Up Spreads' : 'A5 Single Pages'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setBookletMode('imposed');
                  setPageSize('a4');
                  setOrientation('landscape');
                }}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  bookletMode === 'imposed'
                    ? 'bg-white border-indigo-600 shadow-2xs ring-2 ring-indigo-600/20 text-indigo-950'
                    : 'bg-white/70 border-slate-200 hover:bg-white text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-bold text-slate-900">A4 Imposed (Print & Fold)</span>
                  {bookletMode === 'imposed' && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  2-up landscape spreads with fold marks. Print duplex (flip on short edge) and fold into an A5 booklet in 1..N order.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBookletMode('sequential');
                  setPageSize('a5');
                  setOrientation('portrait');
                }}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  bookletMode === 'sequential'
                    ? 'bg-white border-indigo-600 shadow-2xs ring-2 ring-indigo-600/20 text-indigo-950'
                    : 'bg-white/70 border-slate-200 hover:bg-white text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-bold text-slate-900">A5 Master (Press RIP)</span>
                  {bookletMode === 'sequential' && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Single-page A5 in 1..N order with 15mm/9mm alternating gutter margins and folios for commercial printing press RIP.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* 2. PAPER SIZE & ORIENTATION GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Paper Size */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-700">
                2. Paper Size
              </label>
              <span className="text-[10px] font-mono text-slate-400">
                {pageSize.toUpperCase()}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              {[
                { id: 'a4', label: 'A4' },
                { id: 'legal', label: 'Legal' },
                { id: 'a5', label: 'A5' }
              ].map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setPageSize(s.id)}
                  className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer text-center text-xs ${
                    pageSize === s.id
                      ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 px-0.5">
              {pageSizeLabels[pageSize]}
            </p>
          </div>

          {/* Orientation */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-700">
                3. Orientation
              </label>
              {columnCount > 4 && orientation === 'portrait' && (
                <span className="text-[9.5px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                  Tip: Landscape recommended
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              {[
                { id: 'portrait', label: 'Portrait' },
                { id: 'landscape', label: 'Landscape' }
              ].map(o => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setOrientation(o.id)}
                  className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer text-center text-xs ${
                    orientation === o.id
                      ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 px-0.5">
              {orientation === 'landscape' ? 'Horizontal (wide tables, fits more columns)' : 'Vertical (standard document view)'}
            </p>
          </div>
        </div>

        {/* 3. COLOR TONE & DENSITY */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Color Tone */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-700">
              4. Print Tone / Color
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              {[
                { id: 'monochrome', label: 'B&W (Risograph / Copy)' },
                { id: 'color', label: 'Church Presentation' }
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTone(t.id)}
                  className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer text-center text-[11px] truncate ${
                    tone === t.id
                      ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 px-0.5">
              {tone === 'monochrome'
                ? 'High-contrast black & white; zero gray muddying on photocopiers'
                : 'Bethlehem Kohhran deep slate & emerald palette for digital viewing'}
            </p>
          </div>

          {/* Data Density */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-700">
              5. Typography & Density
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              {[
                { id: 'compact', label: 'Compact (8pt - Saves paper)' },
                { id: 'standard', label: 'Standard (10pt - Readable)' }
              ].map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDensity(d.id)}
                  className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer text-center text-[11px] truncate ${
                    density === d.id
                      ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 px-0.5">
              {density === 'compact' ? 'Fits up to 40 members per page' : 'Generous line spacing for committee review'}
            </p>
          </div>
        </div>

        {/* 4. CONTENT INCLUSIONS (CHECKBOXES) */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="block text-[11px] font-semibold text-slate-700">
            6. Content Inclusions
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setIncludeSealSignatures(prev => !prev)}
              className="flex items-center gap-2 p-2 rounded-xl border border-slate-200/80 hover:bg-slate-50 text-left transition-colors cursor-pointer"
            >
              {includeSealSignatures ? (
                <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <span className="text-slate-700">Include Church Seal & Signatory Block</span>
            </button>

            <button
              type="button"
              onClick={() => setIncludeAllocation(prev => !prev)}
              className="flex items-center gap-2 p-2 rounded-xl border border-slate-200/80 hover:bg-slate-50 text-left transition-colors cursor-pointer"
            >
              {includeAllocation ? (
                <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <span className="text-slate-700">Include Fund Allocation % (PTR, RT, etc.)</span>
            </button>

            <button
              type="button"
              onClick={() => setIncludeZeroGiving(prev => !prev)}
              className="flex items-center gap-2 p-2 rounded-xl border border-slate-200/80 hover:bg-slate-50 text-left transition-colors cursor-pointer"
            >
              {includeZeroGiving ? (
                <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <span className="text-slate-700">Include Zero-Giving (Unpaid) Members</span>
            </button>

            <button
              type="button"
              onClick={() => setIncludePageNumbers(prev => !prev)}
              className="flex items-center gap-2 p-2 rounded-xl border border-slate-200/80 hover:bg-slate-50 text-left transition-colors cursor-pointer"
            >
              {includePageNumbers ? (
                <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <span className="text-slate-700">Include Page Numbers & Date Stamp</span>
            </button>
          </div>
        </div>

        {/* Live Output Summary Preview Card */}
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0 font-mono">
              PDF
            </div>
            <div className="min-w-0">
              <span className="font-bold text-slate-800 block truncate">
                {preset === 'certificate'
                  ? 'Official Certificate'
                  : preset === 'summary'
                  ? 'Executive 1-Page Summary'
                  : preset === 'booklet'
                  ? (bookletMode === 'imposed' ? 'A4 Imposed Booklet (Print & Fold)' : 'A5 Sequential Master Booklet (Press RIP)')
                  : 'Member Roster Ledger'}
              </span>
              <span className="text-[10.5px] text-slate-500 block truncate">
                Format: <strong className="text-slate-700">{pageSize.toUpperCase()}</strong> ({orientation}) • {tone === 'monochrome' ? 'B&W Photocopy' : 'Presentation Color'} • {density}
              </span>
            </div>
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={handleDownloadClick}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>
              {isExporting
                ? 'Generating PDF...'
                : `Download PDF (${pageSize.toUpperCase()} • ${orientation === 'landscape' ? 'Landscape' : 'Portrait'})`}
            </span>
          </button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
