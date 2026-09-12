import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});

function containsExactValue(value: unknown, needle: string): boolean {
  if (typeof value === "string") return value === needle;
  if (Array.isArray(value)) return value.some((item) => containsExactValue(item, needle));
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) => containsExactValue(item, needle));
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return reply({ ok: false, error: "unauthorized" }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: callerData, error: callerError } = await admin.auth.getUser(token);
    if (callerError || !callerData.user) return reply({ ok: false, error: "unauthorized" }, 401);

    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("role,generator_id,is_active")
      .eq("id", callerData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.role !== "generator_admin" || !profile.is_active || !profile.generator_id) {
      return reply({ ok: false, error: "forbidden" }, 403);
    }

    const generatorId = String(profile.generator_id);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    if (action === "reset_extras") {
      for (const table of ["app_notifications", "device_push_tokens", "web_push_subscriptions"]) {
        const { error } = await admin.from(table).delete().eq("generator_id", generatorId);
        if (error) throw new Error(`${table}: ${error.message}`);
      }
      return reply({ ok: true, generator_id: generatorId, purged: true });
    }

    if (action === "delete_subscriber_extras") {
      const subscriberId = String(body?.subscriber_id || "").trim();
      if (!subscriberId) return reply({ ok: false, error: "subscriber_id required" }, 400);

      const { error: issueError } = await admin.from("owner_ai_issues")
        .delete().eq("generator_id", generatorId).eq("entity_id", subscriberId);
      if (issueError) throw new Error(`owner_ai_issues: ${issueError.message}`);

      const { data: actions, error: actionsError } = await admin.from("owner_ai_actions")
        .select("id,parameters,before_state,after_state").eq("generator_id", generatorId);
      if (actionsError) throw actionsError;
      const actionIds = (actions || []).filter((row: any) =>
        [row.parameters, row.before_state, row.after_state].some((value) => containsExactValue(value, subscriberId))
      ).map((row: any) => String(row.id));
      if (actionIds.length) {
        const { error } = await admin.from("owner_ai_actions").delete().in("id", actionIds);
        if (error) throw error;
      }

      const { data: pending, error: pendingError } = await admin.from("owner_ai_pending_actions")
        .select("id,parameters").eq("generator_id", generatorId);
      if (pendingError) throw pendingError;
      const pendingIds = (pending || []).filter((row: any) => containsExactValue(row.parameters, subscriberId))
        .map((row: any) => String(row.id));
      if (pendingIds.length) {
        const { error } = await admin.from("owner_ai_pending_actions").delete().in("id", pendingIds);
        if (error) throw error;
      }

      return reply({ ok: true, subscriber_id: subscriberId, ai_actions: actionIds.length, ai_pending_actions: pendingIds.length });
    }

    return reply({ ok: false, error: "unsupported_action" }, 400);
  } catch (error) {
    console.error("generator-data-cleanup failed", error);
    return reply({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400);
  }
});
