if ($request.headers["Cookie"]) {
  var headerBooks = $request.headers["Cookie"];
  var lpkBooks = headerBooks.indexOf("lpk=");
  if (lpkBooks > 0) {
    $notification.post("📗 博客來 Cookie", "", "請往上滑完整退出 App 後重試一次‼️");
  } else {
    $persistentStore.write(headerBooks, "CookieBooks");
    $notification.post("📗 博客來 Cookie 保存成功 🎉", "", "");
  }
} else {
  $notification.post("📗 博客來 Cookie 保存失敗‼️", "", "請重新登入");
}
$done();
