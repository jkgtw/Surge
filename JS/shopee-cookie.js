/*
修改自 https://github.com/langkhach270389/Scripting/blob/master/shopee_cookie.js

適用台灣蝦皮 shopee.tw
安裝啟用後，請使用瀏覽器到以下網址進行登入，保存 Cookie
https://shopee.tw/me/setting

shopee-cookie.js = type=http-request,pattern=^https:\/\/shopee\.tw\/me\/setting,script-path=shopee-cookie.js,script-update-interval=-1

MITM = shopee.tw
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
