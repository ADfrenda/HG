 
/**
 * Quantumult X 节点/IP 线路属性查询脚本（智能双主备防流版）
 */

// 填入你想查询的特定 IP。如果想测试当前节点本身，请保持双引号内为空 ""
const targetIP = ""; 

// 1. 首先尝试主 API
function queryPrimary() {
    const url = `http://ip-api.com/json/${targetIP}?fields=status,message,country,countryCode,isp,as,query`;
    
    $task.fetch({ url: url }).then(response => {
        try {
            if (!response.body) throw new Error("返回体为空");
            const data = JSON.parse(response.body);
            if (data.status !== "success") throw new Error(data.message || "被限流");
            
            // 成功则解析
            showResult(data.query, data.country, data.countryCode, data.isp, data.as || "");
        } catch (e) {
            console.log(`[⚠️ 主 API 异常]: ${e.message}。正在无缝切换至备用 HTTPS 数据库...`);
            queryBackup();
        }
    }, () => queryBackup());
}

// 2. 备用 API（走 HTTPS 更加稳定，防劫持）
function queryBackup() {
    const url = `https://ipapi.co/${targetIP ? targetIP + '/' : ''}json/`;
    
    $task.fetch({ url: url }).then(response => {
        try {
            if (!response.body) throw new Error("备用 API 返回体为空");
            const data = JSON.parse(response.body);
            if (data.error) throw new Error(data.reason || "备用服务报错");
            
            // 成功则解析备用格式
            showResult(data.ip, data.country_name, data.country_code, data.org, data.asn || "");
        } catch (e) {
            $notify("❌ 线路查询完全失败", "主备数据库均无法响应", "原因: 当前节点请求过于频繁或网络彻底断开");
            console.log(`[❌ 备用 API 同样失败]: ${e.message}\n服务器原始响应: ${response.body}`);
            $done();
        }
    }, reason => {
        $notify("❌ 线路查询网络错误", "无法连接到外部数据库", reason.error || "请检查网络");
        $done();
    });
}

// 3. 统一渲染和分类逻辑
function showResult(ip, country, countryCode, isp, asn) {
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

    // 触发系统弹窗
    $notify(title, subtitle, detail);
    console.log(`\n[🎉 查询成功]\n${subtitle}\n${detail}\n`);
    $done();
}

// 启动执行
queryPrimary();
