/*
 * 中国联通 · token_online 抓取 (http-response 版) · v1.0.0
 *
 * http-request 版已经确认: 联通 App 发给 m.client.10010.com 的请求里,
 * Cookie 和请求体都没有 token_online / appId。
 * 这个版本改从响应体里找: 某些接口的返回里可能带着 token_online。
 * 只记录是否找到、字段名, 不输出凭据值。
 * 找到后存到和 http-request 版同一个地方:
 *   ZayiaComponentService.ChinaUnicom.TokenOnline
 *   以及扁平键 ChinaUnicomTokenOnline
 */
(function () {
  "use strict";
  try {
    if (typeof $response === "undefined") return;
    var body = typeof $response.body === "string" ? $response.body : "";
    if (!body) return;
    var mToken = body.match(/"token_online"\s*:\s*"([^"]+)"/) || body.match(/token_online=([A-Za-z0-9%\-_]+)/);
    if (!mToken || !mToken[1]) return;
    var token = "";
    try { token = decodeURIComponent(mToken[1]); } catch (_) { token = mToken[1]; }
    if (!token) return;
    var mApp = body.match(/"appId"\s*:\s*"([^"]+)"/) || body.match(/appId=([A-Za-z0-9%\-_]+)/);
    var appId = mApp && mApp[1] ? mApp[1] : "";
    var mMob = body.match(/"mobile"\s*:\s*"?(1\d{10})"?/);
    var record = {
      token_online: token,
      appId: appId,
      mobile: mMob ? mMob[1] : "",
      updatedAt: new Date().toISOString(),
      source: ($request && $request.url) || ""
    };
    var stored = $persistentStore.read("ZayiaComponentService");
    var root = stored ? JSON.parse(stored) : {};
    var carrier = root.ChinaUnicom || {};
    var old = carrier.TokenOnline || {};
    if (old.token_online === token && old.appId === appId) return;
    carrier.TokenOnline = record;
    root.ChinaUnicom = carrier;
    $persistentStore.write(JSON.stringify(root), "ZayiaComponentService");
    $persistentStore.write(JSON.stringify(record), "ChinaUnicomTokenOnline");
    if (typeof $notify === "function") {
      $notify("中国联通", "token_online 已更新", "已保存，供每日任务使用。");
    } else {
      $notification.post("中国联通", "token_online 已更新", "已保存，供每日任务使用。");
    }
  } catch (_) {}
  $done({});
})();
