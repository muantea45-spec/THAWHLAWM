import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText, Download, FileSpreadsheet, Printer, X,
  Calendar, Building2, User, Award, Shield, CheckCircle2,
  Sliders, Layers, Sparkles, Loader2, RefreshCw, Upload, Image as ImageIcon,
  Bold, Italic, Underline, Users, BookOpen
} from 'lucide-react';
import churchLogo from '../assets/church_logo.jpg';
import { FINANCIAL_MONTHS } from '../utils/constants';
import { api } from '../utils/api';
import {
  exportCertificateReactPDF,
  exportCertificateWYSIWYGPDF,
  exportCertificatePNG,
  printCertificateDirectly,
  exportOfficialCertificateExcel,
  exportConsolidatedBookletPDF,
  exportConsolidatedBookletExcel,
  getBase64ImageFromUrl
} from '../utils/exportEngine';

export default function OfficialReportModal({
  isOpen,
  onClose,
  currentYear,
  financialYears = [],
  bials = [],
  grandTotals = {},
  stats = null,
  user = null,
  fixedBialId = null,
  showToast = () => {}
}) {
  const [reportType, setReportType] = useState('annual'); // 'annual' | 'monthly'
  const [selectedYear, setSelectedYear] = useState(currentYear || new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(4); // 4 (April) or 'all'
  const [selectedBialId, setSelectedBialId] = useState(fixedBialId ? String(fixedBialId) : 'all'); // 'all' or numeric string/id
  const [bialAnnualView, setBialAnnualView] = useState('monthly'); // 'monthly' (12-month breakdown) | 'members' (Member Annual Summary)
  const [pageSize, setPageSize] = useState('a4'); // 'a4' | 'legal'
  const [orientation, setOrientation] = useState('portrait'); // 'portrait' | 'landscape'

  // Manual Signatory Details & B/I/U Styling
  const [signatoryName, setSignatoryName] = useState(user?.username || 'Secretary / Treasurer');
  const [nameBold, setNameBold] = useState(false);
  const [nameItalic, setNameItalic] = useState(false);
  const [nameUnderline, setNameUnderline] = useState(false);

  const [signatoryDesignation, setSignatoryDesignation] = useState('Treasurer');
  const [desigBold, setDesigBold] = useState(false);
  const [desigItalic, setDesigItalic] = useState(false);
  const [desigUnderline, setDesigUnderline] = useState(false);

  const [signatoryOrganization, setSignatoryOrganization] = useState('Presbyterian Church of India');
  const [orgBold, setOrgBold] = useState(false);
  const [orgItalic, setOrgItalic] = useState(false);
  const [orgUnderline, setOrgUnderline] = useState(false);

  const [issueDate, setIssueDate] = useState(new Date().toLocaleDateString('en-GB'));

  // Upload Signature & Seal with Size Controls
  const [signatureBase64, setSignatureBase64] = useState(null);
  const [signatureSize, setSignatureSize] = useState(45); // px
  const [sealBase64, setSealBase64] = useState(null);
  const [sealSize, setSealSize] = useState(65); // px

  const isAdmin = user?.role === 'ADMIN' && !fixedBialId;

  // Dynamic Data & Loading State
  const certificateRef = useRef(null);
  const [loadingData, setLoadingData] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPNG, setIsExportingPNG] = useState(false);
  const [isExportingBooklet, setIsExportingBooklet] = useState(false);
  const [logoBase64, setLogoBase64] = useState(null);

  // Dynamic Content state
  const [dynamicBreakdown, setDynamicBreakdown] = useState([]);
  const [dynamicTotals, setDynamicTotals] = useState({
    total_pathian_ram: 0,
    total_ramthar: 0,
    total_tualchhung: 0,
    total_building: 0,
    grand_total: 0
  });
  const [tableType, setTableType] = useState('bials'); // 'bials' | 'monthly_breakdown' | 'members' | 'member_annual_summary'
  const [scopeName, setScopeName] = useState('All Bials Combined');

  // Pre-load Church Logo as Base64 for instant PDF embedding
  useEffect(() => {
    getBase64ImageFromUrl(churchLogo).then(b64 => {
      setLogoBase64(b64);
    });
  }, []);

  useEffect(() => {
    if (currentYear) setSelectedYear(currentYear);
    if (fixedBialId) setSelectedBialId(String(fixedBialId));
  }, [currentYear, fixedBialId, isOpen]);

  // Natural sorting of bials (Bial 1 to Bial 12)
  const sortedBials = [...bials].sort((a, b) => {
    const numA = parseInt(a.code?.replace(/\D/g, '') || a.id) || 0;
    const numB = parseInt(b.code?.replace(/\D/g, '') || b.id) || 0;
    return numA - numB;
  });

  // Fetch / Compute live data whenever filters change
  const fetchReportData = useCallback(async () => {
    if (!isOpen) return;
    setLoadingData(true);

    try {
      if (selectedBialId === 'all') {
        setScopeName('All Bials Combined');
        setTableType('bials');

        if (reportType === 'annual' || selectedMonth === 'all') {
          // Annual Combined or All Months Summation for all Bials
          const res = await api.getAdminDashboard(selectedYear);
          const breakdown = (res.bialBreakdown && res.bialBreakdown.length > 0)
            ? res.bialBreakdown.map(b => ({
                id: b.id,
                name: b.name,
                bial_name: b.name,
                bial_code: b.code || '',
                member_count: b.total_members || b.member_count || 0,
                pathian_ram: b.pathian_ram || 0,
                ramthar: b.ramthar || 0,
                tualchhung: b.tualchhung || 0,
                building: b.building || 0,
                total: b.total || 0
              }))
            : sortedBials.map((b, i) => ({
                id: b.id,
                name: b.name,
                bial_name: b.name,
                bial_code: b.code || `B${i + 1}`,
                member_count: b.member_count || 0,
                pathian_ram: b.total_pathian_ram || 0,
                ramthar: b.total_ramthar || 0,
                tualchhung: b.total_tualchhung || 0,
                building: b.total_building || 0,
                total: b.total_collected || 0
              }));

          breakdown.sort((a, b) => {
            const numA = parseInt((a.bial_code || a.code || '').replace(/\D/g, '') || a.id) || 0;
            const numB = parseInt((b.bial_code || b.code || '').replace(/\D/g, '') || b.id) || 0;
            return numA - numB;
          });

          setDynamicBreakdown(breakdown);
          setDynamicTotals({
            total_pathian_ram: res.grandTotals?.total_pathian_ram || breakdown.reduce((a, b) => a + (b.pathian_ram || 0), 0),
            total_ramthar: res.grandTotals?.total_ramthar || breakdown.reduce((a, b) => a + (b.ramthar || 0), 0),
            total_tualchhung: res.grandTotals?.total_tualchhung || breakdown.reduce((a, b) => a + (b.tualchhung || 0), 0),
            total_building: res.grandTotals?.total_building || breakdown.reduce((a, b) => a + (b.building || 0), 0),
            grand_total: res.grandTotals?.grand_total || breakdown.reduce((a, b) => a + (b.total || 0), 0)
          });
        } else {
          // Specific Month for All Bials
          const res = await api.getAdminDashboard(selectedYear, { month: selectedMonth });
          const breakdown = (res.bialBreakdown && res.bialBreakdown.length > 0)
            ? res.bialBreakdown.map(b => ({
                id: b.id,
                name: b.name,
                bial_name: b.name,
                bial_code: b.code || '',
                member_count: b.total_members || b.member_count || 0,
                pathian_ram: b.pathian_ram || 0,
                ramthar: b.ramthar || 0,
                tualchhung: b.tualchhung || 0,
                building: b.building || 0,
                total: b.total || 0
              }))
            : bials.map((b, i) => ({
                id: b.id,
                name: b.name,
                bial_name: b.name,
                bial_code: b.code || `B${i + 1}`,
                member_count: b.member_count || 0,
                pathian_ram: 0,
                ramthar: 0,
                tualchhung: 0,
                building: 0,
                total: 0
              }));

          setDynamicBreakdown(breakdown);
          setDynamicTotals({
            total_pathian_ram: res.grandTotals?.total_pathian_ram || breakdown.reduce((a, b) => a + (b.pathian_ram || 0), 0),
            total_ramthar: res.grandTotals?.total_ramthar || breakdown.reduce((a, b) => a + (b.ramthar || 0), 0),
            total_tualchhung: res.grandTotals?.total_tualchhung || breakdown.reduce((a, b) => a + (b.tualchhung || 0), 0),
            total_building: res.grandTotals?.total_building || breakdown.reduce((a, b) => a + (b.building || 0), 0),
            grand_total: res.grandTotals?.grand_total || breakdown.reduce((a, b) => a + (b.total || 0), 0)
          });
        }
      } else {
        // Specific Particular Bial selected!
        const bId = parseInt(selectedBialId);
        const curBialObj = bials.find(b => b.id === bId);
        const bName = curBialObj?.name || `Bial ${bId}`;
        setScopeName(bName);

        if (reportType === 'annual') {
          const summaryRes = await api.getYearlySummary(bId, selectedYear);
          if (bialAnnualView === 'members') {
            // Member Annual Summary: Summation over the full year contributed by every member
            setTableType('member_annual_summary');
            setDynamicBreakdown(summaryRes.memberTotals || []);
          } else {
            // 12 Months Breakdown for this Bial
            setTableType('monthly_breakdown');
            setDynamicBreakdown(summaryRes.monthlyBreakdown || []);
          }
          setDynamicTotals({
            total_pathian_ram: summaryRes.grandTotals?.total_pathian_ram || 0,
            total_ramthar: summaryRes.grandTotals?.total_ramthar || 0,
            total_tualchhung: summaryRes.grandTotals?.total_tualchhung || 0,
            total_building: summaryRes.grandTotals?.total_building || 0,
            grand_total: summaryRes.grandTotals?.grand_total || 0
          });
        } else if (selectedMonth === 'all') {
          // PARTICULAR BIAL + MONTHLY REPORT + ALL MONTHS
          // Shows summation of every month for all members in this Bial!
          setTableType('member_annual_summary');
          const summaryRes = await api.getYearlySummary(bId, selectedYear);
          setDynamicBreakdown(summaryRes.memberTotals || []);
          setDynamicTotals({
            total_pathian_ram: summaryRes.grandTotals?.total_pathian_ram || 0,
            total_ramthar: summaryRes.grandTotals?.total_ramthar || 0,
            total_tualchhung: summaryRes.grandTotals?.total_tualchhung || 0,
            total_building: summaryRes.grandTotals?.total_building || 0,
            grand_total: summaryRes.grandTotals?.grand_total || 0
          });
        } else {
          // Member-level contributions for this Bial and specific Month
          setTableType('members');
          const tithesRes = await api.getTithes(bId, selectedYear, selectedMonth);
          const membersList = tithesRes.members || [];
          setDynamicBreakdown(membersList);
          setDynamicTotals({
            total_pathian_ram: tithesRes.summary?.sum_pathian_ram || 0,
            total_ramthar: tithesRes.summary?.sum_ramthar || 0,
            total_tualchhung: tithesRes.summary?.sum_tualchhung || 0,
            total_building: tithesRes.summary?.sum_building || 0,
            grand_total: tithesRes.summary?.grand_total || 0
          });
        }
      }
    } catch (err) {
      console.error('Error fetching report data:', err);
      showToast('Error loading report data', 'error');
    } finally {
      setLoadingData(false);
    }
  }, [isOpen, selectedBialId, selectedYear, selectedMonth, reportType, bialAnnualView, bials, showToast]);

  useEffect(() => {
    if (isOpen) {
      fetchReportData();
    }
  }, [fetchReportData, isOpen]);

  if (!isOpen) return null;

  // Compute Active Period String
  const isAllMonths = selectedMonth === 'all';
  const monthObj = FINANCIAL_MONTHS.find(m => m.id === selectedMonth) || FINANCIAL_MONTHS[0];
  const periodText = reportType === 'annual'
    ? `Annual Financial Report: FY ${selectedYear} - ${selectedYear + 1}`
    : isAllMonths
      ? `Monthly Report: All Months Summation (FY ${selectedYear} - ${selectedYear + 1})`
      : `Monthly Report: ${monthObj.name} ${selectedYear}`;

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      showToast('Generating official certificate PDF...', 'info');
      const safeScope = scopeName ? `_${scopeName.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
      const safeTitle = `Pathian_Ram_Official_Report_${reportType.replace(/[^a-zA-Z0-9]/g, '_')}${safeScope}_${selectedYear}`;

      const reportData = {
        title: 'Pathian Ram Report',
        denomination: 'Presbyterian Church of India',
        churchName: 'Bethlehem Kohhran',
        periodText,
        scopeName,
        issueDate,
        pageSize,
        orientation,
        logoBase64: logoBase64 || churchLogo,
        totals: dynamicTotals,
        tableType,
        breakdown: dynamicBreakdown,
        signatory: {
          name: signatoryName,
          designation: signatoryDesignation,
          organization: signatoryOrganization,
          nameBold,
          nameItalic,
          nameUnderline,
          desigBold,
          desigItalic,
          desigUnderline,
          orgBold,
          orgItalic,
          orgUnderline,
        },
        signatureBase64,
        signatureSize,
        sealBase64,
        sealSize,
      };

      try {
        await exportCertificateReactPDF(reportData, safeTitle);
        showToast('Official Certificate PDF downloaded successfully!', 'success');
      } catch (reactPdfErr) {
        console.warn('React-PDF export encountered an issue, falling back to canvas engine:', reactPdfErr);
        if (certificateRef.current) {
          await exportCertificateWYSIWYGPDF({
            element: certificateRef.current,
            title: safeTitle,
            pageSize,
            orientation,
            reportData
          });
          showToast('Official Certificate PDF downloaded successfully!', 'success');
        } else {
          throw reactPdfErr;
        }
      }
    } catch (err) {
      console.error('PDF export error:', err);
      showToast(err.message || 'Failed to generate PDF', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPNG = async () => {
    try {
      setIsExportingPNG(true);
      showToast('Downloading high-resolution certificate image...', 'info');

      const safeScope = scopeName ? `_${scopeName.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
      const safeTitle = `Pathian_Ram_Official_Report_${reportType.replace(/[^a-zA-Z0-9]/g, '_')}${safeScope}_${selectedYear}`;

      if (certificateRef.current) {
        await exportCertificatePNG({
          element: certificateRef.current,
          title: safeTitle,
          orientation
        });
        showToast('Official Certificate image downloaded successfully!', 'success');
      } else {
        throw new Error('Certificate preview element not found');
      }
    } catch (err) {
      console.error('PNG export error:', err);
      showToast(err.message || 'Failed to generate image', 'error');
    } finally {
      setIsExportingPNG(false);
    }
  };

  const handlePrint = async () => {
    try {
      showToast('Opening print dialog...', 'info');

      const safeScope = scopeName ? `_${scopeName.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
      const safeTitle = `Pathian_Ram_Official_Report_${reportType.replace(/[^a-zA-Z0-9]/g, '_')}${safeScope}_${selectedYear}`;

      if (certificateRef.current) {
        printCertificateDirectly(certificateRef.current, safeTitle, pageSize, orientation);
      } else {
        window.print();
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to open print preview', 'error');
    }
  };

  const handleExportExcel = () => {
    try {
      showToast('Generating official report Excel sheet...', 'info');

      exportOfficialCertificateExcel({
        title: 'PATHIAN RAM REPORT',
        denomination: 'Presbyterian Church of India',
        churchName: 'Bethlehem Kohhran',
        periodText,
        reportType: reportType === 'annual' ? 'Annual' : 'Monthly',
        year: selectedYear,
        grandTotals: dynamicTotals,
        bialsBreakdown: dynamicBreakdown,
        signatory: {
          name: signatoryName,
          designation: signatoryDesignation,
          organization: signatoryOrganization,
          date: issueDate
        },
        tableType,
        scopeName
      });

      showToast('Official Report Excel sheet downloaded successfully!', 'success');
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to export Excel file', 'error');
    }
  };

  const handleExportConsolidatedBookletPDF = async () => {
    try {
      setIsExportingBooklet(true);
      showToast('Compiling 12-Month Consolidated Booklet (2-Column A4)...', 'info');

      const res = await api.getOverallMemberContributions(selectedYear);
      if (!res || !res.bials || res.bials.length === 0) {
        throw new Error('No consolidated member data found for this year.');
      }

      exportConsolidatedBookletPDF({
        year: selectedYear,
        bialsData: res.bials,
        churchTotals: res.churchGrandTotal || {}
      });

      showToast(`Consolidated Annual Booklet PDF downloaded (FY ${selectedYear})!`, 'success');
    } catch (err) {
      console.error('Booklet PDF export error:', err);
      showToast(err.message || 'Failed to export consolidated booklet PDF', 'error');
    } finally {
      setIsExportingBooklet(false);
    }
  };

  const handleExportConsolidatedBookletExcel = async () => {
    try {
      setIsExportingBooklet(true);
      showToast('Compiling 12-Month Consolidated Booklet Excel...', 'info');

      const res = await api.getOverallMemberContributions(selectedYear);
      if (!res || !res.bials || res.bials.length === 0) {
        throw new Error('No consolidated member data found for this year.');
      }

      exportConsolidatedBookletExcel({
        year: selectedYear,
        bialsData: res.bials,
        churchTotals: res.churchGrandTotal || {}
      });

      showToast(`Consolidated Annual Booklet Excel downloaded (FY ${selectedYear})!`, 'success');
    } catch (err) {
      console.error('Booklet Excel export error:', err);
      showToast(err.message || 'Failed to export consolidated booklet Excel', 'error');
    } finally {
      setIsExportingBooklet(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className={`bg-white rounded-3xl shadow-2xl border border-slate-200 w-full ${orientation === 'landscape' ? 'max-w-6xl xl:max-w-7xl' : 'max-w-5xl'} max-h-[92vh] flex flex-col overflow-hidden my-auto transition-all duration-300`}>
        
        {/* MODAL HEADER */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-600 text-white shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-extrabold text-base sm:text-lg text-slate-900 leading-tight">
                Report Form & Certificate Generator
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Presbyterian Church of India • Bethlehem Kohhran • <span className="font-bold text-indigo-700">{pageSize.toUpperCase()} ({orientation.toUpperCase()})</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY: 2 COLUMN WORKSPACE (CONTROLS LEFT, LIVE SHEET PREVIEW RIGHT) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 bg-slate-100/60">
          
          {/* LEFT COLUMN: CONFIGURATION CONTROLS (4 COLS) */}
          <div className="lg:col-span-4 space-y-3">
            
            {/* 1. Scope & Selection Options */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-700">
                <div className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                  <span>1. Scope & Period</span>
                </div>
                {loadingData && <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />}
              </div>

              {/* Bial Selector (All Bials vs Particular Bial) */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Bial Selection
                </label>
                {fixedBialId ? (
                  <div className="w-full px-2.5 py-1.5 rounded-xl bg-indigo-50/80 border border-indigo-200 text-indigo-950 font-bold text-xs flex items-center justify-between shadow-2xs">
                    <span className="truncate">📍 {bials.find(b => String(b.id) === String(fixedBialId))?.name || `Bial ${fixedBialId}`}</span>
                    <span className="text-[9px] font-black text-indigo-700 bg-white border border-indigo-200 px-1.5 py-0.5 rounded-md uppercase shrink-0">
                      Bial Scope
                    </span>
                  </div>
                ) : (
                  <select
                    value={selectedBialId}
                    onChange={(e) => setSelectedBialId(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-bold text-xs focus:outline-none focus:border-indigo-600 shadow-2xs cursor-pointer truncate"
                  >
                    <option value="all">🌟 ALL BIALS (Church Combined)</option>
                    {sortedBials.map(b => (
                      <option key={b.id} value={b.id}>📍 {b.name} ({b.code})</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Report Type Switcher */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Report Type
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setReportType('annual')}
                    className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                      reportType === 'annual' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Annual Report
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportType('monthly')}
                    className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                      reportType === 'monthly' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Monthly Report
                  </button>
                </div>
              </div>

              {/* Particular Bial Annual View Option: 12-Month Breakdown vs Member Annual Summary */}
              {selectedBialId !== 'all' && reportType === 'annual' && (
                <div className="pt-0.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Annual Breakdown View
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setBialAnnualView('monthly')}
                      className={`py-1.5 px-1.5 rounded-lg transition-all cursor-pointer truncate ${
                        bialAnnualView === 'monthly' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="12 Month Breakdown (April - March)"
                    >
                      📅 12 Months
                    </button>
                    <button
                      type="button"
                      onClick={() => setBialAnnualView('members')}
                      className={`py-1.5 px-1.5 rounded-lg transition-all cursor-pointer truncate ${
                        bialAnnualView === 'members' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Member Annual Summation (Member-by-Member for Full Year)"
                    >
                      👥 Member Summary
                    </button>
                  </div>
                </div>
              )}

              {/* Financial Year Selector */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Financial Year
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono font-bold text-xs focus:outline-none focus:border-indigo-600 shadow-2xs cursor-pointer"
                  >
                    {financialYears.map(y => (
                      <option key={y} value={y}>FY {y}</option>
                    ))}
                  </select>
                </div>

                {/* Month Selector (Includes "All Months" Summation Option) */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Month
                  </label>
                  <select
                    value={selectedMonth}
                    disabled={reportType === 'annual'}
                    onChange={(e) => setSelectedMonth(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                    className="w-full px-2 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-bold text-xs focus:outline-none focus:border-indigo-600 shadow-2xs cursor-pointer disabled:opacity-40 disabled:bg-slate-50"
                  >
                    <option value="all">🌟 All Months (Summation)</option>
                    {FINANCIAL_MONTHS.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 2. Paper Layout & Format */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-700">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>2. Page Setup</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Paper Size
                  </label>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-bold text-xs focus:outline-none focus:border-indigo-600 shadow-2xs cursor-pointer"
                  >
                    <option value="a4">A4 (Standard)</option>
                    <option value="legal">Legal (8.5 x 14 in)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Orientation
                  </label>
                  <select
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-bold text-xs focus:outline-none focus:border-indigo-600 shadow-2xs cursor-pointer"
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 3. YEARLY REPORT & CONSOLIDATED BOOKLET SECTION */}
            <div className="bg-gradient-to-br from-indigo-50/90 to-purple-50/90 p-3.5 rounded-2xl border border-indigo-200 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-indigo-950">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>3. YEARLY REPORT BOOKLET</span>
                </div>
                <span className="px-2 py-0.5 bg-indigo-600 text-white text-[9.5px] font-black rounded-md uppercase tracking-wider">
                  2-Column Landscape A4
                </span>
              </div>
              <p className="text-[10.5px] text-slate-600 font-medium leading-normal">
                Generates a 12-month consolidated booklet on Landscape A4 paper in 2 Columns (fills Column 1 first, then Column 2). Continuous Sl No starts at Bial 1 (Sl 1) and continues seamlessly across B2, B3... B12.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleExportConsolidatedBookletPDF}
                  disabled={isExportingBooklet}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-xs shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
                  title="Download 2-Column Landscape A4 Booklet PDF with continuous Sl No from B1 onwards"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>Booklet PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportConsolidatedBookletExcel}
                  disabled={isExportingBooklet}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                  title="Download Consolidated Member Excel spreadsheet"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                  <span>Booklet Excel</span>
                </button>
              </div>
            </div>

            {/* 4. Manual Signatory Details & B/I/U Options (Admin Only) */}
            {isAdmin && (
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-600" />
                    <span>3. Signatory Details</span>
                  </div>
                </div>

                {/* Name Field with B / I / U */}
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">
                      Name
                    </label>
                    <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-md border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setNameBold(!nameBold)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-black transition-colors cursor-pointer ${nameBold ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                        title="Bold"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={() => setNameItalic(!nameItalic)}
                        className={`px-1.5 py-0.5 rounded text-[10px] italic font-serif transition-colors cursor-pointer ${nameItalic ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                        title="Italic"
                      >
                        I
                      </button>
                      <button
                        type="button"
                        onClick={() => setNameUnderline(!nameUnderline)}
                        className={`px-1.5 py-0.5 rounded text-[10px] underline font-bold transition-colors cursor-pointer ${nameUnderline ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                        title="Underline"
                      >
                        U
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={signatoryName}
                    onChange={(e) => setSignatoryName(e.target.value)}
                    placeholder="Enter Signatory Full Name"
                    className={`w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 shadow-2xs ${nameBold ? 'font-bold' : 'font-normal'} ${nameItalic ? 'italic' : ''} ${nameUnderline ? 'underline' : ''}`}
                  />
                </div>

                {/* Designation Field with B / I / U */}
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">
                      Designation
                    </label>
                    <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-md border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setDesigBold(!desigBold)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-black transition-colors cursor-pointer ${desigBold ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                        title="Bold"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={() => setDesigItalic(!desigItalic)}
                        className={`px-1.5 py-0.5 rounded text-[10px] italic font-serif transition-colors cursor-pointer ${desigItalic ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                        title="Italic"
                      >
                        I
                      </button>
                      <button
                        type="button"
                        onClick={() => setDesigUnderline(!desigUnderline)}
                        className={`px-1.5 py-0.5 rounded text-[10px] underline font-bold transition-colors cursor-pointer ${desigUnderline ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                        title="Underline"
                      >
                        U
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={signatoryDesignation}
                    onChange={(e) => setSignatoryDesignation(e.target.value)}
                    placeholder="e.g. Treasurer / Kohhran Secretary"
                    className={`w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 shadow-2xs ${desigBold ? 'font-bold' : 'font-normal'} ${desigItalic ? 'italic' : ''} ${desigUnderline ? 'underline' : ''}`}
                  />
                </div>

                {/* Organization Field with B / I / U */}
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">
                      Organization
                    </label>
                    <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-md border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setOrgBold(!orgBold)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-black transition-colors cursor-pointer ${orgBold ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                        title="Bold"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrgItalic(!orgItalic)}
                        className={`px-1.5 py-0.5 rounded text-[10px] italic font-serif transition-colors cursor-pointer ${orgItalic ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                        title="Italic"
                      >
                        I
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrgUnderline(!orgUnderline)}
                        className={`px-1.5 py-0.5 rounded text-[10px] underline font-bold transition-colors cursor-pointer ${orgUnderline ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                        title="Underline"
                      >
                        U
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={signatoryOrganization}
                    onChange={(e) => setSignatoryOrganization(e.target.value)}
                    placeholder="e.g. Presbyterian Church of India"
                    className={`w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-indigo-600 shadow-2xs ${orgBold ? 'font-bold' : 'font-normal'} ${orgItalic ? 'italic' : ''} ${orgUnderline ? 'underline' : ''}`}
                  />
                </div>

                <div>
                  <label className="block text-[9.5px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                    Date of Issue
                  </label>
                  <input
                    type="text"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    placeholder="DD/MM/YYYY"
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono text-xs focus:outline-none focus:border-indigo-600 shadow-2xs"
                  />
                </div>
              </div>
            )}

            {/* 4. Upload Signature & Stamp/Seal with Size Controls (Admin Only) */}
            {isAdmin && (
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-700">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>4. Signature & Seal Upload</span>
                </div>

                {/* Signature Upload */}
                <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-700 uppercase flex items-center gap-1">
                      <Upload className="w-3 h-3 text-indigo-600" />
                      <span>Upload Signature</span>
                    </span>
                    {signatureBase64 && (
                      <button
                        type="button"
                        onClick={() => setSignatureBase64(null)}
                        className="text-[10px] text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => setSignatureBase64(ev.target?.result);
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                  />
                  {signatureBase64 && (
                    <div className="pt-1 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold">
                        <span>Signature Size:</span>
                        <span>{signatureSize}px</span>
                      </div>
                      <input
                        type="range"
                        min="25"
                        max="100"
                        value={signatureSize}
                        onChange={(e) => setSignatureSize(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>
                  )}
                </div>

                {/* Seal / Stamp Upload */}
                <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-700 uppercase flex items-center gap-1">
                      <Shield className="w-3 h-3 text-indigo-600" />
                      <span>Upload Stamp / Seal</span>
                    </span>
                    {sealBase64 && (
                      <button
                        type="button"
                        onClick={() => setSealBase64(null)}
                        className="text-[10px] text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => setSealBase64(ev.target?.result);
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                  />
                  {sealBase64 && (
                    <div className="pt-1 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold">
                        <span>Seal Size:</span>
                        <span>{sealSize}px</span>
                      </div>
                      <input
                        type="range"
                        min="35"
                        max="130"
                        value={sealSize}
                        onChange={(e) => setSealSize(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* RIGHT COLUMN: LIVE CERTIFICATE / LETTERHEAD PREVIEW CANVAS (8 COLS) */}
          <div className="lg:col-span-8 flex flex-col">
            
            <div className="flex items-center justify-between px-2 pb-2">
              <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-600" />
                <span>Live Certificate / Letterhead Sheet Preview ({pageSize.toUpperCase()})</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={loadingData || isExporting}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800 hover:text-indigo-700 bg-white hover:bg-indigo-50 border border-slate-300 hover:border-indigo-300 px-2.5 py-1 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                  title="Print this sheet directly"
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Print Sheet</span>
                </button>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                  {scopeName} {tableType === 'member_annual_summary' ? '(Member Summation)' : ''}
                </span>
              </div>
            </div>

            {/* PREVIEW CANVAS SHEET / EXACT CERTIFICATE ELEMENT */}
            <div
              ref={certificateRef}
              id="official-certificate-sheet"
              className={`flex-1 bg-white p-5 sm:p-7 rounded-2xl sm:rounded-3xl border-2 border-slate-800 shadow-lg relative flex flex-col justify-between ${pageSize === 'legal' ? 'min-h-[780px]' : 'min-h-[640px]'}`}
            >
              {/* Outer & Inner Decorative Certificate Borders */}
              <div className="absolute inset-1.5 border-2 border-slate-800 rounded-2xl pointer-events-none"></div>
              <div className="absolute inset-3 border border-amber-600/40 rounded-xl pointer-events-none"></div>

              {/* TOP SECTION: LETTERHEAD + BODY GROUPED WITH TIGHT 1-LINE SPACING */}
              <div className="space-y-1.5 relative z-10">

                {/* LETTERHEAD SECTION */}
                <div className="text-center space-y-0.5">
                  <h3 className="font-heading font-black text-xs sm:text-sm uppercase tracking-wider text-slate-900 leading-tight">
                    Presbyterian Church of India
                  </h3>
                  <h4 className="font-heading font-extrabold text-xs sm:text-xs text-indigo-700 leading-tight">
                    Bethlehem Kohhran
                  </h4>

                  {/* Centered Church Logo (50% larger) */}
                  <div className="flex justify-center my-1">
                    <img
                      src={churchLogo}
                      alt="Church Logo"
                      className="w-16 h-16 sm:w-18 sm:h-18 object-contain rounded-full shadow-xs border border-amber-600/30 bg-white p-0.5"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <h2 className="font-heading font-black text-sm sm:text-base text-slate-950 uppercase tracking-tight leading-tight">
                      Pathian Ram Report
                    </h2>
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 font-bold text-[10.5px] leading-none">
                        {periodText}
                      </span>
                      {/* Centered Bial Name */}
                      <span className="text-center font-black text-slate-900 text-xs tracking-tight leading-tight">
                        {scopeName} {tableType === 'member_annual_summary' ? '• Member Summation' : ''}
                      </span>
                    </div>
                  </div>

                  <div className="w-20 h-0.5 bg-indigo-600 mx-auto mt-1 rounded-full"></div>
                </div>

                {/* EXACTLY 1 LINE GAP: DATE OF ISSUE ROW */}
                <div className="flex items-center justify-between text-xs px-0.5 pt-0.5 border-b border-slate-200 pb-1.5 mb-1">
                  <span className="text-xs font-bold text-slate-800">
                    Date of Issue: <span className="font-semibold text-slate-950">{issueDate}</span>
                  </span>
                  <span className="text-xs text-slate-600 font-bold">
                    Currency: INR (₹)
                  </span>
                </div>

                {/* BODY: CONSOLIDATED TOTALS CARDS */}
                <div className={`grid grid-cols-2 sm:grid-cols-5 ${orientation === 'landscape' ? 'gap-2.5 text-center' : 'gap-1.5 text-center'}`}>
                  {/* Summary Card 1: Pathian Ram */}
                  <div className={`bg-blue-50/90 rounded-xl border border-blue-200 ${orientation === 'landscape' ? 'p-2.5' : 'p-2'}`}>
                    <span className="text-[10px] sm:text-[11px] font-extrabold text-blue-900 uppercase block tracking-wider">Pathian Ram</span>
                    <span className={`font-bold text-blue-950 block mt-0.5 ${orientation === 'landscape' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'}`}>
                      ₹{(dynamicTotals.total_pathian_ram || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className={`bg-emerald-50/90 rounded-xl border border-emerald-200 ${orientation === 'landscape' ? 'p-2.5' : 'p-2'}`}>
                    <span className="text-[10px] sm:text-[11px] font-extrabold text-emerald-900 uppercase block tracking-wider">Ramthar</span>
                    <span className={`font-bold text-emerald-950 block mt-0.5 ${orientation === 'landscape' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'}`}>
                      ₹{(dynamicTotals.total_ramthar || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className={`bg-amber-50/90 rounded-xl border border-amber-200 ${orientation === 'landscape' ? 'p-2.5' : 'p-2'}`}>
                    <span className="text-[10px] sm:text-[11px] font-extrabold text-amber-900 uppercase block tracking-wider">Tualchhung</span>
                    <span className={`font-bold text-amber-950 block mt-0.5 ${orientation === 'landscape' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'}`}>
                      ₹{(dynamicTotals.total_tualchhung || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className={`bg-purple-50/90 rounded-xl border border-purple-200 ${orientation === 'landscape' ? 'p-2.5' : 'p-2'}`}>
                    <span className="text-[10px] sm:text-[11px] font-extrabold text-purple-900 uppercase block tracking-wider">Building</span>
                    <span className={`font-bold text-purple-950 block mt-0.5 ${orientation === 'landscape' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'}`}>
                      ₹{(dynamicTotals.total_building || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  {/* TOTAL Box in White with Amount in Black */}
                  <div className={`col-span-2 sm:col-span-1 bg-white rounded-xl border-2 border-slate-400 shadow-2xs ${orientation === 'landscape' ? 'p-2.5' : 'p-2'}`}>
                    <span className="text-[10px] sm:text-[11px] font-black text-slate-900 uppercase block tracking-wider">TOTAL</span>
                    <span className={`font-black text-slate-950 block mt-0.5 ${orientation === 'landscape' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'}`}>
                      ₹{(dynamicTotals.grand_total || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* DYNAMIC BREAKDOWN TABLE */}
                <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs mt-2">
                  <table className={`w-full text-left border-collapse ${orientation === 'landscape' ? 'text-xs' : 'text-[11px]'}`}>
                    <thead className={`bg-slate-100 border-b border-slate-300 font-extrabold text-slate-900 uppercase tracking-wider ${orientation === 'landscape' ? 'text-[11px]' : 'text-[10px]'}`}>
                      <tr>
                        <th className={`text-center w-8 ${orientation === 'landscape' ? 'py-2 px-2.5' : 'py-1.5 px-2'}`}>Sl</th>
                        <th className={`${orientation === 'landscape' ? 'py-2 px-3' : 'py-1.5 px-2.5'}`}>
                          {tableType === 'monthly_breakdown' ? 'Month' : (tableType === 'members' || tableType === 'member_annual_summary') ? 'Member Name' : 'Bial Name'}
                        </th>
                        {tableType === 'bials' && <th className={`text-center ${orientation === 'landscape' ? 'py-2 px-2.5' : 'py-1.5 px-2'}`}>Mem</th>}
                        <th className={`text-right ${orientation === 'landscape' ? 'py-2 px-3' : 'py-1.5 px-2'}`}>PTR (₹)</th>
                        <th className={`text-right ${orientation === 'landscape' ? 'py-2 px-3' : 'py-1.5 px-2'}`}>RT (₹)</th>
                        <th className={`text-right ${orientation === 'landscape' ? 'py-2 px-3' : 'py-1.5 px-2'}`}>Tch (₹)</th>
                        <th className={`text-right ${orientation === 'landscape' ? 'py-2 px-3' : 'py-1.5 px-2'}`}>Bldg (₹)</th>
                        <th className={`text-right font-black text-emerald-950 ${orientation === 'landscape' ? 'py-2 px-3.5' : 'py-1.5 px-2.5'}`}>Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-900 font-semibold">
                      {dynamicBreakdown.length === 0 ? (
                        <tr>
                          <td colSpan={tableType === 'bials' ? 8 : 7} className="py-6 text-center text-slate-500 font-bold text-xs">
                            {loadingData ? 'Loading report data...' : 'No contribution records found for this period.'}
                          </td>
                        </tr>
                      ) : (
                        dynamicBreakdown.map((item, idx) => (
                          <tr key={item.id || item.member_id || idx} className="hover:bg-slate-50">
                            <td className={`text-center text-slate-600 font-bold text-[10px] ${orientation === 'landscape' ? 'py-1.5 px-2.5' : 'py-1 px-2'}`}>{item.sl_no || idx + 1}</td>
                            <td className={`font-bold text-slate-950 ${orientation === 'landscape' ? 'py-1.5 px-3' : 'py-1 px-2.5'}`}>
                              {tableType === 'monthly_breakdown' ? item.month_name : (tableType === 'members' || tableType === 'member_annual_summary') ? (item.name || item.member_name) : (item.name || item.bial_name)}
                            </td>
                            {tableType === 'bials' && (
                              <td className={`text-center text-slate-700 font-bold ${orientation === 'landscape' ? 'py-1.5 px-2.5' : 'py-1 px-2'}`}>{item.member_count || '-'}</td>
                            )}
                            <td className={`text-right font-bold text-blue-900 ${orientation === 'landscape' ? 'py-1.5 px-3' : 'py-1 px-2'}`}>₹{(item.total_pathian_ram || item.pathian_ram || 0).toLocaleString('en-IN')}</td>
                            <td className={`text-right font-bold text-emerald-900 ${orientation === 'landscape' ? 'py-1.5 px-3' : 'py-1 px-2'}`}>₹{(item.total_ramthar || item.ramthar || 0).toLocaleString('en-IN')}</td>
                            <td className={`text-right font-bold text-amber-900 ${orientation === 'landscape' ? 'py-1.5 px-3' : 'py-1 px-2'}`}>₹{(item.total_tualchhung || item.tualchhung || 0).toLocaleString('en-IN')}</td>
                            <td className={`text-right font-bold text-purple-900 ${orientation === 'landscape' ? 'py-1.5 px-3' : 'py-1 px-2'}`}>₹{(item.total_building || item.building || 0).toLocaleString('en-IN')}</td>
                            <td className={`text-right font-black text-emerald-950 bg-emerald-50/50 ${orientation === 'landscape' ? 'py-1.5 px-3.5' : 'py-1 px-2.5'}`}>
                              ₹{(item.grand_total || item.total || item.total_collected || 0).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-950">
                      <tr>
                        <td className={`text-center font-bold text-[10px] ${orientation === 'landscape' ? 'py-2 px-2.5' : 'py-1.5 px-2'}`}></td>
                        <td className={`font-black uppercase ${orientation === 'landscape' ? 'py-2 px-3' : 'py-1.5 px-2.5'}`}>
                          {tableType === 'monthly_breakdown' ? 'ANNUAL TOTAL' : (tableType === 'members' || tableType === 'member_annual_summary') ? `GRAND TOTAL (${dynamicBreakdown.length} Members)` : 'GRAND TOTAL'}
                        </td>
                        {tableType === 'bials' && (
                          <td className={`text-center font-bold text-[10px] ${orientation === 'landscape' ? 'py-2 px-2.5' : 'py-1.5 px-2'}`}>
                            {dynamicBreakdown.reduce((acc, b) => acc + (b.member_count || 0), 0)}
                          </td>
                        )}
                        <td className={`text-right font-black text-blue-950 ${orientation === 'landscape' ? 'py-2 px-3' : 'py-1.5 px-2'}`}>₹{(dynamicTotals.total_pathian_ram || 0).toLocaleString('en-IN')}</td>
                        <td className={`text-right font-black text-emerald-950 ${orientation === 'landscape' ? 'py-2 px-3' : 'py-1.5 px-2'}`}>₹{(dynamicTotals.total_ramthar || 0).toLocaleString('en-IN')}</td>
                        <td className={`text-right font-black text-amber-950 ${orientation === 'landscape' ? 'py-2 px-3' : 'py-1.5 px-2'}`}>₹{(dynamicTotals.total_tualchhung || 0).toLocaleString('en-IN')}</td>
                        <td className={`text-right font-black text-purple-950 ${orientation === 'landscape' ? 'py-2 px-3' : 'py-1.5 px-2'}`}>₹{(dynamicTotals.total_building || 0).toLocaleString('en-IN')}</td>
                        <td className={`text-right font-black text-black bg-emerald-100/90 ${orientation === 'landscape' ? 'py-2 px-3.5' : 'py-1.5 px-2.5'}`}>
                          ₹{(dynamicTotals.grand_total || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

              </div>

              {/* FOOTER SIGNATORY & SEAL BLOCK */}
              <div className="pt-6 mt-auto relative z-10 text-xs">
                <div className="flex items-end justify-between gap-4">
                  
                  {/* Left Column: Empty Spacer */}
                  <div className="w-1/3 hidden sm:block"></div>

                  {/* Center Column: Uploaded Stamp / Seal (Admin Only) */}
                  <div className="w-1/3 flex items-center justify-center">
                    {isAdmin && sealBase64 ? (
                      <img
                        src={sealBase64}
                        alt="Official Seal"
                        style={{ width: `${sealSize}px`, height: `${sealSize}px` }}
                        className="object-contain"
                      />
                    ) : null}
                  </div>

                  {/* Right Column: Signatory Information */}
                  <div className="w-1/3 flex flex-col items-center justify-end text-center shrink-0">
                    {/* Uploaded Signature (Lands just above Designation/Name) */}
                    {isAdmin && signatureBase64 && (
                      <img
                        src={signatureBase64}
                        alt="Uploaded Signature"
                        style={{ height: `${signatureSize}px` }}
                        className="object-contain mb-1 max-w-[150px]"
                      />
                    )}

                    {/* Signatory Name */}
                    <div className={`text-xs sm:text-sm text-slate-950 font-black leading-normal ${nameBold ? 'font-black' : 'font-bold'} ${nameItalic ? 'italic' : ''} ${nameUnderline ? 'underline' : ''}`}>
                      {signatoryName || 'Authorised Signatory'}
                    </div>

                    {/* Signatory Designation */}
                    <div className={`text-xs text-slate-900 font-bold leading-normal mt-0.5 ${desigBold ? 'font-black' : 'font-bold'} ${desigItalic ? 'italic' : ''} ${desigUnderline ? 'underline' : ''}`}>
                      {signatoryDesignation || 'Treasurer'}
                    </div>

                    {/* Signatory Organization Name */}
                    <div className={`text-[11px] sm:text-xs text-slate-800 font-bold leading-normal mt-0.5 ${orgBold ? 'font-black' : 'font-medium'} ${orgItalic ? 'italic' : ''} ${orgUnderline ? 'underline' : ''}`}>
                      {signatoryOrganization || 'Presbyterian Church of India'}
                    </div>
                  </div>

                </div>
              </div>

            </div>

          </div>

        </div>

        {/* MODAL ACTION FOOTER */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Export formatted in <span className="font-bold text-slate-800">{pageSize.toUpperCase()}</span> ({orientation}) • <span className="text-indigo-600 font-semibold">{scopeName}</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handlePrint}
              disabled={loadingData || isExporting}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
              title={`Direct Print in ${pageSize.toUpperCase()} (${orientation})`}
            >
              <Printer className="w-4 h-4 text-slate-200" />
              <span>Print</span>
            </button>

            <button
              onClick={handleExportExcel}
              disabled={loadingData}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
              title="Export formatted Excel file"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export Excel</span>
            </button>

            {isAdmin && (
              <button
                onClick={handleExportPDF}
                disabled={isExporting || loadingData}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/25 transition-all disabled:opacity-50 cursor-pointer"
                title="Download official certificate PDF in A4 / Legal size"
              >
                <Download className="w-4 h-4" />
                <span>{isExporting ? 'Downloading PDF...' : `Download PDF (${pageSize.toUpperCase()})`}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
