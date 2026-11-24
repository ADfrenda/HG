// 联通新版接口录制器（http-request）
//
// 两个作用：
//   1) 录制 APP 发出的每个 SigninApp 请求（完整 URL / 请求体 / 请求头 / HTTP 方法），
//      供 10010-sign.js 原样重放 —— 联通以后改接口也不用改脚本。
//   2) 顺手把最新的会话 Cookie / UA / Referer 刷新到 chavy_10010_*，
//      这样每天你打开一次联通 APP，定时脚本用的 Cookie 就是新的。
//
// 反馈：每次抓到「不同于上次」的会话 Cookie 会弹一条通知，
//       出现新接口也会弹一条，这样能明确知道录制器到底有没有工作。
//
// ★ 本脚本是 http-request 类型，只能被「真实请求」触发。
//   手动点运行会因为拿不到 $request 而提示异常 —— 那不是故障，
//   正确用法是：在 Surge 运行期间打开一次联通 APP 的签到页。
//
// 挂载规则必须带 requires-body=true，否则拿不到请求体：
//   联通录制 = type=http-request,pattern=^https?:\/\/act\.10010\.com\/SigninApp\/.*,script-path=10010-capture.js,requires-body=true,debug=true

const PREFIX = 'chavy_10010_req_'
const INDEX = 'chavy_10010_index'
// 按「接口名」归档的调用方式（10010-sign.js 会读取，并在此基础上自我学习）
const API_PREFIX = 'chavy_10010_api_'

const S_COOKIE = 'chavy_10010_cookie'
const S_UA = 'chavy_10010_ua'
const S_REFERER = 'chavy_10010_referer'
const S_ORIGIN = 'chavy_10010_origin'

const norm = (s) => String(s).replace(/[^a-zA-Z0-9]+/g, '_')
const rd = (k) => { try { return $persistentStore.read(k) } catch (e) { return null } }
const wr = (k, v) => { try { $persistentStore.write(v, k); return true } catch (e) { return false } }

function notify(title, sub, body) {
  console.log('[' + title + '] ' + sub + (body ? (' | ' + body) : ''))
  try { $surge.logbook('[' + title + '] ' + sub) } catch (e) {}
  try { $notification.post(title, sub, body || '') } catch (e) {}
}

// 大小写不敏感地取请求头
function hdr(o, name) {
  const l = name.toLowerCase()
  for (const k in o) {
    if (k.toLowerCase() === l) return o[k]
  }
  return null
}

const u = ($request && $request.url) ? $request.url : ''
const reqHeaders = ($request && $request.headers) ? $request.headers : {}

// 挡掉「脚本自己发的请求」：10010-sign.js 会带一个自定义标记头，
// 如果把它也录进去，就会污染录制清单（自己覆盖自己）。
const MARK = 'x-10010-self'

// 只记录 10010 自己的接口，挡掉误命中的其它域名
if (u && u.indexOf('10010.com') >= 0 && !hdr(reqHeaders, MARK)) {
  const path = u.split('?')[0]
  const key = PREFIX + norm(path)
  const body = ($request && $request.body) ? $request.body : ''
  const method = ($request && $request.method) ? String($request.method).toUpperCase() : 'POST'

  wr(key + '_url', u)
  wr(key + '_body', body)
  wr(key + '_headers', JSON.stringify(reqHeaders))
  wr(key + '_method', method)
  wr(key + '_time', String(Date.now()))

  // 按接口名（路径最后一段）归档调用方式。
  // 同一个接口名可能挂在不同父目录下（例如 getIntegralize 在 floorData/ 下），
  // 全部保留下来，签到脚本会依次尝试直到某个能通。
  const leaf = path.split('/').pop()
  if (leaf) {
    let variants = []
    try { variants = JSON.parse(rd(API_PREFIX + leaf) || '[]') } catch (e) { variants = [] }
    if (!Array.isArray(variants)) variants = []
    variants = variants.filter(function (v) { return v && !(v.url === u && v.method === method) })
    variants.unshift({ url: u, body: body, method: method, time: Date.now() })
    if (variants.length > 6) variants = variants.slice(0, 6)
    wr(API_PREFIX + leaf, JSON.stringify(variants))
  }

  let idx = []
  try { idx = JSON.parse(rd(INDEX) || '[]') } catch (e) { idx = [] }
  if (!Array.isArray(idx)) idx = []
  if (idx.indexOf(path) < 0) {
    idx.push(path)
    wr(INDEX, JSON.stringify(idx))
    console.log('[联通录制] 新接口 ' + path + ' method=' + method + ' body=' + body.substring(0, 300))
    notify('联通录制', '发现新接口', path.replace('https://act.10010.com/SigninApp/', '') + ' [' + method + ']')
  } else {
    wr(INDEX, JSON.stringify(idx))
  }

  // 刷新会话信息；Cookie 变了才通知，避免刷屏
  const ck = hdr(reqHeaders, 'cookie')
  const oldCk = rd(S_COOKIE)
  // 只保存带 u_account 的完整会话 Cookie：签到页 webview 的 Cookie 没有 u_account，
  // 签到接口不认它；保存它会把首页录到的完整 Cookie 覆盖掉，导致次日签到报未登录。
  if (ck && ck.indexOf('u_account=') >= 0) {
    wr(S_COOKIE, ck)
    if (ck !== oldCk) {
      const m = ck.match(/u_account=([^;]+)/)
      notify('联通录制', '会话 Cookie 已更新', '长度 ' + ck.length + (m ? '，账号 ' + m[1] : ''))
    }
  } else if (ck && !oldCk) {
    wr(S_COOKIE, ck)
  }

  const ua = hdr(reqHeaders, 'user-agent')
  if (ua) wr(S_UA, ua)
  const rf = hdr(reqHeaders, 'referer')
  if (rf) {
    wr(S_REFERER, rf)
    const m = String(rf).match(/^https?:\/\/[^/]+/)
    if (m) wr(S_ORIGIN, m[0])
  }
} else if (u && u.indexOf('10010.com') >= 0) {
  // 脚本自己发的请求（带 X-10010-Self 标记），直接放行不记录
  console.log('[联通录制] 跳过脚本自身请求 ' + u)
} else if (!u) {
  // 手动点运行才会走到这里：http-request 脚本必须由真实请求触发
  console.log('[联通录制] 手动运行，没有 $request')
  notify('联通录制', '手动运行', '本脚本由真实请求触发。请在 Surge 运行期间打开一次联通 APP 的签到页，会自动录到接口并刷新 Cookie。')
} else {
  notify('联通录制', '异常', '没有拿到 $request.url')
}

$done({})
