/**
 * GOLD FIRST / 163_管理者変更ワーカー監視.gs
 * 既存の GF_実績キューワーカー() から呼ぶ読み取り専用の橋渡し。
 * 160番のドライランのみ実行。Supabaseへの書き込み・トリガー作成なし。
 */
function GF163_管理者変更を監視する_(){
 const props=PropertiesService.getScriptProperties();
 if(props.getProperty('GF163_MONITOR_ENABLED')!=='true')return {status:'disabled',write:false};
 if(typeof GF160_変更APIドライラン!=='function')return {status:'missing_160',write:false};
 const result=GF160_変更APIドライラン();
 return {status:'preview',summary:result.summary,write:false};
}
/**
 * 任意の手動テスト: ワーカーに組み込む前に実行。
 */
function GF163_監視手動テスト(){
 return GF163_管理者変更を監視する_();
}
/**
 * 初期状態は無効。監視を開始する際に一度だけ手動実行。
 */
function GF163_監視を有効にする(){
 PropertiesService.getScriptProperties().setProperty('GF163_MONITOR_ENABLED','true');
 console.log('GF163 読取専用監視を有効化しました');
}
/** 監視を止める（既存157や車両処理は止めない）。 */
function GF163_監視を停止する(){
 PropertiesService.getScriptProperties().deleteProperty('GF163_MONITOR_ENABLED');
 console.log('GF163 読取専用監視を停止しました');
}
