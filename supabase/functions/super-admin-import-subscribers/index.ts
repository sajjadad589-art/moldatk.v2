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

const text = (value: unknown) => String(value ?? "").trim();
const nameKey = (value: unknown) => text(value).normalize("NFC").replace(/\s+/g, " ");
const phoneKey = (value: unknown) => text(value)
  .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
  .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
  .replace(/\D/g, "");
const lineKey = (value: unknown) => text(value)
  .normalize("NFC")
  .replace(/[ً-ْ]/g, "")
  .replace(/[أإآ]/g, "ا")
  .replace(/ة/g, "ه")
  .replace(/ى/g, "ي")
  .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
  .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
  .replace(/[ـ_\-.\/\:،,()\[\]]/g, "")
  .replace(/\s+/g, "")
  .toLowerCase();

const numberValue = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const dateValue = (value: unknown) => {
  const raw = text(value);
  if (!raw) return null;
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const allowedTiers = new Set(["normal", "commercial", "golden", "free", "custom"]);
const allowedStatuses = new Set(["paid", "partial", "unpaid", "free"]);

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
    const roleAllowed = Boolean(profile?.is_active && ["super_admin", "super_admin_manager"].includes(profile?.role));
    const managerAllowed = Boolean(manager?.is_active);
    if (!roleAllowed && !managerAllowed && callerEmail !== "almumizz@gmail.com") {
      return json({ ok: false, error: "رفع المشتركين متاح للسوبر أدمن المخوّل فقط" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const generatorId = text(body?.generator_id);
    const inputRows = Array.isArray(body?.rows) ? body.rows : [];
    if (!generatorId) return json({ ok: false, error: "اختر حساب صاحب المولدة" }, 400);
    if (!inputRows.length) return json({ ok: false, error: "لا توجد صفوف صالحة للرفع" }, 400);
    if (inputRows.length > 5000) return json({ ok: false, error: "الحد الأعلى للدفعة الواحدة هو 5000 مشترك" }, 400);

    const { data: generator, error: generatorError } = await admin.from("generators")
      .select("id,name")
      .eq("id", generatorId)
      .maybeSingle();
    if (generatorError) throw generatorError;
    if (!generator) return json({ ok: false, error: "حساب صاحب المولدة غير موجود" }, 404);

    const [{ data: existingSubscribers, error: subscribersError }, { data: existingLines, error: linesError }, { data: activeTariffs, error: tariffError }] = await Promise.all([
      admin.from("generator_subscribers").select("id,code,full_name,phone,line_id,amperes").eq("generator_id", generatorId),
      admin.from("generator_lines").select("*").eq("generator_id", generatorId).order("sort_order", { ascending: true }),
      admin.from("generator_monthly_tariffs").select("id,tiers,is_current_active,year,month,status").eq("generator_id", generatorId).order("year", { ascending: false }).order("month", { ascending: false }),
    ]);
    if (subscribersError) throw new Error(`generator_subscribers: ${subscribersError.message}`);
    if (linesError) throw new Error(`generator_lines: ${linesError.message}`);
    if (tariffError) throw new Error(`generator_monthly_tariffs: ${tariffError.message}`);

    const activeTariff = (activeTariffs || []).find((t: any) => t.is_current_active) || (activeTariffs || [])[0] || null;
    const tiers = Array.isArray(activeTariff?.tiers) ? activeTariff.tiers : [];
    const usedNames = new Set((existingSubscribers || []).map((s: any) => nameKey(s.full_name)).filter(Boolean));
    const usedPhones = new Set((existingSubscribers || []).map((s: any) => phoneKey(s.phone)).filter(Boolean));
    const usedCodes = new Set((existingSubscribers || []).map((s: any) => text(s.code)).filter(Boolean));
    const warnings: string[] = [];
    let duplicateNames = 0;
    let duplicatePhones = 0;
    let invalidRows = 0;

    const prefix = generatorId.replace(/-/g, "").slice(0, 5).toUpperCase() || "GEN";
    let codeCounter = Math.max(1, (existingSubscribers || []).length + 1);
    const nextCode = () => {
      let candidate = `MW-${prefix}-${String(codeCounter).padStart(4, "0")}`;
      while (usedCodes.has(candidate)) {
        codeCounter += 1;
        candidate = `MW-${prefix}-${String(codeCounter).padStart(4, "0")}`;
      }
      codeCounter += 1;
      usedCodes.add(candidate);
      return candidate;
    };

    const prepared: any[] = [];
    inputRows.forEach((raw: any, index: number) => {
      const excelRow = Number(raw?.excel_row || index + 2);
      const fullName = text(raw?.full_name).replace(/\s+/g, " ");
      const normalizedName = nameKey(fullName);
      const phone = text(raw?.phone);
      const normalizedPhone = phoneKey(phone);

      if (!fullName) {
        invalidRows += 1;
        warnings.push(`السطر ${excelRow}: لم يتم رفعه لأن الاسم فارغ.`);
        return;
      }
      if (usedNames.has(normalizedName)) {
        duplicateNames += 1;
        warnings.push(`السطر ${excelRow}: الاسم مطابق لاسم موجود مسبقاً (${fullName}).`);
        return;
      }
      if (normalizedPhone && usedPhones.has(normalizedPhone)) {
        duplicatePhones += 1;
        warnings.push(`السطر ${excelRow}: رقم الهاتف مكرر (${phone}).`);
        return;
      }

      usedNames.add(normalizedName);
      if (normalizedPhone) usedPhones.add(normalizedPhone);

      let code = text(raw?.code);
      if (!code || usedCodes.has(code)) code = nextCode();
      else usedCodes.add(code);

      const requestedTier = text(raw?.tier);
      const tier = allowedTiers.has(requestedTier) ? requestedTier : "normal";
      const amperes = Math.max(0, Math.round(numberValue(raw?.amperes, 1)));
      const isExempted = Boolean(raw?.is_exempted) || tier === "free";
      const paid = isExempted ? 0 : Math.max(0, Math.round(numberValue(raw?.amount_paid, 0)));

      const explicitDue = raw?.amount_due === null || raw?.amount_due === undefined || raw?.amount_due === ""
        ? null
        : Math.max(0, Math.round(numberValue(raw?.amount_due, 0)));
      const priceTier = tiers.find((p: any) => p?.type === tier);
      const calculatedTotal = isExempted || !priceTier
        ? 0
        : Math.max(0, Math.round(amperes * numberValue(priceTier.pricePerAmpere, 0) + numberValue(priceTier.fixedFee, 0)));
      const total = explicitDue === null ? calculatedTotal : explicitDue + paid;

      let paymentStatus = text(raw?.payment_status);
      if (!allowedStatuses.has(paymentStatus)) {
        paymentStatus = isExempted ? "free" : paid >= total && total > 0 ? "paid" : paid > 0 ? "partial" : "unpaid";
      }
      if (isExempted) paymentStatus = "free";
      const amountDue = paymentStatus === "free" ? 0 : Math.max(total - paid, 0);

      prepared.push({
        id: text(raw?.id) || `sub-${crypto.randomUUID()}`,
        generator_id: generatorId,
        code,
        full_name: fullName,
        phone,
        tier: isExempted ? "free" : tier,
        amperes,
        line_name: text(raw?.line_name) || null,
        address: text(raw?.address) || null,
        box_number: text(raw?.box_number) || null,
        payment_status: paymentStatus,
        last_payment_date: dateValue(raw?.last_payment_date),
        amount_due: amountDue,
        amount_paid: paid,
        notes: text(raw?.notes) || null,
        is_exempted: isExempted,
        exempt_reason: isExempted ? (text(raw?.exempt_reason) || "استيراد من Excel") : null,
        joining_date: dateValue(raw?.joining_date) || new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
        excel_row: excelRow,
      });
    });

    if (!prepared.length) {
      return json({
        ok: true,
        generator_id: generatorId,
        generator_name: generator.name,
        imported_count: 0,
        skipped_count: duplicateNames + duplicatePhones + invalidRows,
        duplicate_names: duplicateNames,
        duplicate_phones: duplicatePhones,
        invalid_rows: invalidRows,
        created_cabinets: [],
        warnings: warnings.slice(0, 100),
      });
    }

    const lineMap = new Map<string, any>();
    for (const line of existingLines || []) {
      for (const value of [line.id, line.name, line.zone]) {
        const key = lineKey(value);
        if (key && !lineMap.has(key)) lineMap.set(key, line);
      }
    }

    const createdLines: any[] = [];
    for (const row of prepared) {
      const requestedName = text(row.line_name);
      if (!requestedName) continue;
      const key = lineKey(requestedName);
      if (!key || lineMap.has(key)) continue;
      const nextIndex = (existingLines || []).length + createdLines.length + 1;
      const phaseTypes = ["phase-R", "phase-S", "phase-T", "3-phase"];
      const phaseType = phaseTypes[(nextIndex - 1) % phaseTypes.length];
      const line = {
        id: `excel-line-${crypto.randomUUID()}`,
        generator_id: generatorId,
        name: requestedName,
        zone: requestedName,
        phase_type: phaseType,
        phase_name_ar: phaseType === "phase-R" ? "فيز R (الأحمر) - 380V" : phaseType === "phase-S" ? "فيز S (الأصفر) - 380V" : phaseType === "phase-T" ? "فيز T (الأزرق) - 380V" : "ثلاثي الفيز (3-Phase)",
        max_capacity_amperes: 200,
        current_load_amperes: 0,
        subscribers_count: 0,
        technician_name: "",
        breaker_number: `Q${nextIndex}-250A`,
        sort_order: nextIndex,
        updated_at: new Date().toISOString(),
      };
      createdLines.push(line);
      lineMap.set(key, line);
    }

    if (createdLines.length) {
      const { error } = await admin.from("generator_lines").insert(createdLines);
      if (error) throw new Error(`generator_lines: ${error.message}`);
    }

    const subscriberRows = prepared.map((row) => {
      const requestedLine = text(row.line_name);
      const line = requestedLine ? lineMap.get(lineKey(requestedLine)) : null;
      const { excel_row: _excelRow, ...clean } = row;
      return {
        ...clean,
        line_id: line?.id || null,
        line_name: line?.name || requestedLine || null,
      };
    });

    const { error: insertError } = await admin.from("generator_subscribers").insert(subscriberRows);
    if (insertError) {
      if (createdLines.length) {
        await admin.from("generator_lines").delete().eq("generator_id", generatorId).in("id", createdLines.map((line) => line.id));
      }
      throw new Error(`generator_subscribers: ${insertError.message}`);
    }

    const { data: allSubscribers, error: statReadError } = await admin.from("generator_subscribers")
      .select("line_id,amperes")
      .eq("generator_id", generatorId);
    if (!statReadError) {
      const stats = new Map<string, { count: number; amps: number }>();
      for (const sub of allSubscribers || []) {
        if (!sub.line_id) continue;
        const prev = stats.get(sub.line_id) || { count: 0, amps: 0 };
        prev.count += 1;
        prev.amps += numberValue(sub.amperes, 0);
        stats.set(sub.line_id, prev);
      }
      const allLines = [...(existingLines || []), ...createdLines];
      await Promise.all(allLines.map((line: any) => {
        const stat = stats.get(line.id) || { count: 0, amps: 0 };
        return admin.from("generator_lines")
          .update({ subscribers_count: stat.count, current_load_amperes: Math.round(stat.amps), updated_at: new Date().toISOString() })
          .eq("generator_id", generatorId)
          .eq("id", line.id);
      }));
    }

    await admin.from("generator_audit_logs").insert({
      id: `audit-${crypto.randomUUID()}`,
      generator_id: generatorId,
      timestamp: new Date().toISOString(),
      category: "subscriber",
      title: "رفع مشتركين من Excel عبر السوبر أدمن",
      details: `تم رفع ${subscriberRows.length} مشترك إلى السحابة، وإنشاء ${createdLines.length} كابينة، وتخطي ${duplicateNames + duplicatePhones + invalidRows} سطر.`,
      entity_name: generator.name,
      actor_name: caller.email || "Super Admin",
    }).then(() => undefined).catch(() => undefined);

    return json({
      ok: true,
      generator_id: generatorId,
      generator_name: generator.name,
      imported_count: subscriberRows.length,
      skipped_count: duplicateNames + duplicatePhones + invalidRows,
      duplicate_names: duplicateNames,
      duplicate_phones: duplicatePhones,
      invalid_rows: invalidRows,
      created_cabinets: createdLines.map((line) => line.name),
      warnings: warnings.slice(0, 100),
    });
  } catch (error) {
    console.error("super-admin-import-subscribers failed", error);
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 400);
  }
});
