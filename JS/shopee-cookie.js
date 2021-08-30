/*

修改自 https://github.com/langkhach270389/Scripting/blob/master/shopee_checkin.js

適用台灣蝦皮 shopee.tw

[Script]
cron "0 7 * * *" script-path=https://raw.githubusercontent.com/jkgtw/Surge/master/JS/shopee-checkin.js, wake-system=1, timeout=30
cron "1 7 * * *" script-path=https://raw.githubusercontent.com/jkgtw/Surge/master/JS/shopee-luckydraw.js, wake-system=1, timeout=30
shopee-cookie.js = type=http-request,pattern=^https:\/\/shopee\.tw\/me\/setting,script-path=https://raw.githubusercontent.com/jkgtw/Surge/master/JS/shopee-cookie.js,script-update-interval=-1
shopee-loyalty-cookie.js = type=http-request,pattern=^https:\/\/loyalty\.shopee\.tw\/api\/v1\/coins$,script-path=https://raw.githubusercontent.com/jkgtw/Surge/master/JS/shopee-cookie.js,script-update-interval=-1

[MITM]
hostname = %APPEND% loyalty.shopee.tw

*/

if ($request.headers['Cookie']) {
    var headerSP = $request.headers['Cookie'];
    var cookie = $persistentStore.write(headerSP, "CookieSP");
    if (!cookie){
      $notification.post("蝦皮 Cookie 保存錯誤‼️", "", "請重新登入")
    } else {
      $notification.post("蝦皮 Cookie 保存成功🎉", "", "")
    }
  } else {
    $notification.post("蝦皮 Cookie 保存失敗‼️", "", "請重新登入")
  }
  $done({})
