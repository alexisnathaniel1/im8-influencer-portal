// Bulk-upload CSV columns + helpers. Edit COLUMNS to add/rename fields.

export type PartnerColumnKey =
  | "influencer_name"
  | "influencer_email"
  | "agency_name"
  | "platform_primary"
  | "instagram_handle"
  | "tiktok_handle"
  | "youtube_handle"
  | "follower_count"
  | "niche_tags"
  | "monthly_rate_usd"
  | "total_months"
  | "currency_code"
  | "campaign_start"
  | "campaign_end"
  | "status"
  | "deliverables"
  | "discount_code"
  | "affiliate_link"
  | "phone"
  | "manager_email"
  | "notes";

export type PartnerColumn = {
  key: PartnerColumnKey;
  label: string;
  required?: boolean;
  hint: string;
  example: string;
};

export const PARTNER_COLUMNS: PartnerColumn[] = [
  { key: "influencer_name",   label: "Influencer Name",   required: true,  hint: "Full creator name",                              example: "Jane Doe" },
  { key: "influencer_email",  label: "Email",             required: true,  hint: "Creator's email",                                example: "jane@example.com" },
  { key: "agency_name",       label: "Agency",                            hint: "Leave blank if direct (no agency)",              example: "Wellspirit Collective" },
  { key: "platform_primary",  label: "Primary Platform",                  hint: "instagram | tiktok | youtube",                   example: "instagram" },
  { key: "instagram_handle",  label: "Instagram Handle",                  hint: "Without the @",                                  example: "janedoe" },
  { key: "tiktok_handle",     label: "TikTok Handle",                     hint: "Without the @",                                  example: "janedoe" },
  { key: "youtube_handle",    label: "YouTube Handle",                    hint: "Channel handle",                                 example: "janedoe" },
  { key: "follower_count",    label: "Followers",                         hint: "Number — e.g. 250000",                           example: "250000" },
  { key: "niche_tags",        label: "Niches",                            hint: "Semicolon-separated. e.g. Athlete; Wellness",    example: "Athlete; Wellness" },
  { key: "monthly_rate_usd",  label: "Monthly Rate (USD)",                hint: "Whole dollars — e.g. 3000",                      example: "3000" },
  { key: "total_months",      label: "Months",                            hint: "Contract length in months — default 3",          example: "3" },
  { key: "currency_code",     label: "Currency",                          hint: "USD / GBP / AUD / EUR — default USD",            example: "USD" },
  { key: "campaign_start",    label: "Campaign Start",                    hint: "YYYY-MM-DD",                                     example: "2026-05-01" },
  { key: "campaign_end",      label: "Campaign End",                      hint: "YYYY-MM-DD — leave blank to auto-calc",          example: "2026-08-01" },
  { key: "status",            label: "Status",                            hint: "live | contracted | approved — default live",    example: "live" },
  { key: "deliverables",      label: "Deliverables",                      hint: "code:count; e.g. IGR:2; IGS:3; WHITELIST:1",     example: "IGR:2; IGS:3; WHITELIST:1" },
  { key: "discount_code",     label: "Discount Code",                     hint: "Optional — used to build the affiliate link",   example: "JANE15" },
  { key: "affiliate_link",    label: "Affiliate Link",                    hint: "Format: https://im8health.com/discount/{CODE}",  example: "https://im8health.com/discount/JANE15" },
  { key: "phone",             label: "Phone",                             hint: "Optional",                                       example: "+1 555 1234" },
  { key: "manager_email",     label: "Manager Email",                     hint: "Optional — agency contact",                      example: "manager@agency.com" },
  { key: "notes",             label: "Notes",                             hint: "Internal notes",                                 example: "Returning partner — Q4 2025" },
];

// Build a CSV template string with header row + one example row.
export function buildPartnersTemplateCsv(): string {
  const headers = PARTNER_COLUMNS.map(c => csvEscape(c.label)).join(",");
  const examples = PARTNER_COLUMNS.map(c => csvEscape(c.example)).join(",");
  return headers + "\n" + examples + "\n";
}

export function csvEscape(value: string): string {
  if (value == null) return "";
  const v = String(value);
  if (/[",\n\r]/.test(v)) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}

// Strict but forgiving CSV parser — handles quotes, escaped quotes, CRLF.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field); field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); rows.push(row); row = []; field = "";
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully-empty rows
  return rows.filter(r => r.some(cell => cell.trim().length > 0));
}

// Map header names from a CSV file back to our internal keys.
// Matches by label (case-insensitive) or by key directly.
export function mapHeaderToKey(header: string): PartnerColumnKey | null {
  const norm = header.trim().toLowerCase();
  for (const col of PARTNER_COLUMNS) {
    if (col.label.toLowerCase() === norm) return col.key;
    if (col.key === norm) return col.key;
    if (col.key.replace(/_/g, " ") === norm) return col.key;
  }
  return null;
}

// Parse "IGR:2; IGS:3; WHITELIST:1" → [{code:"IGR",count:2},...]
export function parseDeliverablesCell(raw: string): { code: string; count: number }[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[;,]/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(part => {
      const [code, countRaw] = part.split(":").map(s => s.trim());
      const count = parseInt(countRaw ?? "1", 10);
      return { code: code.toUpperCase(), count: isNaN(count) ? 1 : count };
    })
    .filter(d => d.code.length > 0 && d.count > 0);
}

export type ValidationError = { field: string; message: string };

export type ParsedPartnerRow = {
  rowIndex: number;
  raw: Record<string, string>;
  errors: ValidationError[];
  payload: PartnerPayload | null;
};

export type PartnerPayload = {
  influencer_name: string;
  influencer_email: string;
  agency_name: string | null;
  platform_primary: string;
  instagram_handle: string | null;
  tiktok_handle: string | null;
  youtube_handle: string | null;
  follower_count: number | null;
  niche_tags: string[];
  monthly_rate_cents: number | null;
  total_months: number;
  currency_code: string;
  campaign_start: string | null;
  campaign_end: string | null;
  status: string;
  deliverables: { code: string; count: number }[];
  discount_code: string | null;
  affiliate_link: string | null;
  phone: string | null;
  manager_email: string | null;
  rationale: string | null;
};

const ALLOWED_PLATFORMS = ["instagram", "tiktok", "youtube"];
const ALLOWED_STATUS = ["pending_approval", "approved", "contracted", "live"];

export function validateRow(row: Record<string, string>, rowIndex: number): ParsedPartnerRow {
  const errors: ValidationError[] = [];
  const get = (k: PartnerColumnKey) => (row[k] ?? "").trim();
  const optStr = (k: PartnerColumnKey) => (get(k) ? get(k) : null);
  const optInt = (k: PartnerColumnKey) => {
    const v = get(k);
    if (!v) return null;
    const n = parseInt(v.replace(/[^0-9-]/g, ""), 10);
    return isNaN(n) ? null : n;
  };

  if (!get("influencer_name")) errors.push({ field: "influencer_name", message: "Required" });
  if (!get("influencer_email")) errors.push({ field: "influencer_email", message: "Required" });
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(get("influencer_email")))
    errors.push({ field: "influencer_email", message: "Invalid email" });

  let platform = get("platform_primary").toLowerCase() || "instagram";
  if (!ALLOWED_PLATFORMS.includes(platform)) {
    errors.push({ field: "platform_primary", message: `Must be ${ALLOWED_PLATFORMS.join("/")}` });
    platform = "instagram";
  }

  let status = get("status").toLowerCase() || "live";
  if (!ALLOWED_STATUS.includes(status)) {
    errors.push({ field: "status", message: `Must be one of ${ALLOWED_STATUS.join("/")}` });
    status = "live";
  }

  const niches = get("niche_tags")
    .split(/[;,]/)
    .map(s => s.trim())
    .filter(Boolean);

  const monthlyUsd = optInt("monthly_rate_usd");
  const months = optInt("total_months") ?? 3;

  const start = optStr("campaign_start");
  let end: string | null = optStr("campaign_end");
  if (start && /^\d{4}-\d{2}-\d{2}$/.test(start) && !end) {
    const d = new Date(start);
    d.setMonth(d.getMonth() + months);
    end = d.toISOString().split("T")[0];
  }

  if (errors.length > 0) {
    return { rowIndex, raw: row, errors, payload: null };
  }

  // If an affiliate link wasn't provided but a discount code was, derive the
  // canonical URL: https://im8health.com/discount/{CODE}
  const discountCode = optStr("discount_code");
  let affiliate = optStr("affiliate_link");
  if (!affiliate && discountCode) {
    affiliate = `https://im8health.com/discount/${discountCode.trim().toUpperCase()}`;
  }

  const payload: PartnerPayload = {
    influencer_name: get("influencer_name"),
    influencer_email: get("influencer_email"),
    agency_name: optStr("agency_name"),
    platform_primary: platform,
    instagram_handle: optStr("instagram_handle")?.replace(/^@/, "") ?? null,
    tiktok_handle: optStr("tiktok_handle")?.replace(/^@/, "") ?? null,
    youtube_handle: optStr("youtube_handle")?.replace(/^@/, "") ?? null,
    follower_count: optInt("follower_count"),
    niche_tags: niches,
    monthly_rate_cents: monthlyUsd != null ? monthlyUsd * 100 : null,
    total_months: months,
    currency_code: (get("currency_code") || "USD").toUpperCase(),
    campaign_start: start && /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : null,
    campaign_end: end && /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : null,
    status,
    deliverables: parseDeliverablesCell(get("deliverables")),
    discount_code: discountCode,
    affiliate_link: affiliate,
    phone: optStr("phone"),
    manager_email: optStr("manager_email"),
    rationale: optStr("notes"),
  };

  return { rowIndex, raw: row, errors, payload };
}
