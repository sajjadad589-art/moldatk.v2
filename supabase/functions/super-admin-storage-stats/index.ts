import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});

const DB_QUOTA_BYTES = Number(Deno.env.get("MOLDATK_DB_QUOTA_BYTES") || "500000000");
const FILE_QUOTA_BYTES = Number(Deno.env.get("MOLDATK_FILE_QUOTA_BYTES") || "1000000000");
const PLAN_NAME = Deno.env.get("MOLDATK_SUPABASE_PLAN") || "free";

const percentage = (used: number, quota: number) => quota > 0 ? Math.max(0, (used / quota) * 100) : 0;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ ok: false, error: "unauthorized" }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    const { data: callerData, error: callerError } = await admin.auth.getUser(token);
    if (callerError || !callerData.user) return json({ ok: false, error: "unauthorized" }, 401);

    const caller = callerData.user;
    const [{ data: profile }, { data: manager }] = await Promise.all([
      admin.from("profiles").select("role,is_active").eq("id", caller.id).maybeSingle(),
      admin.from("super_admin_managers").select("is_owner,is_active").eq("id", caller.id).maybeSingle(),
    ]);

    const callerEmail = String(caller.email || "").toLowerCase();
    const roleAllowed = Boolean(profile?.is_active && ["super_admin", "super_admin_manager"].includes(String(profile?.role || "")));
    const managerAllowed = Boolean(manager?.is_active);
    if (!roleAllowed && !managerAllowed && callerEmail !== "almumizz@gmail.com") {
      return json({ ok: false, error: "إحصائيات التخزين متاحة للسوبر أدمن فقط" }, 403);
    }

    const { data, error } = await admin.rpc("super_admin_storage_snapshot");
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("تعذر قراءة مساحة التخزين");

    const databaseBytes = Number(row.database_bytes || 0);
    const fileBytes = Number(row.object_storage_bytes || 0);
    const databasePercent = percentage(databaseBytes, DB_QUOTA_BYTES);
    const filePercent = percentage(fileBytes, FILE_QUOTA_BYTES);
    const criticalPercent = Math.max(databasePercent, filePercent);
    const criticalResource = databasePercent >= filePercent ? "database" : "files";
    const level = criticalPercent >= 100 ? "full" : criticalPercent >= 90 ? "danger" : criticalPercent >= 75 ? "warning" : "healthy";

    return json({
      ok: true,
      plan: PLAN_NAME,
      database_bytes: databaseBytes,
      database_quota_bytes: DB_QUOTA_BYTES,
      database_percent: Number(databasePercent.toFixed(2)),
      file_storage_bytes: fileBytes,
      file_storage_quota_bytes: FILE_QUOTA_BYTES,
      file_storage_percent: Number(filePercent.toFixed(2)),
      object_count: Number(row.object_count || 0),
      critical_percent: Number(criticalPercent.toFixed(2)),
      critical_resource: criticalResource,
      level,
      sampled_at: row.sampled_at || new Date().toISOString(),
    });
  } catch (error) {
    console.error("super-admin-storage-stats failed", error);
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400);
  }
});
