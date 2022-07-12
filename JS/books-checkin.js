function booksCheckIn() {
  const booksUrl = {
    url: 'https://myaccount.books.com.tw/myaccount/reader/dailySignIn/?ru=P5zqo53d',
    headers: {
      Cookie: $persistentStore.read('CookieBooks'),
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 AppVersion:1.0.0 ios_app_shop_ajknrs_2020 support_linepay newAppleLogin',
    },
  };
  $httpClient.post(booksUrl, function (error, response, data) {
    if (error) {
      $notification.post('📗 博客來簽到', '', '連線錯誤‼️');
      $done();
    } else if (response.status === 200) {
      const obj = JSON.parse(data);
      const checkmsg = obj.msg;
      if (obj.status === 'success') {
        $notification.post('📗 博客來', '', checkmsg + ' ✅');
        $done();
      } else if (obj.status === 'signined') {
        $notification.post('📗 博客來' + checkmsg, '', '每日只能簽到一次‼️');
        $done();
      } else {
        $notification.post('📗 博客來', '', '簽到遇到未知問題 ❌');
        $done();
      }
      $done();
    } else {
      $notification.post('📗 博客來 Cookie 已過期‼️', '', '請重新抓取 🔓');
      $done();
    }
  });
}

booksCheckIn();
