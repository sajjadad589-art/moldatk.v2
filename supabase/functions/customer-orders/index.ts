import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json" },
});

const clean = (value: unknown, max = 200) => String(value ?? "").trim().slice(0, max);
const emailOk = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const extFor = (type: string) => type === "image/png" ? "png" : type === "image/webp" ? "webp" : type === "application/pdf" ? "pdf" : "jpg";

const sha256Hex = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
};

const requestIp = (req: Request) => {
  const forwarded = String(req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  return String(
    req.headers.get("cf-connecting-ip")
    || req.headers.get("x-real-ip")
    || forwarded
    || "unknown"
  ).slice(0, 96);
};

async function rateAllowed(admin: any, rawKey: string, limit: number, windowSeconds: number, blockSeconds: number) {
  try {
    const keyHash = await sha256Hex(rawKey);
    const { data, error } = await admin.rpc("consume_moldatk_auth_rate_limit", {
      p_key_hash: keyHash,
      p_limit: limit,
      p_window_seconds: windowSeconds,
      p_block_seconds: blockSeconds,
      p_increment: true,
    });
    if (error) throw error;
    return data !== false;
  } catch (error) {
    console.warn("customer-orders rate-limit unavailable:", error);
    return true;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const contentLength = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > 64 * 1024) {
    return json({ ok: false, error: "الطلب أكبر من الحد المسموح" }, 413);
  }

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json().catch(() => ({}));
    const action = clean(body.action, 50);
    const ip = requestIp(req);

    const limits: Record<string, [number, number, number]> = {
      public_config: [240, 600, 600],
      renewal_context: [120, 600, 600],
      create_new_order: [12, 3600, 3600],
      create_renewal_order: [30, 3600, 1800],
      create_receipt_upload: [60, 3600, 1800],
      finalize_receipt: [60, 3600, 1800],
      order_status: [300, 600, 600],
    };
    const selectedLimit = limits[action];
    if (selectedLimit) {
      const allowed = await rateAllowed(admin, `customer-orders:${action}:${ip}`, ...selectedLimit);
      if (!allowed) return json({ ok: false, error: "طلبات كثيرة خلال وقت قصير. حاول بعد قليل." }, 429);
    }

    const loadConfig = async () => {
      const [{ data: settings, error: settingsError }, { data: plans, error: plansError }] = await Promise.all([
        admin.from("customer_order_payment_settings").select("qi_card_number,qi_card_account_name,qi_card_enabled,zain_cash_phone,zain_cash_account_name,zain_cash_enabled,instructions").eq("id", 1).single(),
        admin.from("subscription_plans")
          .select("id,name,plan_code,duration_months,duration_days,is_custom_duration,price_iqd,is_active")
          .eq("is_active", true)
          .gt("price_iqd", 0)
          .order("duration_days", { ascending: true, nullsFirst: false }),
      ]);
      if (settingsError) throw settingsError;
      if (plansError) throw plansError;
      const paidPlans = (plans || []).filter((p: any) => p.plan_code !== "test" && !p.is_custom_duration && Number(p.price_iqd || 0) > 0);
      return { settings, plans: paidPlans };
    };

    const getPlanAndDestination = async (planId: string, paymentMethod: string) => {
      const { settings, plans } = await loadConfig();
      const plan = plans.find((p: any) => p.id === planId);
      if (!plan) throw new Error("هذه الباقة غير متاحة للطلب من الموقع");
      if (!["qi_card", "zain_cash"].includes(paymentMethod)) throw new Error("اختر طريقة دفع صحيحة");

      if (paymentMethod === "qi_card") {
        if (!settings?.qi_card_enabled || !clean(settings.qi_card_number, 100)) throw new Error("الدفع عبر كي كارد غير متاح حالياً");
        return {
          plan,
          destination: clean(settings.qi_card_number, 100),
          accountName: clean(settings.qi_card_account_name, 120) || null,
          instructions: clean(settings.instructions, 1000) || null,
        };
      }

      if (!settings?.zain_cash_enabled || !clean(settings.zain_cash_phone, 100)) throw new Error("الدفع عبر زين كاش غير متاح حالياً");
      return {
        plan,
        destination: clean(settings.zain_cash_phone, 100),
        accountName: clean(settings.zain_cash_account_name, 120) || null,
        instructions: clean(settings.instructions, 1000) || null,
      };
    };

    const requireCustomer = async () => {
      const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      if (!token) throw new Error("سجل دخولك أولاً حتى نتحقق من حسابك");
      const { data: userData, error: userError } = await admin.auth.getUser(token);
      if (userError || !userData.user) throw new Error("تعذر التحقق من حساب الدخول");
      const { data: profile, error: profileError } = await admin.from("profiles")
        .select("id,generator_id,full_name,phone,role,is_active")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile || profile.role !== "generator_admin" || !profile.generator_id || !profile.is_active) {
        throw new Error("هذا الحساب غير مربوط بصاحب مولدة فعال");
      }
      const { data: generator, error: generatorError } = await admin.from("generators")
        .select("id,name,owner_name,phone,area,email,status")
        .eq("id", profile.generator_id)
        .single();
      if (generatorError || !generator) throw new Error("تعذر العثور على حساب المولدة");
      return { user: userData.user, profile, generator };
    };

    if (action === "public_config") {
      const config = await loadConfig();
      return json({ ok: true, ...config });
    }

    if (action === "renewal_context") {
      const customer = await requireCustomer();
      const { data: latest } = await admin.from("subscriptions")
        .select("id,plan_id,starts_at,ends_at,status,price_iqd")
        .eq("generator_id", customer.generator.id)
        .order("ends_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return json({
        ok: true,
        customer: {
          name: customer.profile.full_name || customer.generator.owner_name,
          email: customer.user.email,
          phone: customer.profile.phone || customer.generator.phone,
          generator_id: customer.generator.id,
          generator_name: customer.generator.name,
          area: customer.generator.area,
          status: customer.generator.status,
          latest_subscription: latest || null,
        },
      });
    }

    if (action === "create_new_order") {
      const customerName = clean(body.customer_name, 120);
      const phone = clean(body.phone, 40);
      const email = clean(body.email, 200).toLowerCase();
      const generatorName = clean(body.generator_name, 160);
      const area = clean(body.area, 160);
      const pendingUserId = clean(body.pending_user_id, 80);
      const planId = clean(body.plan_id, 80);
      const paymentMethod = clean(body.payment_method, 30);
      const notes = clean(body.customer_notes, 1000) || null;

      if (!customerName || customerName.length < 2) throw new Error("اكتب اسم صاحب المولدة");
      if (!phone || phone.length < 8) throw new Error("اكتب رقم هاتف صحيح");
      if (!generatorName || generatorName.length < 2) throw new Error("اكتب اسم المولدة");
      if (!emailOk(email)) throw new Error("اكتب بريد إلكتروني صحيح");
      if (!pendingUserId) throw new Error("أنشئ بيانات دخول الحساب أولاً");

      const { data: pendingUser, error: pendingError } = await admin.auth.admin.getUserById(pendingUserId);
      if (pendingError || !pendingUser.user || (pendingUser.user.email || "").toLowerCase() !== email) {
        throw new Error("تعذر التحقق من حساب الدخول الجديد");
      }
      const { data: existingProfile } = await admin.from("profiles").select("id").eq("id", pendingUserId).maybeSingle();
      if (existingProfile) throw new Error("هذا البريد مربوط بحساب سابق؛ اختار تجديد اشتراك");

      const { plan, destination, accountName } = await getPlanAndDestination(planId, paymentMethod);
      const { data: order, error: orderError } = await admin.from("customer_orders").insert({
        order_type: "new_subscription",
        customer_name: customerName,
        phone,
        email,
        generator_name: generatorName,
        area: area || null,
        auth_user_id: pendingUserId,
        plan_id: plan.id,
        plan_name_snapshot: plan.name,
        amount_iqd: Number(plan.price_iqd),
        payment_method: paymentMethod,
        payment_destination_snapshot: destination,
        payment_account_name_snapshot: accountName,
        customer_notes: notes,
        status: "awaiting_payment",
      }).select("id,order_number,tracking_token,plan_name_snapshot,amount_iqd,payment_method,payment_destination_snapshot,payment_account_name_snapshot,status").single();
      if (orderError || !order) throw orderError || new Error("تعذر إنشاء الطلب");
      return json({ ok: true, order });
    }

    if (action === "create_renewal_order") {
      const customer = await requireCustomer();
      const planId = clean(body.plan_id, 80);
      const paymentMethod = clean(body.payment_method, 30);
      const notes = clean(body.customer_notes, 1000) || null;
      const { plan, destination, accountName } = await getPlanAndDestination(planId, paymentMethod);

      const { data: order, error: orderError } = await admin.from("customer_orders").insert({
        order_type: "renewal",
        customer_name: clean(customer.profile.full_name || customer.generator.owner_name, 120),
        phone: clean(customer.profile.phone || customer.generator.phone, 40),
        email: clean(customer.user.email, 200).toLowerCase(),
        generator_name: clean(customer.generator.name, 160),
        area: clean(customer.generator.area, 160) || null,
        auth_user_id: customer.user.id,
        generator_id: customer.generator.id,
        plan_id: plan.id,
        plan_name_snapshot: plan.name,
        amount_iqd: Number(plan.price_iqd),
        payment_method: paymentMethod,
        payment_destination_snapshot: destination,
        payment_account_name_snapshot: accountName,
        customer_notes: notes,
        status: "awaiting_payment",
      }).select("id,order_number,tracking_token,plan_name_snapshot,amount_iqd,payment_method,payment_destination_snapshot,payment_account_name_snapshot,status").single();
      if (orderError || !order) throw orderError || new Error("تعذر إنشاء طلب التجديد");
      return json({ ok: true, order });
    }

    if (action === "create_receipt_upload") {
      const tracking = clean(body.tracking_token, 80);
      const contentType = clean(body.content_type, 100).toLowerCase();
      if (!tracking) throw new Error("رمز متابعة الطلب مفقود");
      if (!(await rateAllowed(admin, `receipt-upload:${tracking}`, 12, 1800, 1800))) {
        return json({ ok: false, error: "محاولات رفع كثيرة لهذا الطلب. حاول بعد قليل." }, 429);
      }
      if (!allowedTypes.has(contentType)) throw new Error("ارفع صورة JPG/PNG/WebP أو ملف PDF فقط");
      const { data: order, error: orderError } = await admin.from("customer_orders")
        .select("id,status")
        .eq("tracking_token", tracking)
        .single();
      if (orderError || !order) throw new Error("الطلب غير موجود");
      if (order.status !== "awaiting_payment") throw new Error("هذا الطلب لم يعد بانتظار رفع الوصل");
      const path = `orders/${order.id}/${crypto.randomUUID()}.${extFor(contentType)}`;
      const { data: signed, error: signedError } = await admin.storage.from("customer-order-receipts").createSignedUploadUrl(path);
      if (signedError || !signed) throw signedError || new Error("تعذر تجهيز رفع الوصل");
      return json({ ok: true, path, token: signed.token });
    }

    if (action === "finalize_receipt") {
      const tracking = clean(body.tracking_token, 80);
      const receiptPath = clean(body.receipt_path, 500);
      if (!tracking || !receiptPath) throw new Error("بيانات الوصل ناقصة");
      if (!(await rateAllowed(admin, `receipt-finalize:${tracking}`, 20, 1800, 1800))) {
        return json({ ok: false, error: "محاولات كثيرة لهذا الطلب. حاول بعد قليل." }, 429);
      }
      const { data: order, error: orderError } = await admin.from("customer_orders")
        .select("id,status")
        .eq("tracking_token", tracking)
        .single();
      if (orderError || !order) throw new Error("الطلب غير موجود");
      if (order.status !== "awaiting_payment") throw new Error("هذا الطلب لم يعد بانتظار رفع الوصل");
      const expectedPrefix = `orders/${order.id}/`;
      if (!receiptPath.startsWith(expectedPrefix)) throw new Error("مسار الوصل غير صالح");
      const fileName = receiptPath.slice(expectedPrefix.length);
      const { data: files, error: listError } = await admin.storage.from("customer-order-receipts").list(`orders/${order.id}`, { limit: 100 });
      if (listError || !(files || []).some((f: any) => f.name === fileName)) throw new Error("لم يكتمل رفع الوصل، حاول مرة ثانية");
      const { error: updateError } = await admin.from("customer_orders")
        .update({ receipt_path: receiptPath, status: "awaiting_review" })
        .eq("id", order.id);
      if (updateError) throw updateError;
      return json({ ok: true, status: "awaiting_review" });
    }

    if (action === "order_status") {
      const tracking = clean(body.tracking_token, 80);
      if (!tracking) throw new Error("رمز متابعة الطلب مفقود");
      if (!(await rateAllowed(admin, `order-status:${tracking}`, 180, 600, 600))) {
        return json({ ok: false, error: "طلبات متابعة كثيرة. حاول بعد قليل." }, 429);
      }
      const { data: order, error: orderError } = await admin.from("customer_orders")
        .select("order_number,order_type,status,customer_name,email,generator_name,plan_name_snapshot,amount_iqd,payment_method,rejection_reason,activated_until,created_at,approved_at")
        .eq("tracking_token", tracking)
        .single();
      if (orderError || !order) throw new Error("الطلب غير موجود");
      return json({ ok: true, order });
    }

    throw new Error("إجراء غير معروف");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ ok: false, error: message }, 400);
  }
});