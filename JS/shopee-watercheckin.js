var nwtime = Math.floor(new Date().getTime());
let wurl = "https://games.shopee.tw/farm/api/task/action?t=" + nwtime;

var shopeewurl = {
  url: wurl,
  headers: {
    Cookie: $persistentStore.read("CookieSP"),
    "Content-Type": "application/json",
  },
  body: { actionKey: "act_Check_In" },
};

$httpClient.post(shopeewurl, function (error, response, data) {
  if (error) {
    $notification.post("🍤 蝦皮果園水滴任務打卡", "", "連線錯誤‼️");
    $done();
  } else {
    if (response.status == 200) {
      let obj = JSON.parse(data);
      if (obj["msg"] == "success") {
        $notification.post("🍤 蝦皮果園", "", "水滴任務打卡成功 ✅");
        $done();
      } else if (obj["msg"] == "false") {
        $notification.post(
          "🍤 今日已經完成所有水滴任務打卡",
          "",
          "每日只能打卡三次‼️"
        );
        $done();
      }
      $done();
    } else {
      $notification.post(
        "🍤 蝦皮 Cookie 已過期或網路錯誤‼️",
        "",
        "請重新更新 Cookie 重試 🔓"
      );
      $done();
    }
  }
});
