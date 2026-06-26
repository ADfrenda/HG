/**
 * Quantumult X 节点/IP 线路属性查询脚本
 * * 说明：
 * 1. 支持手动指定 IP 查询。
 * 2. 如果 targetIP 留空 ""，并配合 QX 的策略组运行，则会自动查询你当前代理节点的出网线路属性。
 */

// 填入你想查询的特定 IP。如果想测试当前节点本身，请保持双引号内为空 ""
const targetIP = ""; 

const queryUrl = `http://ip-api.com/json/${targetIP}?fields=status,message,country,countryCode,isp,as,query`;

$task.fetch({ url: queryUrl }).then(response => {
    if (!response.body) {
        $notify("❌ 路由查询失败", "", "API 响应体为空");
        $done();
        return;
    }
    
    const data = JSON.parse(response.body);
    if (data.status !== "success") {
        $notify("❌ 路由查询失败", "", data.message || "未知错误");
        $done();
    }

    const ip = data.query;
    const country = data.country;
    const countryCode = data.countryCode;
    const isp = data.isp;
    const asn = data.as || "";
    
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

    // 构建通知内容
    const title = isOptimized ? "👑 发现优质优化线路" : "🔍 节点线路查询结果";
    const subtitle = `目标 IP: ${ip} (${countryCode})`;
    const detail = `区域: ${country}\n运营商: ${isp}\n自治域: ${asn}\n线路级别: ${lineType}`;

    // 触发系统弹窗通知
    $notify(title, subtitle, detail);
    
    // 同时在日志中留存记录
    console.log(`\n[路由查询成功]\n${subtitle}\n${detail}\n`);
    
    $done();
}, reason => {
    $notify("❌ 路由查询出错", "", reason.error);
    $done();
});
