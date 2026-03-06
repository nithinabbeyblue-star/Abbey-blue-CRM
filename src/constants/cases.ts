// ─── Case Type System ────────────────────────────────────
// Single source of truth for all 24 Irish immigration case types.
// Flat list — no sub-categories.

export type CaseTypeKey =
  | "CSEP"
  | "GEP"
  | "CHANGE_EMPLOYER"
  | "RENEWAL_WP"
  | "STAMP_1G_EXT"
  | "STAMP_1G_OVERSTAYED"
  | "STAMP_1_REACTIVATION"
  | "IRP_RENEWAL"
  | "STAMP_REGULARISATION"
  | "SHORT_STAY_TOURIST"
  | "SHORT_STAY_BUSINESS"
  | "LONG_STAY_FAMILY_REUNIFICATION"
  | "LONG_STAY_DE_FACTO"
  | "EUTR1_QFM"
  | "EUTR1A_PFM"
  | "RETENTION_OF_RIGHTS"
  | "PERMANENT_RESIDENCE"
  | "DE_FACTO_PERMISSION"
  | "DE_FACTO_RENEWAL"
  | "ADULT_NATURALISATION"
  | "CITIZENSHIP_MARRIAGE"
  | "MINOR_CITIZENSHIP"
  | "CITIZENSHIP_BORN_IRELAND"
  | "REFUGEE_CITIZENSHIP";

export interface CaseTypeConfig {
  key: CaseTypeKey;
  label: string;
  shortCode: string;
  badgeBg: string;
  badgeText: string;
}

// ─── 24 Case Types (flat) ────────────────────────────────

export const CASE_CONFIG: Record<CaseTypeKey, CaseTypeConfig> = {
  CSEP: {
    key: "CSEP",
    label: "Critical Skills Employment Permit",
    shortCode: "CSEP",
    badgeBg: "bg-green-100",
    badgeText: "text-green-800",
  },
  GEP: {
    key: "GEP",
    label: "General Employment Permit",
    shortCode: "GEP",
    badgeBg: "bg-green-100",
    badgeText: "text-green-800",
  },
  CHANGE_EMPLOYER: {
    key: "CHANGE_EMPLOYER",
    label: "Change of Employer on Same Work Permit",
    shortCode: "CHG",
    badgeBg: "bg-green-100",
    badgeText: "text-green-800",
  },
  RENEWAL_WP: {
    key: "RENEWAL_WP",
    label: "Renewal of Work Permit (Same Employer)",
    shortCode: "RWP",
    badgeBg: "bg-green-100",
    badgeText: "text-green-800",
  },
  STAMP_1G_EXT: {
    key: "STAMP_1G_EXT",
    label: "Stamp 1G Extension",
    shortCode: "S1G",
    badgeBg: "bg-indigo-100",
    badgeText: "text-indigo-800",
  },
  STAMP_1G_OVERSTAYED: {
    key: "STAMP_1G_OVERSTAYED",
    label: "Stamp 1G Extension (Overstayed)",
    shortCode: "S1GO",
    badgeBg: "bg-indigo-100",
    badgeText: "text-indigo-800",
  },
  STAMP_1_REACTIVATION: {
    key: "STAMP_1_REACTIVATION",
    label: "Stamp 1 Extension (Reactivation of Employment Permit)",
    shortCode: "S1R",
    badgeBg: "bg-indigo-100",
    badgeText: "text-indigo-800",
  },
  IRP_RENEWAL: {
    key: "IRP_RENEWAL",
    label: "IRP Card Renewal",
    shortCode: "IRP",
    badgeBg: "bg-teal-100",
    badgeText: "text-teal-800",
  },
  STAMP_REGULARISATION: {
    key: "STAMP_REGULARISATION",
    label: "Stamp Regularisation",
    shortCode: "SREG",
    badgeBg: "bg-indigo-100",
    badgeText: "text-indigo-800",
  },
  SHORT_STAY_TOURIST: {
    key: "SHORT_STAY_TOURIST",
    label: "Short Stay (C) — Tourist/Visit",
    shortCode: "SST",
    badgeBg: "bg-blue-100",
    badgeText: "text-blue-800",
  },
  SHORT_STAY_BUSINESS: {
    key: "SHORT_STAY_BUSINESS",
    label: "Short Stay (C) — Business Visa",
    shortCode: "SSB",
    badgeBg: "bg-blue-100",
    badgeText: "text-blue-800",
  },
  LONG_STAY_FAMILY_REUNIFICATION: {
    key: "LONG_STAY_FAMILY_REUNIFICATION",
    label: "Long Stay (D) — Family Reunification Visa",
    shortCode: "LSFR",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-800",
  },
  LONG_STAY_DE_FACTO: {
    key: "LONG_STAY_DE_FACTO",
    label: "Long Stay (D) — De Facto Visa",
    shortCode: "LSDF",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-800",
  },
  EUTR1_QFM: {
    key: "EUTR1_QFM",
    label: "EUTR1 — Qualifying Family Member",
    shortCode: "EU1",
    badgeBg: "bg-cyan-100",
    badgeText: "text-cyan-800",
  },
  EUTR1A_PFM: {
    key: "EUTR1A_PFM",
    label: "EUTR1A — Permitted Family Member",
    shortCode: "EU1A",
    badgeBg: "bg-cyan-100",
    badgeText: "text-cyan-800",
  },
  RETENTION_OF_RIGHTS: {
    key: "RETENTION_OF_RIGHTS",
    label: "Retention of Rights",
    shortCode: "ROR",
    badgeBg: "bg-orange-100",
    badgeText: "text-orange-800",
  },
  PERMANENT_RESIDENCE: {
    key: "PERMANENT_RESIDENCE",
    label: "Permanent Residence Card (5 Years EUFAM)",
    shortCode: "PRC",
    badgeBg: "bg-teal-100",
    badgeText: "text-teal-800",
  },
  DE_FACTO_PERMISSION: {
    key: "DE_FACTO_PERMISSION",
    label: "De Facto Residence Permission",
    shortCode: "DFP",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-800",
  },
  DE_FACTO_RENEWAL: {
    key: "DE_FACTO_RENEWAL",
    label: "De Facto Renewal (Stamp 4 Extension)",
    shortCode: "DFR",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-800",
  },
  ADULT_NATURALISATION: {
    key: "ADULT_NATURALISATION",
    label: "Adult Naturalisation",
    shortCode: "NAT",
    badgeBg: "bg-purple-100",
    badgeText: "text-purple-800",
  },
  CITIZENSHIP_MARRIAGE: {
    key: "CITIZENSHIP_MARRIAGE",
    label: "Citizenship by Marriage (3-Year Rule)",
    shortCode: "CBM",
    badgeBg: "bg-purple-100",
    badgeText: "text-purple-800",
  },
  MINOR_CITIZENSHIP: {
    key: "MINOR_CITIZENSHIP",
    label: "Minor Child Citizenship",
    shortCode: "MCC",
    badgeBg: "bg-purple-100",
    badgeText: "text-purple-800",
  },
  CITIZENSHIP_BORN_IRELAND: {
    key: "CITIZENSHIP_BORN_IRELAND",
    label: "Citizenship for Children Born in Ireland",
    shortCode: "CBI",
    badgeBg: "bg-purple-100",
    badgeText: "text-purple-800",
  },
  REFUGEE_CITIZENSHIP: {
    key: "REFUGEE_CITIZENSHIP",
    label: "Refugee / International Protection Citizenship",
    shortCode: "RPC",
    badgeBg: "bg-purple-100",
    badgeText: "text-purple-800",
  },
};

// ─── Helper Functions ────────────────────────────────────

/** All case types as an ordered array */
export function getAllCaseTypes(): CaseTypeConfig[] {
  return Object.values(CASE_CONFIG);
}
