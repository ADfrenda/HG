/**
 * Quantumult X 纯本地运行版（防拦截、防缓存）
 */

const targetIP = ""; 
const url = `https://api.ip.sb/geoip/${targetIP}`;

$task.fetch({ url: url }).then(response => {
    if (!response.body) {
        $notify("❌ 查询失败", "", "返回体为空");
        $done();
        return;
    }
    
    const str = response.body.trim();
    
    // 🛡️ 严格防错：如果返回的不是以 { 开头的 JSON，说明被拦截了
    if (!str.startsWith("{")) {
        $notify("⚠️ 节点网络受阻", "未获取到有效数据", "当前节点可能触发了API的防火墙，请换个节点再试");
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

        $notify(isOptimized ? "👑 发现优质优化线路" : "🔍 节点线路查询结果", `目标 IP: ${ip}`, `地区: ${country}\n运营商: ${isp}\n自治域: ${asn}\n线路级别: ${lineType}`);
    } catch (e) {
        $notify("❌ 解析错误", "", e.message);
    }
    $done();
}, reason => {
    $notify("❌ 网络错误", "无法连接到外部数据库", reason.error || "请求超时");
    $done();
});
