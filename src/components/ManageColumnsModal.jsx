import React, { useState, useEffect } from 'react';
import { 
  X, Plus, Edit2, Trash2, ArrowUp, ArrowDown, Check, AlertCircle, 
  SlidersHorizontal, Palette, HelpCircle, Loader2
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

export default function ManageColumnsModal({ isOpen, onClose, onColumnsUpdated }) {
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Add / Edit state
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    color: '#6366f1'
  });
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadColumns();
    } else {
      resetForm();
    }
  }, [isOpen]);

  const loadColumns = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getColumns();
      setColumns(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load columns:', err);
      setError(err.message || 'Failed to load tithe columns');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setIsAddingNew(false);
    setFormData({ name: '', code: '', color: '#6366f1' });
    setConfirmDeleteId(null);
    setError(null);
    setSuccess(null);
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
      const newCol = await api.createColumn({
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        color: formData.color
      });
      setSuccess(`Column "${newCol.name}" (${newCol.code}) added successfully!`);
      resetForm();
      await loadColumns();
      if (onColumnsUpdated) onColumnsUpdated();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to add column');
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
      resetForm();
      await loadColumns();
      if (onColumnsUpdated) onColumnsUpdated();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update column');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (colId) => {
    if (columns.length <= 1) {
      setError('Cannot delete the last remaining column. At least one column must exist.');
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      await api.deleteColumn(colId);
      setSuccess('Column deleted successfully');
      setConfirmDeleteId(null);
      await loadColumns();
      if (onColumnsUpdated) onColumnsUpdated();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete column');
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
      if (onColumnsUpdated) onColumnsUpdated();
    } catch (err) {
      console.error('Failed to reorder columns:', err);
      loadColumns();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Tithe Headers & Columns</h2>
              <p className="text-xs text-slate-500">Add, rename, edit or remove contribution columns (PTR, RT, Tch, Bldg, etc.)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Action Header */}
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Columns ({columns.length})
            </div>
            {!isAddingNew && !editingId && (
              <button
                type="button"
                onClick={handleStartAdd}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Column
              </button>
            )}
          </div>

          {/* Add / Edit Form Panel */}
          {(isAddingNew || editingId) && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-indigo-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 uppercase tracking-wide">
                  {isAddingNew ? 'Create New Contribution Column' : 'Edit Column Header'}
                </span>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={isAddingNew ? handleSaveAdd : handleSaveEdit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Full Column Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ramthar Chhuak"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      autoFocus
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Header Short Code <span className="text-red-500">*</span> (e.g. PTR, RT, Tch)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. RTC"
                      maxLength={8}
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold uppercase focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-slate-500" />
                    Color Accent
                  </label>
                  <div className="flex flex-wrap gap-2 items-center">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, color: c.value })}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${
                          formData.color === c.value ? 'scale-110 border-slate-800 shadow-sm' : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: c.value }}
                        title={c.label}
                      />
                    ))}
                    <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-200">
                      <input
                        type="color"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="w-7 h-7 rounded-lg cursor-pointer border border-slate-300 p-0.5 bg-white"
                        title="Custom Color"
                      />
                      <span className="text-xs font-mono text-slate-600">{formData.color}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-3.5 py-1.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                  >
                    {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {isAddingNew ? 'Create Column' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Columns List */}
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mr-2" />
              <span>Loading contribution columns...</span>
            </div>
          ) : (
            <div className="space-y-2">
              {columns.map((col, index) => {
                const isEditing = editingId === col.id;
                const isDeleting = confirmDeleteId === col.id;

                return (
                  <div
                    key={col.id}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                      isEditing
                        ? 'border-indigo-400 bg-indigo-50/50 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Reorder Up/Down */}
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMove(index, 'up')}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 disabled:hover:bg-transparent"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === columns.length - 1}
                          onClick={() => handleMove(index, 'down')}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 disabled:hover:bg-transparent"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Header Badge */}
                      <div
                        className="px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider shrink-0 shadow-xs border"
                        style={{
                          backgroundColor: `${col.color || '#6366f1'}15`,
                          color: col.color || '#6366f1',
                          borderColor: `${col.color || '#6366f1'}40`
                        }}
                      >
                        {col.code}
                      </div>

                      {/* Name & Details */}
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-800 truncate">
                          {col.name}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2">
                          <span>Key: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">{col.field_key}</code></span>
                          <span>&bull;</span>
                          <span>Order: #{col.display_order || index + 1}</span>
                        </div>
                      </div>
                    </div>

                    {/* Column Actions */}
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {isDeleting ? (
                        <div className="flex items-center gap-1.5 bg-red-50 p-1 rounded-xl border border-red-200 animate-in fade-in">
                          <span className="text-[11px] font-semibold text-red-700 px-1">Delete column?</span>
                          <button
                            type="button"
                            onClick={() => handleDelete(col.id)}
                            disabled={actionLoading}
                            className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-2xs"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-medium"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(col)}
                            className="p-1.5 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-colors"
                            title="Edit Column Header & Code"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={columns.length <= 1}
                            onClick={() => setConfirmDeleteId(col.id)}
                            className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                            title={columns.length <= 1 ? "Cannot delete the last column" : "Delete column"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Help Info Box */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 text-xs flex gap-2.5 items-start">
            <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <div className="space-y-1 leading-relaxed">
              <p className="font-semibold text-slate-700">How dynamic contribution headers work:</p>
              <p>&bull; <strong>Rename & Code</strong>: Changing the name or code (e.g. from <span className="font-mono bg-white px-1 border rounded">PTR</span> to <span className="font-mono bg-white px-1 border rounded">Pathian Ram</span>) immediately updates all tables, Bial sheets, receipts, and PDF reports without losing any member history.</p>
              <p>&bull; <strong>Tallies & Calculations</strong>: All active columns are automatically included in total sums, member histories, monthly trends, and church grand totals.</p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

