import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ ok: false, error: "unauthorized" }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: callerData, error: callerError } = await admin.auth.getUser(token);
    if (callerError || !callerData.user) return json({ ok: false, error: "unauthorized" }, 401);

    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("role,generator_id,is_active").eq("id", callerData.user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.role !== "generator_admin" || !profile.is_active || !profile.generator_id) {
      return json({ ok: false, error: "هذه العملية متاحة لصاحب المولدة فقط" }, 403);
    }

    const generatorId = String(profile.generator_id);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    if (action === "delete_subscriber") {
      const subscriberId = String(body?.subscriber_id || "").trim();
      if (!subscriberId) return json({ ok: false, error: "subscriber_id مطلوب" }, 400);
      const { data, error } = await admin.rpc("delete_generator_subscriber_permanent", {
        p_generator_id: generatorId,
        p_subscriber_id: subscriberId,
      });
      if (error) throw new Error(`delete_generator_subscriber_permanent: ${error.message}`);
      return json(data || { ok: true, subscriber_id: subscriberId, purged: true });
    }

    if (action === "reset_generator_data") {
      const [{ data: collectorRows, error: collectorError }, { data: employeeProfiles, error: employeeError }] = await Promise.all([
        admin.from("generator_collectors").select("id").eq("generator_id", generatorId),
        admin.from("profiles").select("id").eq("generator_id", generatorId).eq("role", "employee"),
      ]);
      if (collectorError) throw collectorError;
      if (employeeError) throw employeeError;

      const collectorIds = Array.from(new Set([...(collectorRows || []), ...(employeeProfiles || [])]
        .map((x: any) => String(x.id || "")).filter(Boolean)));
      if (collectorIds.length) {
        const { error: fixedByError } = await admin.from("owner_ai_issues").update({ fixed_by: null })
          .eq("generator_id", generatorId).in("fixed_by", collectorIds);
        if (fixedByError) throw new Error(`owner_ai_issues.fixed_by: ${fixedByError.message}`);
      }
      for (const id of collectorIds) {
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error && !String(error.message || "").toLowerCase().includes("not found")) {
          throw new Error(`collector_auth:${id}:${error.message}`);
        }
      }

      const { data, error } = await admin.rpc("reset_generator_account_operational_data", {
        p_generator_id: generatorId,
      });
      if (error) throw new Error(`reset_generator_account_operational_data: ${error.message}`);
      const { error: profileDeleteError } = await admin.from("profiles").delete()
        .eq("generator_id", generatorId).eq("role", "employee");
      if (profileDeleteError) throw profileDeleteError;
      return json({ ...(data || {}), ok: true, generator_id: generatorId, collectors_deleted: collectorIds.length, purged: true });
    }

    return json({ ok: false, error: "عملية غير معروفة" }, 400);
  } catch (error) {
    console.error("generator-data-admin failed", error);
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400);
  }
});
