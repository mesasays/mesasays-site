import { existsSync } from "node:fs";
import { join } from "node:path";
import { V1_ROOT } from "@/lib/restaurants/paths";

// The public build generates its catalog from the open dataset only (scripts/open-data-to-v1.mjs leaves this marker):
// that data is ODbL. The private build of mesasays.com also holds facts first collected from sources we may not
// relicense (e.g. Google), so it makes no reuse grant and points to the open dataset instead.
export const OPEN_DATASET_URL = "https://github.com/mesasays/mesasays-site/tree/main/data";
const isOpenBuild = existsSync(join(V1_ROOT, "OPEN_DATA_BUILD.json"));

export const dataLicense = isOpenBuild
  ? { license: "https://opendatacommons.org/licenses/odbl/1-0/", label: "ODbL 1.0", reuse: OPEN_DATASET_URL }
  // 2026-11-05: the open dataset is no longer exported (scripts/export-public.mjs), so mesasays.com points nowhere.
  : { license: null, label: "for reference only", reuse: null };
