import { cache } from "react";
import { getDb } from "./db";
export const getSiteContent = cache(async () => {
  const rows = await getDb().all<{ page: string; key: string; value: string }>(
    "SELECT page,key,value FROM site_content",
  );
  return Object.fromEntries(
    rows.map((row) => [`${row.page}.${row.key}`, row.value]),
  );
});
