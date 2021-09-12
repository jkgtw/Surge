if ($request.headers['Cookie']) {
    var headerBooks = $request.headers['Cookie'];
    var cookie = $persistentStore.write(headerBooks, "CookieBooks");
    if (!cookie) {
      $notification.post("📗 博客來 Cookie 保存錯誤‼️", "", "請重新登入")
    }
    else {
      $notification.post("📗 博客來 Cookie 保存成功 🎉", "", "")
    }
  }
  else {
    $notification.post("📗 博客來 Cookie 保存失敗‼️", "", "請重新登入")
  }
$done({})
