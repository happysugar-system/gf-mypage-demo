// GOLD FIRST / cross-browser, one-time LINE Login verification
// STAGED ONLY: deploy after verifying source LINE ID provenance and provider match.
// Browser A: Supabase email login -> begin -> 5-minute one-time challenge.
// Browser B: existing vehicle-request LIFF -> verified LINE id_token -> complete.
// No client DriverID, name, or LINE user ID is trusted for identity.
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const origin = "https://happysugar-system.github.io";
const headers = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Vary": "Origin",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers });
const digest = async (token: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))]
    .map(x => x.toString(16).padStart(2, "0")).join("");

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST") return reply(405, { error: "Method not allowed" });
  if (request.headers.get("Origin") !== origin)
    return reply(403, { error: "Origin not permitted" });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const channel = Deno.env.get("GF_LINE_LOGIN_CHANNEL_ID");
  if (!url || !serviceKey || !channel)
    return reply(503, { error: "Identity verification unavailable" });
  const sb = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object")
      return reply(400, { error: "Invalid request" });

    if (payload.action === "begin") {
      const authorization = request.headers.get("Authorization") || "";
      const jwt = authorization.match(/^Bearer ([A-Za-z0-9_.-]{100,8192})$/)?.[1];
      if (!jwt) return reply(401, { error: "Email login required" });
      const { data, error } = await sb.auth.getUser(jwt);
      if (error || !data.user?.id || !data.user.email_confirmed_at)
        return reply(401, { error: "Verified email login required" });
      const userId = data.user.id;
      const earliest = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count, error: countError } = await sb
        .from("gf_mypage_line_challenges")
        .select("token_hash", { count: "exact", head: true })
        .eq("auth_user_id", userId).gte("created_at", earliest);
      if (countError) return reply(503, { error: "Verification unavailable" });
      if ((count || 0) >= 3)
        return reply(429, { error: "しばらく時間をおいてから再度お試しください。" });

      const random = crypto.getRandomValues(new Uint8Array(32));
      const challenge = btoa(String.fromCharCode(...random))
        .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
      const tokenHash = await digest(challenge);
      const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const { error: insertError } = await sb.from("gf_mypage_line_challenges")
        .insert({ token_hash: tokenHash, auth_user_id: userId, expires_at: expires });
      if (insertError) return reply(503, { error: "Verification unavailable" });
      return reply(200, { challenge, expires_in_seconds: 300 });
    }

    if (payload.action === "complete") {
      const { challenge, line_id_token: lineToken } = payload;
      if (typeof challenge !== "string" ||
          !/^[A-Za-z0-9_-]{43}$/.test(challenge) ||
          typeof lineToken !== "string" ||
          lineToken.length < 100 || lineToken.length > 8192) {
        return reply(400, { error: "Invalid LINE verification" });
      }
      // Validate LINE ID token on LINE's official server, not in browser.
      const verification = await fetch("https://api.line.me/oauth2/v2.1/verify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ id_token: lineToken, client_id: channel }),
        signal: AbortSignal.timeout(10000),
      });
      if (!verification.ok)
        return reply(401, { error: "LINE verification failed" });
      const line = await verification.json();
      if (line.iss !== "https://access.line.me" ||
          String(line.aud) !== channel ||
          typeof line.sub !== "string" ||
          !/^U[0-9a-fA-F]{32}$/.test(line.sub) ||
          !Number.isFinite(line.exp) ||
          line.exp <= Math.floor(Date.now()/1000)) {
        return reply(401, { error: "LINE identity invalid" });
      }

      const tokenHash = await digest(challenge);
      const { data: linked, error: linkError } = await sb.rpc(
        "gf_complete_line_mypage_challenge", {
          p_token_hash: tokenHash, p_line_user_id: line.sub,
        },
      );
      if (linkError || linked !== true)
        return reply(409, { error: "本人確認できませんでした。受付LINEのアカウントを確認してください。" });
      return reply(200, { linked: true });
    }
    return reply(400, { error: "Unknown operation" });
  } catch (_error) {
    return reply(503, { error: "本人確認を完了できませんでした。再度お試しください。" });
  }
});
