/**
 * Supabase連絡先変更申請の読取専用クライアント（スタンドアロンGAS）
 * 実運用前の接続診断用。スプシ/DBへの書き込みは一切行わない。
 * 公開URL・anonキーだけで全ユーザーの申請を読める設計にはしない。
 * サーバー側でGAS専用シークレットを照合するEdge Functionが必要。
 */
const GF_CONTACT_API_CONFIG = Object.freeze({
  URL_PROP: 'GF_CONTACT_READ_API_URL',
  TOKEN_PROP: 'GF_CONTACT_READ_API_TOKEN'
});
function GF_申請取得_接続診断() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty(GF_CONTACT_API_CONFIG.URL_PROP);
  const token = props.getProperty(GF_CONTACT_API_CONFIG.TOKEN_PROP);
  if (!url || !token) {
    console.log('未設定: Edge Function URLまたは認証トークン。設定前のため外部通信は行っていません。');
    return { status: 'NOT_CONFIGURED' };
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/gf-contact-read-only$/.test(url)) {
    throw new Error('接続先URLが許可された形式ではありません');
  }
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'x-gf-sync-token': token },
    muteHttpExceptions: true,
    followRedirects: false
  });
  const code = response.getResponseCode();
  if (code !== 200) throw new Error('読取API応答エラー HTTP ' + code);
  const data = JSON.parse(response.getContentText());
  if (data.status !== 'ok' || typeof data.pendingCount !== 'number') {
    throw new Error('応答形式が不正です');
  }
  // 個人情報をログ出力しない
  console.log('接続OK / 未処理申請数: ' + data.pendingCount);
  return { status: 'CONNECTED', pendingCount: data.pendingCount };
}
