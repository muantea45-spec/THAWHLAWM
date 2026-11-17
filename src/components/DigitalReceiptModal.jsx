import React, { useState } from 'react';
import { Share2, Church, Download, Loader2, MessageCircle, FileText } from 'lucide-react';
import Modal from './common/Modal';
import churchLogo from '../assets/church_logo.jpg';
import { FINANCIAL_MONTHS, DEFAULT_TITHE_COLUMNS } from '../utils/constants';
import { generateDigitalReceiptPDF } from '../utils/exportEngine';

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
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

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

  // Direct PDF Sharing via Web Share API (with native WhatsApp/App file attachment)
  const handleSharePDF = async () => {
    try {
      setIsGeneratingPDF(true);
      const { file, filename, doc } = await generateDigitalReceiptPDF({
        elementId: 'printable-receipt',
        member,
        monthName,
        year,
        bialName
      });

      // Check if Web Share API with files is supported (mobile browsers, macOS Safari, Windows Edge/Chrome)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Receipt - ${member.name} (${monthName} ${year})`,
          text: `Bethlehem Kohhran Pathian Ram Khawnna Receipt for ${member.name} (${monthName} ${year}).`
        });
        if (showToast) showToast('Receipt PDF shared successfully!', 'success');
      } else {
        // Fallback for browsers without file share capability: download file and notify
        doc.save(filename);
        if (showToast) {
          showToast('Receipt PDF downloaded! You can attach and share it on WhatsApp.', 'success');
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Failed to share PDF:', err);
        try {
          const { doc, filename } = await generateDigitalReceiptPDF({
            elementId: 'printable-receipt',
            member,
            monthName,
            year,
            bialName
          });
          doc.save(filename);
          if (showToast) showToast('Receipt PDF downloaded to your device.', 'success');
        } catch (e) {
          if (showToast) showToast('Failed to generate receipt PDF.', 'error');
        }
      }
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Direct PDF Download
  const handleDownloadPDF = async () => {
    try {
      setIsGeneratingPDF(true);
      const { doc, filename } = await generateDigitalReceiptPDF({
        elementId: 'printable-receipt',
        member,
        monthName,
        year,
        bialName
      });
      doc.save(filename);
      if (showToast) showToast('Receipt PDF downloaded!', 'success');
    } catch (err) {
      console.error('Failed to download PDF:', err);
      if (showToast) showToast('Failed to generate receipt PDF', 'error');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Plain WhatsApp text summary
  const handleWhatsAppShare = () => {
    let breakdownLines = colAmounts.map(c => `• ${c.name} (${c.code}): ₹${c.amount.toLocaleString('en-IN')}`).join('\n');

    const text = `*BETHLEHEM KOHHRAN*\n*Pathian Ram Khawnna Receipt*\n----------------------------------------\n*Bial:* ${bialName || 'Bial'}\n*Name:* ${member.name} (Sl No. ${member.sl_no || ''})\n*Month:* ${monthName} ${year}\n----------------------------------------\n${breakdownLines}\n----------------------------------------\n*TOTAL COLLECTED: ₹${grandTotal.toLocaleString('en-IN')}*\n----------------------------------------\n_Date: ${receiptDate}_\n\nLalpan malsawm che rawh se.`;

    const encodedText = encodeURIComponent(text);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
    if (showToast) showToast('Opened WhatsApp text share!', 'success');
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
              className="w-12 h-12 rounded-full border border-slate-200 object-cover shadow-2xs shrink-0"
            />
            <div className="min-w-0 flex-1 text-center">
              <h2 className="font-heading font-bold text-xs sm:text-sm uppercase tracking-tight text-slate-900 leading-tight">
                Bethlehem Kohhran
              </h2>
              <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mt-0.5">
                Pathian Ram Khawnna Receipt
              </p>
              <p className="text-[10px] font-normal text-slate-500 mt-0.5">
                FY {year}-{year + 1} &nbsp;&bull;&nbsp; Date: {receiptDate}
              </p>
            </div>
          </div>

          {/* Member Details */}
          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5 font-medium">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 uppercase text-[10px] font-semibold">Bial:</span>
              <span className="text-slate-900 font-bold">{bialName || 'Bial'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 uppercase text-[10px] font-semibold">Member Name:</span>
              <span className="text-slate-900 font-bold">{member.name} ({member.sl_no})</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 uppercase text-[10px] font-semibold">Month:</span>
              <span className="text-slate-800 font-semibold">{monthName} {year}</span>
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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer text-center"
          >
            Close
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
            {/* Download PDF button */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-300 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              title="Download official receipt as PDF file"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Download PDF</span>
            </button>

            {/* Share PDF Button */}
            <button
              type="button"
              onClick={handleSharePDF}
              disabled={isGeneratingPDF}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
              title="Share receipt directly in PDF format (WhatsApp, Email, etc.)"
            >
              {isGeneratingPDF ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Preparing...</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share PDF</span>
                </>
              )}
            </button>

            {/* WhatsApp Text Share */}
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs shadow-emerald-600/30 transition-all cursor-pointer"
              title="Send text summary to WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp Text</span>
            </button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
