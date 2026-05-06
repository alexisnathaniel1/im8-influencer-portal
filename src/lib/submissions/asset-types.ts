/**
 * Canonical list of asset types a submission can contain.
 *
 * One submission row = one creator delivery, but a delivery can ship as
 * multiple assets (e.g. 3 full reels with different hooks + 3 hook clips for
 * ad testing + 1 body shot — all part of the same IGR submission).
 *
 * The first asset added is the "primary" — its drive_url/file_name/file_id
 * land on the submissions row directly. Additional assets live in
 * submissions.variants (JSONB array).
 *
 * "drive_folder" is special: the asset is the folder itself, not a copied file.
 * We don't try to clone the folder; we just store the URL.
 */

export type AssetType =
  | "full_reel"
  | "hook"
  | "main_body"
  | "cta"
  | "script"
  | "drive_folder";

export const ASSET_TYPES: ReadonlyArray<{
  value: AssetType;
  label: string;
  /** Filename slug used in the Drive canonical filename builder. */
  slug: string;
}> = [
  { value: "full_reel",    label: "Full Reel",    slug: "FullReel"  },
  { value: "hook",         label: "Hook",         slug: "Hook"      },
  { value: "main_body",    label: "Main Body",    slug: "Body"      },
  { value: "cta",          label: "CTA",          slug: "CTA"       },
  { value: "script",       label: "Script",       slug: "Script"    },
  { value: "drive_folder", label: "Drive Folder", slug: "Folder"    },
];

const SLUG_BY_VALUE: Record<AssetType, string> = ASSET_TYPES.reduce(
  (acc, t) => ({ ...acc, [t.value]: t.slug }),
  {} as Record<AssetType, string>,
);

const LABEL_BY_VALUE: Record<AssetType, string> = ASSET_TYPES.reduce(
  (acc, t) => ({ ...acc, [t.value]: t.label }),
  {} as Record<AssetType, string>,
);

export function assetSlug(value: AssetType): string {
  return SLUG_BY_VALUE[value] ?? "Asset";
}

export function assetLabel(value: AssetType): string {
  return LABEL_BY_VALUE[value] ?? value;
}

export function isAssetType(value: unknown): value is AssetType {
  return typeof value === "string" && value in SLUG_BY_VALUE;
}

export interface VariantAsset {
  asset_type: AssetType;
  drive_url: string;
  drive_file_id: string | null;
  file_name: string;
  /** Optional human label like "Hook 1", "Full Reel 2". */
  label: string | null;
}
