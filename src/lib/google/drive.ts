import { google } from "googleapis";
import path from "path";
import fs from "fs";

function getCredentials() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    if (creds.private_key) {
      creds.private_key = creds.private_key.replace(/\\n/g, "\n");
    }
    return creds;
  }
  const keyPath = path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_PATH || "./service-account.json");
  return JSON.parse(fs.readFileSync(keyPath, "utf8"));
}

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: getCredentials(),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
}

export async function getDriveAccessToken(): Promise<string> {
  const auth = getAuth();
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) throw new Error("Could not obtain Drive access token");
  return tokenResponse.token;
}

export async function createSubFolder(
  parentFolderId: string,
  folderName: string,
  memberEmail?: string
): Promise<{ folderId: string; folderUrl: string }> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });

  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  const folderId = folder.data.id!;
  const folderUrl = folder.data.webViewLink!;

  await drive.permissions.create({
    fileId: folderId,
    requestBody: { type: "anyone", role: "writer" },
    supportsAllDrives: true,
  });

  if (memberEmail) {
    try {
      await drive.permissions.create({
        fileId: folderId,
        requestBody: { type: "user", role: "writer", emailAddress: memberEmail },
        sendNotificationEmail: false,
        supportsAllDrives: true,
      });
    } catch { /* Non-Google email — link access still works */ }
  }

  return { folderId, folderUrl };
}

export async function createInfluencerFolder(folderName: string, influencerEmail: string): Promise<string> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  const masterFolderId = process.env.GOOGLE_DRIVE_MASTER_FOLDER_ID;
  if (!masterFolderId) throw new Error("GOOGLE_DRIVE_MASTER_FOLDER_ID not set");

  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [masterFolderId],
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  const folderId = folder.data.id!;
  const folderUrl = folder.data.webViewLink!;

  await drive.permissions.create({
    fileId: folderId,
    requestBody: { type: "anyone", role: "writer" },
    supportsAllDrives: true,
  });

  try {
    await drive.permissions.create({
      fileId: folderId,
      requestBody: { type: "user", role: "writer", emailAddress: influencerEmail },
      sendNotificationEmail: false,
      supportsAllDrives: true,
    });
  } catch { /* Non-Google email — link access still works */ }

  return folderUrl;
}

export function extractDriveFileId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
  ];
  for (const p of patterns) {
    const match = url.match(p);
    if (match) return match[1];
  }
  return null;
}

export function extractFolderId(folderUrl: string): string | null {
  const match = folderUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export interface DriveFileMetadata {
  name: string;
  durationMs: number | null;
}

export async function getDriveFileMetadata(fileId: string): Promise<DriveFileMetadata> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  const file = await drive.files.get({
    fileId,
    fields: "name, videoMediaMetadata/durationMillis",
    supportsAllDrives: true,
  });
  const raw = file.data as Record<string, unknown>;
  const durationMs = (raw.videoMediaMetadata as Record<string, unknown>)?.durationMillis
    ? Number((raw.videoMediaMetadata as Record<string, unknown>).durationMillis)
    : null;
  return { name: file.data.name || "", durationMs };
}

export interface DriveFile {
  id: string;
  name: string;
  webViewLink: string;
  mimeType: string;
  createdTime: string;
  durationMs: number | null;
}

export async function listFolderFiles(folderId: string): Promise<DriveFile[]> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, webViewLink, mimeType, createdTime, videoMediaMetadata/durationMillis)",
      pageSize: 100,
      orderBy: "name",
      pageToken,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    for (const f of res.data.files ?? []) {
      const name = (f.name || '').toLowerCase();
      const mime = (f.mimeType || '').toLowerCase();
      const isVideo = mime.includes('video/')
        || mime === 'application/octet-stream'
        || mime === 'application/x-quicktime'
        || name.endsWith('.mp4') || name.endsWith('.mov')
        || name.endsWith('.m4v') || name.endsWith('.avi')
        || name.endsWith('.webm') || name.endsWith('.mkv');

      if (!isVideo) continue;

      const durationMs = (f as Record<string, unknown>).videoMediaMetadata
        ? ((f as Record<string, unknown>).videoMediaMetadata as Record<string, unknown>)?.durationMillis as number | undefined
        : null;

      files.push({
        id: f.id!, name: f.name!, webViewLink: f.webViewLink!,
        mimeType: f.mimeType!, createdTime: f.createdTime!,
        durationMs: durationMs ? Number(durationMs) : null,
      });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}

export async function initiateResumableUpload(
  folderId: string,
  fileName: string,
  mimeType: string,
  fileSize: number,
  clientOrigin?: string
): Promise<{ sessionUri: string }> {
  const auth = getAuth();
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;
  if (!token) throw new Error("Could not obtain service account access token");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Upload-Content-Type": mimeType,
    "X-Upload-Content-Length": String(fileSize),
  };
  if (clientOrigin) headers["Origin"] = clientOrigin;

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true",
    {
      method: "POST",
      headers,
      body: JSON.stringify({ name: fileName, parents: [folderId] }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Drive resumable upload initiation failed: ${response.status} ${text}`);
  }

  const sessionUri = response.headers.get("location");
  if (!sessionUri) throw new Error("Drive API did not return a session URI");
  return { sessionUri };
}

export async function findFileInFolder(
  folderId: string,
  fileName: string
): Promise<{ id: string; webViewLink: string; md5Checksum: string | null } | null> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  const safeFileName = fileName.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  const res = await drive.files.list({
    q: `'${folderId}' in parents and name = '${safeFileName}' and trashed = false`,
    fields: "files(id, webViewLink, md5Checksum)",
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    pageSize: 1,
  });

  const file = res.data.files?.[0];
  if (!file || !file.id || !file.webViewLink) return null;
  return { id: file.id, webViewLink: file.webViewLink, md5Checksum: file.md5Checksum ?? null };
}

async function grantServiceAccountWriteAccess(drive: ReturnType<typeof google.drive>, fileId: string): Promise<void> {
  const creds = getCredentials();
  const serviceAccountEmail = creds.client_email as string;
  if (!serviceAccountEmail) return;
  try {
    const perms = await drive.permissions.list({
      fileId, fields: "permissions(id, emailAddress, role)", supportsAllDrives: true,
    });
    const alreadyGranted = (perms.data.permissions ?? []).some(
      (p) => p.emailAddress === serviceAccountEmail && (p.role === "writer" || p.role === "owner")
    );
    if (alreadyGranted) return;
    await drive.permissions.create({
      fileId,
      requestBody: { type: "user", role: "writer", emailAddress: serviceAccountEmail },
      sendNotificationEmail: false,
      supportsAllDrives: true,
    });
  } catch (err) {
    console.warn("[drive] Could not grant service account write access:", fileId, err);
  }
}

/**
 * Copy a Drive file into a destination folder with a new name.
 * The file extension from the source is preserved if `newName` has no extension.
 * Throws if the copy fails (e.g. service account lacks read access on the source).
 */
export async function copyDriveFile(
  sourceFileId: string,
  destFolderId: string,
  newName: string,
): Promise<{ copiedFileId: string; webViewLink: string }> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });

  // Fetch source file name to preserve extension
  let sourceName = "";
  try {
    const meta = await drive.files.get({ fileId: sourceFileId, fields: "name", supportsAllDrives: true });
    sourceName = meta.data.name || "";
  } catch { /* ignore — no extension will be appended */ }

  const extMatch = sourceName.match(/\.[^.]+$/);
  const extension = extMatch ? extMatch[0] : "";
  const finalName = newName.includes(".") ? newName : `${newName}${extension}`;

  const copied = await drive.files.copy({
    fileId: sourceFileId,
    requestBody: { name: finalName, parents: [destFolderId] },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  if (!copied.data.id || !copied.data.webViewLink) {
    throw new Error("Drive copy did not return file ID or link");
  }

  return { copiedFileId: copied.data.id, webViewLink: copied.data.webViewLink };
}

export async function renameDriveFile(fileId: string, newName: string): Promise<{ renamed: boolean; reason?: string }> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  await grantServiceAccountWriteAccess(drive, fileId);

  const file = await drive.files.get({ fileId, fields: "name, parents", supportsAllDrives: true });
  const currentName = file.data.name || "";
  const extMatch = currentName.match(/\.[^.]+$/);
  const extension = extMatch ? extMatch[0] : ".mp4";
  const finalName = newName.includes(".") ? newName : `${newName}${extension}`;

  if (currentName === finalName) return { renamed: false, reason: "already_named" };

  const parentId = file.data.parents?.[0];
  if (parentId) {
    const existing = await drive.files.list({
      q: `'${parentId}' in parents and name = '${finalName}' and trashed = false`,
      fields: "files(id)", includeItemsFromAllDrives: true, supportsAllDrives: true,
    });
    if (existing.data.files && existing.data.files.length > 0) {
      return { renamed: false, reason: "duplicate_exists" };
    }
  }

  await drive.files.update({ fileId, requestBody: { name: finalName }, supportsAllDrives: true });
  return { renamed: true };
}

/**
 * Upload a file buffer directly to a Drive folder.
 * Uses the multipart upload endpoint — suitable for files up to ~5 MB (images, short clips, docs).
 * For large video files, prefer the resumable upload flow via initiateResumableUpload().
 */
export async function uploadFileToDrive(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string,
  destFolderId: string,
): Promise<{ fileId: string; webViewLink: string }> {
  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });

  const { Readable } = await import("stream");
  const stream = Readable.from(fileBuffer);

  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [destFolderId] },
    media: { mimeType, body: stream },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });

  if (!res.data.id || !res.data.webViewLink) {
    throw new Error("Drive upload did not return file ID or link");
  }

  return { fileId: res.data.id, webViewLink: res.data.webViewLink };
}
