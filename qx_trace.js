/**
 * Quantumult X 本地高精线路查询脚本 (显示优化版)
 */

const targetIP = ""; 
const url = `https://api.ip.sb/geoip/${targetIP}`;

$task.fetch({ url: url }).then(response => {
    if (!response.body) {
        $notify("❌ 查询失败", "", "服务器返回内容为空");
        $done();
        return;
    }
    
    const str = response.body.trim();
    
    // 防御：如果不是 JSON 格式，说明遇到网络拦截
    if (!str.startsWith("{")) {
        $notify("⚠️ 节点网络受阻", "未能获取有效数据", "当前节点可能触发了防火墙，请换个节点再试");
        $done();
        return;
    }

    try {
        const data = JSON.parse(str);
        const ip = data.ip || "未知";
        const country = data.country || "未知";
        const isp = data.isp || "未知";
        const asn = data.asn ? `AS${data.asn}` : "未知";

        let lineType = "ℹ️ 普通常规线路";
        let isOptimized = false;

        if (asn.includes("4809")) {
            lineType = "✨ 电信 CN2 GIA [AS4809]";
            isOptimized = true;
        } else if (asn.includes("9929") || asn.includes("10099")) {
            lineType = "✨ 联通高端 9929 [AS9929]";
            isOptimized = true;
        } else if (asn.includes("10222")) {
            lineType = "✨ 移动精品 CMIN2 [AS10222]";
            isOptimized = true;
        }

        // 🔀 调整显示顺序：把【是否优化】和【线路级别】直接拍在最顶部（标题栏）
        const title = isOptimized ? `👑 优质线路 · ${lineType}` : `${lineType}`;
        const subtitle = `目标 IP: ${ip}`;
        const detail = `国家/地区: ${country}\n运营商: ${isp}\n自治域: ${asn}`;

        $notify(title, subtitle, detail);
    } catch (e) {
        $notify("❌ 解析错误", "", e.message);
    }
    $done();
}, reason => {
    $notify("❌ 网络错误", "无法连接到外部数据库", reason.error || "请求超时");
    $done();
});
