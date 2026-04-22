import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDriveAccessToken } from "@/lib/google/drive";

export async function GET(request: NextRequest, ctx: { params: Promise<{ fileId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { fileId } = await ctx.params;

  let token: string;
  try {
    token = await getDriveAccessToken();
  } catch {
    return new Response("Could not obtain Drive access token", { status: 500 });
  }

  const driveUrl = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`);
  driveUrl.searchParams.set("alt", "media");
  driveUrl.searchParams.set("supportsAllDrives", "true");

  const driveHeaders: Record<string, string> = { Authorization: `Bearer ${token}` };
  const range = request.headers.get("range");
  if (range) driveHeaders["Range"] = range;

  const driveResponse = await fetch(driveUrl.toString(), { headers: driveHeaders });

  if (!driveResponse.ok && driveResponse.status !== 206) {
    return new Response("Failed to fetch video from Drive", { status: driveResponse.status });
  }

  const responseHeaders = new Headers();
  const contentType = driveResponse.headers.get("content-type") ?? "video/mp4";
  const contentLength = driveResponse.headers.get("content-length");
  const contentRange = driveResponse.headers.get("content-range");
  const acceptRanges = driveResponse.headers.get("accept-ranges");

  responseHeaders.set("Content-Type", contentType);
  responseHeaders.set("Content-Disposition", "inline");
  responseHeaders.set("Accept-Ranges", acceptRanges ?? "bytes");
  responseHeaders.set("Cache-Control", "private, max-age=3600");
  if (contentLength) responseHeaders.set("Content-Length", contentLength);
  if (contentRange) responseHeaders.set("Content-Range", contentRange);

  return new Response(driveResponse.body, {
    status: driveResponse.status,
    headers: responseHeaders,
  });
}
