import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit2, Trash2, ArrowUp, ArrowDown, Check, AlertCircle, 
  SlidersHorizontal, Palette, HelpCircle, Loader2, Sparkles, Eye,
  RefreshCw, CheckCircle2, ShieldAlert
} from 'lucide-react';
import { api } from '../utils/api';

const PRESET_COLORS = [
  { label: 'Indigo', value: '#6366f1', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { label: 'Emerald', value: '#10b981', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { label: 'Amber', value: '#f59e0b', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  { label: 'Purple', value: '#a855f7', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
  { label: 'Rose', value: '#f43f5e', bg: 'bg-rose-50 text-rose-700 border-rose-200' },
  { label: 'Cyan', value: '#06b6d4', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { label: 'Blue', value: '#3b82f6', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
  { label: 'Orange', value: '#f97316', bg: 'bg-orange-50 text-orange-700 border-orange-200' },
  { label: 'Teal', value: '#14b8a6', bg: 'bg-teal-50 text-teal-700 border-teal-200' },
];

export default function TitheColumnsTab({ onColumnsChanged, showToast = () => {} }) {
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Add / Edit form state
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    color: '#6366f1'
  });
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    loadColumns();
  }, []);

  const broadcastColumnUpdate = () => {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('tithe_columns_sync');
        channel.postMessage({ type: 'COLUMNS_UPDATED', timestamp: Date.now() });
        channel.close();
      }
      localStorage.setItem('tithe_columns_updated', String(Date.now()));
      window.dispatchEvent(new CustomEvent('tithe-columns-updated'));
    } catch (e) {
      console.warn('Broadcast sync note:', e);
    }
  };

  const loadColumns = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getColumns();
      const list = Array.isArray(data) ? data : (data?.columns || []);
      setColumns(list);
      return list;
    } catch (err) {
      console.error('Failed to load columns:', err);
      setError(err.message || 'Failed to load tithe columns');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setIsAddingNew(false);
    setFormData({ name: '', code: '', color: '#6366f1' });
    setConfirmDeleteId(null);
  };

  const handleStartEdit = (col) => {
    setConfirmDeleteId(null);
    setIsAddingNew(false);
    setEditingId(col.id);
    setFormData({
      name: col.name,
      code: col.code,
      color: col.color || '#6366f1'
    });
    setError(null);
  };

  const handleStartAdd = () => {
    setConfirmDeleteId(null);
    setEditingId(null);
    setIsAddingNew(true);
    setFormData({
      name: '',
      code: '',
      color: PRESET_COLORS[columns.length % PRESET_COLORS.length].value
    });
    setError(null);
  };

  const handleSaveAdd = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      setError('Column name and code are required');
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const res = await api.createColumn({
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        color: formData.color
      });
      const newCol = res?.column || { name: formData.name.trim(), code: formData.code.trim().toUpperCase() };
      setSuccess(`Column "${newCol.name}" (${newCol.code}) added successfully!`);
      showToast(`Column "${newCol.name}" (${newCol.code}) created successfully!`, 'success');
      resetForm();
      const fresh = await loadColumns();
      broadcastColumnUpdate();
      if (onColumnsChanged) onColumnsChanged(fresh);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to add column');
      showToast(err.message || 'Failed to add column', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      setError('Column name and code are required');
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      await api.updateColumn(editingId, {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        color: formData.color
      });
      setSuccess(`Column updated successfully!`);
      showToast(`Column updated successfully!`, 'success');
      resetForm();
      const fresh = await loadColumns();
      broadcastColumnUpdate();
      if (onColumnsChanged) onColumnsChanged(fresh);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update column');
      showToast(err.message || 'Failed to update column', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (colId) => {
    if (columns.length <= 1) {
      setError('Cannot delete the last remaining column. At least one column must exist.');
      showToast('At least one tithe column must exist.', 'error');
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      await api.deleteColumn(colId);
      setSuccess('Column deleted successfully');
      showToast('Column deleted successfully', 'success');
      setConfirmDeleteId(null);
      const fresh = await loadColumns();
      broadcastColumnUpdate();
      if (onColumnsChanged) onColumnsChanged(fresh);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete column');
      showToast(err.message || 'Failed to delete column', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMove = async (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= columns.length) return;

    const newCols = [...columns];
    const [moved] = newCols.splice(index, 1);
    newCols.splice(newIndex, 0, moved);

    setColumns(newCols);

    try {
      const orders = newCols.map((c, i) => ({ id: c.id, display_order: i + 1 }));
      await api.reorderColumns(orders);
      broadcastColumnUpdate();
      if (onColumnsChanged) onColumnsChanged(newCols);
    } catch (err) {
      setError('Failed to update order');
      loadColumns();
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Top Banner Header */}
      <div className="glass-panel p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-teal-50 text-teal-700 border border-teal-200">
              <SlidersHorizontal className="w-5 h-5" />
            </span>
            <h2 className="text-lg sm:text-xl font-heading font-black text-slate-900 tracking-tight">
              Tithe Columns Management
            </h2>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
              {columns.length} Active Columns
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            All tithe collection columns (e.g. PTR, RT, Tch, Bldg) are dynamic and fully customizable.
            Any category you add, rename, recolor, or delete here will <span className="font-bold text-slate-700">simultaneously reflect in all 12 Bial collector windows</span> and official reports.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadColumns}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Refresh Columns"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {!isAddingNew && !editingId && (
            <button
              type="button"
              onClick={handleStartAdd}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-700 hover:to-indigo-700 text-white text-xs font-extrabold shadow-sm shadow-teal-600/20 transition-all cursor-pointer flex items-center gap-2 active:scale-[0.99]"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Column</span>
            </button>
          )}
        </div>
      </div>

      {/* Success / Error Alerts */}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs font-bold text-emerald-800 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-xs font-bold text-rose-800 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Add / Edit Form Drawer */}
      {(isAddingNew || editingId) && (
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border-2 border-indigo-400 bg-indigo-50/30 shadow-md animate-in slide-in-from-top-2 duration-150 space-y-4">
          <div className="flex items-center justify-between border-b border-indigo-100 pb-2.5">
            <h3 className="text-xs sm:text-sm font-extrabold text-indigo-950 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>{isAddingNew ? 'Add New Tithe Column' : 'Edit & Rename Tithe Column'}</span>
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={isAddingNew ? handleSaveAdd : handleSaveEdit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Column Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Krismas, Biak In Thar"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-base sm:text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                  autoFocus
                />
                <p className="text-[10px] text-slate-400 mt-1">Displayed in reports & summary totals</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Header Code (Short) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={8}
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. KR, BLDG, PTR"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-base sm:text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 uppercase"
                />
                <p className="text-[10px] text-slate-400 mt-1">Short badge displayed in table header (2–5 letters)</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Badge Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-9 h-9 rounded-xl border border-slate-300 p-0.5 cursor-pointer bg-white"
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono font-bold text-slate-900 uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Color Presets Picker */}
            <div>
              <span className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5">
                Quick Palette
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: p.value })}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                      formData.color === p.value ? 'ring-2 ring-indigo-600 font-extrabold shadow-2xs' : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: `${p.value}15`, borderColor: p.value, color: p.value }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.value }}></span>
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-indigo-100">
              <button
                type="button"
                onClick={resetForm}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isAddingNew ? 'Create Column' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Live Header Preview Bar */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl sm:rounded-3xl border border-slate-800 shadow-md space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-extrabold tracking-wider text-indigo-300 uppercase flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" /> Live Bial Header & Table Preview
          </span>
          <span className="text-[10px] text-slate-400">
            This is how collectors will see the columns
          </span>
        </div>

        {/* Mockup Header Row */}
        <div className="overflow-x-auto pb-1">
          <div className="flex items-center gap-2 min-w-max p-2 bg-slate-800/80 rounded-xl border border-slate-700">
            <div className="px-2.5 py-1.5 rounded-lg bg-slate-700 text-[11px] font-mono font-bold text-slate-300">
              # SL
            </div>
            <div className="px-4 py-1.5 rounded-lg bg-slate-700 text-[11px] font-bold text-slate-300 min-w-[120px]">
              MEMBER NAME
            </div>
            {columns.map(col => (
              <div
                key={col.id}
                className="px-3 py-1.5 rounded-lg border text-xs font-mono font-black flex items-center gap-1.5 shadow-2xs"
                style={{
                  backgroundColor: `${col.color || '#6366f1'}25`,
                  borderColor: col.color || '#6366f1',
                  color: '#ffffff'
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color || '#6366f1' }}></span>
                <span>{col.code}</span>
                <span className="text-[9px] opacity-75 font-sans font-normal">({col.name})</span>
              </div>
            ))}
            <div className="px-3.5 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-xs font-mono font-black text-emerald-300">
              TOTAL (₹)
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive Columns Table */}
      <div className="glass-panel rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-indigo-600 font-bold text-xs flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <span>Loading active tithe columns...</span>
          </div>
        ) : columns.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs space-y-2">
            <SlidersHorizontal className="w-8 h-8 text-slate-300 mx-auto" />
            <p>No tithe columns configured.</p>
            <button
              onClick={handleStartAdd}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs cursor-pointer"
            >
              Add First Column
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {columns.map((col, index) => {
              const isDefaultCol = ['pathian_ram', 'ramthar', 'tualchhung', 'building'].includes(col.field_key);
              const isDeleting = confirmDeleteId === col.id;

              return (
                <div
                  key={col.id}
                  className="p-3 sm:p-4 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  {/* Left: Reorder, Color Swatch & Column Info */}
                  <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                    {/* Order Controls */}
                    <div className="flex sm:flex-col items-center gap-0.5 sm:gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMove(index, 'up')}
                        disabled={index === 0}
                        className="p-1.5 sm:p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(index, 'down')}
                        disabled={index === columns.length - 1}
                        className="p-1.5 sm:p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Order Number Badge */}
                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200">
                      {index + 1}
                    </span>

                    {/* Color Swatch & Code Tag */}
                    <div
                      className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border text-xs font-mono font-extrabold flex items-center gap-1.5 shrink-0 shadow-2xs"
                      style={{
                        backgroundColor: `${col.color || '#6366f1'}15`,
                        borderColor: `${col.color || '#6366f1'}40`,
                        color: col.color || '#1e293b'
                      }}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: col.color || '#6366f1' }}></span>
                      <span className="text-xs sm:text-sm font-black">{col.code}</span>
                    </div>

                    {/* Name & Database Key */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="font-heading font-black text-xs sm:text-sm text-slate-900 truncate">
                          {col.name}
                        </span>
                        {isDefaultCol && (
                          <span className="text-[8.5px] sm:text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
                            Core
                          </span>
                        )}
                      </div>
                      <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-0.5">
                        <span>key: <code className="text-slate-600 bg-slate-100 px-1 py-0.5 rounded">{col.field_key}</code></span>
                        <span>color: <code className="text-slate-600">{col.color || '#6366f1'}</code></span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center justify-end gap-2 shrink-0 pt-1 sm:pt-0 border-t border-slate-100 sm:border-0 w-full sm:w-auto">
                    {isDeleting ? (
                      <div className="flex items-center justify-end gap-2 animate-in fade-in w-full sm:w-auto">
                        <span className="text-xs font-bold text-rose-600">Delete column?</span>
                        <button
                          type="button"
                          onClick={() => handleDelete(col.id)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-100 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(col)}
                          className="flex-1 sm:flex-none justify-center px-3 py-1.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/70 text-slate-700 hover:text-indigo-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          title="Edit column name, code, or color"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Edit / Rename</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(col.id)}
                          disabled={columns.length <= 1}
                          className="p-1.5 sm:p-2 rounded-xl border border-slate-200 hover:border-rose-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all cursor-pointer disabled:opacity-20 disabled:hover:bg-transparent shadow-2xs"
                          title="Delete this tithe column"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Helpful Guidance Card */}
      <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-indigo-950/80 text-xs space-y-1.5 leading-relaxed">
        <span className="font-extrabold uppercase text-[10px] tracking-wider text-indigo-900 flex items-center gap-1">
          <HelpCircle className="w-3.5 h-3.5 text-indigo-600" /> Real-Time Column Synchronization
        </span>
        <p>
          Every column configured above is saved permanently in your Cloudflare D1 database.
          When you add, rename, or reorder any column, all 12 Bial collector screens automatically update with the new headers and input fields instantly.
          Overall totals and PDF exports will dynamically include every active category with zero hardcoded limits.
        </p>
      </div>
    </div>
  );
}
