import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  getLeadingDigit,
  analyzeBenfordsLaw,
  findDuplicateTransactions,
  findWeekendEntries,
  findRoundSums,
  verifyTrialBalanceBalance,
  NormalizedTransaction,
} from "./anomaly-math";
import { splitCsvLine, detectDelimiter, matchColumns, parseCurrency } from "./ledger-parser";

describe("Deterministic Anomaly Math Engine", () => {
  test("getLeadingDigit correctly extracts first significant digit", () => {
    assert.equal(getLeadingDigit(123.45), 1);
    assert.equal(getLeadingDigit(-9876.54), 9);
    assert.equal(getLeadingDigit(0.0045), 4);
    assert.equal(getLeadingDigit(0), null);
    assert.equal(getLeadingDigit(NaN), null);
  });

  test("findDuplicateTransactions groups exact amount + date matches", () => {
    const sampleTxs: NormalizedTransaction[] = [
      { rowNumber: 1, transactionDate: "2026-03-15", accountCode: "6010", accountName: "Travel", amount: 1540.0, journalRef: "JE-101", description: "Flight" },
      { rowNumber: 2, transactionDate: "2026-03-15", accountCode: "6010", accountName: "Travel", amount: 1540.0, journalRef: "JE-102", description: "Flight re-entry" },
      { rowNumber: 3, transactionDate: "2026-03-16", accountCode: "6010", accountName: "Travel", amount: 1540.0, journalRef: "JE-103", description: "Next day flight" },
    ];

    const duplicates = findDuplicateTransactions(sampleTxs);
    assert.equal(duplicates.length, 1);
    assert.equal(duplicates[0].anomalyType, "duplicate_transaction");
    assert.equal(duplicates[0].amount, 1540.0);
    assert.equal(duplicates[0].accountCode, "6010");
  });

  test("findWeekendEntries flags Saturday and Sunday postings", () => {
    const sampleTxs: NormalizedTransaction[] = [
      { rowNumber: 1, transactionDate: "2026-03-13", accountCode: "1010", accountName: "Cash", amount: 500, journalRef: "JE-1", description: "Friday" },
      { rowNumber: 2, transactionDate: "2026-03-14", accountCode: "1010", accountName: "Cash", amount: 12000, journalRef: "JE-2", description: "Saturday post" },
      { rowNumber: 3, transactionDate: "2026-03-15", accountCode: "1010", accountName: "Cash", amount: 8000, journalRef: "JE-3", description: "Sunday post" },
      { rowNumber: 4, transactionDate: "2026-03-16", accountCode: "1010", accountName: "Cash", amount: 300, journalRef: "JE-4", description: "Monday" },
    ];

    const weekendAnomalies = findWeekendEntries(sampleTxs);
    assert.equal(weekendAnomalies.length, 2);
    assert.ok(weekendAnomalies.some(a => a.transactionDate === "2026-03-14" && a.riskLevel === "high"));
    assert.ok(weekendAnomalies.some(a => a.transactionDate === "2026-03-15" && a.riskLevel === "medium"));
  });

  test("findRoundSums detects $5,000+ round figures", () => {
    const sampleTxs: NormalizedTransaction[] = [
      { rowNumber: 1, transactionDate: "2026-03-10", accountCode: "7020", accountName: "Consulting", amount: 5000.0, journalRef: "JE-10", description: "Retainer" },
      { rowNumber: 2, transactionDate: "2026-03-11", accountCode: "7020", accountName: "Consulting", amount: 25000.0, journalRef: "JE-11", description: "Advisory" },
      { rowNumber: 3, transactionDate: "2026-03-12", accountCode: "7020", accountName: "Consulting", amount: 5432.18, journalRef: "JE-12", description: "Detailed invoice" },
    ];

    const roundSums = findRoundSums(sampleTxs);
    assert.equal(roundSums.length, 2);
    assert.ok(roundSums.some(r => r.amount === 25000.0 && r.riskLevel === "high"));
  });

  test("verifyTrialBalanceBalance flags unbalanced debits and credits", () => {
    const balancedTxs: NormalizedTransaction[] = [
      { rowNumber: 1, transactionDate: "2026-01-01", accountCode: "1010", accountName: "Cash", amount: 1000, debit: 1000, credit: 0, journalRef: "1", description: "Deposit" },
      { rowNumber: 2, transactionDate: "2026-01-01", accountCode: "2010", accountName: "Revenue", amount: -1000, debit: 0, credit: 1000, journalRef: "1", description: "Sales" },
    ];

    const balancedResult = verifyTrialBalanceBalance(balancedTxs);
    assert.equal(balancedResult.isBalanced, true);
    assert.equal(balancedResult.variance, 0);

    const unbalancedTxs: NormalizedTransaction[] = [
      { rowNumber: 1, transactionDate: "2026-01-01", accountCode: "1010", accountName: "Cash", amount: 1500, debit: 1500, credit: 0, journalRef: "1", description: "Deposit" },
      { rowNumber: 2, transactionDate: "2026-01-01", accountCode: "2010", accountName: "Revenue", amount: -1000, debit: 0, credit: 1000, journalRef: "1", description: "Sales" },
    ];

    const unbalancedResult = verifyTrialBalanceBalance(unbalancedTxs);
    assert.equal(unbalancedResult.isBalanced, false);
    assert.equal(unbalancedResult.variance, 500);
  });
});

describe("Streaming CSV Ledger Parser", () => {
  test("splitCsvLine handles quotes and commas correctly", () => {
    const line = '2026-03-10,"Consulting, Legal Services",6010,"$5,000.00","JE #101"';
    const cols = splitCsvLine(line, ",");
    assert.equal(cols.length, 5);
    assert.equal(cols[0], "2026-03-10");
    assert.equal(cols[1], "Consulting, Legal Services");
    assert.equal(cols[2], "6010");
    assert.equal(cols[3], "$5,000.00");
    assert.equal(cols[4], "JE #101");
  });

  test("detectDelimiter identifies comma, tab, and semicolon", () => {
    assert.equal(detectDelimiter("date,account,amount"), ",");
    assert.equal(detectDelimiter("date\taccount\tamount"), "\t");
    assert.equal(detectDelimiter("date;account;amount"), ";");
  });

  test("parseCurrency handles negative, parenthesized, and formatted strings", () => {
    assert.equal(parseCurrency("$1,234.56"), 1234.56);
    assert.equal(parseCurrency("(500.00)"), -500.0);
    assert.equal(parseCurrency("-120.50"), -120.5);
    assert.equal(parseCurrency("0.00"), 0);
  });

  test("matchColumns maps canonical headers across variations", () => {
    const headers = ["Posting_Date", "Account_No", "Account_Description", "Net_Amount", "Doc_No", "Memo"];
    const mapping = matchColumns(headers);
    assert.ok(mapping !== null);
    assert.equal(mapping.dateCol, 0);
    assert.equal(mapping.accountCodeCol, 1);
    assert.equal(mapping.accountNameCol, 2);
    assert.equal(mapping.amountCol, 3);
    assert.equal(mapping.refCol, 4);
    assert.equal(mapping.descCol, 5);
  });
});
