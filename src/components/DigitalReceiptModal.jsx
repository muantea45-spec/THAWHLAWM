import React from 'react';
import { Share2, Church } from 'lucide-react';
import Modal from './common/Modal';
import churchLogo from '../assets/church_logo.jpg';
import { FINANCIAL_MONTHS, DEFAULT_TITHE_COLUMNS } from '../utils/constants';

export default function DigitalReceiptModal({ 
  isOpen, 
  onClose, 
  member, 
  month, 
  year, 
  bialName, 
  columns = DEFAULT_TITHE_COLUMNS,
  showToast 
}) {
  if (!isOpen || !member) return null;

  const activeCols = (columns && columns.length > 0) ? columns : DEFAULT_TITHE_COLUMNS;
  const monthObj = FINANCIAL_MONTHS.find(m => m.id === month) || { name: `Month ${month}` };
  const monthName = monthObj.name;
  
  let computedTotal = 0;
  const colAmounts = activeCols.map(col => {
    const val = parseFloat(member[col.field_key]) || 0;
    computedTotal += val;
    return {
      ...col,
      amount: val
    };
  });

  const grandTotal = member.total !== undefined && member.total !== null 
    ? parseFloat(member.total) 
    : computedTotal;

  const receiptDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const handleWhatsAppShare = () => {
    let breakdownLines = colAmounts.map(c => `• ${c.name} (${c.code}): ₹${c.amount.toLocaleString('en-IN')}`).join('\n');

    const text = `*BETHLEHEM KOHHRAN*\n*Pathian Ram Khawnna Receipt*\n----------------------------------------\n*Bial:* ${bialName || 'Bial'}\n*Name:* ${member.name} (Sl No. ${member.sl_no || ''})\n*Month:* ${monthName} ${year}\n----------------------------------------\n${breakdownLines}\n----------------------------------------\n*TOTAL COLLECTED: ₹${grandTotal.toLocaleString('en-IN')}*\n----------------------------------------\n_Date: ${receiptDate}_\n\nLalpan malsawm che rawh se.`;

    const encodedText = encodeURIComponent(text);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
    if (showToast) showToast('Opened WhatsApp share!', 'success');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      <Modal.Header
        title="Contribution Digital Receipt"
        subtitle="Official Payment Proof & Shareable Receipt"
        icon={Church}
        onClose={onClose}
      />

      <Modal.Body className="p-4 space-y-4">
        {/* Receipt Card Area */}
        <div id="printable-receipt" className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 space-y-4 text-slate-900 shadow-xs">
          
          {/* Header Identity */}
          <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
            <img
              src={churchLogo}
              alt="Church Logo"
              className="w-12 h-12 rounded-full border border-amber-600/30 object-contain bg-white p-0.5 shrink-0"
            />
            <div className="min-w-0 flex-1 text-center">
              <h2 className="font-heading font-black text-xs sm:text-sm uppercase tracking-tight text-slate-900 leading-tight">
                Bethlehem Kohhran
              </h2>
              <p className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider mt-0.5">
                Pathian Ram Khawnna Receipt
              </p>
              <p className="text-[9.5px] font-bold text-slate-500 mt-0.5">
                FY {year}-{year + 1} &nbsp;•&nbsp; Date: {receiptDate}
              </p>
            </div>
          </div>

          {/* Member Details */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/90 text-xs space-y-1.5 font-bold">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 uppercase text-[10px]">BIAL:</span>
              <span className="text-indigo-900 font-extrabold">{bialName || 'Bial'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 uppercase text-[10px]">MEMBER NAME:</span>
              <span className="text-slate-900 font-extrabold">{member.name} ({member.sl_no})</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 uppercase text-[10px]">MONTH:</span>
              <span className="text-indigo-700 font-extrabold">{monthName} {year}</span>
            </div>
          </div>

          {/* Category Breakdown Table */}
          <div className="space-y-1.5 text-xs font-mono">
            {colAmounts.map(col => (
              <div 
                key={col.id} 
                className="flex justify-between p-2 rounded-lg border"
                style={{ 
                  backgroundColor: `${col.color || '#6366f1'}10`,
                  borderColor: `${col.color || '#6366f1'}30`
                }}
              >
                <span className="font-sans font-bold text-[11px]" style={{ color: col.color || '#1e293b' }}>
                  {col.name} ({col.code})
                </span>
                <span className="font-extrabold text-slate-900">₹{col.amount.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>

          {/* Grand Total Bar */}
          <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-800 to-teal-800 text-white flex justify-between items-center shadow-xs">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-200">TOTAL PAID</span>
            <span className="font-mono text-base font-black tracking-tight text-white">
              ₹{grandTotal.toLocaleString('en-IN')}
            </span>
          </div>

          {/* Footer Note */}
          <div className="text-center pt-1 border-t border-slate-100 text-[10px] text-slate-500 italic">
            Lalpan tam takin malsawm che rawh se.
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <div className="flex justify-between items-center w-full">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>

          <button
            onClick={handleWhatsAppShare}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs shadow-emerald-600/30 transition-all cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>Share to WhatsApp</span>
          </button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
