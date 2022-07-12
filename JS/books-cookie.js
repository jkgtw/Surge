const cookie = $request.headers["Cookie"] || $request.headers["cookie"];

if (cookie) {
  $persistentStore.write(cookie, "CookieBooks");
  $notification.post("📗 博客來 Cookie 保存成功 🎉", "", "");
} else {
  $notification.post("📗 博客來 Cookie 保存失敗‼️", "", "請重新登入");
}
$done({});
