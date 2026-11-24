/*
 * 中国联通 · token_online 抓取 · v1.0.2
 *
 * 配合已有的「中国联通凭据抓取」(Zayia NetTool, 抓 ecs_token) 使用。
 * 这个脚本只抓 token_online + appId, 也就是每日脚本 chinaUnicom.py
 * 需要的 Token#AppId, 存到同一个 Surge 持久化根键里, 供每日任务读取。
 *
 * 触发 (任一即可, 哪个先到抓哪个):
 *   1. 联通 App 登录时调 onLine, POST https://loginxx.10010.com/mobileService/onLine.htm
 *   2. 联通 App 的任意 m.client.10010.com 请求, 包括首页加载时调的
 *      getUnicomCodeByBaiduCode / getMenuAutoCheckConfig 等
 *      (hotRecommend 每天只调一次, 今天已经调过了就不会再调;
 *       loginxx 目前走 DIRECT 隧道、Surge 看不到 HTTP 内容, 所以只靠 onLine 抓不到)
 * 抓取来源 (按优先级):
 *   1. 请求 Cookie 里的 token_online / appId
 *   2. 请求体 (form) 里的 token_online / appId
 * 持久化根键: ZayiaComponentService (和 Zayia 脚本同一个根键)
 * 写入字段: ZayiaComponentService.ChinaUnicom.TokenOnline = {
 *   token_online, appId, mobile, updatedAt, source }
 * 同时另存一份扁平键 ChinaUnicomTokenOnline, 方便直接读取。
 *
 * 只保存凭据字段, 不修改请求, 不输出凭据, 不请求任何外部服务。
 */
(function () {
  "use strict";

  var ROOT_KEY = "ZayiaComponentService";
  var FLAT_KEY = "ChinaUnicomTokenOnline";
  var TARGET = /^(https:\/\/loginxx\.10010\.com\/mobileService\/onLine\.htm|https:\/\/m\.client\.10010\.com\/.*)$/;

  function readStore(key) {
    return typeof $prefs !== "undefined" ? $prefs.valueForKey(key) : $persistentStore.read(key);
  }

  function writeStore(value, key) {
    return typeof $prefs !== "undefined" ? $prefs.setValueForKey(value, key) : $persistentStore.write(value, key);
  }

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function parseCookie(raw) {
    var fields = Object.create(null);
    var parts = raw.split(";");
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      var equal = part.indexOf("=");
      if (equal < 1) continue;
      fields[part.slice(0, equal).trim()] = part.slice(equal + 1).trim();
    }
    return fields;
  }

  function parseForm(raw) {
    var fields = Object.create(null);
    if (typeof raw !== "string") return fields;
    var pairs = raw.split("&");
    for (var i = 0; i < pairs.length; i++) {
      var equal = pairs[i].indexOf("=");
      if (equal < 1) continue;
      try {
        fields[decodeURIComponent(pairs[i].slice(0, equal))] = decodeURIComponent(pairs[i].slice(equal + 1));
      } catch (_) {}
    }
    return fields;
  }

  try {
    try { $persistentStore.write(JSON.stringify({url: (typeof $request !== "undefined" && $request.url) || "", method: (typeof $request !== "undefined" && $request.method) || "", time: new Date().toISOString()}), "ChinaUnicomTokenLastRun"); } catch (_) {}
    try {
      var _h = $request.headers || {};
      var _ck = Object.keys(_h).find(function (n) { return n.toLowerCase() === "cookie"; });
      var _cKeys = [];
      if (_ck && _h[_ck]) { _h[_ck].split(";").forEach(function (pp) { var _i = pp.indexOf("="); if (_i > 0) _cKeys.push(pp.slice(0, _i).trim()); }); }
      var _b = typeof $request.body === "string" ? $request.body : "";
      var _bKeys = [];
      var _hasTok = false;
      if (_b) { _b.split("&").forEach(function (pair) { var _i = pair.indexOf("="); if (_i > 0) { var _k = ""; try { _k = decodeURIComponent(pair.slice(0, _i)); } catch (_) { _k = pair.slice(0, _i); } _bKeys.push(_k); if (_k === "token_online") _hasTok = true; } }); }
      var _rec = {url: $request.url || "", method: $request.method || "", cookieKeys: _cKeys, bodyKeys: _bKeys.slice(0, 30), bodyHasTokenOnline: _hasTok, cookieHasTokenOnline: _cKeys.indexOf("token_online") >= 0, time: new Date().toISOString()};
      var _oldRaw = $persistentStore.read("ChinaUnicomDebug");
      var _old = null;
      try { _old = _oldRaw ? JSON.parse(_oldRaw) : null; } catch (_) {}
      if (_hasTok || !_old || !_old.bodyHasTokenOnline) { $persistentStore.write(JSON.stringify(_rec), "ChinaUnicomDebug"); }
    } catch (_) {}
    if (typeof $request === "undefined") return;
    if (!TARGET.test($request.url || "")) return;

    var headers = $request.headers || {};
    var headerName = Object.keys(headers).find(function (name) {
      return name.toLowerCase() === "cookie";
    });
    var cookieFields = parseCookie(headerName ? headers[headerName] || "" : "");
    var bodyFields = parseForm(typeof $request.body === "string" ? $request.body : "");

    var token = cookieFields.token_online || bodyFields.token_online || "";
    var appId = cookieFields.appId || bodyFields.appId || cookieFields.appid || bodyFields.appid || "";
    if (!token) {
      console.log("[中国联通 token] 本次请求没有 token_online, 保留已有凭据。");
      return;
    }

    var mobile = [cookieFields.c_mobile, cookieFields.u_account, bodyFields.mobile, bodyFields.desmobile]
      .find(function (v) { return /^1\d{10}$/.test(v || ""); }) || "";

    var record = {
      token_online: token,
      appId: appId,
      mobile: mobile,
      updatedAt: new Date().toISOString(),
      source: $request.url || ""
    };

    var stored = readStore(ROOT_KEY);
    var root = stored ? JSON.parse(stored) : {};
    if (!isObject(root)) throw new Error("持久化根数据格式无效");
    if (root.ChinaUnicom != null && !isObject(root.ChinaUnicom)) throw new Error("中国联通数据格式无效");
    var carrier = root.ChinaUnicom || {};
    var old = carrier.TokenOnline || {};
    if (old.token_online === token && old.appId === appId) return;
    carrier.TokenOnline = record;
    root.ChinaUnicom = carrier;
    if (!writeStore(JSON.stringify(root), ROOT_KEY)) throw new Error("凭据写入失败");
    writeStore(JSON.stringify(record), FLAT_KEY);

    if (typeof $notify === "function") {
      $notify("中国联通", "token_online 已更新", "已保存，供每日任务使用。");
    } else {
      $notification.post("中国联通", "token_online 已更新", "已保存，供每日任务使用。");
    }
  } catch (_) {
    console.log("[中国联通 token] 保存失败, 请检查 ZayiaComponentService 数据格式及持久化存储。");
  } finally {
    $done({});
  }
})();
