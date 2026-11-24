/*
 * 中国联通 · token 调试探针 · 临时用, 抓到后删除
 * 对每个 m.client 请求只记录元数据, 不记录凭据值:
 *   url, cookie 字段名, body 字段名, body 是否含 token_online, 时间
 * 存到 ChinaUnicomDebug, 只保留最近一条含 token_online 的, 否则保留最后一条。
 */
(function () {
  "use strict";
  try {
    if (typeof $request === "undefined") return;
    var url = $request.url || "";
    var headers = $request.headers || {};
    var ck = Object.keys(headers).find(function (n) { return n.toLowerCase() === "cookie"; });
    var cookieKeys = [];
    if (ck && headers[ck]) {
      headers[ck].split(";").forEach(function (p) {
        var i = p.indexOf("=");
        if (i > 0) cookieKeys.push(p.slice(0, i).trim());
      });
    }
    var body = typeof $request.body === "string" ? $request.body : "";
    var bodyKeys = [];
    var hasToken = false;
    if (body) {
      body.split("&").forEach(function (pair) {
        var i = pair.indexOf("=");
        if (i > 0) {
          var k = "";
          try { k = decodeURIComponent(pair.slice(0, i)); } catch (_) { k = pair.slice(0, i); }
          bodyKeys.push(k);
          if (k === "token_online") hasToken = true;
        }
      });
    }
    var rec = {
      url: url, method: $request.method || "",
      cookieKeys: cookieKeys,
      bodyKeys: bodyKeys.slice(0, 30),
      bodyHasTokenOnline: hasToken,
      cookieHasTokenOnline: cookieKeys.indexOf("token_online") >= 0,
      updatedAt: new Date().toISOString()
    };
    var oldRaw = $persistentStore.read("ChinaUnicomDebug");
    var old = null;
    try { old = oldRaw ? JSON.parse(oldRaw) : null; } catch (_) {}
    if (hasToken || !old || !old.bodyHasTokenOnline) {
      $persistentStore.write(JSON.stringify(rec), "ChinaUnicomDebug");
    }
  } catch (_) {}
  $done({});
})();
