// ─── Case Type System ────────────────────────────────────
// Single source of truth for all 25 Irish visa categories.
// Used across the entire app: badges, dropdowns, checklists, ref numbers.

export type CaseGroup =
  | "EMPLOYMENT_PERMITS"
  | "STAMP_EXTENSIONS"
  | "SHORT_STAY"
  | "LONG_STAY_FAMILY"
  | "RESIDENCY"
  | "CITIZENSHIP"
  | "FBR";

export type CaseTypeKey =
  | "CSEP"
  | "GWEP"
  | "ICT"
  | "DEPT_EP"
  | "REACTIVATION_EP"
  | "ATYPICAL"
  | "STAMP_1"
  | "STAMP_1G"
  | "STAMP_2"
  | "STAMP_3"
  | "STAMP_4"
  | "STAMP_4_EUFAM"
  | "STAMP_5"
  | "STAMP_6"
  | "SHORT_STAY_C_VISIT"
  | "SHORT_STAY_C_BUSINESS"
  | "CONFERENCE_EVENT"
  | "JOIN_FAMILY_D"
  | "DE_FACTO_PARTNER"
  | "PERMISSION_TO_REMAIN"
  | "IRP_REGISTRATION"
  | "LONG_TERM_RESIDENCY"
  | "NATURALISATION"
  | "CITIZENSHIP_DESCENT"
  | "FOREIGN_BIRTH_REGISTRATION";

export interface CaseTypeConfig {
  key: CaseTypeKey;
  label: string;
  shortCode: string;
  group: CaseGroup;
  badgeBg: string;
  badgeText: string;
  dotColor: string;
  requiredDocs: string[];
}

// ─── Group Metadata ──────────────────────────────────────

export const GROUP_LABELS: Record<CaseGroup, string> = {
  EMPLOYMENT_PERMITS: "Employment Permits",
  STAMP_EXTENSIONS: "Stamp Extensions",
  SHORT_STAY: "Short Stay Visas",
  LONG_STAY_FAMILY: "Long Stay / Family",
  RESIDENCY: "Residency",
  CITIZENSHIP: "Citizenship",
  FBR: "Foreign Birth Registration",
};

export const GROUP_ORDER: CaseGroup[] = [
  "EMPLOYMENT_PERMITS",
  "STAMP_EXTENSIONS",
  "SHORT_STAY",
  "LONG_STAY_FAMILY",
  "RESIDENCY",
  "CITIZENSHIP",
  "FBR",
];

// ─── 25 Case Types ───────────────────────────────────────

export const CASE_CONFIG: Record<CaseTypeKey, CaseTypeConfig> = {
  // ── Employment Permits (Green) ─────────────────────────
  CSEP: {
    key: "CSEP",
    label: "Critical Skills Employment Permit",
    shortCode: "CSEP",
    group: "EMPLOYMENT_PERMITS",
    badgeBg: "bg-green-100",
    badgeText: "text-green-800",
    dotColor: "bg-green-400",
    requiredDocs: [
      "Passport (valid 6+ months)",
      "2x Passport Photos",
      "Job Offer Letter",
      "Educational Certificates",
      "CSEP Application Form",
      "Bank Statements (3 months)",
      "Employment Contract",
      "Company Registration Docs",
    ],
  },
  GWEP: {
    key: "GWEP",
    label: "General Work Employment Permit",
    shortCode: "GWEP",
    group: "EMPLOYMENT_PERMITS",
    badgeBg: "bg-green-100",
    badgeText: "text-green-800",
    dotColor: "bg-green-400",
    requiredDocs: [
      "Passport",
      "2x Passport Photos",
      "Job Offer Letter",
      "Labour Market Needs Test Advert",
      "GWEP Application Form",
      "Salary Evidence",
      "Company Registration Docs",
    ],
  },
  ICT: {
    key: "ICT",
    label: "Intra-Company Transfer Permit",
    shortCode: "ICT",
    group: "EMPLOYMENT_PERMITS",
    badgeBg: "bg-green-100",
    badgeText: "text-green-800",
    dotColor: "bg-green-400",
    requiredDocs: [
      "Passport",
      "2x Passport Photos",
      "ICT Application Form",
      "Home Company Letter",
      "Employment Contract",
      "Proof of Employment (12+ months)",
      "Company Group Structure",
    ],
  },
  DEPT_EP: {
    key: "DEPT_EP",
    label: "Dependant/Partner/Spouse EP",
    shortCode: "DEPT",
    group: "EMPLOYMENT_PERMITS",
    badgeBg: "bg-green-100",
    badgeText: "text-green-800",
    dotColor: "bg-green-400",
    requiredDocs: [
      "Passport",
      "2x Passport Photos",
      "Primary Permit Holder's Permit Copy",
      "Marriage Certificate / Civil Partnership Cert",
      "Application Form",
      "Proof of Relationship",
    ],
  },
  REACTIVATION_EP: {
    key: "REACTIVATION_EP",
    label: "Reactivation Employment Permit",
    shortCode: "REAC",
    group: "EMPLOYMENT_PERMITS",
    badgeBg: "bg-green-100",
    badgeText: "text-green-800",
    dotColor: "bg-green-400",
    requiredDocs: [
      "Passport",
      "2x Passport Photos",
      "Previous Permit Copy",
      "Reactivation Application Form",
      "Job Offer Letter",
      "Reason for Redundancy / Layoff Letter",
    ],
  },
  ATYPICAL: {
    key: "ATYPICAL",
    label: "Atypical Working Scheme",
    shortCode: "ATYP",
    group: "EMPLOYMENT_PERMITS",
    badgeBg: "bg-green-100",
    badgeText: "text-green-800",
    dotColor: "bg-green-400",
    requiredDocs: [
      "Passport",
      "2x Passport Photos",
      "Employer Support Letter",
      "Contract of Employment",
      "Atypical Application Form",
      "Evidence of Accommodation in Ireland",
    ],
  },

  // ── Stamp Extensions (Indigo) ──────────────────────────
  STAMP_1: {
    key: "STAMP_1",
    label: "Stamp 1 Extension",
    shortCode: "S1",
    group: "STAMP_EXTENSIONS",
    badgeBg: "bg-indigo-100",
    badgeText: "text-indigo-800",
    dotColor: "bg-indigo-400",
    requiredDocs: [
      "Passport",
      "Current IRP Card",
      "Employment Permit Copy",
      "P60 / Payslips",
      "Bank Statements",
      "Application Form",
    ],
  },
  STAMP_1G: {
    key: "STAMP_1G",
    label: "Stamp 1G (Graduate) Extension",
    shortCode: "S1G",
    group: "STAMP_EXTENSIONS",
    badgeBg: "bg-indigo-100",
    badgeText: "text-indigo-800",
    dotColor: "bg-indigo-400",
    requiredDocs: [
      "Passport",
      "Current IRP Card",
      "Degree Certificate",
      "Transcript",
      "Application Form",
      "Evidence of Job Search",
    ],
  },
  STAMP_2: {
    key: "STAMP_2",
    label: "Stamp 2 (Student) Extension",
    shortCode: "S2",
    group: "STAMP_EXTENSIONS",
    badgeBg: "bg-indigo-100",
    badgeText: "text-indigo-800",
    dotColor: "bg-indigo-400",
    requiredDocs: [
      "Passport",
      "Current IRP Card",
      "Student Enrolment Letter",
      "Fee Payment Receipt",
      "Application Form",
    ],
  },
  STAMP_3: {
    key: "STAMP_3",
    label: "Stamp 3 Extension",
    shortCode: "S3",
    group: "STAMP_EXTENSIONS",
    badgeBg: "bg-indigo-100",
    badgeText: "text-indigo-800",
    dotColor: "bg-indigo-400",
    requiredDocs: [
      "Passport",
      "Current IRP Card",
      "Sponsor's Evidence",
      "Proof of Financial Support",
      "Application Form",
    ],
  },
  STAMP_4: {
    key: "STAMP_4",
    label: "Stamp 4 Extension",
    shortCode: "S4",
    group: "STAMP_EXTENSIONS",
    badgeBg: "bg-indigo-100",
    badgeText: "text-indigo-800",
    dotColor: "bg-indigo-400",
    requiredDocs: [
      "Passport",
      "Current IRP Card",
      "Application Form",
      "Employment / Business Evidence",
      "Bank Statements",
      "Tax Compliance Cert (if self-employed)",
    ],
  },
  STAMP_4_EUFAM: {
    key: "STAMP_4_EUFAM",
    label: "Stamp 4 (EU Family Member)",
    shortCode: "S4EU",
    group: "STAMP_EXTENSIONS",
    badgeBg: "bg-indigo-100",
    badgeText: "text-indigo-800",
    dotColor: "bg-indigo-400",
    requiredDocs: [
      "Passport",
      "EU/EEA Sponsor's Passport",
      "Current IRP Card",
      "Proof of Relationship to EU Citizen",
      "Sponsor's Evidence of Exercising EU Treaty Rights",
      "Application Form",
    ],
  },
  STAMP_5: {
    key: "STAMP_5",
    label: "Stamp 5 (Without Condition)",
    shortCode: "S5",
    group: "STAMP_EXTENSIONS",
    badgeBg: "bg-indigo-100",
    badgeText: "text-indigo-800",
    dotColor: "bg-indigo-400",
    requiredDocs: [
      "Passport",
      "5 Years Continuous Residence Evidence",
      "Current IRP Card",
      "P60s (last 5 years)",
      "Application Form",
      "Bank Statements",
    ],
  },
  STAMP_6: {
    key: "STAMP_6",
    label: "Stamp 6 (Dual Citizenship)",
    shortCode: "S6",
    group: "STAMP_EXTENSIONS",
    badgeBg: "bg-indigo-100",
    badgeText: "text-indigo-800",
    dotColor: "bg-indigo-400",
    requiredDocs: [
      "Irish Passport",
      "Foreign Passport",
      "IRP Card",
      "Application Form",
    ],
  },

  // ── Short Stay (Blue) ─────────────────────────────────
  SHORT_STAY_C_VISIT: {
    key: "SHORT_STAY_C_VISIT",
    label: "Short Stay C Visa — Visit",
    shortCode: "SSV",
    group: "SHORT_STAY",
    badgeBg: "bg-blue-100",
    badgeText: "text-blue-800",
    dotColor: "bg-blue-400",
    requiredDocs: [
      "Passport (valid 6+ months)",
      "2x Passport Photos",
      "Short Stay Visa Application Form",
      "Bank Statements (3 months)",
      "Proof of Accommodation in Ireland",
      "Return Flight Booking",
      "Travel Insurance",
      "Proof of Ties to Home Country",
    ],
  },
  SHORT_STAY_C_BUSINESS: {
    key: "SHORT_STAY_C_BUSINESS",
    label: "Short Stay C Visa — Business",
    shortCode: "SSB",
    group: "SHORT_STAY",
    badgeBg: "bg-blue-100",
    badgeText: "text-blue-800",
    dotColor: "bg-blue-400",
    requiredDocs: [
      "Passport",
      "2x Passport Photos",
      "Business Visa Application Form",
      "Invitation Letter from Irish Company",
      "Employer Letter (home country)",
      "Bank Statements",
      "Return Flight Booking",
      "Travel Insurance",
    ],
  },
  CONFERENCE_EVENT: {
    key: "CONFERENCE_EVENT",
    label: "Conference / Event Visa",
    shortCode: "CONF",
    group: "SHORT_STAY",
    badgeBg: "bg-blue-100",
    badgeText: "text-blue-800",
    dotColor: "bg-blue-400",
    requiredDocs: [
      "Passport",
      "2x Passport Photos",
      "Conference Registration Confirmation",
      "Invitation Letter from Organiser",
      "Bank Statements",
      "Return Flight Booking",
      "Travel Insurance",
      "Employer / Sponsor Letter",
    ],
  },

  // ── Long Stay / Family (Amber) ────────────────────────
  JOIN_FAMILY_D: {
    key: "JOIN_FAMILY_D",
    label: "Join Family Long Stay D Visa",
    shortCode: "JFD",
    group: "LONG_STAY_FAMILY",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-800",
    dotColor: "bg-amber-400",
    requiredDocs: [
      "Passport",
      "2x Passport Photos",
      "D Visa Application Form",
      "Sponsor's IRP Card / Stamp Copy",
      "Marriage Certificate / Birth Certificate",
      "Sponsor's Bank Statements (6 months)",
      "Proof of Accommodation",
      "Sponsor's P60 / Payslips",
    ],
  },
  DE_FACTO_PARTNER: {
    key: "DE_FACTO_PARTNER",
    label: "De Facto Partner Permission",
    shortCode: "DFP",
    group: "LONG_STAY_FAMILY",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-800",
    dotColor: "bg-amber-400",
    requiredDocs: [
      "Passport",
      "2x Passport Photos",
      "Application Form",
      "Evidence of Genuine Relationship (2+ years)",
      "Joint Bills / Lease / Bank Account Evidence",
      "Statutory Declaration",
      "Sponsor's IRP Card",
    ],
  },

  // ── Residency (Teal) ──────────────────────────────────
  PERMISSION_TO_REMAIN: {
    key: "PERMISSION_TO_REMAIN",
    label: "Permission to Remain",
    shortCode: "PTR",
    group: "RESIDENCY",
    badgeBg: "bg-teal-100",
    badgeText: "text-teal-800",
    dotColor: "bg-teal-400",
    requiredDocs: [
      "Passport",
      "Current IRP Card (if held)",
      "Application Form",
      "Change of Circumstances Evidence",
      "Bank Statements",
      "Cover Letter",
    ],
  },
  IRP_REGISTRATION: {
    key: "IRP_REGISTRATION",
    label: "IRP Registration / Renewal",
    shortCode: "IRP",
    group: "RESIDENCY",
    badgeBg: "bg-teal-100",
    badgeText: "text-teal-800",
    dotColor: "bg-teal-400",
    requiredDocs: [
      "Passport",
      "Existing Permission Evidence",
      "Completed IRP Registration Form",
      "Proof of Address (utility bill / lease)",
      "Bank Statements",
    ],
  },
  LONG_TERM_RESIDENCY: {
    key: "LONG_TERM_RESIDENCY",
    label: "Long Term Residency",
    shortCode: "LTR",
    group: "RESIDENCY",
    badgeBg: "bg-teal-100",
    badgeText: "text-teal-800",
    dotColor: "bg-teal-400",
    requiredDocs: [
      "Passport",
      "5 Years Legal Residence Evidence",
      "P60s / Tax Compliance",
      "Application Form",
      "Bank Statements",
      "Character Reference",
    ],
  },

  // ── Citizenship (Purple) ──────────────────────────────
  NATURALISATION: {
    key: "NATURALISATION",
    label: "Naturalisation (Citizenship)",
    shortCode: "NAT",
    group: "CITIZENSHIP",
    badgeBg: "bg-purple-100",
    badgeText: "text-purple-800",
    dotColor: "bg-purple-400",
    requiredDocs: [
      "Passport",
      "All Previous Passports",
      "All Previous IRP Cards",
      "5 Years Residence Evidence",
      "Irish Tax Reference / P60s",
      "Garda Clearance / Police Certificate",
      "Application Form (CTZEN1)",
      "Proof of Good Character",
      "Bank Statements",
    ],
  },
  CITIZENSHIP_DESCENT: {
    key: "CITIZENSHIP_DESCENT",
    label: "Citizenship by Descent",
    shortCode: "CBD",
    group: "CITIZENSHIP",
    badgeBg: "bg-purple-100",
    badgeText: "text-purple-800",
    dotColor: "bg-purple-400",
    requiredDocs: [
      "Applicant's Passport",
      "Irish Parent/Grandparent's Birth Certificate",
      "Parent's Birth Certificate",
      "Marriage Certificate (of Irish ancestor)",
      "Application Form (CBD1)",
    ],
  },

  // ── Foreign Birth Registration (Pink) ─────────────────
  FOREIGN_BIRTH_REGISTRATION: {
    key: "FOREIGN_BIRTH_REGISTRATION",
    label: "Foreign Birth Registration",
    shortCode: "FBR",
    group: "FBR",
    badgeBg: "bg-pink-100",
    badgeText: "text-pink-800",
    dotColor: "bg-pink-400",
    requiredDocs: [
      "Applicant's Passport / Birth Certificate",
      "Irish Grandparent's Birth Certificate",
      "Parent's Birth Certificate",
      "Irish Grandparent's Marriage Certificate",
      "Long-form Birth Certificates (all in chain)",
      "FBR Application Form",
    ],
  },
};

// ─── Helper Functions ────────────────────────────────────

export function getCaseConfig(caseType: CaseTypeKey): CaseTypeConfig {
  return CASE_CONFIG[caseType];
}

export function getRequiredDocuments(caseType: CaseTypeKey): string[] {
  return CASE_CONFIG[caseType]?.requiredDocs ?? [];
}

export function getCasesByGroup(): Map<CaseGroup, CaseTypeConfig[]> {
  const grouped = new Map<CaseGroup, CaseTypeConfig[]>();
  for (const group of GROUP_ORDER) {
    grouped.set(group, []);
  }
  for (const config of Object.values(CASE_CONFIG)) {
    grouped.get(config.group)!.push(config);
  }
  return grouped;
}
