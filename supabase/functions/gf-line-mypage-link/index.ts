// GOLD FIRST / LINE -> Supabase Auth -> canonical DriverID
// Staged only. Deploy after a verified LINE mapping has been safely synced.
// This function validates BOTH login sessions; never accept client-provided DriverID or LINE ID.
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const allowedOrigin = "https://happysugar-system.github.io";
const cors = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Vary": "Origin",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const json = (status: number, data: Record<string, unknown>) =>
  new Response(JSON.stringify(data), { status, headers: cors });

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  if (request.headers.get("Origin") !== allowedOrigin)
    return json(403, { error: "Origin not permitted" });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const channelId = Deno.env.get("GF_LINE_LOGIN_CHANNEL_ID");
    if (!supabaseUrl || !serviceKey || !channelId)
      return json(503, { error: "Identity verification unavailable" });
    const bearer = request.headers.get("Authorization") || "";
    const userToken = bearer.match(/^Bearer ([A-Za-z0-9_.-]{100,8192})$/)?.[1];
    if (!userToken) return json(401, { error: "Authentication required" });
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userError } =
      await supabase.auth.getUser(userToken);
    if (userError || !userData.user?.id || !userData.user.email_confirmed_at)
      return json(401, { error: "Verified login required" });
    const body = await request.json().catch(() => null);
    const lineToken = body?.line_id_token;
    if (typeof lineToken !== "string" ||
        lineToken.length < 100 || lineToken.length > 8192)
      return json(400, { error: "LINE verification required" });
    const verification = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: lineToken, client_id: channelId }),
      signal: AbortSignal.timeout(10000),
    });
    if (!verification.ok) return json(401, { error: "LINE verification failed" });
    const line = await verification.json();
    if (line.iss !== "https://access.line.me" ||
        String(line.aud) !== channelId ||
        typeof line.sub !== "string" ||
        !/^U[0-9a-fA-F]{32}$/.test(line.sub) ||
        typeof line.exp !== "number" ||
        line.exp <= Math.floor(Date.now()/1000)) {
      return json(401, { error: "LINE identity invalid" });
    }
    // The RPC can run only as service_role and checks mapping, identity conflicts,
    // approval state, and unique constraints in a single DB transaction.
    const { data: driverId, error: linkError } = await supabase.rpc(
      "gf_link_mypage_from_verified_line", {
        p_auth_user_id: userData.user.id,
        p_line_user_id: line.sub,
      },
    );
    if (linkError || !/^D[0-9]{6}$/.test(String(driverId||""))) {
      // Do not reveal whether a given LINE ID/DriverID exists.
      return json(409, { error: "本人確認を完了できませんでした。受付情報を確認してください。" });
    }
    return json(200, { linked: true });
  } catch (_error) {
    return json(503, { error: "本人確認処理に失敗しました。時間をおいてお試しください。" });
  }
});
