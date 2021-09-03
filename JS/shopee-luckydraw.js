/*

適用台灣蝦皮 shopee.tw

[Script]
cron "0 7 * * *" script-path=https://raw.githubusercontent.com/jkgtw/Surge/master/JS/shopee-checkin.js, wake-system=1, timeout=30
cron "1 7 * * *" script-path=https://raw.githubusercontent.com/jkgtw/Surge/master/JS/shopee-luckydraw.js, wake-system=1, timeout=30
shopee-cookie.js = type=http-request,pattern=^https:\/\/shopee\.tw\/me\/setting,script-path=https://raw.githubusercontent.com/jkgtw/Surge/master/JS/shopee-cookie.js,script-update-interval=-1
shopee-loyalty-cookie.js = type=http-request,pattern=^https:\/\/loyalty\.shopee\.tw\/api\/v1\/coins$,script-path=https://raw.githubusercontent.com/jkgtw/Surge/master/JS/shopee-cookie.js,script-update-interval=-1

[MITM]
hostname = %APPEND% loyalty.shopee.tw

*/

var shopeeluckydrawUrl = {
url: 'https://games.shopee.tw/luckydraw/api/v1/lucky/event/0244d69e637bbb73',
headers: {
	Cookie: $persistentStore.read("CookieSP"),
	},
 body: {
	"request_id": (Math.random() * 10**20).toFixed(0).substring(0,16),
	"app_id": "E9VFyxwmtgjnCR8uhL",
	"activity_code": "010ac47631cf4bb5",
	"source": 0
	},
}

$httpClient.post(shopeeluckydrawUrl, function(error, response, data){
if (error)
{
	$notification.post("🍤 蝦幣寶箱", "", "連線錯誤‼️")
	$done(); 
} 

else{
if(response.status == 200)
{
	let obj= JSON.parse(data);
	if(obj["msg"] == 'no chance')
	{
		$notification.post("🍤 今日已領過蝦幣寶箱，每日只能領一次‼️", "","");
		$done();
	}
	else if(obj["msg"] == 'success')
	{
		var packagename = obj["data"]["package_name"];
		$notification.post("🍤 蝦幣寶箱領取成功 ✅", "", "獲得 👉 " + packagename + " 💎💎💎");
		$done();
	}
	else if(obj["msg"] == 'expired')
	{
		$notification.post("🍤 蝦幣寶箱活動已過期 ❌","","請嘗試更新模組或腳本，或等待作者更新‼️");
		$done();
	}
	$done();
}

else{
	$notification.post("🍤 蝦皮 Cookie 已過期‼️", "", "請重新抓取 🔓");
	$done();
	}
}
});
