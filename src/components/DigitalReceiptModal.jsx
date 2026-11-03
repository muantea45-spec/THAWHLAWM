import React from 'react';
import { Share2, Church } from 'lucide-react';
import Modal from './common/Modal';
import churchLogo from '../assets/church_logo.jpg';
import { FINANCIAL_MONTHS } from '../utils/constants';

export default function DigitalReceiptModal({ isOpen, onClose, member, month, year, bialName, showToast }) {
  if (!isOpen || !member) return null;

  const monthObj = FINANCIAL_MONTHS.find(m => m.id === month) || { name: `Month ${month}` };
  const monthName = monthObj.name;
  
  const pr = parseFloat(member.pathian_ram) || 0;
  const rt = parseFloat(member.ramthar) || 0;
  const tch = parseFloat(member.tualchhung) || 0;
  const bldg = parseFloat(member.building) || 0;
  const grandTotal = parseFloat(member.total) || (pr + rt + tch + bldg);

  const receiptDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const handleWhatsAppShare = () => {
    const text = `*BETHLEHEM KOHHRAN*\n*Pathian Ram Khawnna Receipt*\n----------------------------------------\n*Bial:* ${bialName || 'Bial'}\n*Name:* ${member.name} (Sl No. ${member.sl_no || ''})\n*Month:* ${monthName} ${year}\n----------------------------------------\n• Pathian Ram: ₹${pr.toLocaleString('en-IN')}\n• Ramthar: ₹${rt.toLocaleString('en-IN')}\n• Tualchhung: ₹${tch.toLocaleString('en-IN')}\n• Building: ₹${bldg.toLocaleString('en-IN')}\n----------------------------------------\n*TOTAL COLLECTED: ₹${grandTotal.toLocaleString('en-IN')}*\n----------------------------------------\n_Date: ${receiptDate}_\n\nLalpan malsawm che rawh se.`;

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
            <div className="flex justify-between p-2 rounded-lg bg-blue-50/80 border border-blue-200">
              <span className="font-sans font-bold text-blue-800 text-[11px]">Pathian Ram</span>
              <span className="font-extrabold text-blue-950">₹{pr.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between p-2 rounded-lg bg-emerald-50/80 border border-emerald-200">
              <span className="font-sans font-bold text-emerald-800 text-[11px]">Ramthar</span>
              <span className="font-extrabold text-emerald-950">₹{rt.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between p-2 rounded-lg bg-amber-50/80 border border-amber-200">
              <span className="font-sans font-bold text-amber-800 text-[11px]">Tualchhung</span>
              <span className="font-extrabold text-amber-950">₹{tch.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between p-2 rounded-lg bg-purple-50/80 border border-purple-200">
              <span className="font-sans font-bold text-purple-800 text-[11px]">Building</span>
              <span className="font-extrabold text-purple-950">₹{bldg.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Grand Total Footer */}
          <div className="flex justify-between items-center bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-3 rounded-xl shadow-xs">
            <span className="font-bold text-xs uppercase tracking-wider">TOTAL PAID:</span>
            <span className="font-mono text-base font-extrabold">₹{grandTotal.toLocaleString('en-IN')}</span>
          </div>

          {/* Footer Message */}
          <div className="text-center text-xs font-extrabold text-indigo-900 tracking-wide pt-1">
            Lalpan malsawm che rawh se.
          </div>
        </div>

        {/* Action Button: Share WhatsApp */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>Share via WhatsApp</span>
          </button>
        </div>
      </Modal.Body>
    </Modal>
  );
}
