import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.4";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "npm:@simplewebauthn/server@13.2.2";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "content-type": "application/json; charset=utf-8" },
});

const normalizePhone = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const normalizeIdentifier = (value: unknown) => String(value ?? "").trim().toLowerCase();
const collectorEmail = (phone: string) => `c_${normalizePhone(phone)}@collector.molidatk.app`;
const collectorPassword = (pin: string) => `Md!${String(pin || "").trim()}`;

const fromBase64Url = (value: string) => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob(base64);
  return Uint8Array.from(raw, ch => ch.charCodeAt(0));
};
const toBase64Url = (bytes: Uint8Array) => {
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

function resolveOrigin(req: Request, body: any) {
  const headerOrigin = String(req.headers.get("origin") || "").trim();
  const supplied = String(body?.origin || "").trim();
  const raw = headerOrigin || supplied;
  if (!raw) throw new Error("origin_required");
  if (headerOrigin && supplied && headerOrigin !== supplied) throw new Error("origin_mismatch");
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("secure_origin_required");
  }
  return { origin: url.origin, rpID: url.hostname };
}

async function passwordGrant(supabaseUrl: string, anonKey: string, email: string, password: string) {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: anonKey },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.access_token || !data?.refresh_token || !data?.user?.id) return null;
  return data;
}

async function loadAccount(admin: any, userId: string) {
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,role,generator_id,is_active,full_name,phone")
    .eq("id", userId)
    .single();

  if (profileError || !profile || !profile.is_active) throw new Error("account_inactive");

  const profileRole = String(profile.role);
  if (profileRole === "super_admin" || profileRole === "super_admin_manager") {
    return {
      userId,
      role: profileRole,
      generatorId: "",
      generatorName: "مولدتك",
      ownerName: String(profile.full_name || "الإدارة"),
      location: "",
      collectorName: null,
      collectorId: null,
      collectorPermissions: null,
      assignedLineId: null,
      assignedLineName: null,
      assignedLineIds: [],
      assignedAllLines: false,
    };
  }

  if (!profile.generator_id) throw new Error("generator_not_linked");
  if (!["generator_admin", "employee"].includes(profileRole)) throw new Error("use_super_admin_portal");

  const { data: generator, error: generatorError } = await admin
    .from("generators")
    .select("id,name,owner_name,area,status")
    .eq("id", profile.generator_id)
    .single();
  if (generatorError || !generator) throw new Error("generator_not_found");

  if (String(generator.status) !== "active") throw new Error("generator_inactive");

  let collector: any = null;
  if (profile.role === "employee") {
    const result = await admin
      .from("generator_collectors")
      .select("id,name,is_active,permissions,assigned_line_id,assigned_line_name,assigned_line_ids,assigned_all_lines")
      .eq("id", userId)
      .eq("generator_id", profile.generator_id)
      .single();
    if (result.error || !result.data || result.data.is_active === false) throw new Error("collector_not_active");
    collector = result.data;
  }

  return {
    userId,
    role: profile.role === "employee" ? "collector" : "generator_admin",
    generatorId: String(generator.id),
    generatorName: String(generator.name || "مولدتك"),
    ownerName: String(generator.owner_name || profile.full_name || "صاحب المولدة"),
    location: String(generator.area || ""),
    collectorName: collector ? String(collector.name || profile.full_name || "جابي") : null,
    collectorId: collector ? String(collector.id) : null,
    collectorPermissions: collector?.permissions || null,
    assignedLineId: collector?.assigned_line_id || null,
    assignedLineName: collector?.assigned_line_name || null,
    assignedLineIds: Array.isArray(collector?.assigned_line_ids) ? collector.assigned_line_ids.map(String) : [],
    assignedAllLines: Boolean(collector?.assigned_all_lines),
  };
}

async function phoneProfiles(admin: any, phone: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("id,role,generator_id,is_active,full_name,phone")
    .eq("is_active", true)
    .in("role", ["generator_admin", "employee"]);
  if (error) throw error;
  return (data || []).filter((row: any) => normalizePhone(row.phone) === phone);
}

async function findActiveSuperAdminByEmail(admin: any, identifier: string) {
  const normalizedEmail = normalizeIdentifier(identifier);
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id,role,is_active")
    .eq("is_active", true)
    .in("role", ["super_admin", "super_admin_manager"]);
  if (error) throw error;

  for (const profile of profiles || []) {
    const { data: authUser, error: authError } = await admin.auth.admin.getUserById(profile.id);
    if (authError || !authUser?.user) continue;
    if (normalizeIdentifier(authUser.user.email) === normalizedEmail) return profile;
  }
  return null;
}

async function discoverRole(admin: any, identifier: string) {
  if (identifier.includes("@")) {
    // Keep the existing unified login UI unchanged: this value is only a hint
    // used to advance to the password step. The real role is loaded after auth.
    const superAdmin = await findActiveSuperAdminByEmail(admin, identifier);
    if (superAdmin) return "generator_admin";

    const { data: gen } = await admin.from("generators").select("id").ilike("email", identifier).limit(1).maybeSingle();
    if (!gen?.id) return null;
    const { data: profile } = await admin
      .from("profiles")
      .select("role,is_active")
      .eq("generator_id", gen.id)
      .eq("role", "generator_admin")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    return profile?.role === "generator_admin" ? "generator_admin" : null;
  }
  const phone = normalizePhone(identifier);
  if (phone.length < 10) return null;
  const matches = await phoneProfiles(admin, phone);
  if (!matches.length) return null;
  return matches.some((x: any) => x.role === "generator_admin") ? "generator_admin" : "collector";
}

async function authenticatedUser(req: Request, supabaseUrl: string, anonKey: string) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) throw new Error("unauthorized");
  const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error("unauthorized");
  return user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    const body = await req.json();
    const action = String(body?.action || "");

    if (action === "discover") {
      const identifier = normalizeIdentifier(body?.identifier);
      if (identifier.length < 5) return json({ found: false });
      const role = await discoverRole(admin, identifier);
      return json({ found: Boolean(role), roleHint: role });
    }

    if (action === "password-login") {
      const identifier = normalizeIdentifier(body?.identifier);
      const secret = String(body?.secret || "").trim();
      if (!identifier || secret.length < 4) return json({ error: "invalid_credentials" }, 401);

      let grant: any = null;
      let sourceUserId = "";

      if (identifier.includes("@")) {
        const candidates = [secret];
        if (/^\d{4,5}$/.test(secret)) candidates.push(secret + "moldatk");
        for (const password of candidates) {
          grant = await passwordGrant(supabaseUrl, anonKey, identifier, password);
          if (grant) break;
        }
        sourceUserId = grant?.user?.id || "";
      } else {
        const phone = normalizePhone(identifier);
        if (phone.length < 10) return json({ error: "invalid_credentials" }, 401);
        const profiles = await phoneProfiles(admin, phone);

        for (const profile of profiles) {
          let email = "";
          let passwords: string[] = [];
          if (profile.role === "employee") {
            email = collectorEmail(phone);
            passwords = [collectorPassword(secret)];
          } else if (profile.role === "generator_admin") {
            const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
            email = String(authUser?.user?.email || "");
            passwords = [secret];
            if (/^\d{4,5}$/.test(secret)) passwords.push(secret + "moldatk");
          }
          if (!email) continue;

          for (const password of passwords) {
            grant = await passwordGrant(supabaseUrl, anonKey, email, password);
            if (grant) {
              sourceUserId = String(profile.id);
              break;
            }
          }
          if (grant) break;
        }
      }

      if (!grant || !sourceUserId) return json({ error: "invalid_credentials" }, 401);
      const account = await loadAccount(admin, sourceUserId);

      return json({
        ok: true,
        accessToken: grant.access_token,
        refreshToken: grant.refresh_token,
        account,
      });
    }

    if (action === "passkey-register-options") {
      const user = await authenticatedUser(req, supabaseUrl, anonKey);
      const account = await loadAccount(admin, user.id);
      const { origin, rpID } = resolveOrigin(req, body);

      const { data: existing, error: existingError } = await admin
        .from("moldatk_passkeys")
        .select("credential_id,transports")
        .eq("user_id", user.id)
        .eq("rp_id", rpID);
      if (existingError) throw existingError;

      const options = await generateRegistrationOptions({
        rpName: "مولدتك",
        rpID,
        userID: new TextEncoder().encode(user.id),
        userName: user.email || user.phone || user.id,
        userDisplayName: account.role === "collector" ? (account.collectorName || "جابي") : account.ownerName,
        timeout: 60000,
        attestationType: "none",
        excludeCredentials: (existing || []).map((item: any) => ({
          id: String(item.credential_id),
          transports: Array.isArray(item.transports) ? item.transports : undefined,
        })),
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "required",
        },
      });

      const { data: challenge, error: challengeError } = await admin
        .from("moldatk_webauthn_challenges")
        .insert({
          user_id: user.id,
          purpose: "registration",
          challenge: options.challenge,
          rp_id: rpID,
          origin,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })
        .select("id")
        .single();
      if (challengeError) throw challengeError;

      return json({ ok: true, challengeId: challenge.id, options });
    }

    if (action === "passkey-register-verify") {
      const user = await authenticatedUser(req, supabaseUrl, anonKey);
      const challengeId = String(body?.challengeId || "");
      const response = body?.response;
      if (!challengeId || !response) return json({ error: "invalid_request" }, 400);

      const { data: challenge, error: challengeError } = await admin
        .from("moldatk_webauthn_challenges")
        .select("*")
        .eq("id", challengeId)
        .eq("user_id", user.id)
        .eq("purpose", "registration")
        .is("consumed_at", null)
        .gt("expires_at", new Date().toISOString())
        .single();
      if (challengeError || !challenge) return json({ error: "challenge_expired" }, 400);

      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: challenge.origin,
        expectedRPID: challenge.rp_id,
        requireUserVerification: true,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return json({ error: "passkey_verification_failed" }, 401);
      }

      const credential = verification.registrationInfo.credential;
      const { error: saveError } = await admin.from("moldatk_passkeys").upsert({
        user_id: user.id,
        credential_id: credential.id,
        public_key: toBase64Url(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports || [],
        device_label: String(body?.deviceLabel || "جهاز موثوق").slice(0, 80),
        rp_id: challenge.rp_id,
        last_used_at: new Date().toISOString(),
      }, { onConflict: "credential_id" });
      if (saveError) throw saveError;

      await admin.from("moldatk_webauthn_challenges")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", challengeId);

      return json({ ok: true, credentialId: credential.id });
    }

    if (action === "passkey-auth-options") {
      const userId = String(body?.userId || "");
      if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: "invalid_account" }, 400);
      await loadAccount(admin, userId);
      const { origin, rpID } = resolveOrigin(req, body);

      const { data: passkeys, error: passkeysError } = await admin
        .from("moldatk_passkeys")
        .select("credential_id,transports")
        .eq("user_id", userId)
        .eq("rp_id", rpID)
        .order("created_at");
      if (passkeysError) throw passkeysError;
      if (!passkeys?.length) return json({ error: "passkey_not_registered" }, 404);

      const options = await generateAuthenticationOptions({
        rpID,
        timeout: 60000,
        userVerification: "required",
        allowCredentials: passkeys.map((item: any) => ({
          id: String(item.credential_id),
          transports: Array.isArray(item.transports) ? item.transports : undefined,
        })),
      });

      const { data: challenge, error: challengeError } = await admin
        .from("moldatk_webauthn_challenges")
        .insert({
          user_id: userId,
          purpose: "authentication",
          challenge: options.challenge,
          rp_id: rpID,
          origin,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })
        .select("id")
        .single();
      if (challengeError) throw challengeError;

      return json({ ok: true, challengeId: challenge.id, options });
    }

    if (action === "passkey-auth-verify") {
      const userId = String(body?.userId || "");
      const challengeId = String(body?.challengeId || "");
      const response = body?.response;
      if (!userId || !challengeId || !response?.id) return json({ error: "invalid_request" }, 400);

      const { data: challenge, error: challengeError } = await admin
        .from("moldatk_webauthn_challenges")
        .select("*")
        .eq("id", challengeId)
        .eq("user_id", userId)
        .eq("purpose", "authentication")
        .is("consumed_at", null)
        .gt("expires_at", new Date().toISOString())
        .single();
      if (challengeError || !challenge) return json({ error: "challenge_expired" }, 400);

      const { data: key, error: keyError } = await admin
        .from("moldatk_passkeys")
        .select("*")
        .eq("user_id", userId)
        .eq("credential_id", String(response.id))
        .eq("rp_id", challenge.rp_id)
        .single();
      if (keyError || !key) return json({ error: "passkey_not_registered" }, 404);

      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: challenge.origin,
        expectedRPID: challenge.rp_id,
        credential: {
          id: key.credential_id,
          publicKey: fromBase64Url(key.public_key),
          counter: Number(key.counter || 0),
          transports: Array.isArray(key.transports) ? key.transports : undefined,
        },
        requireUserVerification: true,
      });

      if (!verification.verified) return json({ error: "passkey_verification_failed" }, 401);

      await Promise.all([
        admin.from("moldatk_passkeys")
          .update({
            counter: verification.authenticationInfo.newCounter,
            last_used_at: new Date().toISOString(),
          })
          .eq("credential_id", key.credential_id),
        admin.from("moldatk_webauthn_challenges")
          .update({ consumed_at: new Date().toISOString() })
          .eq("id", challengeId),
      ]);

      const account = await loadAccount(admin, userId);
      const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(userId);
      const email = String(authUser?.user?.email || "");
      if (authUserError || !email) throw new Error("auth_user_not_found");

      const { data: link, error: linkError } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
      if (linkError || !link?.properties?.hashed_token) throw linkError || new Error("session_link_failed");

      return json({
        ok: true,
        tokenHash: link.properties.hashed_token,
        account,
      });
    }

    return json({ error: "unsupported_action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("moldatk-auth failed:", message);
    const unauthorized = ["unauthorized", "invalid_credentials", "passkey_verification_failed"].includes(message);
    return json({ error: message }, unauthorized ? 401 : 400);
  }
});
