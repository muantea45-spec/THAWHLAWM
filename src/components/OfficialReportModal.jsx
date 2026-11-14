import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  FileText, Download, FileSpreadsheet, Printer, X,
  Calendar, Building2, User, Award, Shield, CheckCircle2,
  Sliders, Layers, Sparkles, Loader2, RefreshCw, Upload, Image as ImageIcon,
  Bold, Italic, Underline, Users, BookOpen, Search
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
  const bookletRef = useRef(null);
  const [loadingData, setLoadingData] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPNG, setIsExportingPNG] = useState(false);
  const [isExportingBooklet, setIsExportingBooklet] = useState(false);
  const [logoBase64, setLogoBase64] = useState(null);

  // Preview Mode: 'certificate' | 'booklet'
  const [previewTab, setPreviewTab] = useState('certificate');
  const [bookletData, setBookletData] = useState(null);
  const [loadingBooklet, setLoadingBooklet] = useState(false);
  const [bookletSearch, setBookletSearch] = useState('');
  const [bookletBialFilter, setBookletBialFilter] = useState('all');

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

  // Load 12-month consolidated booklet data
  const loadBookletData = useCallback(async () => {
    try {
      setLoadingBooklet(true);
      const res = await api.getOverallMemberContributions(selectedYear);
      setBookletData(res);
    } catch (err) {
      console.error('Failed to load booklet data:', err);
      showToast(err.message || 'Failed to load consolidated booklet data', 'error');
    } finally {
      setLoadingBooklet(false);
    }
  }, [selectedYear, showToast]);

  // Compute continuous global Sl No starting from Bial 1 upwards across all Bials
  const processedBookletBials = useMemo(() => {
    if (!bookletData?.bials) return [];
    let globalSl = 1;
    return bookletData.bials.map(b => {
      const members = (b.members || []).map(m => ({
        ...m,
        booklet_sl_no: globalSl++
      }));
      return {
        ...b,
        members
      };
    });
  }, [bookletData]);

  // Filtered booklet bials based on search query and bial dropdown
  const filteredBookletBials = useMemo(() => {
    if (!processedBookletBials.length) return [];
    return processedBookletBials
      .filter(b => bookletBialFilter === 'all' || String(b.bial_id) === String(bookletBialFilter))
      .map(b => {
        if (!bookletSearch.trim()) return b;
        const q = bookletSearch.toLowerCase().trim();
        const filtered = b.members.filter(m =>
          (m.member_name || '').toLowerCase().includes(q)
        );
        return {
          ...b,
          members: filtered
        };
      })
      .filter(b => b.members.length > 0 || !bookletSearch.trim());
  }, [processedBookletBials, bookletBialFilter, bookletSearch]);

  const totalFilteredMembers = useMemo(() => {
    return filteredBookletBials.reduce((acc, b) => acc + (b.members?.length || 0), 0);
  }, [filteredBookletBials]);

  // Aggregate overall Booklet Household metrics (Total, Returned, Return Rate %)
  const { totalBookletHH, totalBookletReturned, overallBookletReturnRate } = useMemo(() => {
    if (!bookletData?.bials) return { totalBookletHH: 0, totalBookletReturned: 0, overallBookletReturnRate: 0 };
    let hh = 0;
    let ret = 0;
    bookletData.bials.forEach(b => {
      (b.members || []).forEach(m => {
        hh++;
        if ((parseFloat(m.grand_total || m.total) || 0) > 0) {
          ret++;
        }
      });
    });
    const rate = hh > 0 ? Math.round((ret / hh) * 1000) / 10 : 0;
    return { totalBookletHH: hh, totalBookletReturned: ret, overallBookletReturnRate: rate };
  }, [bookletData]);

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
                total_members: b.total_members || b.member_count || 0,
                returned_members: b.returned_members ?? (b.total > 0 ? (b.total_members || b.member_count || 0) : 0),
                return_rate: b.return_rate ?? ((b.total_members || b.member_count || 0) > 0 ? Math.round(((b.returned_members || 0) / (b.total_members || b.member_count || 0)) * 1000) / 10 : 0),
                avg_per_member: b.avg_per_member || (b.returned_members > 0 ? Math.round(b.total / b.returned_members) : 0),
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
                total_members: b.member_count || 0,
                returned_members: 0,
                return_rate: 0,
                avg_per_member: 0,
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

          const totalSysMembers = res.grandTotals?.total_system_members || breakdown.reduce((a, b) => a + (b.total_members || 0), 0);
          const totalRetMembers = res.grandTotals?.total_returned_members || breakdown.reduce((a, b) => a + (b.returned_members || 0), 0);
          const overallRetRate = res.grandTotals?.overall_return_rate ?? (
            totalSysMembers > 0 ? Math.round((totalRetMembers / totalSysMembers) * 1000) / 10 : 0
          );
          const grandTot = res.grandTotals?.grand_total || breakdown.reduce((a, b) => a + (b.total || 0), 0);
          const avgContrib = res.grandTotals?.avg_contribution_per_member || (
            totalRetMembers > 0 ? Math.round(grandTot / totalRetMembers) : 0
          );

          setDynamicBreakdown(breakdown);
          setDynamicTotals({
            total_pathian_ram: res.grandTotals?.total_pathian_ram || breakdown.reduce((a, b) => a + (b.pathian_ram || 0), 0),
            total_ramthar: res.grandTotals?.total_ramthar || breakdown.reduce((a, b) => a + (b.ramthar || 0), 0),
            total_tualchhung: res.grandTotals?.total_tualchhung || breakdown.reduce((a, b) => a + (b.tualchhung || 0), 0),
            total_building: res.grandTotals?.total_building || breakdown.reduce((a, b) => a + (b.building || 0), 0),
            grand_total: grandTot,
            total_system_members: totalSysMembers,
            total_returned_members: totalRetMembers,
            overall_return_rate: overallRetRate,
            avg_contribution_per_member: avgContrib
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
                total_members: b.total_members || b.member_count || 0,
                returned_members: b.returned_members ?? (b.total > 0 ? (b.total_members || b.member_count || 0) : 0),
                return_rate: b.return_rate ?? ((b.total_members || b.member_count || 0) > 0 ? Math.round(((b.returned_members || 0) / (b.total_members || b.member_count || 0)) * 1000) / 10 : 0),
                avg_per_member: b.avg_per_member || (b.returned_members > 0 ? Math.round(b.total / b.returned_members) : 0),
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
                total_members: b.member_count || 0,
                returned_members: 0,
                return_rate: 0,
                avg_per_member: 0,
                pathian_ram: 0,
                ramthar: 0,
                tualchhung: 0,
                building: 0,
                total: 0
              }));

          const totalSysMembers = res.grandTotals?.total_system_members || breakdown.reduce((a, b) => a + (b.total_members || 0), 0);
          const totalRetMembers = res.grandTotals?.total_returned_members || breakdown.reduce((a, b) => a + (b.returned_members || 0), 0);
          const overallRetRate = res.grandTotals?.overall_return_rate ?? (
            totalSysMembers > 0 ? Math.round((totalRetMembers / totalSysMembers) * 1000) / 10 : 0
          );
          const grandTot = res.grandTotals?.grand_total || breakdown.reduce((a, b) => a + (b.total || 0), 0);
          const avgContrib = res.grandTotals?.avg_contribution_per_member || (
            totalRetMembers > 0 ? Math.round(grandTot / totalRetMembers) : 0
          );

          setDynamicBreakdown(breakdown);
          setDynamicTotals({
            total_pathian_ram: res.grandTotals?.total_pathian_ram || breakdown.reduce((a, b) => a + (b.pathian_ram || 0), 0),
            total_ramthar: res.grandTotals?.total_ramthar || breakdown.reduce((a, b) => a + (b.ramthar || 0), 0),
            total_tualchhung: res.grandTotals?.total_tualchhung || breakdown.reduce((a, b) => a + (b.tualchhung || 0), 0),
            total_building: res.grandTotals?.total_building || breakdown.reduce((a, b) => a + (b.building || 0), 0),
            grand_total: grandTot,
            total_system_members: totalSysMembers,
            total_returned_members: totalRetMembers,
            overall_return_rate: overallRetRate,
            avg_contribution_per_member: avgContrib
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
          const membersList = summaryRes.memberTotals || [];
          const totalHH = membersList.length;
          const returnedHH = membersList.filter(m => (m.grand_total || m.total || 0) > 0).length;
          const retRate = totalHH > 0 ? Math.round((returnedHH / totalHH) * 1000) / 10 : 0;
          const gTot = summaryRes.grandTotals?.grand_total || 0;
          const avgPerHH = returnedHH > 0 ? Math.round(gTot / returnedHH) : 0;

          if (bialAnnualView === 'members') {
            // Member Annual Summary: Summation over the full year contributed by every member
            setTableType('member_annual_summary');
            setDynamicBreakdown(membersList);
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
            grand_total: gTot,
            total_system_members: totalHH,
            total_returned_members: returnedHH,
            overall_return_rate: retRate,
            avg_contribution_per_member: avgPerHH
          });
        } else if (selectedMonth === 'all') {
          // PARTICULAR BIAL + MONTHLY REPORT + ALL MONTHS
          setTableType('member_annual_summary');
          const summaryRes = await api.getYearlySummary(bId, selectedYear);
          const membersList = summaryRes.memberTotals || [];
          const totalHH = membersList.length;
          const returnedHH = membersList.filter(m => (m.grand_total || m.total || 0) > 0).length;
          const retRate = totalHH > 0 ? Math.round((returnedHH / totalHH) * 1000) / 10 : 0;
          const gTot = summaryRes.grandTotals?.grand_total || 0;
          const avgPerHH = returnedHH > 0 ? Math.round(gTot / returnedHH) : 0;

          setDynamicBreakdown(membersList);
          setDynamicTotals({
            total_pathian_ram: summaryRes.grandTotals?.total_pathian_ram || 0,
            total_ramthar: summaryRes.grandTotals?.total_ramthar || 0,
            total_tualchhung: summaryRes.grandTotals?.total_tualchhung || 0,
            total_building: summaryRes.grandTotals?.total_building || 0,
            grand_total: gTot,
            total_system_members: totalHH,
            total_returned_members: returnedHH,
            overall_return_rate: retRate,
            avg_contribution_per_member: avgPerHH
          });
        } else {
          // Member-level contributions for this Bial and specific Month
          setTableType('members');
          const tithesRes = await api.getTithes(bId, selectedYear, selectedMonth);
          const membersList = tithesRes.members || [];
          const totalHH = membersList.length;
          const returnedHH = membersList.filter(m => (m.total || m.grand_total || 0) > 0).length;
          const retRate = totalHH > 0 ? Math.round((returnedHH / totalHH) * 1000) / 10 : 0;
          const gTot = tithesRes.summary?.grand_total || 0;
          const avgPerHH = returnedHH > 0 ? Math.round(gTot / returnedHH) : 0;

          setDynamicBreakdown(membersList);
          setDynamicTotals({
            total_pathian_ram: tithesRes.summary?.sum_pathian_ram || 0,
            total_ramthar: tithesRes.summary?.sum_ramthar || 0,
            total_tualchhung: tithesRes.summary?.sum_tualchhung || 0,
            total_building: tithesRes.summary?.sum_building || 0,
            grand_total: gTot,
            total_system_members: totalHH,
            total_returned_members: returnedHH,
            overall_return_rate: retRate,
            avg_contribution_per_member: avgPerHH
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

      if (previewTab === 'booklet' && bookletRef.current) {
        printCertificateDirectly(bookletRef.current, `Pathian_Ram_Booklet_FY_${selectedYear}`, 'a4', 'landscape');
      } else if (certificateRef.current) {
        const safeScope = scopeName ? `_${scopeName.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
        const safeTitle = `Pathian_Ram_Official_Report_${reportType.replace(/[^a-zA-Z0-9]/g, '_')}${safeScope}_${selectedYear}`;
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

              {/* Live Preview Button */}
              <button
                type="button"
                onClick={() => {
                  setPreviewTab('booklet');
                  if (!bookletData || bookletData.year !== selectedYear) {
                    loadBookletData();
                  }
                }}
                className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-black text-white font-black text-xs shadow-xs transition-all cursor-pointer"
                title="Open interactive 2-column landscape preview of the Yearly Report Booklet"
              >
                <BookOpen className="w-4 h-4 text-amber-400" />
                <span>{previewTab === 'booklet' ? '✓ Currently Previewing Booklet' : 'Preview Booklet Here'}</span>
              </button>

              <div className="grid grid-cols-2 gap-2 pt-0.5">
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
                    <span>4. Signatory Details</span>
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

          {/* RIGHT COLUMN: PREVIEW CANVAS (CERTIFICATE OR BOOKLET) (8 COLS) */}
          <div className="lg:col-span-8 flex flex-col">
            
            {/* TAB SELECTOR: CERTIFICATE SHEET vs YEARLY REPORT BOOKLET */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2.5">
              <div className="flex items-center gap-1 bg-slate-200/90 p-1 rounded-xl shadow-2xs">
                <button
                  type="button"
                  onClick={() => setPreviewTab('certificate')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    previewTab === 'certificate'
                      ? 'bg-white text-black shadow-xs font-black'
                      : 'text-slate-600 hover:text-black font-semibold'
                  }`}
                >
                  <Award className="w-3.5 h-3.5 text-black" />
                  <span>Report Form & Certificate</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewTab('booklet');
                    if (!bookletData || bookletData.year !== selectedYear) {
                      loadBookletData();
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    previewTab === 'booklet'
                      ? 'bg-white text-black shadow-xs font-black'
                      : 'text-slate-600 hover:text-black font-semibold'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 text-black" />
                  <span>Yearly Report Booklet (2-Col A4)</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {previewTab === 'certificate' ? (
                  <>
                    <button
                      type="button"
                      onClick={handlePrint}
                      disabled={loadingData || isExporting}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-black hover:bg-slate-100 bg-white border border-slate-300 px-2.5 py-1.5 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                      title="Print this sheet directly"
                    >
                      <Printer className="w-3.5 h-3.5 text-black" />
                      <span>Print Sheet</span>
                    </button>
                    <span className="text-[10px] font-bold text-black bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-full">
                      {scopeName} {tableType === 'member_annual_summary' ? '(Member Summation)' : ''}
                    </span>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handlePrint}
                      disabled={loadingBooklet}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-black hover:bg-slate-100 bg-white border border-slate-300 px-2.5 py-1.5 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                      title="Print booklet directly"
                    >
                      <Printer className="w-3.5 h-3.5 text-black" />
                      <span>Print</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportConsolidatedBookletPDF}
                      disabled={isExportingBooklet}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1.5 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                      title="Download Consolidated Booklet PDF"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Booklet PDF</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* PREVIEW CONTAINER: SWITCHES BETWEEN CERTIFICATE AND YEARLY REPORT BOOKLET */}
            {previewTab === 'certificate' ? (
              /* PREVIEW CANVAS SHEET / EXACT CERTIFICATE ELEMENT */
              <div
                ref={certificateRef}
                id="official-certificate-sheet"
                className={`flex-1 bg-white text-black p-5 sm:p-7 rounded-2xl sm:rounded-3xl border-2 border-black shadow-lg relative flex flex-col justify-between ${pageSize === 'legal' ? 'min-h-[780px]' : 'min-h-[640px]'}`}
              >
                {/* Outer & Inner Decorative Certificate Borders */}
                <div className="absolute inset-1.5 border-2 border-black rounded-2xl pointer-events-none"></div>
                <div className="absolute inset-3 border border-black/30 rounded-xl pointer-events-none"></div>

                {/* TOP SECTION: LETTERHEAD + BODY GROUPED WITH TIGHT 1-LINE SPACING */}
                <div className="space-y-1.5 relative z-10">

                  {/* LETTERHEAD SECTION (100% BLACK TEXT) */}
                  <div className="text-center space-y-0.5">
                    <h3 className="font-heading font-black text-xs sm:text-sm uppercase tracking-wider text-black leading-tight">
                      Presbyterian Church of India
                    </h3>
                    <h4 className="font-heading font-extrabold text-xs sm:text-xs text-black leading-tight">
                      Bethlehem Kohhran
                    </h4>

                    {/* Centered Church Logo */}
                    <div className="flex justify-center my-1">
                      <img
                        src={churchLogo}
                        alt="Church Logo"
                        className="w-16 h-16 sm:w-18 sm:h-18 object-contain rounded-full shadow-xs border border-black/30 bg-white p-0.5"
                      />
                    </div>

                    <div className="space-y-0.5">
                      <h2 className="font-heading font-black text-sm sm:text-base text-black uppercase tracking-tight leading-tight">
                        Pathian Ram Report
                      </h2>
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-300 text-black font-bold text-[10.5px] leading-none">
                          {periodText}
                        </span>
                        {/* Centered Bial Name */}
                        <span className="text-center font-black text-black text-xs tracking-tight leading-tight">
                          {scopeName} {tableType === 'member_annual_summary' ? '• Member Summation' : ''}
                        </span>
                      </div>
                    </div>

                    <div className="w-20 h-0.5 bg-black mx-auto mt-1 rounded-full"></div>
                  </div>

                  {/* EXACTLY 1 LINE GAP: DATE OF ISSUE ROW */}
                  <div className="flex items-center justify-between text-xs px-0.5 pt-0.5 border-b border-black/30 pb-1.5 mb-1 text-black font-bold">
                    <span className="text-xs font-bold text-black">
                      Date of Issue: <span className="font-extrabold text-black">{issueDate}</span>
                    </span>
                    <span className="text-xs text-black font-bold">
                      Currency: INR (₹)
                    </span>
                  </div>

                  {/* BODY: CONSOLIDATED TOTALS CARDS (100% BLACK TEXT) */}
                  <div className={`grid grid-cols-2 sm:grid-cols-5 ${orientation === 'landscape' ? 'gap-2.5 text-center' : 'gap-1.5 text-center'}`}>
                    {/* Summary Card 1: Pathian Ram */}
                    <div className={`bg-slate-50 rounded-xl border border-slate-300 ${orientation === 'landscape' ? 'p-2.5' : 'p-2'}`}>
                      <span className="text-[10px] sm:text-[11px] font-extrabold text-black uppercase block tracking-wider">Pathian Ram</span>
                      <span className={`font-bold text-black block mt-0.5 ${orientation === 'landscape' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'}`}>
                        ₹{(dynamicTotals.total_pathian_ram || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    {/* Summary Card 2: Ramthar */}
                    <div className={`bg-slate-50 rounded-xl border border-slate-300 ${orientation === 'landscape' ? 'p-2.5' : 'p-2'}`}>
                      <span className="text-[10px] sm:text-[11px] font-extrabold text-black uppercase block tracking-wider">Ramthar</span>
                      <span className={`font-bold text-black block mt-0.5 ${orientation === 'landscape' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'}`}>
                        ₹{(dynamicTotals.total_ramthar || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    {/* Summary Card 3: Tualchhung */}
                    <div className={`bg-slate-50 rounded-xl border border-slate-300 ${orientation === 'landscape' ? 'p-2.5' : 'p-2'}`}>
                      <span className="text-[10px] sm:text-[11px] font-extrabold text-black uppercase block tracking-wider">Tualchhung</span>
                      <span className={`font-bold text-black block mt-0.5 ${orientation === 'landscape' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'}`}>
                        ₹{(dynamicTotals.total_tualchhung || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    {/* Summary Card 4: Building */}
                    <div className={`bg-slate-50 rounded-xl border border-slate-300 ${orientation === 'landscape' ? 'p-2.5' : 'p-2'}`}>
                      <span className="text-[10px] sm:text-[11px] font-extrabold text-black uppercase block tracking-wider">Building</span>
                      <span className={`font-bold text-black block mt-0.5 ${orientation === 'landscape' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'}`}>
                        ₹{(dynamicTotals.total_building || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    {/* Summary Card 5: TOTAL */}
                    <div className={`col-span-2 sm:col-span-1 bg-white rounded-xl border-2 border-black shadow-2xs ${orientation === 'landscape' ? 'p-2.5' : 'p-2'}`}>
                      <span className="text-[10px] sm:text-[11px] font-black text-black uppercase block tracking-wider">TOTAL</span>
                      <span className={`font-black text-black block mt-0.5 ${orientation === 'landscape' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'}`}>
                        ₹{(dynamicTotals.grand_total || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* HOUSEHOLD RETURN RATE & PARTICIPATION SUMMARY (100% BLACK TEXT) */}
                  <div className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs text-black">
                    <div className="flex items-center gap-2.5 sm:gap-4 text-xs">
                      <div>
                        <span className="text-[9px] uppercase font-extrabold tracking-wider text-black block">Total Households</span>
                        <span className="font-black text-black text-xs sm:text-sm">
                          {dynamicTotals.total_system_members || dynamicBreakdown.length || 0} HH
                        </span>
                      </div>
                      <div className="h-5 w-px bg-slate-300"></div>
                      <div>
                        <span className="text-[9px] uppercase font-extrabold tracking-wider text-black block">Households Returned</span>
                        <span className="font-black text-black text-xs sm:text-sm">
                          {dynamicTotals.total_returned_members || dynamicBreakdown.filter(m => (m.grand_total || m.total || 0) > 0).length || 0} HH
                        </span>
                      </div>
                      <div className="h-5 w-px bg-slate-300"></div>
                      <div>
                        <span className="text-[9px] uppercase font-extrabold tracking-wider text-black block">Return Rate per Household</span>
                        <span className="font-black text-black text-xs sm:text-sm">
                          {dynamicTotals.overall_return_rate !== undefined ? `${dynamicTotals.overall_return_rate}%` : 'N/A'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <span className="text-[9px] uppercase font-extrabold tracking-wider text-black block">Avg / Household</span>
                      <span className="font-black text-black text-xs sm:text-sm">
                        ₹{(dynamicTotals.avg_contribution_per_member || (dynamicTotals.total_returned_members > 0 ? Math.round(dynamicTotals.grand_total / dynamicTotals.total_returned_members) : 0)).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* DYNAMIC BREAKDOWN TABLE (100% BLACK TEXT) */}
                  <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs mt-2">
                    <table className={`w-full text-left border-collapse text-black ${orientation === 'landscape' ? 'text-xs' : 'text-[11px]'}`}>
                      <thead className={`bg-slate-100 border-b-2 border-black font-extrabold text-black uppercase tracking-wider ${orientation === 'landscape' ? 'text-[11px]' : 'text-[10px]'}`}>
                        <tr>
                          <th className={`text-center w-8 text-black ${orientation === 'landscape' ? 'py-2 px-2.5' : 'py-1.5 px-2'}`}>Sl</th>
                          <th className={`text-black ${orientation === 'landscape' ? 'py-2 px-3' : 'py-1.5 px-2.5'}`}>
                            {tableType === 'monthly_breakdown' ? 'Month' : (tableType === 'members' || tableType === 'member_annual_summary') ? 'Member Name' : 'Bial Name'}
                          </th>
                          {tableType === 'bials' && (
                            <>
                              <th className={`text-center text-black ${orientation === 'landscape' ? 'py-2 px-2' : 'py-1.5 px-1.5'}`}>HH</th>
                              <th className={`text-center text-black ${orientation === 'landscape' ? 'py-2 px-2' : 'py-1.5 px-1.5'}`}>Ret</th>
                              <th className={`text-center text-black ${orientation === 'landscape' ? 'py-2 px-2' : 'py-1.5 px-1.5'}`}>Return %</th>
                            </>
                          )}
                          <th className={`text-right text-black ${orientation === 'landscape' ? 'py-2 px-3' : 'py-1.5 px-2'}`}>PTR (₹)</th>
                          <th className={`text-right text-black ${orientation === 'landscape' ? 'py-2 px-3' : 'py-1.5 px-2'}`}>RT (₹)</th>
                          <th className={`text-right text-black ${orientation === 'landscape' ? 'py-2 px-3' : 'py-1.5 px-2'}`}>Tch (₹)</th>
                          <th className={`text-right text-black ${orientation === 'landscape' ? 'py-2 px-3' : 'py-1.5 px-2'}`}>Bldg (₹)</th>
                          <th className={`text-right font-black text-black ${orientation === 'landscape' ? 'py-2 px-3.5' : 'py-1.5 px-2.5'}`}>Total (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-black font-semibold">
                        {dynamicBreakdown.length === 0 ? (
                          <tr>
                            <td colSpan={tableType === 'bials' ? 10 : 7} className="py-6 text-center text-black font-bold text-xs">
                              {loadingData ? 'Loading report data...' : 'No contribution records found for this period.'}
                            </td>
                          </tr>
                        ) : (
                          dynamicBreakdown.map((item, idx) => (
                            <tr key={item.id || item.member_id || idx} className="hover:bg-slate-50">
                              <td className={`text-center text-black font-bold text-[10px] ${orientation === 'landscape' ? 'py-1.5 px-2.5' : 'py-1 px-2'}`}>{item.sl_no || idx + 1}</td>
                              <td className={`font-bold text-black ${orientation === 'landscape' ? 'py-1.5 px-3' : 'py-1 px-2.5'}`}>
                                {tableType === 'monthly_breakdown' ? item.month_name : (tableType === 'members' || tableType === 'member_annual_summary') ? (item.name || item.member_name) : (item.name || item.bial_name)}
                              </td>
                              {tableType === 'bials' && (
                                <>
                                  <td className={`text-center text-black font-bold ${orientation === 'landscape' ? 'py-1.5 px-2' : 'py-1 px-1.5'}`}>
                                    {item.total_members || item.member_count || '-'}
                                  </td>
                                  <td className={`text-center text-black font-bold ${orientation === 'landscape' ? 'py-1.5 px-2' : 'py-1 px-1.5'}`}>
                                    {item.returned_members ?? '-'}
                                  </td>
                                  <td className={`text-center text-black font-black ${orientation === 'landscape' ? 'py-1.5 px-2' : 'py-1 px-1.5'}`}>
                                    {item.return_rate !== undefined ? `${item.return_rate}%` : '-'}
                                  </td>
                                </>
                              )}
                              <td className={`text-right font-medium text-black ${orientation === 'landscape' ? 'py-1.5 px-3' : 'py-1 px-2'}`}>₹{(item.total_pathian_ram || item.pathian_ram || 0).toLocaleString('en-IN')}</td>
                              <td className={`text-right font-medium text-black ${orientation === 'landscape' ? 'py-1.5 px-3' : 'py-1 px-2'}`}>₹{(item.total_ramthar || item.ramthar || 0).toLocaleString('en-IN')}</td>
                              <td className={`text-right font-medium text-black ${orientation === 'landscape' ? 'py-1.5 px-3' : 'py-1 px-2'}`}>₹{(item.total_tualchhung || item.tualchhung || 0).toLocaleString('en-IN')}</td>
                              <td className={`text-right font-medium text-black ${orientation === 'landscape' ? 'py-1.5 px-3' : 'py-1 px-2'}`}>₹{(item.total_building || item.building || 0).toLocaleString('en-IN')}</td>
                              <td className={`text-right font-bold text-black bg-slate-50 ${orientation === 'landscape' ? 'py-1.5 px-3.5' : 'py-1 px-2.5'}`}>
                                ₹{(item.grand_total || item.total || item.total_collected || 0).toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot className="bg-slate-100 font-bold border-t-2 border-black text-black">
                        <tr>
                          <td className={`text-center font-bold text-[10px] ${orientation === 'landscape' ? 'py-2 px-2.5' : 'py-1.5 px-2'}`}></td>
                          <td className={`font-black uppercase text-black ${orientation === 'landscape' ? 'py-2 px-3' : 'py-1.5 px-2.5'}`}>
                            {tableType === 'monthly_breakdown' ? 'ANNUAL TOTAL' : (tableType === 'members' || tableType === 'member_annual_summary') ? `GRAND TOTAL (${dynamicBreakdown.length} Members)` : 'GRAND TOTAL'}
                          </td>
                          {tableType === 'bials' && (
                            <>
                              <td className={`text-center font-black text-[10px] text-black ${orientation === 'landscape' ? 'py-2 px-2' : 'py-1.5 px-1.5'}`}>
                                {dynamicTotals.total_system_members || dynamicBreakdown.reduce((acc, b) => acc + (b.total_members || b.member_count || 0), 0)}
                              </td>
                              <td className={`text-center font-black text-[10px] text-black ${orientation === 'landscape' ? 'py-2 px-2' : 'py-1.5 px-1.5'}`}>
                                {dynamicTotals.total_returned_members || dynamicBreakdown.reduce((acc, b) => acc + (b.returned_members || 0), 0)}
                              </td>
                              <td className={`text-center font-black text-[10px] text-black ${orientation === 'landscape' ? 'py-2 px-2' : 'py-1.5 px-1.5'}`}>
                                {dynamicTotals.overall_return_rate !== undefined ? `${dynamicTotals.overall_return_rate}%` : '-'}
                              </td>
                            </>
                          )}
                          <td className={`text-right font-black text-black ${orientation === 'landscape' ? 'py-2 px-3' : 'py-1.5 px-2'}`}>₹{(dynamicTotals.total_pathian_ram || 0).toLocaleString('en-IN')}</td>
                          <td className={`text-right font-black text-black ${orientation === 'landscape' ? 'py-2 px-3' : 'py-1.5 px-2'}`}>₹{(dynamicTotals.total_ramthar || 0).toLocaleString('en-IN')}</td>
                          <td className={`text-right font-black text-black ${orientation === 'landscape' ? 'py-2 px-3' : 'py-1.5 px-2'}`}>₹{(dynamicTotals.total_tualchhung || 0).toLocaleString('en-IN')}</td>
                          <td className={`text-right font-black text-black ${orientation === 'landscape' ? 'py-2 px-3' : 'py-1.5 px-2'}`}>₹{(dynamicTotals.total_building || 0).toLocaleString('en-IN')}</td>
                          <td className={`text-right font-black text-black bg-slate-200 border-l border-black/30 ${orientation === 'landscape' ? 'py-2 px-3.5' : 'py-1.5 px-2.5'}`}>
                            ₹{(dynamicTotals.grand_total || 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                </div>

                {/* FOOTER SIGNATORY & SEAL BLOCK (100% BLACK TEXT) */}
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

                    {/* Right Column: Signatory Information (100% Black) */}
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
                      <div className={`text-xs sm:text-sm text-black font-black leading-normal ${nameBold ? 'font-black' : 'font-bold'} ${nameItalic ? 'italic' : ''} ${nameUnderline ? 'underline' : ''}`}>
                        {signatoryName || 'Authorised Signatory'}
                      </div>

                      {/* Signatory Designation */}
                      <div className={`text-xs text-black font-bold leading-normal mt-0.5 ${desigBold ? 'font-black' : 'font-bold'} ${desigItalic ? 'italic' : ''} ${desigUnderline ? 'underline' : ''}`}>
                        {signatoryDesignation || 'Treasurer'}
                      </div>

                      {/* Signatory Organization Name */}
                      <div className={`text-[11px] sm:text-xs text-black font-semibold leading-normal mt-0.5 ${orgBold ? 'font-black' : 'font-medium'} ${orgItalic ? 'italic' : ''} ${orgUnderline ? 'underline' : ''}`}>
                        {signatoryOrganization || 'Presbyterian Church of India'}
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            ) : (
              /* LIVE PREVIEW OF YEARLY REPORT BOOKLET (2-COLUMN LANDSCAPE A4) */
              <div
                ref={bookletRef}
                id="yearly-report-booklet-preview"
                className="flex-1 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border-2 border-black shadow-lg relative flex flex-col text-black min-h-[640px]"
              >
                {/* Decorative Booklet Borders */}
                <div className="absolute inset-1.5 border-2 border-black rounded-2xl pointer-events-none"></div>
                <div className="absolute inset-3 border border-black/30 rounded-xl pointer-events-none"></div>

                {/* Booklet Sheet Header */}
                <div className="relative z-10 text-center space-y-1 pb-2.5 border-b-2 border-black mb-3">
                  <div className="flex justify-center mb-1">
                    <img
                      src={churchLogo}
                      alt="Church Logo"
                      className="w-14 h-14 object-contain rounded-full border border-black/30 bg-white p-0.5"
                    />
                  </div>
                  <h3 className="font-heading font-black text-xs uppercase tracking-wider text-black">
                    Presbyterian Church of India
                  </h3>
                  <h2 className="font-heading font-black text-base sm:text-lg uppercase tracking-tight text-black">
                    BETHLEHEM KOHHRAN — PATHIAN RAM
                  </h2>
                  <div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5">
                    <span className="px-3 py-0.5 rounded-full bg-slate-100 border border-slate-300 text-black font-extrabold text-xs">
                      CONSOLIDATED ANNUAL MEMBER BOOKLET (FY {selectedYear} - {selectedYear + 1})
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-300 text-black font-bold text-xs">
                      2-Column Landscape A4 • Continuous Sl No across Bial 1 to Bial 12
                    </span>
                  </div>
                  <div className="w-24 h-0.5 bg-black mx-auto mt-1 rounded-full"></div>
                </div>

                {/* Search & Bial filter toolbar */}
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 mb-3 bg-slate-50 p-2.5 rounded-xl border border-slate-300">
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <div className="relative w-full">
                      <Search className="w-3.5 h-3.5 text-black absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search member name across all bials..."
                        value={bookletSearch}
                        onChange={(e) => setBookletSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-white border border-slate-300 text-black font-bold placeholder:text-slate-400 focus:outline-none focus:border-black"
                      />
                    </div>
                    {bookletSearch && (
                      <button
                        type="button"
                        onClick={() => setBookletSearch('')}
                        className="text-xs text-black font-bold hover:underline shrink-0 px-1 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={bookletBialFilter}
                      onChange={(e) => setBookletBialFilter(e.target.value)}
                      className="px-2.5 py-1.5 text-xs rounded-lg bg-white border border-slate-300 text-black font-bold focus:outline-none focus:border-black cursor-pointer"
                    >
                      <option value="all">🌟 All Bials (1 to 12)</option>
                      {processedBookletBials.map(b => (
                        <option key={b.bial_id} value={b.bial_id}>
                          📍 {b.bial_code ? `${b.bial_code} - ` : ''}{b.bial_name} ({b.members?.length || 0})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={loadBookletData}
                      disabled={loadingBooklet}
                      className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-black cursor-pointer shadow-2xs"
                      title="Refresh booklet data"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingBooklet ? 'animate-spin' : ''}`} />
                    </button>

                    <span className="text-[11px] font-bold text-black bg-white border border-slate-300 px-2.5 py-1 rounded-lg">
                      {totalFilteredMembers} Members
                    </span>
                  </div>
                </div>

                {/* Content area: 2-Column layout */}
                <div className="relative z-10 flex-1 overflow-y-auto max-h-[560px] pr-1 space-y-3">
                  {loadingBooklet ? (
                    <div className="py-20 flex flex-col items-center justify-center text-center text-black">
                      <Loader2 className="w-8 h-8 animate-spin text-black mb-3" />
                      <span className="font-bold text-sm">Compiling 12-Month Consolidated Booklet...</span>
                      <span className="text-xs text-black font-medium mt-1">Aggregating records across all 12 Bials</span>
                    </div>
                  ) : !bookletData || !bookletData.bials || filteredBookletBials.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center text-center text-black">
                      <BookOpen className="w-10 h-10 text-slate-400 mb-2" />
                      <span className="font-bold text-sm">
                        {bookletSearch ? 'No members found matching your search.' : 'No booklet data available.'}
                      </span>
                      <button
                        type="button"
                        onClick={loadBookletData}
                        className="mt-3 px-4 py-1.5 rounded-xl bg-black text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
                      >
                        Load 12-Month Booklet Data
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* 2-COLUMN BOOKLET GRID (A4 LANDSCAPE SIMULATION) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                        {filteredBookletBials.map((bial) => {
                          const sub = bial.subtotal || {};
                          return (
                            <div
                              key={bial.bial_id}
                              className="border border-slate-300 rounded-xl overflow-hidden bg-white shadow-2xs"
                            >
                              {/* Bial Banner Header (With Household Return Rate) */}
                              {(() => {
                                const totalHH = bial.members.length;
                                const returnedHH = bial.members.filter(m => (parseFloat(m.grand_total || m.total) || 0) > 0).length;
                                const returnRate = totalHH > 0 ? Math.round((returnedHH / totalHH) * 1000) / 10 : 0;
                                return (
                                  <>
                                    <div className="bg-slate-100 border-b border-black/40 px-3 py-1.5 flex flex-wrap items-center justify-between gap-1.5 text-black font-black text-xs">
                                      <span>📍 {bial.bial_code ? `${bial.bial_code} - ` : ''}{bial.bial_name}</span>
                                      <div className="flex items-center gap-1.5 text-[10px] font-bold">
                                        <span className="bg-white px-2 py-0.5 rounded border border-slate-300">
                                          {totalHH} HH
                                        </span>
                                        <span className="bg-white px-2 py-0.5 rounded border border-slate-300">
                                          {returnedHH} Returned
                                        </span>
                                        <span className="bg-slate-200 px-2 py-0.5 rounded border border-black/40 font-black">
                                          {returnRate}% Return Rate
                                        </span>
                                      </div>
                                    </div>

                                    {/* Table with continuous Sl No */}
                                    <table className="w-full text-left border-collapse text-black text-[10px]">
                                      <thead className="bg-slate-50 border-b border-black/30 font-extrabold uppercase text-[9px]">
                                        <tr>
                                          <th className="py-1 px-1.5 text-center w-8">Sl</th>
                                          <th className="py-1 px-2">Member Name</th>
                                          <th className="py-1 px-1 text-right">PTR (₹)</th>
                                          <th className="py-1 px-1 text-right">RT (₹)</th>
                                          <th className="py-1 px-1 text-right">Tch (₹)</th>
                                          <th className="py-1 px-1 text-right">Bldg (₹)</th>
                                          <th className="py-1 px-2 text-right">Total (₹)</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-200">
                                        {bial.members.map((m) => (
                                          <tr key={m.member_id} className="hover:bg-slate-50 even:bg-slate-50/50">
                                            <td className="py-1 px-1.5 text-center font-bold text-black">{m.booklet_sl_no}</td>
                                            <td className="py-1 px-2 font-semibold text-black truncate max-w-[130px]">{m.member_name}</td>
                                            <td className="py-1 px-1 text-right text-black font-medium">{m.pathian_ram ? m.pathian_ram.toLocaleString('en-IN') : '-'}</td>
                                            <td className="py-1 px-1 text-right text-black font-medium">{m.ramthar ? m.ramthar.toLocaleString('en-IN') : '-'}</td>
                                            <td className="py-1 px-1 text-right text-black font-medium">{m.tualchhung ? m.tualchhung.toLocaleString('en-IN') : '-'}</td>
                                            <td className="py-1 px-1 text-right text-black font-medium">{m.building ? m.building.toLocaleString('en-IN') : '-'}</td>
                                            <td className="py-1 px-2 text-right text-black font-bold">{m.grand_total ? `₹${m.grand_total.toLocaleString('en-IN')}` : '₹0'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                      <tfoot className="bg-slate-100 border-t-2 border-black text-black font-black text-[9.5px]">
                                        <tr>
                                          <td colSpan={2} className="py-1 px-2 uppercase font-extrabold">
                                            Subtotal ({bial.bial_code || bial.bial_name}) • {returnRate}% Return Rate ({returnedHH}/{totalHH} HH)
                                          </td>
                                          <td className="py-1 px-1 text-right">{(sub.total_pathian_ram || 0).toLocaleString('en-IN')}</td>
                                          <td className="py-1 px-1 text-right">{(sub.total_ramthar || 0).toLocaleString('en-IN')}</td>
                                          <td className="py-1 px-1 text-right">{(sub.total_tualchhung || 0).toLocaleString('en-IN')}</td>
                                          <td className="py-1 px-1 text-right">{(sub.total_building || 0).toLocaleString('en-IN')}</td>
                                          <td className="py-1 px-2 text-right font-black bg-slate-200">₹{(sub.grand_total || 0).toLocaleString('en-IN')}</td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </>
                                );
                              })()}
                            </div>
                          );
                        })}
                      </div>

                      {/* KOHHRAN GRAND TOTAL BANNER AT BOTTOM (100% BLACK TEXT) */}
                      <div className="mt-4 bg-slate-100 text-black rounded-xl p-3.5 border-2 border-black flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
                        <div>
                          <h4 className="font-heading font-black text-sm uppercase tracking-wider text-black">
                            KOHHRAN GRAND TOTAL ({totalBookletHH} Households • {totalBookletReturned} Returned • {overallBookletReturnRate}% Return Rate)
                          </h4>
                          <p className="text-[11px] text-black font-semibold mt-0.5">
                            PTR: ₹{(bookletData.churchGrandTotal?.total_pathian_ram || 0).toLocaleString('en-IN')} • 
                            RT: ₹{(bookletData.churchGrandTotal?.total_ramthar || 0).toLocaleString('en-IN')} • 
                            Tch: ₹{(bookletData.churchGrandTotal?.total_tualchhung || 0).toLocaleString('en-IN')} • 
                            Bldg: ₹{(bookletData.churchGrandTotal?.total_building || 0).toLocaleString('en-IN')}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-black block">Avg / Household</span>
                          <span className="text-xs font-bold text-black block mb-0.5">
                            ₹{(totalBookletReturned > 0 ? Math.round((bookletData.churchGrandTotal?.grand_total || 0) / totalBookletReturned) : 0).toLocaleString('en-IN')}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-black block">Total Collections</span>
                          <span className="text-base sm:text-lg font-black text-black">
                            ₹{(bookletData.churchGrandTotal?.grand_total || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      {/* Booklet Footer Note */}
                      <div className="mt-2 text-center text-[10px] text-black font-semibold">
                        Bethlehem Kohhran • Consolidated Annual Booklet (12-Month Aggregated) • FY {selectedYear}-{selectedYear + 1}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

          </div>

        </div>

        {/* MODAL ACTION FOOTER */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            {previewTab === 'booklet' ? (
              <>Viewing <span className="font-bold text-slate-800">Consolidated Annual Booklet (2-Col A4)</span> • Landscape • FY {selectedYear}-{selectedYear + 1}</>
            ) : (
              <>Export formatted in <span className="font-bold text-slate-800">{pageSize.toUpperCase()}</span> ({orientation}) • <span className="text-indigo-600 font-semibold">{scopeName}</span></>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {previewTab === 'booklet' ? (
              <>
                <button
                  onClick={handlePrint}
                  disabled={loadingBooklet}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                  title="Direct Print Booklet (Landscape A4)"
                >
                  <Printer className="w-4 h-4 text-slate-200" />
                  <span>Print</span>
                </button>

                <button
                  onClick={handleExportConsolidatedBookletExcel}
                  disabled={isExportingBooklet}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                  title="Download Consolidated Booklet Excel"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Booklet Excel</span>
                </button>

                <button
                  onClick={handleExportConsolidatedBookletPDF}
                  disabled={isExportingBooklet}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/25 transition-all disabled:opacity-50 cursor-pointer"
                  title="Download Consolidated Booklet PDF (2-Column Landscape A4)"
                >
                  <Download className="w-4 h-4" />
                  <span>{isExportingBooklet ? 'Downloading...' : 'Download Booklet PDF (A4)'}</span>
                </button>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
