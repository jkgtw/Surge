  var booksUrl = {
    url: 'https://myaccount.books.com.tw/myaccount/reader/dailySignIn/?ru=P5zqo53d',
    headers: {
      Cookie: $persistentStore.read("CookieBooks"),
    }
  }
$httpClient.post(booksUrl, function(error, response, data){
  if (error) {
    $notification.post("📗 博客來簽到", "", "連線錯誤‼️")
    $done(); 
  }
  else {
    if(response.status == 200) {
     let obj= JSON.parse(data);
     var checkmsg = obj["msg"]
     if(obj["status"] == "success") {
       $notification.post("📗 博客來", "", checkmsg + " ✅");
       $done();
     }
     else if(obj["status"] == "signined") {
        $notification.post("📗 博客來" + checkmsg, "", "每日只能簽到一次‼️");
        $done();
     }
     else {
        $notification.post("📗 博客來", "", "簽到遇到未知問題 ❌") ;
        $done();
     }
     $done();
    }
  else {
    $notification.post("📗 博客來 Cookie 已過期‼️", "", "請重新抓取 🔓");
    $done();
  }
  }
});
