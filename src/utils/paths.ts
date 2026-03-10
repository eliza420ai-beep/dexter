import { join } from 'node:path';

const DEXTER_DIR = '.dexter';
const DEXTER_PORTFOLIOS_SUBDIR = 'portfolios';
const DEXTER_REPORTS_SUBDIR = 'reports';
const DEXTER_TEMP_CHECKS_SUBDIR = 'temp-checks';
const DEXTER_STOCK_THESES_SUBDIR = 'stock-theses';

export function getDexterDir(): string {
  return DEXTER_DIR;
}

export function dexterPath(...segments: string[]): string {
  return join(getDexterDir(), ...segments);
}

export function dexterPortfoliosDir(): string {
  return dexterPath(DEXTER_PORTFOLIOS_SUBDIR);
}

export function dexterReportsDir(): string {
  return dexterPath(DEXTER_REPORTS_SUBDIR);
}

export function dexterTempChecksDir(): string {
  return dexterPath(DEXTER_TEMP_CHECKS_SUBDIR);
}

export function dexterStockThesesDir(): string {
  return dexterPath(DEXTER_STOCK_THESES_SUBDIR);
}

export function dexterPortfolioPath(filename: string): string {
  return join(dexterPortfoliosDir(), filename);
}

export function dexterReportPath(filename: string): string {
  return join(dexterReportsDir(), filename);
}

export function dexterTempCheckPath(filename: string): string {
  return join(dexterTempChecksDir(), filename);
}

export function dexterStockThesisPath(filename: string): string {
  return join(dexterStockThesesDir(), filename);
}
