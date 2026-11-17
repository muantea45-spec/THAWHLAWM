import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';

function formatINR(val) {
  if (!val && val !== 0) return '0';
  const num = Number(val);
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-IN');
}

function hexToRgba(hex, alpha = 0.1) {
  if (!hex || typeof hex !== 'string') return `rgba(99, 102, 241, ${alpha})`;
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(99, 102, 241, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    padding: 12,
    fontFamily: 'Helvetica',
  },
  receiptCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1.2,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 14,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 10,
    marginBottom: 10,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  logoSpacer: {
    width: 44,
    height: 44,
  },
  headerTextContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  churchTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  receiptSubtitle: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
    textAlign: 'center',
  },
  headerMeta: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
  },
  memberBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 9,
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 1.5,
  },
  detailLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
  },
  breakdownList: {
    marginBottom: 10,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 7,
    borderWidth: 1,
    marginBottom: 3.5,
  },
  categoryLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  categoryAmount: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
  },
  grandTotalBar: {
    backgroundColor: '#065f46',
    borderRadius: 9,
    paddingVertical: 7,
    paddingHorizontal: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  grandTotalLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#a7f3d0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grandTotalAmount: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
  },
  footerText: {
    textAlign: 'center',
    fontSize: 8,
    fontFamily: 'Helvetica-Oblique',
    color: '#64748b',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 6,
  },
});

export default function DigitalReceiptPDFDocument({
  member,
  monthName,
  year,
  bialName,
  columns = [],
  grandTotal = 0,
  receiptDate,
  logoBase64
}) {
  const safeYear = Number(year) || new Date().getFullYear();
  const pageHeight = Math.max(440, 310 + ((columns?.length || 4) * 28));

  return (
    <Document title={`Receipt_${member?.name || 'Member'}_${monthName}_${safeYear}`}>
      <Page size={[320, pageHeight]} style={styles.page}>
        <View style={styles.receiptCard}>
          {/* Header Identity */}
          <View style={styles.headerRow}>
            {logoBase64 ? (
              <Image src={logoBase64} style={styles.logo} />
            ) : (
              <View style={[styles.logo, { backgroundColor: '#e2e8f0' }]} />
            )}
            <View style={styles.headerTextContainer}>
              <Text style={styles.churchTitle}>Bethlehem Kohhran</Text>
              <Text style={styles.receiptSubtitle}>Pathian Ram Khawnna Receipt</Text>
              <Text style={styles.headerMeta}>FY {safeYear}-{safeYear + 1} • Date: {receiptDate}</Text>
            </View>
            <View style={styles.logoSpacer} />
          </View>

          {/* Member Details */}
          <View style={styles.memberBox}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Bial:</Text>
              <Text style={styles.detailValue}>{bialName || 'Bial'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Member Name:</Text>
              <Text style={styles.detailValue}>{member?.name} ({member?.sl_no})</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Month:</Text>
              <Text style={styles.detailValue}>{monthName} {safeYear}</Text>
            </View>
          </View>

          {/* Category Breakdown Table */}
          <View style={styles.breakdownList}>
            {columns.map(col => {
              const bg = hexToRgba(col.color || '#6366f1', 0.08);
              const border = hexToRgba(col.color || '#6366f1', 0.25);
              const textCol = col.color || '#1e293b';
              return (
                <View
                  key={col.id}
                  style={[
                    styles.categoryRow,
                    { backgroundColor: bg, borderColor: border }
                  ]}
                >
                  <Text style={[styles.categoryLabel, { color: textCol }]}>
                    {col.name} ({col.code})
                  </Text>
                  <Text style={styles.categoryAmount}>
                    ₹{formatINR(col.amount)}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Grand Total Bar */}
          <View style={styles.grandTotalBar}>
            <Text style={styles.grandTotalLabel}>TOTAL PAID</Text>
            <Text style={styles.grandTotalAmount}>₹{formatINR(grandTotal)}</Text>
          </View>

          {/* Footer Note */}
          <Text style={styles.footerText}>
            Lalpan tam takin malsawm che rawh se.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
