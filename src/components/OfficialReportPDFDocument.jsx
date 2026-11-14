import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';

function formatINR(val) {
  if (!val && val !== 0) return '0';
  const num = Number(val);
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-IN');
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    padding: 14,
    fontFamily: 'Helvetica',
  },
  outerBorder: {
    borderWidth: 1.5,
    borderColor: '#1e293b',
    borderRadius: 8,
    padding: 3,
    flex: 1,
  },
  innerBorder: {
    borderWidth: 0.75,
    borderColor: '#d97706',
    borderRadius: 6,
    padding: 10,
    flex: 1,
    justifyContent: 'space-between',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  denominationText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  churchText: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginTop: 1,
  },
  logoImage: {
    width: 38,
    height: 38,
    marginVertical: 2.5,
    alignSelf: 'center',
    borderRadius: 19,
  },
  reportTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  periodBadge: {
    backgroundColor: '#f8fafc',
    borderWidth: 0.75,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingVertical: 1.5,
    paddingHorizontal: 7,
    marginTop: 2,
    alignSelf: 'center',
  },
  periodBadgeText: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  scopeText: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginTop: 2,
  },
  dividerLine: {
    width: 50,
    height: 1.5,
    backgroundColor: '#000000',
    alignSelf: 'center',
    marginTop: 3,
    borderRadius: 1,
  },
  issueDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 0.75,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 2.5,
    marginBottom: 4,
    marginTop: 2,
  },
  issueDateText: {
    fontSize: 7.5,
    color: '#000000',
  },
  currencyText: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  cardsContainer: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 5,
  },
  card: {
    flex: 1,
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderRadius: 4,
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 1,
    color: '#000000',
  },
  cardValue: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
  },
  tableContainer: {
    borderWidth: 0.75,
    borderColor: '#94a3b8',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 2,
    flexGrow: 1,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 0.75,
    borderBottomColor: '#94a3b8',
    alignItems: 'center',
    paddingVertical: 2.5,
  },
  tableHeaderCell: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    paddingHorizontal: 2,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    alignItems: 'center',
    paddingVertical: 2,
  },
  tableRowEven: {
    backgroundColor: '#ffffff',
  },
  tableRowOdd: {
    backgroundColor: '#f8fafc',
  },
  tableCell: {
    fontSize: 6.5,
    color: '#000000',
    paddingHorizontal: 2,
  },
  tableFooterRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderTopWidth: 1,
    borderTopColor: '#94a3b8',
    alignItems: 'center',
    paddingVertical: 3,
  },
  tableFooterCell: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    paddingHorizontal: 2,
  },
  footerSection: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerCol: {
    width: '33%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  signatoryText: {
    textAlign: 'center',
  },
});

export default function OfficialReportPDFDocument({
  title = 'PATHIAN RAM REPORT',
  denomination = 'Presbyterian Church of India',
  churchName = 'Bethlehem Kohhran',
  periodText = 'Annual Financial Report',
  scopeName = 'All Bials Combined',
  issueDate = new Date().toLocaleDateString('en-GB'),
  pageSize = 'a4',
  orientation = 'portrait',
  logoBase64 = null,
  totals = {},
  tableType = 'bials',
  breakdown = [],
  signatory = {},
  signatureBase64 = null,
  signatureSize = 45,
  sealBase64 = null,
  sealSize = 65,
}) {
  const isLandscape = orientation === 'landscape';
  const isLegal = String(pageSize).toLowerCase() === 'legal';
  const size = isLegal ? 'LEGAL' : 'A4';

  const isBials = tableType === 'bials';

  // Column width calculations based on layout
  const colWidths = isBials
    ? {
        sl: '4%',
        name: isLandscape ? '21%' : '18%',
        hh: '7%',
        ret: '7%',
        rate: '7%',
        ptr: isLandscape ? '11%' : '11%',
        rt: isLandscape ? '11%' : '11%',
        tch: isLandscape ? '11%' : '11%',
        bldg: isLandscape ? '11%' : '11%',
        total: isLandscape ? '10%' : '11%',
      }
    : {
        sl: '6%',
        name: isLandscape ? '34%' : '30%',
        ptr: '14%',
        rt: '14%',
        tch: '14%',
        bldg: '14%',
        total: '14%',
      };

  // Signatory font styles (Pure Black)
  const nameStyle = {
    fontSize: 8.5,
    fontFamily: signatory.nameBold
      ? (signatory.nameItalic ? 'Helvetica-BoldOblique' : 'Helvetica-Bold')
      : (signatory.nameItalic ? 'Helvetica-Oblique' : 'Helvetica'),
    textDecoration: signatory.nameUnderline ? 'underline' : 'none',
    color: '#000000',
    textAlign: 'center',
  };

  const desigStyle = {
    fontSize: 7.5,
    fontFamily: signatory.desigBold
      ? (signatory.desigItalic ? 'Helvetica-BoldOblique' : 'Helvetica-Bold')
      : (signatory.desigItalic ? 'Helvetica-Oblique' : 'Helvetica'),
    textDecoration: signatory.desigUnderline ? 'underline' : 'none',
    color: '#000000',
    marginTop: 1,
    textAlign: 'center',
  };

  const orgStyle = {
    fontSize: 7,
    fontFamily: signatory.orgBold
      ? (signatory.orgItalic ? 'Helvetica-BoldOblique' : 'Helvetica-Bold')
      : (signatory.orgItalic ? 'Helvetica-Oblique' : 'Helvetica'),
    textDecoration: signatory.orgUnderline ? 'underline' : 'none',
    color: '#000000',
    marginTop: 1,
    textAlign: 'center',
  };

  return (
    <Document title={title} author="Pathian Ram Management System" creator="Antigravity">
      <Page size={size} orientation={orientation} style={styles.page}>
        <View style={styles.outerBorder}>
          <View style={styles.innerBorder}>
            
            {/* Header / Letterhead */}
            <View>
              <View style={styles.headerContainer}>
                <Text style={styles.denominationText}>{denomination.toUpperCase()}</Text>
                <Text style={styles.churchText}>{churchName}</Text>

                {logoBase64 ? (
                  <Image src={logoBase64} style={styles.logoImage} />
                ) : null}

                <Text style={styles.reportTitle}>{title.toUpperCase()}</Text>

                <View style={styles.periodBadge}>
                  <Text style={styles.periodBadgeText}>{periodText}</Text>
                </View>

                <Text style={styles.scopeText}>
                  {scopeName} {tableType === 'member_annual_summary' ? '• Member Summation' : ''}
                </Text>

                <View style={styles.dividerLine} />
              </View>

              {/* Date of Issue & Currency row */}
              <View style={styles.issueDateRow}>
                <Text style={styles.issueDateText}>
                  Date of Issue: <Text style={{ fontFamily: 'Helvetica-Bold', color: '#000000' }}>{issueDate}</Text>
                </Text>
                <Text style={styles.currencyText}>Currency: INR (₹)</Text>
              </View>

              {/* 5 Financial Totals Cards (All Black Text) */}
              <View style={styles.cardsContainer}>
                {/* Pathian Ram */}
                <View style={[styles.card, { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1' }]}>
                  <Text style={[styles.cardLabel, { color: '#000000' }]}>Pathian Ram</Text>
                  <Text style={[styles.cardValue, { color: '#000000' }]}>
                    ₹{formatINR(totals.total_pathian_ram)}
                  </Text>
                </View>

                {/* Ramthar */}
                <View style={[styles.card, { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1' }]}>
                  <Text style={[styles.cardLabel, { color: '#000000' }]}>Ramthar</Text>
                  <Text style={[styles.cardValue, { color: '#000000' }]}>
                    ₹{formatINR(totals.total_ramthar)}
                  </Text>
                </View>

                {/* Tualchhung */}
                <View style={[styles.card, { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1' }]}>
                  <Text style={[styles.cardLabel, { color: '#000000' }]}>Tualchhung</Text>
                  <Text style={[styles.cardValue, { color: '#000000' }]}>
                    ₹{formatINR(totals.total_tualchhung)}
                  </Text>
                </View>

                {/* Building */}
                <View style={[styles.card, { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1' }]}>
                  <Text style={[styles.cardLabel, { color: '#000000' }]}>Building</Text>
                  <Text style={[styles.cardValue, { color: '#000000' }]}>
                    ₹{formatINR(totals.total_building)}
                  </Text>
                </View>

                {/* Grand Total */}
                <View style={[styles.card, { backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#000000' }]}>
                  <Text style={[styles.cardLabel, { color: '#000000' }]}>TOTAL</Text>
                  <Text style={[styles.cardValue, { color: '#000000', fontFamily: 'Helvetica-Bold' }]}>
                    ₹{formatINR(totals.grand_total)}
                  </Text>
                </View>
              </View>

              {/* Household Return Rate & Compliance Summary (100% Black) */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#f8fafc',
                  borderWidth: 0.75,
                  borderColor: '#94a3b8',
                  borderRadius: 4,
                  paddingVertical: 2,
                  paddingHorizontal: 6,
                  marginBottom: 3.5,
                }}
              >
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={{ fontSize: 6.5, color: '#000000' }}>
                    Total HH: <Text style={{ fontFamily: 'Helvetica-Bold' }}>{totals.total_system_members || breakdown.length || 0}</Text>
                  </Text>
                  <Text style={{ fontSize: 6.5, color: '#000000' }}>
                    Returned: <Text style={{ fontFamily: 'Helvetica-Bold' }}>{totals.total_returned_members || breakdown.filter(m => (m.grand_total || m.total || 0) > 0).length || 0}</Text>
                  </Text>
                  <Text style={{ fontSize: 6.5, color: '#000000' }}>
                    Return Rate / Household: <Text style={{ fontFamily: 'Helvetica-Bold' }}>{totals.overall_return_rate !== undefined ? `${totals.overall_return_rate}%` : 'N/A'}</Text>
                  </Text>
                </View>
                <Text style={{ fontSize: 6.5, color: '#000000' }}>
                  Avg / HH: <Text style={{ fontFamily: 'Helvetica-Bold' }}>₹{formatINR(totals.avg_contribution_per_member || (totals.total_returned_members > 0 ? Math.round(totals.grand_total / totals.total_returned_members) : 0))}</Text>
                </Text>
              </View>

              {/* Dynamic Breakdown Table */}
              <View style={styles.tableContainer}>
                {/* Table Header */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, { width: colWidths.sl, textAlign: 'center', color: '#000000' }]}>Sl</Text>
                  <Text style={[styles.tableHeaderCell, { width: colWidths.name, textAlign: 'left', color: '#000000' }]}>
                    {tableType === 'monthly_breakdown'
                      ? 'Month'
                      : tableType === 'members' || tableType === 'member_annual_summary'
                      ? 'Member Name'
                      : 'Bial Name'}
                  </Text>
                  {isBials && (
                    <>
                      <Text style={[styles.tableHeaderCell, { width: colWidths.hh, textAlign: 'center', color: '#000000' }]}>HH</Text>
                      <Text style={[styles.tableHeaderCell, { width: colWidths.ret, textAlign: 'center', color: '#000000' }]}>Ret</Text>
                      <Text style={[styles.tableHeaderCell, { width: colWidths.rate, textAlign: 'center', color: '#000000' }]}>Return %</Text>
                    </>
                  )}
                  <Text style={[styles.tableHeaderCell, { width: colWidths.ptr, textAlign: 'right', color: '#000000' }]}>PTR (₹)</Text>
                  <Text style={[styles.tableHeaderCell, { width: colWidths.rt, textAlign: 'right', color: '#000000' }]}>RT (₹)</Text>
                  <Text style={[styles.tableHeaderCell, { width: colWidths.tch, textAlign: 'right', color: '#000000' }]}>Tch (₹)</Text>
                  <Text style={[styles.tableHeaderCell, { width: colWidths.bldg, textAlign: 'right', color: '#000000' }]}>Bldg (₹)</Text>
                  <Text style={[styles.tableHeaderCell, { width: colWidths.total, textAlign: 'right', color: '#000000', fontFamily: 'Helvetica-Bold' }]}>
                    Total (₹)
                  </Text>
                </View>

                {/* Table Rows */}
                {breakdown.length === 0 ? (
                  <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                    <Text style={{ fontSize: 8, color: '#000000' }}>No contribution records found for this period.</Text>
                  </View>
                ) : (
                  breakdown.map((item, idx) => {
                    const rowName =
                       tableType === 'monthly_breakdown'
                        ? item.month_name
                        : tableType === 'members' || tableType === 'member_annual_summary'
                        ? item.name || item.member_name
                        : item.name || item.bial_name;
                    const ptr = item.total_pathian_ram || item.pathian_ram || 0;
                    const rt = item.total_ramthar || item.ramthar || 0;
                    const tch = item.total_tualchhung || item.tualchhung || 0;
                    const bldg = item.total_building || item.building || 0;
                    const tot = item.grand_total || item.total || item.total_collected || 0;

                    return (
                      <View
                        key={item.id || idx}
                        style={[styles.tableRow, idx % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd]}
                      >
                        <Text style={[styles.tableCell, { width: colWidths.sl, textAlign: 'center', color: '#000000' }]}>
                          {item.sl_no || idx + 1}
                        </Text>
                        <Text style={[styles.tableCell, { width: colWidths.name, fontFamily: 'Helvetica-Bold', color: '#000000' }]}>
                          {rowName}
                        </Text>
                        {isBials && (
                          <>
                            <Text style={[styles.tableCell, { width: colWidths.hh, textAlign: 'center', color: '#000000' }]}>
                              {item.total_members || item.member_count || '-'}
                            </Text>
                            <Text style={[styles.tableCell, { width: colWidths.ret, textAlign: 'center', color: '#000000' }]}>
                              {item.returned_members ?? '-'}
                            </Text>
                            <Text style={[styles.tableCell, { width: colWidths.rate, textAlign: 'center', fontFamily: 'Helvetica-Bold', color: '#000000' }]}>
                              {item.return_rate !== undefined ? `${item.return_rate}%` : '-'}
                            </Text>
                          </>
                        )}
                        <Text style={[styles.tableCell, { width: colWidths.ptr, textAlign: 'right', color: '#000000' }]}>
                          ₹{formatINR(ptr)}
                        </Text>
                        <Text style={[styles.tableCell, { width: colWidths.rt, textAlign: 'right', color: '#000000' }]}>
                          ₹{formatINR(rt)}
                        </Text>
                        <Text style={[styles.tableCell, { width: colWidths.tch, textAlign: 'right', color: '#000000' }]}>
                          ₹{formatINR(tch)}
                        </Text>
                        <Text style={[styles.tableCell, { width: colWidths.bldg, textAlign: 'right', color: '#000000' }]}>
                          ₹{formatINR(bldg)}
                        </Text>
                        <Text
                          style={[
                            styles.tableCell,
                            { width: colWidths.total, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: '#000000' },
                          ]}
                        >
                          ₹{formatINR(tot)}
                        </Text>
                      </View>
                    );
                  })
                )}

                {/* Table Footer Grand Totals */}
                <View style={styles.tableFooterRow}>
                  <Text style={[styles.tableFooterCell, { width: colWidths.sl, textAlign: 'center' }]}></Text>
                  <Text style={[styles.tableFooterCell, { width: colWidths.name, fontFamily: 'Helvetica-Bold', color: '#000000' }]}>
                    {tableType === 'monthly_breakdown'
                      ? 'ANNUAL TOTAL'
                      : tableType === 'members' || tableType === 'member_annual_summary'
                      ? `GRAND TOTAL (${breakdown.length} Members)`
                      : 'GRAND TOTAL'}
                  </Text>
                  {isBials && (
                    <>
                      <Text style={[styles.tableFooterCell, { width: colWidths.hh, textAlign: 'center', color: '#000000' }]}>
                        {totals.total_system_members || breakdown.reduce((acc, b) => acc + (b.total_members || b.member_count || 0), 0)}
                      </Text>
                      <Text style={[styles.tableFooterCell, { width: colWidths.ret, textAlign: 'center', color: '#000000' }]}>
                        {totals.total_returned_members || breakdown.reduce((acc, b) => acc + (b.returned_members || 0), 0)}
                      </Text>
                      <Text style={[styles.tableFooterCell, { width: colWidths.rate, textAlign: 'center', color: '#000000' }]}>
                        {totals.overall_return_rate !== undefined ? `${totals.overall_return_rate}%` : '-'}
                      </Text>
                    </>
                  )}
                  <Text style={[styles.tableFooterCell, { width: colWidths.ptr, textAlign: 'right', color: '#000000' }]}>
                    ₹{formatINR(totals.total_pathian_ram)}
                  </Text>
                  <Text style={[styles.tableFooterCell, { width: colWidths.rt, textAlign: 'right', color: '#000000' }]}>
                    ₹{formatINR(totals.total_ramthar)}
                  </Text>
                  <Text style={[styles.tableFooterCell, { width: colWidths.tch, textAlign: 'right', color: '#000000' }]}>
                    ₹{formatINR(totals.total_tualchhung)}
                  </Text>
                  <Text style={[styles.tableFooterCell, { width: colWidths.bldg, textAlign: 'right', color: '#000000' }]}>
                    ₹{formatINR(totals.total_building)}
                  </Text>
                  <Text
                    style={[
                      styles.tableFooterCell,
                      { width: colWidths.total, textAlign: 'right', color: '#000000', fontFamily: 'Helvetica-Bold' },
                    ]}
                  >
                    ₹{formatINR(totals.grand_total)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Footer Signatory & Seal Section */}
            <View style={styles.footerSection}>
              {/* Left Column: Spacer */}
              <View style={styles.footerCol}>
                <Text style={{ fontSize: 6.5, color: '#000000' }}>
                  Pathian Ram Financial Report
                </Text>
              </View>

              {/* Center Column: Uploaded Seal */}
              <View style={styles.footerCol}>
                {sealBase64 ? (
                  <Image
                    src={sealBase64}
                    style={{
                      width: Math.min(Math.max(sealSize * 0.65, 30), 65),
                      height: Math.min(Math.max(sealSize * 0.65, 30), 65),
                      alignSelf: 'center',
                    }}
                  />
                ) : null}
              </View>

              {/* Right Column: Signatory */}
              <View style={styles.footerCol}>
                {signatureBase64 ? (
                  <Image
                    src={signatureBase64}
                    style={{
                      height: Math.min(Math.max(signatureSize * 0.65, 20), 45),
                      maxWidth: 110,
                      alignSelf: 'center',
                      marginBottom: 2,
                    }}
                  />
                ) : null}
                <Text style={nameStyle}>{signatory.name || 'Authorised Signatory'}</Text>
                <Text style={desigStyle}>{signatory.designation || 'Treasurer'}</Text>
                <Text style={orgStyle}>{signatory.organization || 'Presbyterian Church of India'}</Text>
              </View>
            </View>

          </View>
        </View>
      </Page>
    </Document>
  );
}
