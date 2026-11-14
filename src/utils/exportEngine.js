import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas-pro';
import { pdf } from '@react-pdf/renderer';
import React from 'react';
import OfficialReportPDFDocument from '../components/OfficialReportPDFDocument';
import { DEFAULT_TITHE_COLUMNS } from './constants';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Excel Export (.xlsx)
 */
export function exportToExcel({ bialName, year, month, members, summary, columns }) {
  const cols = (columns && columns.length > 0) ? columns : DEFAULT_TITHE_COLUMNS;
  const monthName = MONTH_NAMES[month - 1] || month;
  const hasBialCol = members.some(m => m.bial_name);

  // Header rows
  const headerCols = hasBialCol
    ? ['Sl No', 'HMING (Member Name)', 'Bial', ...cols.map(c => `${c.name} (${c.code})`), 'TOTAL']
    : ['Sl No', 'HMING (Member Name)', ...cols.map(c => `${c.name} (${c.code})`), 'TOTAL'];

  const sheetData = [
    ['PATHIAN RAM TITHE COLLECTION LEDGER'],
    [`Bial Name: ${bialName}`],
    [`Period: ${monthName} ${year}`],
    ['Generated On: ' + new Date().toLocaleString()],
    [], // empty row
    headerCols
  ];

  // Data rows
  members.forEach((m, idx) => {
    const rowAmounts = cols.map(c => m[c.field_key] || 0);
    if (hasBialCol) {
      sheetData.push([
        m.sl_no || idx + 1,
        m.name,
        m.bial_name || '',
        ...rowAmounts,
        m.total || 0
      ]);
    } else {
      sheetData.push([
        m.sl_no || idx + 1,
        m.name,
        ...rowAmounts,
        m.total || 0
      ]);
    }
  });

  // Summary Footer Row
  const footerAmounts = cols.map(c => summary[c.field_key] ?? summary[`sum_${c.field_key}`] ?? 0);
  if (hasBialCol) {
    sheetData.push([
      'TOTAL',
      `Total Members: ${members.length}`,
      '',
      ...footerAmounts,
      summary.grand_total || 0
    ]);
  } else {
    sheetData.push([
      'TOTAL',
      `Total Members: ${members.length}`,
      ...footerAmounts,
      summary.grand_total || 0
    ]);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

  // Set Column Widths
  worksheet['!cols'] = [
    { wch: 8 },
    { wch: 28 },
    ...(hasBialCol ? [{ wch: 20 }] : []),
    ...cols.map(() => ({ wch: 16 })),
    { wch: 18 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Ledger');

  const cleanBialName = bialName.replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `${cleanBialName}_Tithe_${monthName}_${year}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

/**
 * Printable PDF Report Export
 */
export function exportToPDF({ bialName, year, month, members, summary, columns }) {
  const cols = (columns && columns.length > 0) ? columns : DEFAULT_TITHE_COLUMNS;
  const monthName = MONTH_NAMES[month - 1] || month;
  const doc = new jsPDF({ orientation: cols.length > 5 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const hasBialCol = members.some(m => m.bial_name);

  // Title Header Block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text('PATHIAN RAM TITHE LEDGER', doc.internal.pageSize.getWidth() / 2, 16, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Bial: ${bialName}`, 14, 25);
  doc.text(`Period & Location: ${monthName} ${year}`, 14, 31);
  doc.text(`Date of Issue: ${new Date().toLocaleDateString()}`, doc.internal.pageSize.getWidth() - 14, 31, { align: 'right' });

  doc.setLineWidth(0.5);
  doc.setDrawColor(203, 213, 225);
  doc.line(14, 34, doc.internal.pageSize.getWidth() - 14, 34);

  // Format table data
  const tableHead = hasBialCol
    ? [['Sl No', 'Member Name', 'Bial', ...cols.map(c => c.code), 'Total (₹)']]
    : [['Sl No', 'Member Name', ...cols.map(c => c.code), 'Total (₹)']];

  const tableBody = members.map((m, idx) => {
    const rowAmounts = cols.map(c => (m[c.field_key] || 0).toLocaleString('en-IN'));
    return hasBialCol ? [
      m.sl_no || idx + 1,
      m.name,
      m.bial_name || '',
      ...rowAmounts,
      (m.total || 0).toLocaleString('en-IN')
    ] : [
      m.sl_no || idx + 1,
      m.name,
      ...rowAmounts,
      (m.total || 0).toLocaleString('en-IN')
    ];
  });

  // Footer total row inside table
  const footerAmounts = cols.map(c => ((summary[c.field_key] ?? summary[`sum_${c.field_key}`] ?? 0)).toLocaleString('en-IN'));
  const tableFoot = hasBialCol ? [[
    'TOTAL',
    `Members: ${members.length}`,
    '',
    ...footerAmounts,
    (summary.grand_total || 0).toLocaleString('en-IN')
  ]] : [[
    'TOTAL',
    `Members: ${members.length}`,
    ...footerAmounts,
    (summary.grand_total || 0).toLocaleString('en-IN')
  ]];

  const colStyles = {
    0: { halign: 'center', cellWidth: 14 },
    1: { halign: 'left' }
  };
  let colIdx = 2;
  if (hasBialCol) {
    colStyles[colIdx++] = { halign: 'left', cellWidth: 24 };
  }
  cols.forEach(() => {
    colStyles[colIdx++] = { halign: 'right' };
  });
  colStyles[colIdx] = { halign: 'right', fontStyle: 'bold' };

  doc.autoTable({
    startY: 38,
    head: tableHead,
    body: tableBody,
    foot: tableFoot,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 2 },
    columnStyles: colStyles
  });

  const cleanBialName = bialName.replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `${cleanBialName}_Tithe_${monthName}_${year}.pdf`;
  doc.save(fileName);
}

/**
 * Admin Consolidated Report Export (PDF)
 */
export function exportAdminConsolidatedPDF({ year, grandTotals, bialBreakdown, columns }) {
  const cols = (columns && columns.length > 0) ? columns : DEFAULT_TITHE_COLUMNS;
  const doc = new jsPDF({ orientation: cols.length > 4 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text('PATHIAN RAM TITHE COLLECTION SUMMARY', pageWidth / 2, 16, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Consolidated Admin Report - Year ${year}`, 14, 25);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 14, 25, { align: 'right' });

  doc.setLineWidth(0.5);
  doc.line(14, 28, pageWidth - 14, 28);

  const tableHead = [['Code', 'Bial Name', ...cols.map(c => c.name), 'Grand Total']];
  const tableBody = bialBreakdown.map(b => [
    b.code,
    b.name,
    ...cols.map(c => (b[c.field_key] || 0).toLocaleString('en-IN')),
    (b.total || 0).toLocaleString('en-IN')
  ]);

  const tableFoot = [[
    'ALL',
    'TOTAL SUMS',
    ...cols.map(c => ((grandTotals[c.field_key] ?? grandTotals[`total_${c.field_key}`] ?? 0)).toLocaleString('en-IN')),
    (grandTotals.grand_total || 0).toLocaleString('en-IN')
  ]];

  const colStyles = {
    0: { halign: 'center', cellWidth: 20 },
    1: { halign: 'left' }
  };
  cols.forEach((_, i) => {
    colStyles[2 + i] = { halign: 'right' };
  });
  colStyles[2 + cols.length] = { halign: 'right', fontStyle: 'bold' };

  doc.autoTable({
    startY: 34,
    head: tableHead,
    body: tableBody,
    foot: tableFoot,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    columnStyles: colStyles
  });

  doc.save(`Pathian_Ram_Admin_Summary_${year}.pdf`);
}

/**
 * Admin Consolidated Report Export (Excel)
 */
export function exportAdminConsolidatedExcel({ year, grandTotals, bialBreakdown, columns }) {
  const cols = (columns && columns.length > 0) ? columns : DEFAULT_TITHE_COLUMNS;
  const sheetData = [
    ['PATHIAN RAM TITHE COLLECTION SUMMARY - CONSOLIDATED REPORT'],
    [`Financial Year: FY ${year} - ${year + 1}`],
    ['Generated On: ' + new Date().toLocaleString()],
    [],
    ['Code', 'Bial Name', ...cols.map(c => `${c.name} (${c.code})`), 'Grand Total']
  ];

  bialBreakdown.forEach(b => {
    sheetData.push([
      b.code,
      b.name,
      ...cols.map(c => b[c.field_key] || 0),
      b.total || 0
    ]);
  });

  sheetData.push([
    'ALL',
    'TOTAL SUMS',
    ...cols.map(c => (grandTotals[c.field_key] ?? grandTotals[`total_${c.field_key}`] ?? 0)),
    grandTotals.grand_total || 0
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  worksheet['!cols'] = [
    { wch: 12 },
    { wch: 28 },
    ...cols.map(() => ({ wch: 18 })),
    { wch: 20 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Consolidated Summary');
  XLSX.writeFile(workbook, `Pathian_Ram_Admin_Summary_${year}.xlsx`);
}

/**
 * Printable PDF Statement for an Individual Member's Overall Payments
 */
export function exportMemberHistoryPDF({ member, year, monthlyEntries, annualSummary, columns }) {
  const cols = (columns && columns.length > 0) ? columns : DEFAULT_TITHE_COLUMNS;
  const doc = new jsPDF({ orientation: cols.length > 5 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title Header Block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(30, 41, 59);
  doc.text('PATHIAN RAM TITHE PAYMENT STATEMENT', pageWidth / 2, 16, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Member Name: ${member.name}`, 14, 25);
  doc.text(`Sl No: ${member.sl_no}`, 14, 30);
  doc.text(`Bial: ${member.bial_name} (${member.bial_code})`, 120, 25);
  doc.text(`Financial Year: ${year}`, 120, 30);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 14, 30, { align: 'right' });

  doc.setLineWidth(0.5);
  doc.setDrawColor(203, 213, 225);
  doc.line(14, 33, pageWidth - 14, 33);

  // Table Data
  const tableHead = [['Month', ...cols.map(c => c.code), 'Total (₹)']];
  const tableBody = monthlyEntries.map(e => [
    e.month_name,
    ...cols.map(c => (e[c.field_key] || 0).toLocaleString('en-IN')),
    (e.total || 0).toLocaleString('en-IN')
  ]);

  const tableFoot = [[
    'OVERALL TOTAL',
    ...cols.map(c => ((annualSummary[c.field_key] ?? annualSummary[`total_${c.field_key}`] ?? 0)).toLocaleString('en-IN')),
    (annualSummary.grand_total || 0).toLocaleString('en-IN')
  ]];

  const colStyles = {
    0: { halign: 'left', fontStyle: 'bold' }
  };
  cols.forEach((_, i) => {
    colStyles[1 + i] = { halign: 'right' };
  });
  colStyles[1 + cols.length] = { halign: 'right', fontStyle: 'bold' };

  doc.autoTable({
    startY: 37,
    head: tableHead,
    body: tableBody,
    foot: tableFoot,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      halign: 'right'
    },
    columnStyles: colStyles,
    styles: {
      fontSize: 9,
      cellPadding: 2.5
    }
  });

  const cleanName = member.name.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`${cleanName}_Payment_Statement_${year}.pdf`);
}

/**
 * Excel Export for Bial Aggregated Collection & Member Totals
 */
export function exportBialYearlySummaryExcel({ bialName, year, monthlyBreakdown, memberTotals, grandTotals, columns }) {
  const cols = (columns && columns.length > 0) ? columns : DEFAULT_TITHE_COLUMNS;
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Monthly Aggregated Trends
  const monthlySheetData = [
    ['PATHIAN RAM - ANNUAL AGGREGATED MONTHLY COLLECTION'],
    [`Bial Name: ${bialName}`],
    [`Financial Year: ${year}`],
    ['Generated On: ' + new Date().toLocaleString()],
    [],
    ['Month', ...cols.map(c => `${c.name} (${c.code})`), 'TOTAL']
  ];

  monthlyBreakdown.forEach(m => {
    monthlySheetData.push([
      m.month_name,
      ...cols.map(c => m[c.field_key] || 0),
      m.total || 0
    ]);
  });

  monthlySheetData.push([
    'OVERALL TOTAL',
    ...cols.map(c => (grandTotals[c.field_key] ?? grandTotals[`total_${c.field_key}`] ?? 0)),
    grandTotals.grand_total || 0
  ]);

  const monthlyWs = XLSX.utils.aoa_to_sheet(monthlySheetData);
  monthlyWs['!cols'] = [{ wch: 18 }, ...cols.map(() => ({ wch: 16 })), { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, monthlyWs, 'Monthly Summary');

  // Sheet 2: Member Annual Totals Matrix
  const memberSheetData = [
    ['PATHIAN RAM - MEMBER ANNUAL OVERALL PAYMENTS'],
    [`Bial Name: ${bialName}`],
    [`Financial Year: ${year}`],
    [],
    ['Sl No', 'Member Name', ...cols.map(c => `Total ${c.name}`), 'GRAND TOTAL']
  ];

  memberTotals.forEach(m => {
    memberSheetData.push([
      m.sl_no,
      m.name,
      ...cols.map(c => (m[c.field_key] ?? m[`total_${c.field_key}`] ?? 0)),
      m.grand_total || 0
    ]);
  });

  memberSheetData.push([
    'TOTAL',
    `Total Members: ${memberTotals.length}`,
    ...cols.map(c => (grandTotals[c.field_key] ?? grandTotals[`total_${c.field_key}`] ?? 0)),
    grandTotals.grand_total || 0
  ]);

  const memberWs = XLSX.utils.aoa_to_sheet(memberSheetData);
  memberWs['!cols'] = [{ wch: 8 }, { wch: 28 }, ...cols.map(() => ({ wch: 18 })), { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, memberWs, 'Member Annual Totals');

  const cleanBialName = bialName.replace(/[^a-zA-Z0-9]/g, '_');
  XLSX.writeFile(workbook, `${cleanBialName}_Aggregated_Collection_${year}.xlsx`);
}

/**
 * PDF Export for Bial Aggregated Collection Summary
 */
export function exportBialYearlySummaryPDF({ bialName, year, monthlyBreakdown, memberTotals, grandTotals, columns }) {
  const cols = (columns && columns.length > 0) ? columns : DEFAULT_TITHE_COLUMNS;
  const doc = new jsPDF({ orientation: cols.length > 4 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text('PATHIAN RAM AGGREGATED COLLECTION REPORT', pageWidth / 2, 16, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Bial: ${bialName}`, 14, 25);
  doc.text(`Financial Year: ${year}`, 14, 30);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 14, 30, { align: 'right' });

  doc.setLineWidth(0.5);
  doc.line(14, 33, pageWidth - 14, 33);

  // Section 1: Monthly Breakdown Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('1. Monthly Collection Breakdown (April - March)', 14, 40);

  const monthHead = [['Month', ...cols.map(c => c.code), 'Total (₹)']];
  const monthBody = monthlyBreakdown.map(m => [
    m.month_name,
    ...cols.map(c => (m[c.field_key] || 0).toLocaleString('en-IN')),
    (m.total || 0).toLocaleString('en-IN')
  ]);

  const monthFoot = [[
    'OVERALL TOTAL',
    ...cols.map(c => ((grandTotals[c.field_key] ?? grandTotals[`total_${c.field_key}`] ?? 0)).toLocaleString('en-IN')),
    (grandTotals.grand_total || 0).toLocaleString('en-IN')
  ]];

  const monthColStyles = { 0: { halign: 'left', fontStyle: 'bold' } };
  cols.forEach((_, i) => { monthColStyles[1 + i] = { halign: 'right' }; });
  monthColStyles[1 + cols.length] = { halign: 'right', fontStyle: 'bold' };

  doc.autoTable({
    startY: 44,
    head: monthHead,
    body: monthBody,
    foot: monthFoot,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    columnStyles: monthColStyles,
    styles: { fontSize: 8.5, cellPadding: 2 }
  });

  // Section 2: Member Totals Table
  const nextY = doc.lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('2. Member Annual Overall Payments', 14, nextY);

  const memHead = [['Sl', 'Name', ...cols.map(c => c.code), 'Total (₹)']];
  const memBody = memberTotals.map(m => [
    m.sl_no,
    m.name,
    ...cols.map(c => ((m[c.field_key] ?? m[`total_${c.field_key}`] ?? 0)).toLocaleString('en-IN')),
    (m.grand_total || 0).toLocaleString('en-IN')
  ]);

  const memFoot = [[
    'TOT',
    `Members: ${memberTotals.length}`,
    ...cols.map(c => ((grandTotals[c.field_key] ?? grandTotals[`total_${c.field_key}`] ?? 0)).toLocaleString('en-IN')),
    (grandTotals.grand_total || 0).toLocaleString('en-IN')
  ]];

  const memColStyles = { 0: { halign: 'center', cellWidth: 10 }, 1: { halign: 'left' } };
  cols.forEach((_, i) => { memColStyles[2 + i] = { halign: 'right' }; });
  memColStyles[2 + cols.length] = { halign: 'right', fontStyle: 'bold' };

  doc.autoTable({
    startY: nextY + 4,
    head: memHead,
    body: memBody,
    foot: memFoot,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    columnStyles: memColStyles,
    styles: { fontSize: 8.5, cellPadding: 2 }
  });

  const cleanBialName = bialName.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`${cleanBialName}_Aggregated_Collection_${year}.pdf`);
}

/**
 * Overall Annual Member-Level Contributions Export (Excel)
 * Groups members by Bial (Bial 1, Bial 2...) with 12-month summed totals for each member
 */
export function exportOverallMemberExcel({ year, bialsData, churchGrandTotal, columns }) {
  const cols = (columns && columns.length > 0) ? columns : DEFAULT_TITHE_COLUMNS;
  const sheetData = [
    ['BETHLEHEM KOHHRAN - PATHIAN RAM'],
    [`OVERALL ANNUAL MEMBER TITHE CONTRIBUTIONS (FY ${year} - ${year + 1})`],
    ['Generated On: ' + new Date().toLocaleString()],
    [],
    ['Sl No', 'Bial', 'Hming (Member Name)', ...cols.map(c => `${c.name} (${c.code})`), 'Total (₹)']
  ];

  (bialsData || []).forEach((b) => {
    (b.members || []).forEach((m) => {
      sheetData.push([
        m.sl_no,
        b.bial_name,
        m.member_name,
        ...cols.map(c => (m[c.field_key] ?? m[`total_${c.field_key}`] ?? 0)),
        m.grand_total || 0
      ]);
    });

    // Subtotal for this Bial
    sheetData.push([
      '',
      `${b.bial_name} Subtotal`,
      `(${b.members?.length || 0} Members)`,
      ...cols.map(c => (b.subtotal?.[c.field_key] ?? b.subtotal?.[`total_${c.field_key}`] ?? 0)),
      b.subtotal?.grand_total || 0
    ]);
    sheetData.push([]); // blank row between bials
  });

  // Church Grand Total Row
  sheetData.push([
    'TOTAL',
    'CHURCH OVERALL GRAND TOTAL',
    'All Bials Combined',
    ...cols.map(c => (churchGrandTotal?.[c.field_key] ?? churchGrandTotal?.[`total_${c.field_key}`] ?? 0)),
    churchGrandTotal?.grand_total || 0
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

  worksheet['!cols'] = [
    { wch: 8 },  // Sl No
    { wch: 20 }, // Bial
    { wch: 26 }, // Name
    ...cols.map(() => ({ wch: 18 })),
    { wch: 20 }  // Total
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Overall Members');
  XLSX.writeFile(workbook, `Pathian_Ram_Overall_Member_Contributions_FY_${year}.xlsx`);
}

/**
 * Overall Annual Member-Level Contributions Export (PDF)
 * Formatted multi-page PDF with all bials and member annual totals
 */
export function exportOverallMemberPDF({ year, bialsData, churchGrandTotal, columns }) {
  const cols = (columns && columns.length > 0) ? columns : DEFAULT_TITHE_COLUMNS;
  const doc = new jsPDF({ orientation: cols.length > 4 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.text('BETHLEHEM KOHHRAN', pageWidth / 2, 14, { align: 'center' });

  doc.setFontSize(10.5);
  doc.setTextColor(67, 56, 202);
  doc.text(`PATHIAN RAM - OVERALL ANNUAL MEMBER CONTRIBUTIONS`, pageWidth / 2, 19.5, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Financial Year: FY ${year} - ${year + 1}`, 14, 26);
  doc.text(`Date of Issue: ${new Date().toLocaleDateString()}`, pageWidth - 14, 26, { align: 'right' });

  doc.setLineWidth(0.4);
  doc.setDrawColor(203, 213, 225);
  doc.line(14, 28.5, pageWidth - 14, 28.5);

  let currentY = 32;

  (bialsData || []).forEach((b) => {
    // Check if new page is needed for Bial header
    if (currentY > 250) {
      doc.addPage();
      currentY = 16;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`${b.bial_name} (${b.bial_code}) - ${b.members?.length || 0} Members`, 14, currentY);
    currentY += 2.5;

    const head = [['Sl', 'Hming (Member Name)', ...cols.map(c => `${c.code} (₹)`), 'Total (₹)']];
    const body = (b.members || []).map((m) => [
      m.sl_no,
      m.member_name,
      ...cols.map(c => ((m[c.field_key] ?? m[`total_${c.field_key}`] ?? 0)).toLocaleString('en-IN')),
      (m.grand_total || 0).toLocaleString('en-IN')
    ]);

    const foot = [[
      'TOT',
      `${b.bial_name} Subtotal`,
      ...cols.map(c => ((b.subtotal?.[c.field_key] ?? b.subtotal?.[`total_${c.field_key}`] ?? 0)).toLocaleString('en-IN')),
      (b.subtotal?.grand_total || 0).toLocaleString('en-IN')
    ]];

    const colStyles = {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'left' }
    };
    cols.forEach((_, i) => {
      colStyles[2 + i] = { halign: 'right' };
    });
    colStyles[2 + cols.length] = { halign: 'right', fontStyle: 'bold' };

    doc.autoTable({
      startY: currentY,
      head,
      body,
      foot,
      theme: 'grid',
      headStyles: { fillColor: [67, 56, 202], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5 },
      bodyStyles: { fontSize: 7, cellPadding: 1.2 },
      columnStyles: colStyles
    });

    currentY = doc.lastAutoTable.finalY + 8;
  });

  // Final Overall Church Grand Total Box
  if (currentY > 240) {
    doc.addPage();
    currentY = 16;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('CHURCH OVERALL GRAND TOTAL SUMMARY', 14, currentY);
  currentY += 3.5;

  const summaryHead = [['Category', 'Amount (₹)']];
  const summaryBody = [
    ...cols.map(c => [
      `${c.name} (${c.code})`,
      `Rs. ${(churchGrandTotal?.[c.field_key] ?? churchGrandTotal?.[`total_${c.field_key}`] ?? 0).toLocaleString('en-IN')}`
    ]),
    ['OVERALL GRAND TOTAL', `Rs. ${(churchGrandTotal?.grand_total || 0).toLocaleString('en-IN')}`]
  ];

  doc.autoTable({
    startY: currentY,
    head: summaryHead,
    body: summaryBody,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, cellPadding: 1.8 },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: 14, right: 14 }
  });

  // Page Numbers
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
  }

  doc.save(`Pathian_Ram_Overall_Member_Contributions_FY_${year}.pdf`);
}

/**
 * Convert Image URL to Base64 data URL for jsPDF embedding
 */
export function getBase64ImageFromUrl(imgUrl) {
  return new Promise((resolve) => {
    if (!imgUrl) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL('image/jpeg', 0.95);
        resolve(dataURL);
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = imgUrl;
  });
}

/**
 * Helper to safely run html2canvas with complete oklch sanitization across host and cloned stylesheets
 */
async function safeHtml2Canvas(element, options = {}) {
  const originalWarn = console.warn;
  const originalError = console.error;

  const hostStyleElements = Array.from(document.querySelectorAll('style'));
  const originalStyleTexts = hostStyleElements.map((s) => s.textContent);

  hostStyleElements.forEach((s) => {
    if (s.textContent && (s.textContent.includes('oklch') || s.textContent.includes('color-mix'))) {
      s.textContent = s.textContent
        .replace(/oklch\([^)]+\)/g, '#334155')
        .replace(/color-mix\([^)]+\)/g, '#334155');
    }
  });

  try {
    console.warn = (...args) => {
      if (args[0] && typeof args[0] === 'string' && (args[0].includes('oklch') || args[0].includes('color-mix'))) return;
      originalWarn.apply(console, args);
    };
    console.error = (...args) => {
      if (args[0] && typeof args[0] === 'string' && (args[0].includes('oklch') || args[0].includes('color-mix'))) return;
      originalError.apply(console, args);
    };

    return await html2canvas(element, options);
  } finally {
    console.warn = originalWarn;
    console.error = originalError;

    hostStyleElements.forEach((s, idx) => {
      if (originalStyleTexts[idx] !== null) {
        s.textContent = originalStyleTexts[idx];
      }
    });
  }
}

/**
 * Exact WYSIWYG Certificate PNG Image Generator (300 DPI High-Res)
 * Directly downloads high-definition image of the certificate, ideal for WhatsApp / mobile gallery
 */
export async function exportCertificatePNG({
  element,
  title = 'Pathian_Ram_Certificate',
  orientation = 'portrait'
}) {
  if (!element) return;

  const imgs = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    })
  );

  const targetDesktopWidth = orientation === 'landscape' ? 1060 : 794;

  const canvas = await safeHtml2Canvas(element, {
    scale: 3, // 300 DPI high resolution
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: orientation === 'landscape' ? 1200 : 850,
    onclone: (clonedDoc) => {
      const dummyCanvas = clonedDoc.createElement('canvas');
      dummyCanvas.width = 1;
      dummyCanvas.height = 1;
      const ctx = dummyCanvas.getContext('2d');

      const toRgb = (colorVal) => {
        if (!colorVal || typeof colorVal !== 'string') return colorVal;
        if (!colorVal.includes('oklch') && !colorVal.includes('color-mix')) return colorVal;
        try {
          ctx.fillStyle = '#ffffff';
          ctx.fillStyle = colorVal;
          const res = ctx.fillStyle;
          return res && res !== '#ffffff' && !res.includes('oklch') ? res : '#334155';
        } catch (e) {
          return '#334155';
        }
      };

      clonedDoc.querySelectorAll('style').forEach((styleEl) => {
        if (styleEl.textContent && (styleEl.textContent.includes('oklch') || styleEl.textContent.includes('color-mix'))) {
          styleEl.textContent = styleEl.textContent
            .replace(/oklch\([^)]+\)/g, '#334155')
            .replace(/color-mix\([^)]+\)/g, '#334155');
        }
      });

      const sheet = clonedDoc.getElementById('official-certificate-sheet');
      if (sheet) {
        sheet.style.boxShadow = 'none';
        sheet.style.width = `${targetDesktopWidth}px`;
        sheet.style.minWidth = `${targetDesktopWidth}px`;
        sheet.style.maxWidth = `${targetDesktopWidth}px`;
        sheet.style.margin = '0 auto';

        // Force 5-column grid across summary cards
        const cardGrids = sheet.querySelectorAll('.grid');
        cardGrids.forEach((grid) => {
          grid.style.display = 'grid';
          grid.style.gridTemplateColumns = 'repeat(5, minmax(0, 1fr))';
          grid.style.gap = '8px';
          Array.from(grid.children).forEach((child) => {
            child.style.gridColumn = 'span 1';
          });
        });

        // Unhide footer spacer so seal and signatory stay centered and aligned
        sheet.querySelectorAll('.hidden').forEach((el) => {
          el.classList.remove('hidden');
          el.style.display = 'block';
        });

        const elements = [sheet, ...sheet.querySelectorAll('*')];
        const colorProps = [
          'color', 'backgroundColor', 'borderColor',
          'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor',
          'outlineColor', 'fill', 'stroke'
        ];

        const defaultView = window;
        elements.forEach((el) => {
          const style = defaultView.getComputedStyle(el);
          if (style) {
            colorProps.forEach((p) => {
              const val = style[p];
              if (val && typeof val === 'string') {
                if (val.includes('oklch') || val.includes('color-mix')) {
                  el.style[p] = toRgb(val);
                } else if (val.startsWith('rgb')) {
                  el.style[p] = val;
                }
              }
            });

            const shadow = style.boxShadow;
            if (shadow && (shadow.includes('oklch') || shadow.includes('color-mix'))) {
              el.style.boxShadow = shadow
                .replace(/oklch\([^)]+\)/g, (match) => toRgb(match))
                .replace(/color-mix\([^)]+\)/g, (match) => toRgb(match));
            }
          }
        });
      }
    }
  });

  const link = document.createElement('a');
  link.download = `${title}.png`;
  link.href = canvas.toDataURL('image/png', 1.0);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Native Vector Certificate & Report PDF Generator using @react-pdf/renderer
 * Generates ultra-crisp vector PDFs with full typography, logos, signatures, and zero oklch color errors.
 */
export async function exportCertificateReactPDF(reportData, filename = 'Pathian_Ram_Official_Report') {
  const safeTitle = filename ? filename.replace(/\.pdf$/i, '') : 'Pathian_Ram_Official_Report';
  const doc = React.createElement(OfficialReportPDFDocument, {
    ...reportData,
    title: reportData?.title || safeTitle
  });
  const blob = await pdf(doc).toBlob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = `${safeTitle}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
}

/**
 * Exact WYSIWYG Certificate PDF & Print Generator
 * Captures the exact on-screen certificate styling (colors, fonts, borders, seals, signatures, layout)
 * with 300 DPI high-resolution canvas using html2canvas-pro to support modern color spaces.
 * Fully calibrated for full-screen desktop layout on both mobile phones and computers.
 */
export async function exportCertificateWYSIWYGPDF({
  element,
  title = 'Pathian_Ram_Certificate',
  pageSize = 'a4',
  orientation = 'portrait',
  isPrint = false,
  reportData = null
}) {
  if (reportData && !isPrint) {
    return await exportCertificateReactPDF(reportData, title);
  }
  if (!element) return;

  // 1. Ensure all custom fonts are ready before rasterization
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (e) {
      console.warn('Font loading wait skipped:', e);
    }
  }

  // 2. Ensure all images inside the sheet (logo, signatures, seal) are loaded
  const imgs = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    })
  );

  const targetDesktopWidth = orientation === 'landscape' ? 1060 : 794;

  const canvas = await safeHtml2Canvas(element, {
    scale: 3, // 300 DPI high resolution
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: orientation === 'landscape' ? 1200 : 850,
    onclone: (clonedDoc) => {
      // Create a dummy canvas in the cloned doc to resolve modern OKLCH colors to standard RGB
      const dummyCanvas = clonedDoc.createElement('canvas');
      dummyCanvas.width = 1;
      dummyCanvas.height = 1;
      const ctx = dummyCanvas.getContext('2d');

      const toRgb = (colorVal) => {
        if (!colorVal || typeof colorVal !== 'string') return colorVal;
        if (!colorVal.includes('oklch') && !colorVal.includes('color-mix')) return colorVal;
        try {
          ctx.fillStyle = '#ffffff';
          ctx.fillStyle = colorVal;
          const res = ctx.fillStyle;
          return res && res !== '#ffffff' && !res.includes('oklch') ? res : '#334155';
        } catch (e) {
          return '#334155';
        }
      };

      // Sanitize all stylesheet definitions containing oklch or color-mix
      clonedDoc.querySelectorAll('style').forEach((styleEl) => {
        if (styleEl.textContent && (styleEl.textContent.includes('oklch') || styleEl.textContent.includes('color-mix'))) {
          styleEl.textContent = styleEl.textContent
            .replace(/oklch\([^)]+\)/g, '#334155')
            .replace(/color-mix\([^)]+\)/g, '#334155');
        }
      });

      // Sanitize all elements inside official certificate sheet by converting computed styles to explicit RGB
      const sheet = clonedDoc.getElementById('official-certificate-sheet');
      if (sheet) {
        sheet.style.boxShadow = 'none'; // Remove screen drop shadow for clean paper export
        sheet.style.width = `${targetDesktopWidth}px`;
        sheet.style.minWidth = `${targetDesktopWidth}px`;
        sheet.style.maxWidth = `${targetDesktopWidth}px`;
        sheet.style.margin = '0 auto';

        // Force 5-column grid across summary cards
        const cardGrids = sheet.querySelectorAll('.grid');
        cardGrids.forEach((grid) => {
          grid.style.display = 'grid';
          grid.style.gridTemplateColumns = 'repeat(5, minmax(0, 1fr))';
          grid.style.gap = '8px';
          Array.from(grid.children).forEach((child) => {
            child.style.gridColumn = 'span 1';
          });
        });

        // Unhide footer spacer so seal and signatory stay centered and aligned
        sheet.querySelectorAll('.hidden').forEach((el) => {
          el.classList.remove('hidden');
          el.style.display = 'block';
        });

        const elements = [sheet, ...sheet.querySelectorAll('*')];
        const colorProps = [
          'color', 'backgroundColor', 'borderColor',
          'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor',
          'outlineColor', 'fill', 'stroke'
        ];

        const defaultView = window;
        elements.forEach((el) => {
          const style = defaultView.getComputedStyle(el);
          if (style) {
            colorProps.forEach((p) => {
              const val = style[p];
              if (val && typeof val === 'string') {
                if (val.includes('oklch') || val.includes('color-mix')) {
                  el.style[p] = toRgb(val);
                } else if (val.startsWith('rgb')) {
                  el.style[p] = val;
                }
              }
            });

            // If box-shadow uses oklch, resolve or strip
            const shadow = style.boxShadow;
            if (shadow && (shadow.includes('oklch') || shadow.includes('color-mix'))) {
              el.style.boxShadow = shadow
                .replace(/oklch\([^)]+\)/g, (match) => toRgb(match))
                .replace(/color-mix\([^)]+\)/g, (match) => toRgb(match));
            }
          }
        });
      }
    }
  });

  const format = pageSize === 'legal' ? 'legal' : 'a4';
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format,
    compress: true
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const margin = 6; // Clean 6mm margin
  const targetWidth = pageWidth - (margin * 2);
  const targetHeight = pageHeight - (margin * 2);

  const imgRatio = canvas.width / canvas.height;
  const fullRenderHeight = targetWidth / imgRatio;

  if (fullRenderHeight <= targetHeight * 1.08) {
    // Fits cleanly on 1 page (single page certificate / report)
    let renderW = targetWidth;
    let renderH = fullRenderHeight;

    if (renderH > targetHeight) {
      renderH = targetHeight;
      renderW = targetHeight * imgRatio;
    }

    const offsetX = margin + ((targetWidth - renderW) / 2);
    const offsetY = margin + ((targetHeight - renderH) / 2);

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    doc.addImage(imgData, 'JPEG', offsetX, offsetY, renderW, renderH, undefined, 'FAST');
  } else {
    // Multi-page slicing for large member tables
    const pageCanvasHeight = (canvas.width * targetHeight) / targetWidth;
    let remainingHeight = canvas.height;
    let sourceY = 0;
    let pageIndex = 0;

    while (remainingHeight > 0) {
      const sliceHeight = Math.min(remainingHeight, pageCanvasHeight);

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = pageCanvasHeight;
      const pageCtx = pageCanvas.getContext('2d');

      pageCtx.fillStyle = '#ffffff';
      pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      pageCtx.drawImage(
        canvas,
        0, sourceY, canvas.width, sliceHeight,
        0, 0, canvas.width, sliceHeight
      );

      const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.98);
      if (pageIndex > 0) {
        doc.addPage(format, orientation);
      }

      doc.addImage(pageImgData, 'JPEG', margin, margin, targetWidth, targetHeight, undefined, 'FAST');

      sourceY += sliceHeight;
      remainingHeight -= sliceHeight;
      pageIndex++;
    }
  }

  if (isPrint) {
    doc.autoPrint();
    const blobUrl = doc.output('bloburl');
    const printWindow = window.open(blobUrl, '_blank');
    if (!printWindow) {
      doc.save(`Print_${title}.pdf`);
    }
  } else {
    doc.save(`${title}.pdf`);
  }
}

/**
 * Direct High-Fidelity Certificate Printer
 * Opens an isolated invisible iframe to print ONLY the certificate sheet,
 * strictly pinning the signatory details and footer to the bottom of the selected paper size.
 * Uses viewport metadata, offscreen desktop sizing, and explicit desktop CSS
 * so mobile phones (iOS Safari / Android) print full-bleed A4 / Legal pages covering 100% of the screen.
 */
export function printCertificateDirectly(element, title = 'Pathian_Ram_Report', pageSize = 'a4', orientation = 'portrait') {
  if (!element) return;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = pageSize === 'a5' 
    ? (orientation === 'landscape' ? '800px' : '620px')
    : (orientation === 'landscape' ? '1200px' : '900px');
  iframe.style.height = '1400px';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  iframe.style.zIndex = '-9999';
  document.body.appendChild(iframe);

  const pri = iframe.contentWindow;

  let stylesHtml = '';
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
    stylesHtml += node.outerHTML;
  });

  const pageHeightCss = pageSize === 'legal'
    ? (orientation === 'landscape' ? '215.9mm' : '355.6mm')
    : pageSize === 'a5'
      ? (orientation === 'landscape' ? '148mm' : '210mm')
      : (orientation === 'landscape' ? '210mm' : '297mm');

  const viewportWidth = pageSize === 'a5'
    ? (orientation === 'landscape' ? '794' : '559')
    : (orientation === 'landscape' ? '1122' : '794');

  pri.document.open();
  pri.document.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=${viewportWidth}, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <title>${title}</title>
        ${stylesHtml}
        <style>
          @page {
            margin: 6mm 8mm;
            size: ${pageSize} ${orientation};
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #print-wrapper {
            width: 100% !important;
            min-height: calc(${pageHeightCss} - 16mm) !important;
            height: auto !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-sizing: border-box !important;
            margin: 0 auto !important;
          }
          #official-certificate-sheet {
            box-shadow: none !important;
            border: 2px solid #1e293b !important;
            border-radius: 16px !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: calc(${pageHeightCss} - 16mm) !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-sizing: border-box !important;
            padding: 16px 20px !important;
            background: #ffffff !important;
            position: relative !important;
          }
          /* Force 5-Column Summary Grid in Print (even if on mobile) */
          #official-certificate-sheet .grid {
            display: grid !important;
            grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
            gap: 6px !important;
          }
          #official-certificate-sheet .grid > div {
            grid-column: span 1 / span 1 !important;
          }
          /* Force footer 3-column layout (Spacer, Seal, Signatory) */
          #official-certificate-sheet .hidden.sm\\:block,
          #official-certificate-sheet .sm\\:block {
            display: block !important;
            width: 33.333333% !important;
          }
          #official-certificate-sheet .w-1\\/2.sm\\:w-1\\/3,
          #official-certificate-sheet .sm\\:w-1\\/3 {
            width: 33.333333% !important;
          }
          /* Ensure dynamic table fonts and borders span edge-to-edge cleanly */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            white-space: nowrap !important;
          }
        </style>
      </head>
      <body>
        <div id="print-wrapper">
          ${element.outerHTML}
        </div>
      </body>
    </html>
  `);
  pri.document.close();

  setTimeout(() => {
    pri.focus();
    pri.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 1500);
  }, 400);
}

/**
 * Official Church Certificate & Report PDF Generator (A4 / Legal)
 * Pure high-definition vector rendering matching the exact screen certificate styling.
 */
export function exportOfficialCertificatePDF({
  title = 'PATHIAN RAM REPORT',
  denomination = 'Presbyterian Church of India',
  churchName = 'Bethlehem Kohhran',
  periodText = 'Annual Financial Report',
  reportType = 'Annual',
  year = new Date().getFullYear(),
  grandTotals = {},
  bialsBreakdown = [],
  signatory = {},
  pageSize = 'a4',
  orientation = 'portrait',
  logoBase64 = null,
  tableType = 'bials', // 'bials' | 'monthly_breakdown' | 'members'
  scopeName = '',
  signatureBase64 = null,
  signatureSize = 45,
  sealBase64 = null,
  sealSize = 65,
  isPrint = false
}) {
  // Page setup (A4: 210 x 297, Legal: 215.9 x 355.6 mm)
  const format = pageSize === 'legal' ? 'legal' : 'a4';
  const isLandscape = orientation === 'landscape';
  const doc = new jsPDF({ orientation, unit: 'mm', format });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const centerX = pageWidth / 2;
  const margin = isLandscape ? 12 : 12;
  const contentWidth = pageWidth - (margin * 2);

  // Outer Certificate Border (Double Line with Gold Accent)
  doc.setDrawColor(30, 41, 59); // Slate 800
  doc.setLineWidth(0.8);
  doc.rect(margin - 3, margin - 3, contentWidth + 6, pageHeight - (margin * 2) + 6);
  
  doc.setDrawColor(217, 119, 6); // Amber 600 Gold Inner Accent
  doc.setLineWidth(0.35);
  doc.rect(margin - 1.5, margin - 1.5, contentWidth + 3, pageHeight - (margin * 2) + 3);

  let currentY = margin + (isLandscape ? 2 : 2.5);

  // Header 1: Denomination
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isLandscape ? 12 : 12.5);
  doc.setTextColor(30, 41, 59);
  doc.text(denomination.toUpperCase(), centerX, currentY, { align: 'center' });
  currentY += isLandscape ? 4 : 4.5;

  // Header 2: Church Name
  doc.setFontSize(isLandscape ? 10.5 : 11);
  doc.setTextColor(67, 56, 202); // Indigo 700
  doc.text(churchName, centerX, currentY, { align: 'center' });
  currentY += isLandscape ? 4 : 4.5;

  // Centered Church Logo
  if (logoBase64) {
    const logoSize = isLandscape ? 15 : 18;
    doc.addImage(logoBase64, 'JPEG', centerX - (logoSize / 2), currentY, logoSize, logoSize);
    currentY += logoSize + (isLandscape ? 2 : 2.5);
  } else {
    currentY += 1.5;
  }

  // Header 3: Report Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isLandscape ? 12 : 12.5);
  doc.setTextColor(15, 23, 42);
  doc.text(title.toUpperCase(), centerX, currentY, { align: 'center' });
  currentY += isLandscape ? 3.5 : 4;

  // Subtitle / Period Badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isLandscape ? 9 : 9.5);
  doc.setTextColor(180, 83, 9); // Amber 700
  doc.text(`(${periodText})`, centerX, currentY, { align: 'center' });
  currentY += isLandscape ? 3.5 : 4;

  // Bial Name just below Period (Centered)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isLandscape ? 9.5 : 10);
  doc.setTextColor(15, 23, 42);
  doc.text(scopeName || 'All Bials Combined', centerX, currentY, { align: 'center' });
  currentY += isLandscape ? 4 : 4.5;

  // Dividing Line
  doc.setDrawColor(99, 102, 241);
  doc.setLineWidth(0.5);
  doc.line(margin + 20, currentY, pageWidth - margin - 20, currentY);
  currentY += 3; // 1 clean line space before Date of Issue

  // Date of Issue just above Pathian Ram / Summary Totals
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text(`Date of Issue: ${signatory.date || new Date().toLocaleDateString('en-GB')}`, margin, currentY);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`(All amounts in INR)`, pageWidth - margin, currentY, { align: 'right' });
  currentY += 2.5;

  // Section 1: Executive Summary Totals Box with Exact Screen Backgrounds
  const pr = (grandTotals.total_pathian_ram || 0).toLocaleString('en-IN');
  const rt = (grandTotals.total_ramthar || 0).toLocaleString('en-IN');
  const tch = (grandTotals.total_tualchhung || 0).toLocaleString('en-IN');
  const bldg = (grandTotals.total_building || 0).toLocaleString('en-IN');
  const grandTotal = (grandTotals.grand_total || 0).toLocaleString('en-IN');

  const summaryHead = [['Pathian Ram', 'Ramthar (RT)', 'Tualchhung (Tch)', 'Building (Bldg)', 'TOTAL']];
  const summaryBody = [[`₹${pr}`, `₹${rt}`, `₹${tch}`, `₹${bldg}`, `₹${grandTotal}`]];

  doc.autoTable({
    startY: currentY,
    head: summaryHead,
    body: summaryBody,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // Slate 800
      textColor: [255, 255, 255],
      fontSize: isLandscape ? 8 : 7.5,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: isLandscape ? 1.5 : 1.2
    },
    bodyStyles: {
      fontSize: isLandscape ? 9 : 8,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: isLandscape ? 1.8 : 1.2
    },
    columnStyles: {
      0: { textColor: [30, 64, 175], fillColor: [239, 246, 255] },  // Blue
      1: { textColor: [6, 95, 70], fillColor: [236, 253, 245] },   // Emerald
      2: { textColor: [146, 64, 14], fillColor: [255, 251, 235] }, // Amber
      3: { textColor: [107, 33, 168], fillColor: [250, 245, 255] },// Purple
      4: { textColor: [0, 0, 0], fillColor: [255, 255, 255], fontStyle: 'bold' } // Black on White
    },
    margin: { left: margin, right: margin }
  });

  const totalHH = grandTotals.total_system_members !== undefined 
    ? grandTotals.total_system_members 
    : ((tableType === 'bials' || tableType === 'members') ? bialsBreakdown.reduce((acc, b) => acc + (b.total_members || b.member_count || 0), 0) : 0);
  const returnedHH = grandTotals.total_returned_members !== undefined 
    ? grandTotals.total_returned_members 
    : ((tableType === 'bials' || tableType === 'members') ? bialsBreakdown.reduce((acc, b) => acc + (b.returned_members || (parseFloat(b.total || b.grand_total) > 0 ? 1 : 0)), 0) : 0);
  const returnRate = grandTotals.overall_return_rate !== undefined 
    ? grandTotals.overall_return_rate 
    : (totalHH > 0 ? Math.round((returnedHH / totalHH) * 1000) / 10 : 0);
  const avgPerHH = grandTotals.avg_contribution_per_member !== undefined 
    ? grandTotals.avg_contribution_per_member 
    : (returnedHH > 0 ? Math.round((grandTotals.grand_total || 0) / returnedHH) : 0);

  if (totalHH > 0) {
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 2,
      head: [['TOTAL HOUSEHOLDS', 'HOUSEHOLDS RETURNED', 'RETURN RATE PER HOUSEHOLD', 'AVG / HOUSEHOLD']],
      body: [[
        String(totalHH),
        String(returnedHH),
        `${returnRate}%`,
        `Rs. ${avgPerHH.toLocaleString('en-IN')}`
      ]],
      theme: 'grid',
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [0, 0, 0],
        fontSize: isLandscape ? 6.5 : 6,
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: isLandscape ? 1.2 : 0.8
      },
      bodyStyles: {
        fontSize: isLandscape ? 7.5 : 7,
        fontStyle: 'bold',
        halign: 'center',
        textColor: [0, 0, 0],
        cellPadding: isLandscape ? 1.4 : 1
      },
      margin: { left: margin, right: margin }
    });
    currentY = doc.lastAutoTable.finalY + 4;
  } else {
    currentY = doc.lastAutoTable.finalY + 5;
  }

  let tableHead, tableBody, tableFoot, colStyles;

  if (tableType === 'monthly_breakdown') {
    // 12 Months Breakdown
    tableHead = [['Sl', 'Month (Period)', 'PTR (₹)', 'RT (₹)', 'Tch (₹)', 'Bldg (₹)', 'Total (₹)']];
    tableBody = (bialsBreakdown || []).map((m, idx) => [
      idx + 1,
      m.month_name || `Month ${idx + 1}`,
      (m.pathian_ram || 0).toLocaleString('en-IN'),
      (m.ramthar || 0).toLocaleString('en-IN'),
      (m.tualchhung || 0).toLocaleString('en-IN'),
      (m.building || 0).toLocaleString('en-IN'),
      (m.total || 0).toLocaleString('en-IN')
    ]);
    tableFoot = [['', 'ANNUAL TOTAL', pr, rt, tch, bldg, grandTotal]];
    colStyles = {
      0: { halign: 'center', cellWidth: 10, textColor: [0, 0, 0] },
      1: { halign: 'left', fontStyle: 'bold', textColor: [0, 0, 0] },
      2: { halign: 'right', cellWidth: isLandscape ? 38 : 24, textColor: [0, 0, 0] },
      3: { halign: 'right', cellWidth: isLandscape ? 38 : 24, textColor: [0, 0, 0] },
      4: { halign: 'right', cellWidth: isLandscape ? 38 : 24, textColor: [0, 0, 0] },
      5: { halign: 'right', cellWidth: isLandscape ? 38 : 24, textColor: [0, 0, 0] },
      6: { halign: 'right', cellWidth: isLandscape ? 44 : 28, fontStyle: 'bold', textColor: [0, 0, 0], fillColor: [240, 253, 244] }
    };
  } else if (tableType === 'members' || tableType === 'member_annual_summary') {
    // Member-Level Ledger / Member Annual Summary
    tableHead = [['Sl', 'Member Name', 'PTR (₹)', 'RT (₹)', 'Tch (₹)', 'Bldg (₹)', 'Total (₹)']];
    tableBody = (bialsBreakdown || []).map((m, idx) => [
      m.sl_no || idx + 1,
      m.name || m.member_name,
      (m.total_pathian_ram || m.pathian_ram || 0).toLocaleString('en-IN'),
      (m.total_ramthar || m.ramthar || 0).toLocaleString('en-IN'),
      (m.total_tualchhung || m.tualchhung || 0).toLocaleString('en-IN'),
      (m.total_building || m.building || 0).toLocaleString('en-IN'),
      (m.grand_total || m.total || 0).toLocaleString('en-IN')
    ]);
    tableFoot = [['', `GRAND TOTAL (${bialsBreakdown.length} Households)`, pr, rt, tch, bldg, grandTotal]];
    colStyles = {
      0: { halign: 'center', cellWidth: 10, textColor: [0, 0, 0] },
      1: { halign: 'left', fontStyle: 'bold', textColor: [0, 0, 0] },
      2: { halign: 'right', cellWidth: isLandscape ? 38 : 24, textColor: [0, 0, 0] },
      3: { halign: 'right', cellWidth: isLandscape ? 38 : 24, textColor: [0, 0, 0] },
      4: { halign: 'right', cellWidth: isLandscape ? 38 : 24, textColor: [0, 0, 0] },
      5: { halign: 'right', cellWidth: isLandscape ? 38 : 24, textColor: [0, 0, 0] },
      6: { halign: 'right', cellWidth: isLandscape ? 44 : 28, fontStyle: 'bold', textColor: [0, 0, 0], fillColor: [240, 253, 244] }
    };
  } else {
    // All Bials Table
    const bialTotalHH = (bialsBreakdown || []).reduce((acc, b) => acc + (b.total_members || b.member_count || 0), 0);
    const bialTotalRet = (bialsBreakdown || []).reduce((acc, b) => acc + (b.returned_members || 0), 0);
    const bialOverallRate = bialTotalHH > 0 ? Math.round((bialTotalRet / bialTotalHH) * 1000) / 10 : 0;

    tableHead = [['Sl', 'Bial / Unit', 'HH', 'Ret', 'Rate %', 'PTR (₹)', 'RT (₹)', 'Tch (₹)', 'Bldg (₹)', 'Total (₹)']];
    tableBody = (bialsBreakdown || []).map((b, idx) => [
      idx + 1,
      b.name || b.bial_name || `Bial ${idx + 1}`,
      b.total_members || b.member_count || '-',
      b.returned_members !== undefined ? b.returned_members : '-',
      b.return_rate !== undefined ? `${b.return_rate}%` : '-',
      (b.total_pathian_ram || b.pathian_ram || 0).toLocaleString('en-IN'),
      (b.total_ramthar || b.ramthar || 0).toLocaleString('en-IN'),
      (b.total_tualchhung || b.tualchhung || 0).toLocaleString('en-IN'),
      (b.total_building || b.building || 0).toLocaleString('en-IN'),
      (b.total_collected || b.total || 0).toLocaleString('en-IN')
    ]);
    tableFoot = [['', 'GRAND TOTAL', bialTotalHH || '-', bialTotalRet || '-', `${bialOverallRate}%`, pr, rt, tch, bldg, grandTotal]];
    colStyles = {
      0: { halign: 'center', cellWidth: 8, textColor: [0, 0, 0] },
      1: { halign: 'left', fontStyle: 'bold', textColor: [0, 0, 0] },
      2: { halign: 'center', cellWidth: isLandscape ? 16 : 12, textColor: [0, 0, 0] },
      3: { halign: 'center', cellWidth: isLandscape ? 16 : 12, textColor: [0, 0, 0] },
      4: { halign: 'center', cellWidth: isLandscape ? 18 : 14, textColor: [0, 0, 0], fontStyle: 'bold' },
      5: { halign: 'right', cellWidth: isLandscape ? 28 : 20, textColor: [0, 0, 0] },
      6: { halign: 'right', cellWidth: isLandscape ? 28 : 20, textColor: [0, 0, 0] },
      7: { halign: 'right', cellWidth: isLandscape ? 28 : 20, textColor: [0, 0, 0] },
      8: { halign: 'right', cellWidth: isLandscape ? 28 : 20, textColor: [0, 0, 0] },
      9: { halign: 'right', cellWidth: isLandscape ? 34 : 24, fontStyle: 'bold', textColor: [0, 0, 0], fillColor: [240, 253, 244] }
    };
  }

  doc.autoTable({
    startY: currentY,
    head: tableHead,
    body: tableBody,
    foot: tableFoot,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: isLandscape ? 8 : 7.5,
      fontStyle: 'bold',
      cellPadding: isLandscape ? 1.8 : 1.3
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: isLandscape ? 8.5 : 8,
      fontStyle: 'bold',
      cellPadding: isLandscape ? 1.8 : 1.3
    },
    bodyStyles: {
      fontSize: isLandscape ? 8 : 7.5,
      cellPadding: isLandscape ? 1.6 : 1.2
    },
    columnStyles: colStyles,
    margin: { left: margin, right: margin }
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // Compute footer heights for perfect vertical alignment
  const sigHMM = signatureBase64 ? Math.min(signatureSize * 0.264583, 16) : 0;
  const textBlockHeight = 14;
  const totalSigHeight = sigHMM + (signatureBase64 ? 2 : 0) + textBlockHeight;
  const sealSizeMM = sealBase64 ? Math.min(sealSize * 0.264583, 30) : 0;
  const blockHeight = Math.max(totalSigHeight, sealSizeMM);

  // Pin the footer to the bottom of the page for all bials (even with only 2 members!)
  const bottomPinnedY = pageHeight - margin - blockHeight - 3;
  if (currentY < bottomPinnedY) {
    currentY = bottomPinnedY;
  } else if (currentY + blockHeight > pageHeight - margin) {
    doc.addPage();
    currentY = pageHeight - margin - blockHeight - 3;
  }

  // Draw Centered Seal / Stamp aligned vertically with the signatory block
  if (sealBase64) {
    const sealY = currentY + ((blockHeight - sealSizeMM) / 2);
    doc.addImage(sealBase64, 'PNG', centerX - (sealSizeMM / 2), sealY, sealSizeMM, sealSizeMM);
  }

  // Signatory Information Box (Centered with respect to each other at the right footer, NO horizontal line)
  const sigBoxWidth = 60;
  const signCenterX = pageWidth - margin - (sigBoxWidth / 2);
  let sigY = currentY + ((blockHeight - totalSigHeight) / 2);

  // Draw Signature above the name if uploaded
  if (signatureBase64) {
    const sigWMM = Math.min(sigHMM * 2.5, sigBoxWidth);
    doc.addImage(signatureBase64, 'PNG', signCenterX - (sigWMM / 2), sigY, sigWMM, sigHMM);
    sigY += sigHMM + 2;
  } else {
    sigY += 2;
  }

  // Helper for font style from B/I
  const getStyle = (b, i) => (b && i ? 'bolditalic' : b ? 'bold' : i ? 'italic' : 'normal');

  // Name (Centered relative to Designation & Org)
  doc.setFont('helvetica', getStyle(signatory.nameBold, signatory.nameItalic));
  doc.setFontSize(8.5);
  doc.setTextColor(0, 0, 0);
  const nameStr = signatory.name || 'Authorised Signatory';
  doc.text(nameStr, signCenterX, sigY + 3.5, { align: 'center' });
  if (signatory.nameUnderline) {
    const textW = doc.getTextWidth(nameStr);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.line(signCenterX - (textW / 2), sigY + 4.1, signCenterX + (textW / 2), sigY + 4.1);
  }

  // Designation (Centered relative to Name & Org)
  doc.setFont('helvetica', getStyle(signatory.desigBold, signatory.desigItalic));
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  const desigStr = signatory.designation || 'Treasurer / Bial Secretary';
  doc.text(desigStr, signCenterX, sigY + 7.5, { align: 'center' });
  if (signatory.desigUnderline) {
    const textW = doc.getTextWidth(desigStr);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.line(signCenterX - (textW / 2), sigY + 8.1, signCenterX + (textW / 2), sigY + 8.1);
  }

  // Organization (Centered relative to Name & Designation)
  doc.setFont('helvetica', getStyle(signatory.orgBold, signatory.orgItalic));
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  const orgStr = signatory.organization || 'Presbyterian Church of India';
  doc.text(orgStr, signCenterX, sigY + 11.5, { align: 'center' });
  if (signatory.orgUnderline) {
    const textW = doc.getTextWidth(orgStr);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.line(signCenterX - (textW / 2), sigY + 12.1, signCenterX + (textW / 2), sigY + 12.1);
  }

  const safeScope = scopeName ? `_${scopeName.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
  const safeTitle = `Pathian_Ram_Official_Report_${reportType.replace(/[^a-zA-Z0-9]/g, '_')}${safeScope}_${year}.pdf`;

  if (isPrint) {
    doc.autoPrint();
    const blobUrl = doc.output('bloburl');
    const printWindow = window.open(blobUrl, '_blank');
    if (!printWindow) {
      doc.save(`Print_${safeTitle}`);
    }
  } else {
    doc.save(safeTitle);
  }
}

/**
 * Official Church Certificate & Report Excel Generator (.xlsx)
 */
export function exportOfficialCertificateExcel({
  title = 'PATHIAN RAM REPORT',
  denomination = 'Presbyterian Church of India',
  churchName = 'Bethlehem Kohhran',
  periodText = 'Annual Financial Report',
  reportType = 'Annual',
  year = new Date().getFullYear(),
  grandTotals = {},
  bialsBreakdown = [],
  signatory = {},
  tableType = 'bials',
  scopeName = ''
}) {
  const pr = grandTotals.total_pathian_ram || 0;
  const rt = grandTotals.total_ramthar || 0;
  const tch = grandTotals.total_tualchhung || 0;
  const bldg = grandTotals.total_building || 0;
  const grandTotal = grandTotals.grand_total || 0;

  const totalHH = grandTotals.total_system_members || (bialsBreakdown || []).reduce((acc, b) => acc + (b.total_members || b.member_count || 0), 0) || bialsBreakdown.length;
  const returnedHH = grandTotals.total_returned_members || (bialsBreakdown || []).reduce((acc, b) => acc + (b.returned_members || 0), 0) || (bialsBreakdown || []).filter(m => (m.grand_total || m.total || 0) > 0).length;
  const returnRate = grandTotals.overall_return_rate !== undefined ? grandTotals.overall_return_rate : (totalHH > 0 ? Math.round((returnedHH / totalHH) * 1000) / 10 : 0);
  const avgPerHH = grandTotals.avg_contribution_per_member || (returnedHH > 0 ? Math.round(grandTotal / returnedHH) : 0);

  const sheetData = [
    [denomination.toUpperCase()],
    [churchName],
    [title.toUpperCase()],
    [`Period: ${periodText}`],
    [`Bial / Scope: ${scopeName || 'All Bials Combined'}`],
    [`Date of Issue: ${signatory.date || new Date().toLocaleDateString('en-GB')}`],
    [],
    ['EXECUTIVE SUMMARY TOTALS'],
    ['Pathian Ram (₹)', 'Ramthar (₹)', 'Tualchhung (₹)', 'Building (₹)', 'TOTAL (₹)', 'Total Households', 'Households Returned', 'Return Rate per Household (%)', 'Avg / Household (₹)'],
    [pr, rt, tch, bldg, grandTotal, totalHH, returnedHH, `${returnRate}%`, avgPerHH],
    [],
    ['CONTRIBUTIONS BREAKDOWN']
  ];

  let colWidths;

  if (tableType === 'monthly_breakdown') {
    sheetData.push(['Sl No', 'Month', 'PTR (₹)', 'RT (₹)', 'Tch (₹)', 'Bldg (₹)', 'Total (₹)']);
    (bialsBreakdown || []).forEach((m, idx) => {
      sheetData.push([
        idx + 1,
        m.month_name || `Month ${idx + 1}`,
        m.pathian_ram || 0,
        m.ramthar || 0,
        m.tualchhung || 0,
        m.building || 0,
        m.total || 0
      ]);
    });
    sheetData.push(['', 'ANNUAL TOTAL', pr, rt, tch, bldg, grandTotal]);
    colWidths = [{ wch: 8 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 }];
  } else if (tableType === 'members' || tableType === 'member_annual_summary') {
    sheetData.push(['Sl No', 'Member Name', 'PTR (₹)', 'RT (₹)', 'Tch (₹)', 'Bldg (₹)', 'Total (₹)']);
    (bialsBreakdown || []).forEach((m, idx) => {
      sheetData.push([
        m.sl_no || idx + 1,
        m.name || m.member_name,
        m.total_pathian_ram || m.pathian_ram || 0,
        m.total_ramthar || m.ramthar || 0,
        m.total_tualchhung || m.tualchhung || 0,
        m.total_building || m.building || 0,
        m.grand_total || m.total || 0
      ]);
    });
    sheetData.push(['', `GRAND TOTAL (${bialsBreakdown.length} Members)`, pr, rt, tch, bldg, grandTotal]);
    colWidths = [{ wch: 8 }, { wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 }];
  } else {
    sheetData.push(['Sl No', 'Bial Name', 'Total HH', 'Returned HH', 'Return Rate (%)', 'PTR (₹)', 'RT (₹)', 'Tch (₹)', 'Bldg (₹)', 'Total (₹)']);
    (bialsBreakdown || []).forEach((b, idx) => {
      sheetData.push([
        idx + 1,
        b.name || b.bial_name || `Bial ${idx + 1}`,
        b.total_members || b.member_count || b.members_count || 0,
        b.returned_members ?? '-',
        b.return_rate !== undefined ? `${b.return_rate}%` : '-',
        b.total_pathian_ram || b.pathian_ram || 0,
        b.total_ramthar || b.ramthar || 0,
        b.total_tualchhung || b.tualchhung || 0,
        b.total_building || b.building || 0,
        b.total_collected || b.total || 0
      ]);
    });
    sheetData.push(['', 'GRAND TOTAL', totalHH, returnedHH, `${returnRate}%`, pr, rt, tch, bldg, grandTotal]);
    colWidths = [{ wch: 8 }, { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 }];
  }

  sheetData.push([]);
  sheetData.push(['VERIFIED & CERTIFIED BY:']);
  sheetData.push(['Name:', signatory.name || 'Authorised Signatory']);
  sheetData.push(['Designation:', signatory.designation || 'Treasurer / Bial Secretary']);
  sheetData.push(['Organization:', signatory.organization || denomination]);

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Official Report');

  const safeScope = scopeName ? `_${scopeName.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
  const safeTitle = `Pathian_Ram_Official_Report_${reportType.replace(/[^a-zA-Z0-9]/g, '_')}${safeScope}_${year}.xlsx`;
  XLSX.writeFile(workbook, safeTitle);
}

/**
 * Consolidated Annual Member Contribution Booklet (A5 Portrait Layout, Single Column, Sequential Bial Order)
 */
export function exportConsolidatedBookletPDF({
  year = new Date().getFullYear(),
  bialsData = [],
  churchTotals = {}
}) {
  // Explicitly initialize jsPDF in portrait mode for A5 paper (148mm x 210mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5'
  });

  const pageWidth = 148;
  const pageHeight = 210;
  const marginLeft = 10;
  const marginRight = 10;
  const marginTop = 16;
  const marginBottom = 12;
  const colWidth = pageWidth - marginLeft - marginRight; // 128mm
  const colX = marginLeft; // 10mm

  let currentY = marginTop;
  let pageNum = 1;
  let globalSlNo = 1;

  const drawPageHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text('BETHLEHEM KOHHRAN', pageWidth / 2, 6.5, { align: 'center' });

    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`PATHIAN RAM — ANNUAL MEMBER BOOKLET (FY ${year}-${year + 1})`, pageWidth / 2, 10.5, { align: 'center' });

    doc.setLineWidth(0.3);
    doc.setDrawColor(0, 0, 0);
    doc.line(marginLeft, 12.8, pageWidth - marginRight, 12.8);
  };

  const drawPageFooter = () => {
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(0, 0, 0);
      doc.text(`Consolidated Annual Booklet • FY ${year}-${year + 1}`, marginLeft, pageHeight - 5);
      doc.text(`Page ${p} of ${totalPages}`, pageWidth - marginRight, pageHeight - 5, { align: 'right' });
    }
  };

  const checkSpace = (neededHeight) => {
    if (currentY + neededHeight > pageHeight - marginBottom) {
      doc.addPage('a5', 'portrait');
      pageNum++;
      drawPageHeader();
      currentY = marginTop;
    }
  };

  // Draw initial page header
  drawPageHeader();

  let churchTotalHH = 0;
  let churchReturnedHH = 0;

  // Sort Bials strictly starting from the First Bial (Bial 1 / B1) in natural sequential order
  const sortedBials = [...bialsData].sort((a, b) => {
    const codeA = a.bial_code || a.code || '';
    const codeB = b.bial_code || b.code || '';
    const numA = parseInt(codeA.replace(/\D/g, '') || a.bial_id || a.id) || 0;
    const numB = parseInt(codeB.replace(/\D/g, '') || b.bial_id || b.id) || 0;
    if (numA !== numB) return numA - numB;
    return (a.bial_name || a.name || '').localeCompare(b.bial_name || b.name || '', undefined, { numeric: true });
  });

  // Process Bials in natural order (Bial 1, Bial 2, Bial 3...)
  sortedBials.forEach((bialGroup) => {
    const bialName = bialGroup.bial_name || bialGroup.name || 'Bial';
    const bialCode = bialGroup.bial_code || bialGroup.code || '';
    const members = [...(bialGroup.members || [])].sort((m1, m2) => (parseInt(m1.sl_no) || 0) - (parseInt(m2.sl_no) || 0));
    const bialTotalHH = members.length;
    const bialReturnedHH = members.filter(m => (parseFloat(m.grand_total || m.total) || 0) > 0).length;
    const bialReturnRate = bialTotalHH > 0 ? Math.round((bialReturnedHH / bialTotalHH) * 1000) / 10 : 0;

    churchTotalHH += bialTotalHH;
    churchReturnedHH += bialReturnedHH;

    // Draw Bial Header Banner (Single column)
    checkSpace(14);
    doc.setFillColor(241, 245, 249); // slate-100
    doc.setDrawColor(0, 0, 0);
    doc.roundedRect(colX, currentY, colWidth, 5.5, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    const headerTitle = `${bialCode ? `${bialCode} - ` : ''}${bialName} (${bialTotalHH} HH • ${bialReturnedHH} Ret • ${bialReturnRate}% Return Rate)`;
    doc.text(headerTitle, colX + 2.5, currentY + 3.8);

    currentY += 6.5;

    // Draw Table Sub-header (Single column, Rs. currency notation)
    checkSpace(6);
    doc.setFillColor(226, 232, 240); // slate-200
    doc.rect(colX, currentY, colWidth, 4.6, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(0, 0, 0);
    doc.text('Sl', colX + 1.5, currentY + 3.1);
    doc.text('Member Name', colX + 8, currentY + 3.1);
    doc.text('PTR (Rs)', colX + 58, currentY + 3.1, { align: 'right' });
    doc.text('RT (Rs)', colX + 74, currentY + 3.1, { align: 'right' });
    doc.text('Tch (Rs)', colX + 90, currentY + 3.1, { align: 'right' });
    doc.text('Bldg (Rs)', colX + 104, currentY + 3.1, { align: 'right' });
    doc.text('Total (Rs)', colX + 126, currentY + 3.1, { align: 'right' });

    currentY += 4.8;

    let bialPR = 0, bialRT = 0, bialTch = 0, bialBldg = 0, bialTotal = 0;

    // Loop Members
    members.forEach((m, idx) => {
      checkSpace(4.2);

      const pr = parseFloat(m.total_pathian_ram || m.pathian_ram) || 0;
      const rt = parseFloat(m.total_ramthar || m.ramthar) || 0;
      const tch = parseFloat(m.total_tualchhung || m.tualchhung) || 0;
      const bldg = parseFloat(m.total_building || m.building) || 0;
      const total = parseFloat(m.grand_total || m.total) || (pr + rt + tch + bldg);

      bialPR += pr;
      bialRT += rt;
      bialTch += tch;
      bialBldg += bldg;
      bialTotal += total;

      // Alternating row background
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(colX, currentY - 0.4, colWidth, 4.0, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(0, 0, 0);

      // Continuous Sl No across all Bials
      doc.text(String(globalSlNo++), colX + 1.5, currentY + 2.4);

      const mName = String(m.member_name || m.name || '');
      doc.text(mName.length > 24 ? mName.substring(0, 24) + '..' : mName, colX + 8, currentY + 2.4);

      doc.setFont('helvetica', 'bold');
      doc.text(pr > 0 ? pr.toLocaleString('en-IN') : '-', colX + 58, currentY + 2.4, { align: 'right' });
      doc.text(rt > 0 ? rt.toLocaleString('en-IN') : '-', colX + 74, currentY + 2.4, { align: 'right' });
      doc.text(tch > 0 ? tch.toLocaleString('en-IN') : '-', colX + 90, currentY + 2.4, { align: 'right' });
      doc.text(bldg > 0 ? bldg.toLocaleString('en-IN') : '-', colX + 104, currentY + 2.4, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(total > 0 ? `Rs. ${total.toLocaleString('en-IN')}` : '0', colX + 126, currentY + 2.4, { align: 'right' });

      currentY += 4.2;
    });

    // Draw Bial Subtotal Row
    checkSpace(5.5);
    doc.setFillColor(224, 231, 255); // indigo-100
    doc.rect(colX, currentY, colWidth, 4.8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(0, 0, 0);
    doc.text(`Subtotal (${bialCode || bialName}) • ${bialReturnRate}% Ret (${bialReturnedHH}/${bialTotalHH} HH)`, colX + 2.5, currentY + 3.2);

    doc.text(bialPR.toLocaleString('en-IN'), colX + 58, currentY + 3.2, { align: 'right' });
    doc.text(bialRT.toLocaleString('en-IN'), colX + 74, currentY + 3.2, { align: 'right' });
    doc.text(bialTch.toLocaleString('en-IN'), colX + 90, currentY + 3.2, { align: 'right' });
    doc.text(bialBldg.toLocaleString('en-IN'), colX + 104, currentY + 3.2, { align: 'right' });
    doc.text(`Rs. ${bialTotal.toLocaleString('en-IN')}`, colX + 126, currentY + 3.2, { align: 'right' });

    currentY += 7.0;
  });

  // Final Church Grand Total Box (100% Black Text)
  checkSpace(14);
  const finalX = colX;
  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(0, 0, 0);
  doc.roundedRect(finalX, currentY, colWidth, 12, 1.2, 1.2, 'FD');

  const gPR = churchTotals.total_pathian_ram || sortedBials.reduce((acc, b) => acc + (b.subtotal?.total_pathian_ram || 0), 0);
  const gRT = churchTotals.total_ramthar || sortedBials.reduce((acc, b) => acc + (b.subtotal?.total_ramthar || 0), 0);
  const gTch = churchTotals.total_tualchhung || sortedBials.reduce((acc, b) => acc + (b.subtotal?.total_tualchhung || 0), 0);
  const gBldg = churchTotals.total_building || sortedBials.reduce((acc, b) => acc + (b.subtotal?.total_building || 0), 0);
  const gTotal = churchTotals.grand_total || sortedBials.reduce((acc, b) => acc + (b.subtotal?.grand_total || 0), 0);

  const overallChurchReturnRate = churchTotalHH > 0 ? Math.round((churchReturnedHH / churchTotalHH) * 1000) / 10 : 0;
  const avgPerHH = churchReturnedHH > 0 ? Math.round(gTotal / churchReturnedHH) : 0;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(0, 0, 0);
  doc.text(`KOHHRAN GRAND TOTAL (${churchTotalHH} HH • ${churchReturnedHH} Ret • ${overallChurchReturnRate}% Return Rate)`, finalX + 3, currentY + 4.5);

  doc.setFontSize(6.2);
  doc.setTextColor(0, 0, 0);
  doc.text(`PTR: Rs.${gPR.toLocaleString('en-IN')} | RT: Rs.${gRT.toLocaleString('en-IN')} | Tch: Rs.${gTch.toLocaleString('en-IN')} | Bldg: Rs.${gBldg.toLocaleString('en-IN')} | Avg/HH: Rs.${avgPerHH.toLocaleString('en-IN')}`, finalX + 3, currentY + 8.8);

  doc.setFontSize(9.0);
  doc.setTextColor(0, 0, 0);
  doc.text(`Rs. ${gTotal.toLocaleString('en-IN')}`, finalX + 125, currentY + 6.8, { align: 'right' });

  // Draw Page Footers on all pages
  drawPageFooter();

  doc.save(`Consolidated_Annual_Booklet_A5_${year}.pdf`);
}

/**
 * Consolidated Annual Member Contribution Booklet Excel Export (.xlsx)
 */
export function exportConsolidatedBookletExcel({
  year = new Date().getFullYear(),
  bialsData = [],
  churchTotals = {}
}) {
  const sheetData = [
    ['BETHLEHEM KOHHRAN'],
    ['PATHIAN RAM — CONSOLIDATED ANNUAL MEMBER CONTRIBUTION BOOKLET'],
    [`Period: Financial Year ${year} - ${year + 1} (12 Months Aggregated)`],
    [`Generated On: ${new Date().toLocaleString()}`],
    [],
    ['Sl No', 'Member Name', 'Bial Code', 'Bial Name', 'Pathian Ram (₹)', 'Ramthar (₹)', 'Tualchhung (₹)', 'Building (₹)', 'TOTAL (₹)']
  ];

  let globalSlNo = 1;
  let churchPR = 0, churchRT = 0, churchTch = 0, churchBldg = 0, churchTotal = 0;
  let churchTotalHH = 0;
  let churchReturnedHH = 0;

  // Sort Bials strictly starting from the First Bial (Bial 1 / B1) in natural sequential order
  const sortedBials = [...bialsData].sort((a, b) => {
    const codeA = a.bial_code || a.code || '';
    const codeB = b.bial_code || b.code || '';
    const numA = parseInt(codeA.replace(/\D/g, '') || a.bial_id || a.id) || 0;
    const numB = parseInt(codeB.replace(/\D/g, '') || b.bial_id || b.id) || 0;
    if (numA !== numB) return numA - numB;
    return (a.bial_name || a.name || '').localeCompare(b.bial_name || b.name || '', undefined, { numeric: true });
  });

  sortedBials.forEach((bialGroup) => {
    const bialName = bialGroup.bial_name || bialGroup.name || 'Bial';
    const bialCode = bialGroup.bial_code || bialGroup.code || '';
    const members = [...(bialGroup.members || [])].sort((m1, m2) => (parseInt(m1.sl_no) || 0) - (parseInt(m2.sl_no) || 0));
    const bialTotalHH = members.length;
    const bialReturnedHH = members.filter(m => (parseFloat(m.grand_total || m.total) || 0) > 0).length;
    const bialReturnRate = bialTotalHH > 0 ? Math.round((bialReturnedHH / bialTotalHH) * 1000) / 10 : 0;

    churchTotalHH += bialTotalHH;
    churchReturnedHH += bialReturnedHH;

    // Bial Section Divider Header
    sheetData.push([`--- ${bialCode ? `${bialCode}: ` : ''}${bialName.toUpperCase()} (${bialTotalHH} HH • ${bialReturnedHH} Returned • ${bialReturnRate}% Return Rate) ---`, '', '', '', '', '', '', '', '']);

    let bialPR = 0, bialRT = 0, bialTch = 0, bialBldg = 0, bialTotal = 0;

    members.forEach((m) => {
      const pr = parseFloat(m.total_pathian_ram || m.pathian_ram) || 0;
      const rt = parseFloat(m.total_ramthar || m.ramthar) || 0;
      const tch = parseFloat(m.total_tualchhung || m.tualchhung) || 0;
      const bldg = parseFloat(m.total_building || m.building) || 0;
      const total = parseFloat(m.grand_total || m.total) || (pr + rt + tch + bldg);

      bialPR += pr;
      bialRT += rt;
      bialTch += tch;
      bialBldg += bldg;
      bialTotal += total;

      sheetData.push([
        globalSlNo++,
        m.member_name || m.name,
        bialCode,
        bialName,
        pr,
        rt,
        tch,
        bldg,
        total
      ]);
    });

    churchPR += bialPR;
    churchRT += bialRT;
    churchTch += bialTch;
    churchBldg += bialBldg;
    churchTotal += bialTotal;

    // Bial Subtotal Row
    sheetData.push([
      `Subtotal (${bialCode || bialName})`,
      `${bialTotalHH} HH • ${bialReturnedHH} Ret (${bialReturnRate}%)`,
      '',
      '',
      bialPR,
      bialRT,
      bialTch,
      bialBldg,
      bialTotal
    ]);

    sheetData.push([]); // Empty spacing row
  });

  const churchReturnRate = churchTotalHH > 0 ? Math.round((churchReturnedHH / churchTotalHH) * 1000) / 10 : 0;
  const avgPerHH = churchReturnedHH > 0 ? Math.round(churchTotal / churchReturnedHH) : 0;

  // Church Grand Total Row
  sheetData.push([
    'KOHHRAN GRAND TOTAL',
    `${churchTotalHH} HH • ${churchReturnedHH} Ret (${churchReturnRate}% Return Rate) • Avg/HH: ₹${avgPerHH}`,
    '',
    '',
    churchPR,
    churchRT,
    churchTch,
    churchBldg,
    churchTotal
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  worksheet['!cols'] = [
    { wch: 8 },  // Sl No
    { wch: 28 }, // Member Name
    { wch: 12 }, // Bial Code
    { wch: 24 }, // Bial Name
    { wch: 16 }, // Pathian Ram
    { wch: 16 }, // Ramthar
    { wch: 16 }, // Tualchhung
    { wch: 16 }, // Building
    { wch: 18 }  // TOTAL
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Consolidated Booklet');

  XLSX.writeFile(workbook, `Consolidated_Annual_Booklet_FY_${year}.xlsx`);
}







