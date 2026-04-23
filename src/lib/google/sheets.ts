import { google } from "googleapis";
import path from "path";
import fs from "fs";

function getCredentials() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    if (creds.private_key) creds.private_key = creds.private_key.replace(/\\n/g, "\n");
    return creds;
  }
  const keyPath = path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_PATH || "./service-account.json");
  return JSON.parse(fs.readFileSync(keyPath, "utf8"));
}

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: getCredentials(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheets() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_TRACKER_ID || "";
const TRACKER_SHEET = "Tracker";
const CONTENT_LOG_SHEET = "Content Log";
const DEAL_LOG_SHEET = "Deal Log";
const INTAKE_HISTORY_SHEET = "Intake History";

function fmt(v: string | number | boolean | null | undefined): string | number {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "YES" : "NO";
  return v;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.split("T")[0];
}

// ─── Tracker sheet ─────────────────────────────────────────────────────────
// A = Name        B = Email (lookup key)    C = Agency
// D = Primary Platform  E = IG Handle      F = TikTok Handle
// G = YouTube Handle   H = Followers       I = Status
// J = Deal Owner       K = Monthly Rate    L = Total Rate
// M = Campaign Start   N = Campaign End    O = Contract Signed
// P = Drive Folder     Q = Brief Count     R = Submissions (Approved)
// S = Submissions (Pending) T = Submissions (Rejected) U = Go-Live Count
// V = Discount Code    W = Notes

async function findTrackerRowByEmail(email: string): Promise<number | null> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TRACKER_SHEET}!B:B`,
  });
  const rows = res.data.values || [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0]?.toString().toLowerCase() === email.toLowerCase()) return i + 1;
  }
  return null;
}

async function getTrackerNextEmptyRow(): Promise<number> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: `${TRACKER_SHEET}!A:A`,
  });
  const rows = res.data.values || [];
  for (let i = 1; i < rows.length; i++) {
    if (!rows[i]?.[0]?.toString().trim()) return i + 1;
  }
  return rows.length + 1;
}

export interface InfluencerSyncData {
  fullName: string;
  email: string;
  agencyName?: string | null;
  primaryPlatform?: string | null;
  igHandle?: string | null;
  tiktokHandle?: string | null;
  youtubeHandle?: string | null;
  followerCount?: number | null;
  status?: string | null;
  dealOwner?: string | null;
  monthlyRateCents?: number | null;
  totalRateCents?: number | null;
  campaignStart?: string | null;
  campaignEnd?: string | null;
  contractSignedAt?: string | null;
  driveFolderUrl?: string | null;
  briefCount?: number | null;
  submissionsApproved?: number | null;
  submissionsPending?: number | null;
  submissionsRejected?: number | null;
  goLiveCount?: number | null;
  discountCode?: string | null;
  notes?: string | null;
}

export async function syncInfluencerToTracker(data: InfluencerSyncData): Promise<void> {
  const sheets = getSheets();
  let rowNumber = await findTrackerRowByEmail(data.email);
  const isNew = rowNumber === null;
  if (isNew) rowNumber = await getTrackerNextEmptyRow();
  const r = rowNumber!;

  const updates: Array<{ range: string; values: (string | number)[][] }> = [
    { range: `${TRACKER_SHEET}!A${r}`, values: [[fmt(data.fullName)]] },
    { range: `${TRACKER_SHEET}!C${r}`, values: [[fmt(data.agencyName)]] },
    { range: `${TRACKER_SHEET}!D${r}`, values: [[fmt(data.primaryPlatform)]] },
    { range: `${TRACKER_SHEET}!E${r}`, values: [[fmt(data.igHandle)]] },
    { range: `${TRACKER_SHEET}!F${r}`, values: [[fmt(data.tiktokHandle)]] },
    { range: `${TRACKER_SHEET}!G${r}`, values: [[fmt(data.youtubeHandle)]] },
    { range: `${TRACKER_SHEET}!H${r}`, values: [[data.followerCount ?? ""]] },
    { range: `${TRACKER_SHEET}!I${r}`, values: [[fmt(data.status)]] },
    { range: `${TRACKER_SHEET}!J${r}`, values: [[fmt(data.dealOwner)]] },
    { range: `${TRACKER_SHEET}!K${r}`, values: [[data.monthlyRateCents ? (data.monthlyRateCents / 100).toFixed(2) : ""]] },
    { range: `${TRACKER_SHEET}!L${r}`, values: [[data.totalRateCents ? (data.totalRateCents / 100).toFixed(2) : ""]] },
    { range: `${TRACKER_SHEET}!M${r}`, values: [[fmtDate(data.campaignStart)]] },
    { range: `${TRACKER_SHEET}!N${r}`, values: [[fmtDate(data.campaignEnd)]] },
    { range: `${TRACKER_SHEET}!O${r}`, values: [[fmtDate(data.contractSignedAt)]] },
    { range: `${TRACKER_SHEET}!P${r}`, values: [[fmt(data.driveFolderUrl)]] },
    { range: `${TRACKER_SHEET}!Q${r}`, values: [[data.briefCount ?? 0]] },
    { range: `${TRACKER_SHEET}!R${r}`, values: [[data.submissionsApproved ?? 0]] },
    { range: `${TRACKER_SHEET}!S${r}`, values: [[data.submissionsPending ?? 0]] },
    { range: `${TRACKER_SHEET}!T${r}`, values: [[data.submissionsRejected ?? 0]] },
    { range: `${TRACKER_SHEET}!U${r}`, values: [[data.goLiveCount ?? 0]] },
    { range: `${TRACKER_SHEET}!V${r}`, values: [[fmt(data.discountCode)]] },
    { range: `${TRACKER_SHEET}!W${r}`, values: [[fmt(data.notes)]] },
  ];

  if (isNew) {
    updates.push({ range: `${TRACKER_SHEET}!B${r}`, values: [[data.email]] });
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: "USER_ENTERED", data: updates },
  });
}

// ─── Content Log sheet ─────────────────────────────────────────────────────
// A = Influencer Name   B = Email   C = Deal ID (key)
// D = Brief Title       E = Platform  F = Content Type
// G = File Name         H = Drive Link  I = Post Link
// J = Date Submitted    K = Date Approved  L = Approved By
// M = Submission ID (hidden key)

async function findContentLogRowBySubmissionId(submissionId: string): Promise<number | null> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: `${CONTENT_LOG_SHEET}!M:M`,
  });
  const rows = res.data.values || [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0]?.toString() === submissionId) return i + 1;
  }
  return null;
}

export interface ContentLogEntry {
  submissionId: string;
  influencerName: string;
  email: string;
  dealId: string;
  briefTitle?: string | null;
  platform?: string | null;
  contentType: string;
  fileName?: string | null;
  driveUrl?: string | null;
  postUrl?: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  approvedByName?: string | null;
}

export async function syncContentLogEntry(data: ContentLogEntry): Promise<void> {
  const sheets = getSheets();
  let rowNumber = await findContentLogRowBySubmissionId(data.submissionId);
  if (rowNumber === null) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: `${CONTENT_LOG_SHEET}!A:A`,
    });
    rowNumber = (res.data.values || []).length + 1;
  }
  const r = rowNumber;

  const updates = [
    { range: `${CONTENT_LOG_SHEET}!A${r}`, values: [[fmt(data.influencerName)]] },
    { range: `${CONTENT_LOG_SHEET}!B${r}`, values: [[fmt(data.email)]] },
    { range: `${CONTENT_LOG_SHEET}!C${r}`, values: [[fmt(data.dealId)]] },
    { range: `${CONTENT_LOG_SHEET}!D${r}`, values: [[fmt(data.briefTitle)]] },
    { range: `${CONTENT_LOG_SHEET}!E${r}`, values: [[fmt(data.platform)]] },
    { range: `${CONTENT_LOG_SHEET}!F${r}`, values: [[fmt(data.contentType)]] },
    { range: `${CONTENT_LOG_SHEET}!G${r}`, values: [[fmt(data.fileName)]] },
    { range: `${CONTENT_LOG_SHEET}!H${r}`, values: [[fmt(data.driveUrl)]] },
    { range: `${CONTENT_LOG_SHEET}!I${r}`, values: [[fmt(data.postUrl)]] },
    { range: `${CONTENT_LOG_SHEET}!J${r}`, values: [[fmtDate(data.submittedAt)]] },
    { range: `${CONTENT_LOG_SHEET}!K${r}`, values: [[fmtDate(data.reviewedAt)]] },
    { range: `${CONTENT_LOG_SHEET}!L${r}`, values: [[fmt(data.approvedByName)]] },
    { range: `${CONTENT_LOG_SHEET}!M${r}`, values: [[data.submissionId]] },
  ];

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: "USER_ENTERED", data: updates },
  });
}

// ─── Intake History (append-only record of every submitted profile) ──────
// A = Timestamp  B = Submitter Name  C = Submitter Email  D = Agency
// E = Influencer Name  F = Platform  G = IG Handle  H = TikTok Handle
// I = YouTube Handle  J = Followers  K = Proposed Rate (USD)  L = Niches
// M = Others Niche  N = Positioning  O = Proposed Deliverables (JSON)
// P = Discovery Profile ID

export interface IntakeHistoryEntry {
  submitterName: string;
  submitterEmail: string;
  submitterAgency: string | null;
  influencerName: string;
  platform: string;
  igHandle?: string | null;
  tiktokHandle?: string | null;
  youtubeHandle?: string | null;
  followerCount?: number | null;
  proposedRateUsd?: number | null;
  niches: string[];
  othersNiche?: string | null;
  positioning?: string | null;
  proposedDeliverables?: Array<{ code: string; count: number }>;
  discoveryProfileId: string;
}

export async function appendIntakeHistory(entry: IntakeHistoryEntry): Promise<void> {
  if (!SPREADSHEET_ID) return;
  const sheets = getSheets();

  // Ensure the sheet tab exists (create on first call with header row).
  try {
    await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: `${INTAKE_HISTORY_SHEET}!A1`,
    });
  } catch {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: INTAKE_HISTORY_SHEET } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${INTAKE_HISTORY_SHEET}!A1:P1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          "Timestamp", "Submitter Name", "Submitter Email", "Agency",
          "Creator Name", "Platform", "IG Handle", "TikTok Handle",
          "YouTube Handle", "Followers", "Proposed Rate (USD)", "Niches",
          "Others Niche", "Positioning", "Proposed Deliverables", "Profile ID",
        ]],
      },
    });
  }

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: `${INTAKE_HISTORY_SHEET}!A:A`,
  });
  const nextRow = (existing.data.values || []).length + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${INTAKE_HISTORY_SHEET}!A${nextRow}:P${nextRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        new Date().toISOString(),
        fmt(entry.submitterName),
        fmt(entry.submitterEmail),
        fmt(entry.submitterAgency),
        fmt(entry.influencerName),
        fmt(entry.platform),
        fmt(entry.igHandle),
        fmt(entry.tiktokHandle),
        fmt(entry.youtubeHandle),
        entry.followerCount ?? "",
        entry.proposedRateUsd ?? "",
        (entry.niches || []).join(", "),
        fmt(entry.othersNiche),
        fmt(entry.positioning),
        JSON.stringify(entry.proposedDeliverables || []),
        entry.discoveryProfileId,
      ]],
    },
  });
}

// ─── Deal Log (append-only activity feed) ─────────────────────────────────
// A = Timestamp  B = Entity Type  C = Entity ID  D = Actor  E = Action  F = Notes

export async function logDealActivity(params: {
  entityType: string;
  entityId: string;
  actorName: string;
  action: string;
  notes?: string;
}): Promise<void> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: `${DEAL_LOG_SHEET}!A:A`,
  });
  const nextRow = (res.data.values || []).length + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${DEAL_LOG_SHEET}!A${nextRow}:F${nextRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        new Date().toISOString(),
        params.entityType,
        params.entityId,
        params.actorName,
        params.action,
        params.notes || "",
      ]],
    },
  });
}
