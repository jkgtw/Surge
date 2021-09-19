function Booksupdatelpk() {
  var updatelpkUrl = {
    url: "https://myaccount.books.com.tw/myaccount/myaccount/getReorder",
    headers: {
      Cookie: $persistentStore.read("CookieBooks"),
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 AppVersion:1.0.0 ios_app_shop_ajknrs_2020 support_linepay newAppleLogin",
    },
  };
  $httpClient.get(updatelpkUrl, function (error, response, data) {
    if (error) {
      $notification.post("📗 博客來 lpk", "", "連線錯誤‼️");
      $done();
    } else {
      if (response.status == 200 && response.headers["Set-Cookie"]) {
        var bookslpk = $persistentStore.write(
          response.headers["Set-Cookie"].split("lpk=")[1].split(";")[0],
          "lpkBooks"
        );
        if (bookslpk) {
          Bookscheckin();
        } else {
          $notification.post("📗 博客來 lpk", "", "刷新失敗‼️");
        }
        $done();
      } else {
        $notification.post("📗 博客來 lpk", "", "刷新失敗‼️");
        $done();
      }
    }
  });
}

function Bookscheckin() {
  var booksUrl = {
    url: "https://myaccount.books.com.tw/myaccount/reader/dailySignIn/?ru=P5zqo53d",
    headers: {
      Cookie:
        $persistentStore.read("CookieBooks") +
        "; lpk=" +
        $persistentStore.read("lpkBooks"),
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 AppVersion:1.0.0 ios_app_shop_ajknrs_2020 support_linepay newAppleLogin",
    },
  };
  $httpClient.post(booksUrl, function (error, response, data) {
    if (error) {
      $notification.post("📗 博客來簽到", "", "連線錯誤‼️");
      $done();
    } else if (response.status == 200) {
      let obj = JSON.parse(data);
      var checkmsg = obj["msg"];
      if (obj["status"] == "success") {
        $notification.post("📗 博客來", "", checkmsg + " ✅");
        $done();
      } else if (obj["status"] == "signined") {
        $notification.post("📗 博客來" + checkmsg, "", "每日只能簽到一次‼️");
        $done();
      } else {
        $notification.post("📗 博客來", "", "簽到遇到未知問題 ❌");
        $done();
      }
      $done();
    } else {
      $notification.post("📗 博客來 Cookie 已過期‼️", "", "請重新抓取 🔓");
      $done();
    }
  });
}

Booksupdatelpk();
