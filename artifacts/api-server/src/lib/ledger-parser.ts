import { Readable } from "node:stream";
import * as readline from "node:readline";
import { NormalizedTransaction } from "./anomaly-math";

export interface ColumnMapping {
  dateCol: number;
  accountCodeCol: number;
  accountNameCol: number;
  amountCol: number;
  debitCol?: number;
  creditCol?: number;
  refCol: number;
  descCol: number;
}

const ALIASES = {
  date: ["date", "transaction_date", "tx_date", "posting_date", "doc_date", "effective_date", "entry_date"],
  accountCode: ["account", "account_code", "account_no", "acct_no", "gl_code", "gl_account", "code", "acct"],
  accountName: ["account_name", "account_desc", "account_description", "acct_name", "name", "gl_name"],
  amount: ["amount", "net_amount", "total", "net", "balance", "trans_amount"],
  debit: ["debit", "dr", "debits", "debit_amount"],
  credit: ["credit", "cr", "credits", "credit_amount"],
  ref: ["ref", "reference", "journal_ref", "entry_no", "doc_no", "voucher_no", "je_number", "id"],
  desc: ["desc", "description", "memo", "details", "narrative", "line_desc", "line_description"],
};

/**
 * Splits a CSV/TSV line respecting quotes.
 */
export function splitCsvLine(line: string, delimiter: string = ","): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Detects whether the delimiter is comma, tab, or semicolon.
 */
export function detectDelimiter(headerLine: string): string {
  const commas = (headerLine.match(/,/g) || []).length;
  const tabs = (headerLine.match(/\t/g) || []).length;
  const semicolons = (headerLine.match(/;/g) || []).length;

  if (tabs > commas && tabs > semicolons) return "\t";
  if (semicolons > commas && semicolons > tabs) return ";";
  return ",";
}

/**
 * Heuristically matches header column names to canonical fields.
 */
export function matchColumns(headers: string[]): ColumnMapping | null {
  const cleanHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, ""));
  const used = new Set<number>();

  const findIdx = (aliases: string[]): number => {
    // Pass 1: exact match on unused columns
    for (let i = 0; i < cleanHeaders.length; i++) {
      if (used.has(i)) continue;
      if (aliases.some(alias => cleanHeaders[i] === alias)) {
        used.add(i);
        return i;
      }
    }
    // Pass 2: substring includes on unused columns
    for (let i = 0; i < cleanHeaders.length; i++) {
      if (used.has(i)) continue;
      if (aliases.some(alias => cleanHeaders[i].includes(alias))) {
        used.add(i);
        return i;
      }
    }
    return -1;
  };

  const dateCol = findIdx(ALIASES.date);
  const accountCodeCol = findIdx(ALIASES.accountCode);
  const accountNameCol = findIdx(ALIASES.accountName);
  const amountCol = findIdx(ALIASES.amount);
  const debitCol = findIdx(ALIASES.debit);
  const creditCol = findIdx(ALIASES.credit);
  const refCol = findIdx(ALIASES.ref);
  const descCol = findIdx(ALIASES.desc);

  // We require date, account (code or name), and either amount OR (debit & credit)
  const hasAccount = accountCodeCol !== -1 || accountNameCol !== -1;
  const hasAmount = amountCol !== -1 || (debitCol !== -1 && creditCol !== -1);

  if (dateCol === -1 || !hasAccount || !hasAmount) {
    return null;
  }

  return {
    dateCol,
    accountCodeCol: accountCodeCol !== -1 ? accountCodeCol : accountNameCol,
    accountNameCol: accountNameCol !== -1 ? accountNameCol : accountCodeCol,
    amountCol: amountCol !== -1 ? amountCol : debitCol,
    debitCol: debitCol !== -1 ? debitCol : undefined,
    creditCol: creditCol !== -1 ? creditCol : undefined,
    refCol: refCol !== -1 ? refCol : -1,
    descCol: descCol !== -1 ? descCol : -1,
  };
}

/**
 * Parses numeric currency string (handles "$1,234.56", "(500.00)", "-120.00").
 */
export function parseCurrency(str: string | undefined): number {
  if (!str) return 0;
  const cleaned = str.replace(/[$, ]/g, "");
  if (cleaned.startsWith("(") && cleaned.endsWith(")")) {
    return -parseFloat(cleaned.slice(1, -1)) || 0;
  }
  return parseFloat(cleaned) || 0;
}

/**
 * Asynchronously streams and parses a CSV/TSV readable stream.
 */
export async function parseLedgerStream(
  stream: Readable,
  onBatch: (transactions: NormalizedTransaction[]) => Promise<void>,
  batchSize = 2500
): Promise<{ totalRows: number; columnMapping: ColumnMapping }> {
  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity,
  });

  let delimiter = ",";
  let mapping: ColumnMapping | null = null;
  let rowNumber = 0;
  let batch: NormalizedTransaction[] = [];
  let totalRows = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;

    if (!mapping) {
      delimiter = detectDelimiter(line);
      const headers = splitCsvLine(line, delimiter);
      mapping = matchColumns(headers);
      if (!mapping) {
        throw new Error(`Unable to automatically map columns from headers: ${headers.join(", ")}`);
      }
      continue;
    }

    rowNumber++;
    const cols = splitCsvLine(line, delimiter);
    if (cols.length < 2) continue;

    const dateStr = cols[mapping.dateCol] || "";
    const acctCode = cols[mapping.accountCodeCol] || "UNKNOWN";
    const acctName = cols[mapping.accountNameCol] || acctCode;
    const ref = mapping.refCol !== -1 ? cols[mapping.refCol] || "" : "";
    const desc = mapping.descCol !== -1 ? cols[mapping.descCol] || "" : "";

    let amount = 0;
    let debit: number | undefined;
    let credit: number | undefined;

    if (mapping.debitCol !== undefined && mapping.creditCol !== undefined) {
      debit = parseCurrency(cols[mapping.debitCol]);
      credit = parseCurrency(cols[mapping.creditCol]);
      amount = debit - credit;
    } else {
      amount = parseCurrency(cols[mapping.amountCol]);
    }

    batch.push({
      rowNumber,
      transactionDate: dateStr,
      accountCode: acctCode,
      accountName: acctName,
      amount,
      debit,
      credit,
      journalRef: ref,
      description: desc,
    });

    if (batch.length >= batchSize) {
      totalRows += batch.length;
      await onBatch(batch);
      batch = [];
    }
  }

  if (batch.length > 0) {
    totalRows += batch.length;
    await onBatch(batch);
  }

  if (!mapping) {
    throw new Error("Empty file or missing headers");
  }

  return { totalRows, columnMapping: mapping };
}
