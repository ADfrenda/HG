/**
 * Quantumult X 节点线路属性查询（防崩溃高稳定性版）
 */

const targetIP = ""; // 留空代表查询当前代理节点本身的公网IP线路
const url = `https://ipwho.is/${targetIP}`;

$task.fetch({ url: url }).then(response => {
    if (!response.body) {
        $notify("❌ 线路查询失败", "", "服务器返回体为空");
        $done();
        return;
    }

    const bodyText = response.body.trim();

    // 🛡️ 核心防御：如果返回内容以 < 开头（说明是 HTML 报错网页或拦截墙），优雅退出
    if (bodyText.startsWith("<") || bodyText.toLowerCase().includes("<!doctype")) {
        $notify("⚠️ 节点被查询网站拦截", "未能获取到线路数据", "当前机场节点请求太频繁，已被API网站暂时拒绝，请切换节点再试");
        $done();
        return;
    }

    try {
        const data = JSON.parse(bodyText);
        if (data.success !== true) {
            $notify("❌ 线路查询失败", "", data.message || "未知错误");
            $done();
            return;
        }

        const ip = data.ip || "未知";
        const country = data.country || "未知";
        const countryCode = data.country_code || "";
        const connection = data.connection || {};
        const isp = connection.isp || "未知";
        const asn = connection.asn ? `AS${connection.asn}` : "";

        let lineType = "ℹ️ 普通常规线路";
        let isOptimized = false;

        // 智能匹配优化线路特征 ASN
        if (asn.includes("AS4809")) {
            lineType = "✨ 电信 CN2 GIA/GT [AS4809]";
            isOptimized = true;
        } else if (asn.includes("AS9929") || asn.includes("AS10099")) {
            lineType = "✨ 联通高端 A9929 [AS9929]";
            isOptimized = true;
        } else if (asn.includes("AS10222")) {
            lineType = "✨ 移动精品 CMIN2 [AS10222]";
            isOptimized = true;
        }

        const title = isOptimized ? "👑 发现优质优化线路" : "🔍 节点线路查询结果";
        const subtitle = `目标 IP: ${ip} (${countryCode})`;
        const detail = `区域: ${country}\n运营商: ${isp}\n自治域: ${asn}\n线路级别: ${lineType}`;

        $notify(title, subtitle, detail);
        $done();

    } catch (e) {
        $notify("❌ 脚本解析异常", "JSON 格式转换失败", e.message);
        console.log(`[解析失败] 原始内容为: ${bodyText}`);
        $done();
    }
}, reason => {
    $notify("❌ 线路查询网络错误", "无法连接到外部数据库", reason.error || "请检查网络");
    $done();
});
