/************************

巴哈姆特簽到腳本
包含主站簽到、公會簽到、動畫瘋答題等

腳本兼容: Surge、QuantumultX、Loon、Shadowrocket、Node.js
適配過程: https://nobyda.github.io/2021/07/24/Bahamut_daily_bonus_js_example
BoxJs訂閱: https://raw.githubusercontent.com/NobyDa/Script/master/NobyDa_BoxJs.json

*************************
【 簽到腳本注意事項 】:
*************************

1. 該腳本需要進入BoxJs或腳本內填寫賬號密碼後, 方可使用.
2. 不建議在凌晨執行,因需要獲取動畫瘋題目答案; 默認配置將在每天的早上8:00執行.
3. 如需使用Node.js運行該腳本, 則需安裝got、tough-cookie模塊

*************************
【 Surge & Loon 腳本配置 】:
*************************

[Script]
cron "0 8 * * *" script-path=https://raw.githubusercontent.com/NobyDa/Script/master/Bahamut/BahamutDailyBonus.js, wake-system=1, timeout=300

*************************
【 QX 1.0.10+ 腳本配置 】 :
*************************

[task_local]
0 8 * * * https://raw.githubusercontent.com/NobyDa/Script/master/Bahamut/BahamutDailyBonus.js, tag=巴哈姆特簽到, img-url=https://raw.githubusercontent.com/NobyDa/mini/master/Color/bahamutGame.png

************************/

// 以下全局變量中的持久化接口為BoxJs預留, 以便修改
// 把兼容函數定義到$中, 以便統一調用
const $ = new Env('巴哈姆特');

// 取得模組arguments
let args = getArgs();

// 用戶名
$.uid = $.getdata('@ND_BAHA.ID') || args.uid || 'YourUserName';

// 用戶密碼
$.pwd = $.getdata('@ND_BAHA.PW') || args.pwd || 'YourUserPassword';

// 兩步驗證Token, 16位數, 未設置請保持默認
$.totp = $.getdata('@ND_BAHA.TOTP') || args.totp || '';

// 是否開啓廣告簽到，true/false，默認關閉 (該功能耗時過長)
$.needSignAds = $.getdata('@ND_BAHA.ADS') || args.needSignAds || false;

// 是否自動簽到公會，true/false，默認開啓
$.needSignGuild = $.getdata('@ND_BAHA.GUILD') || args.needSignGuild || true;

// 是否自動答題動畫瘋，true/false，默認開啓 (不保證100%答題正確)
$.needAnswer = $.getdata('@ND_BAHA.ANSWER') || args.needAnswer || true;

//Bark APP 通知推送Key
$.barkKey = '';

// 為通知準備的空數組
$.notifyMsg = [];

(async function() { // 立即運行的匿名異步函數
	await BahamutLogin(); // 登錄
	await BahamutGuildSign(); //簽到巴哈公會
	await BahamutSign(); //簽到巴哈
	await BahamutAnswer(); //動畫瘋答題
})().catch((e) => $.notifyMsg.push(e.message || e)) //捕獲登錄函數等拋出的異常, 並把原因添加到全局變量(通知)
	.finally(async () => { //finally在catch之後無論有無異常都會執行
		if ($.barkKey) { //如果已填寫Bark Key
			await BarkNotify($, $.barkKey, $.name, $.notifyMsg.join('\n')); //推送Bark通知
		};
		$.msg($.name, ``, $.notifyMsg.join('\n'), {
			'open-url': 'crazyanime://', //動畫瘋url scheme
			'media-url': 'https://cdn.jsdelivr.net/gh/NobyDa/mini@master/Color/bahamutClear.png' //通知圖片
		}); //帶上總結推送通知
		$.done(); //調用Surge、QX內部特有的函數, 用於退出腳本執行
	});

async function BahamutLogin(retry = 3, interval = 1000) { //登錄函數，拿到Set-Cookie

	//登錄成功: {"success":true,"userid":"DGIE","nickname":"coco","gold":152769,"gp":0,"avatar":"https:\/\/avatar2.bahamut.com.tw\/avataruserpic\/dgie.png","avatar_s":"https:\/\/avatar2.bahamut.com.tw\/avataruserpic\/dgie_s.png","lv":6}
	//賬號錯誤: {"code":0,"message":"查無此人：SDFOUGB"}
	//密碼錯誤: {"code":0,"message":"帳號、密碼或驗證碼錯誤！"}
	//驗證碼錯誤: {"code":0,"message":"驗證碼錯誤"}

	for (let i = 0; i < retry; i++) { //循環登錄(默認三次)
		if (i > 0) {
			$.log('', `🔶嘗試第 ${i+1} 次登錄...`);
			await $.wait(interval); //延遲一秒
		};
		const reqUrl = {
			url: 'https://api.gamer.com.tw/mobile_app/user/v3/do_login.php', //登錄接口
			headers: { //請求頭
				'Cookie': 'ckAPP_VCODE=6666' //Cookie中的ckAPP_VCODE為必須
			},
			//請求體放入用戶名和密碼，並把它uri編碼
			body: `uid=${encodeURIComponent($.uid)}&passwd=${encodeURIComponent($.pwd)}&vcode=6666${$.totp?`&twoStepAuth=${TOTP($.totp)}`:``}`
		};
		const res = await $.http.post(reqUrl) //使用post請求查詢 (兼容函數實際上返回Promise實例對象,以便後續調用時可以實現順序執行異步函數)
			.then(async (resp) => { //請求成功的處理
				const body = JSON.parse(resp.body); //解析響應體json為對象
				if (body.userid) { //如果成功返回用戶信息
					$.BAHARUNE = JSON.stringify(resp.headers).split(/(BAHARUNE=[^;]+)/)[1];
					return `✅巴哈姆特登錄成功`;
				} else { //否則登錄失敗 (例如密碼錯誤)
					const failMsg = body.error ? body.error.message : null; //判斷簽到失敗原因
					throw new Error(`${body.message||failMsg||'原因未知'}`); //帶上原因拋出異常
				}
			}).catch((err) => `❌登錄失敗\n❌${err.message || err}`);
		$.log('', res.message || res);
		if (res === `✅巴哈姆特登錄成功`) {
			break; //登錄成功則跳出循環
		} else if (retry == i + 1) { //如果最後一次重試仍登錄失敗
			throw new Error(res.message || res); //拋出錯誤, 被調用該函數時的catch捕獲, 腳本結束.
		}
	}
}

function BahamutSign() { //查詢巴哈姆特簽到Token
	return $.http.get({ //使用get方法 (Promise實例對象) 查詢簽到Token
			url: 'https://www.gamer.com.tw/ajax/get_csrf_token.php', // 查詢Token接口
			headers: {} //請求頭, 客戶端將自動設置Cookie字段
		}).then(async (resp) => { //網絡請求成功的處理, 實例函數帶有async關鍵字, 表示裡面有異步操作
			if (resp.body) { //如果簽到Token獲取成功
				$.log('', '✅獲取簽到令牌成功'); //打印日誌
				const sign = await StartSignBahamut(resp.body); //帶上Token開始簽到
				$.notifyMsg.push(`首頁簽到: 成功, 已連續簽到 ${sign} 天`); //添加到全局變量備用 (通知)
				await StartAdsBonus(resp.body.slice(0, 16), 'start'); //執行廣告簽到
			} else { //否則拋出異常
				throw new Error('獲取簽到令牌失敗'); //帶上原因被下面catch捕獲
			}
		})
		.catch(err => {
			$.notifyMsg.push(`首頁簽到: ${err.message||err}`); //添加到全局變量備用 (通知)
			$.log('', `❌巴哈姆特簽到失敗`, `❌${err.message||err}`);
		}); // 捕獲異常, 打印日誌
}

function StartSignBahamut(token) { //巴哈姆特簽到

	//簽到成功: {"data":{"days":1,"dialog":"","prjSigninDays":0}}
	//已簽過: {"error":{"code":0,"message":"今天您已經簽到過了喔","status":"","details":[]}}
	//未登錄: {"error":{"code":401,"message":"尚未登入","status":"NO_LOGIN","details":[]}}
	//令牌過期: {"error":{"code":403,"message":"網頁已過期","status":"CSRF_TOKEN_ERROR","details":[]}}

	return $.http.post({ //使用post方法 (Promise實例對象) 進行簽到
			url: 'https://www.gamer.com.tw/ajax/signin.php', //巴哈姆特簽到接口
			headers: {}, //請求頭, 客戶端將自動設置Cookie字段
			body: `action=1&token=${token}` //請求體帶上查詢到的簽到Token
		})
		.then(res => { // 網絡請求成功的處理
			const body = JSON.parse(res.body); //解析響應體json為對象
			if (body.data) { // 如果簽到成功 (判斷預期響應格式)
				$.log('', '✅巴哈姆特簽到成功', `✅已連續簽到 ${body.data.days} 天`); //打印日誌
				return body.data.days; //返回簽到天數
			} else { //否則簽到失敗
				const failMsg = body.error ? body.error.message : null; //判斷簽到失敗原因
				throw new Error(failMsg || body.message || '未知'); //帶上原因拋出異常
			}
		}); //未寫catch，如果簽到失敗或其他錯誤，則被調用該函數時的catch捕獲
}

function StartAdsBonus(token, type) {
	if ($.needSignAds === false || $.needSignAds === 'false') { //如果用戶選擇不簽到廣告
		return; //退出廣告簽到函數
	}
	return $.http.post({ //使用post方法 (Promise實例對象) 進行簽到
			url: 'https://api.gamer.com.tw/mobile_app/bahamut/v1/sign_in_ad_' + type + '.php?bahamutCsrfToken=' + token, //雙倍巴幣廣告獎勵接口
			headers: {
				'Cookie': `ckBahamutCsrfToken=${token};${$.BAHARUNE}` //前16位簽到Token和重新設置的Cookie
			}
		})
		.then(async (res) => { //網絡請求成功的處理, 實例函數帶有async關鍵字, 表示裡面有異步操作
			const body = JSON.parse(res.body); //解析響應體json為對象
			if (body.data && body.data.finished == 0 && type == 'start') { //如果成功激活廣告獎勵
				$.log('', '🔶正在執行廣告簽到 (30s)'); //打印日誌
				await $.wait(30000); //等待30秒
				await StartAdsBonus(token, 'finished'); //領取獎勵函數
			} else if (body.data && body.data.finished == 1) { //如果廣告獎勵領取成功
				$.log('', '✅領取廣告獎勵成功'); //打印日誌
				$.notifyMsg.push('廣告簽到: 成功, 已領取雙倍簽到獎勵'); //添加到全局變量備用 (通知)
			} else {
				const failMsg = body.error ? body.error.message : null; //判斷簽到失敗原因
				throw new Error(failMsg || body.message || '未知'); //帶上原因拋出異常
			}
		})
		.catch(err => {
			$.notifyMsg.push(`廣告簽到: ${err.message||err}`); //添加到全局變量備用 (通知)
			$.log('', `❌廣告獎勵簽到失敗`, `❌${err.message||err}`);
		}); // 捕獲異常, 打印日誌
}

function BahamutGuildSign() { //巴哈姆特查詢公會列表
	if ($.needSignGuild === false || $.needSignGuild === 'false') { //如果用戶選擇不簽到公會
		return; //退出公會簽到函數
	}
	return $.http.get({ //使用get請求查詢公會列表 (Promise實例對象)
			url: 'https://api.gamer.com.tw/ajax/common/topBar.php?type=forum', // 查詢公會列表接口
			headers: {} //請求頭, 客戶端將自動設置Cookie字段
		})
		.then(async (resp) => { //網絡請求成功的處理, 實例函數帶有async關鍵字, 表示裡面有異步操作
			const list = (resp.body.replace(/\n/g, '').match(/guild\.php\?g?sn=\d.+?<\/p>/g) || []) //正則過濾公會列表大致內容
				.map(n => { //使用map遍歷每個大致內容
					return { //返回包含公會ID和公會名稱的對象
						sn: n.split(/guild\.php\?g?sn=(\d+)/)[1], //正則進一步提取公會ID
						name: n.split(/<p>(.+?)<\/p>/)[1] //正則進一步提取公會名稱
					}
				});
			if (list.length) { //過濾後, 如果包含公會列表
				$.log('', `✅獲取公會列表成功`); //打印日誌
				//按照公會數量進行併發簽到, map結合Promise.all後可以實現併發簽到並且都完成後才進行下一行操作
				const sign = await Promise.all(list.map(StartSignGuild));
				const sucs = sign.filter(n => n === 1).length; //過濾後得到成功數量
				const fail = sign.filter(n => n === 0).length; //過濾後得到失敗數量
				//添加到全局變量備用 (通知)
				$.notifyMsg.push(`公會簽到: ${sucs?`成功${sucs}個`:``}${sucs&&fail?`, `:``}${fail?`失敗${fail}個`:``}`);
			} else {
				throw new Error('公會列表為空'); //無公會列表則拋出異常
			}
		})
		.catch(err => { //捕獲異常, 打印日誌
			$.notifyMsg.push(`公會簽到: ${err.message || err}`); //添加到全局變量備用 (通知)
			$.log('', `❌巴哈姆特公會簽到失敗`, `❌${err.message || err}`); //打印日誌
		});
}

function StartSignGuild(v) { //巴哈姆特公會簽到

	//簽到成功: {"ok":1,"msg":"本日簽到成功！獲得5貢獻度"}
	//已簽過: {"error":1,"msg":"您今天已經簽到過了！"}
	//公會ID錯誤: {"error":1,"msg":"此公會社團不存在。"}
	//未加入公會: {"error":1,"msg":"你還不是成員，歡迎加入！"}
	//未登錄: {"error":1,"msg":"請先登入"}

	return $.http.post({ //使用post方法簽到公會 (Promise實例對象)
			url: 'https://guild.gamer.com.tw/ajax/guildSign.php', //公會簽到接口
			headers: {}, //請求頭, 客戶端將自動設置Cookie字段
			body: `sn=${v.sn}` //把查詢到的公會ID放進請求體
		})
		.then((res) => { //網絡請求成功後的處理
			const body = JSON.parse(res.body); //解析響應體json為對象
			$.log('', `🔷<${v.name}>`, `${body.ok?`✅`:`❌`}${body.msg}`); //打印日誌, 包含簽到結果
			if (body.ok) { //如果簽到成功
				return 1; //返回1表示成功
			} else {
				return 0; //返回0表示失敗
			}
		})
		.catch(e => { //捕獲異常, 打印日誌
			$.log('', `🔷<${v.name}>`, `❌簽到失敗: ${e.message||e}`);
			return 0; //返回0表示失敗
		});
}

function BahamutAnswer() { //動畫瘋答題

	//未答題: {"game":"灌籃高手","question":"流川楓的號碼是下列何者？","a1":"7","a2":"11","a3":"23","a4":"59","userid":"GN32964174","token":"01092fe463ab36ab47cb298e229c4f8fb298e229cc260fa7baf"}
	//已答題: {"error":1,"msg":"今日已經答過題目了，一天僅限一次機會"}
	//未登錄: {"error":1,"nologin":1,"msg":"請先登入"}

	if ($.needAnswer === false || $.needAnswer === 'false') { //如果用戶關閉動畫瘋答題
		return; //退出答題函數
	}
	return $.http.get({ //使用get方獲取題目 (Promise實例對象)
			url: 'https://ani.gamer.com.tw/ajax/animeGetQuestion.php?t=' + Date.now(), //獲取題目接口
			headers: {} //請求頭, 客戶端將自動設置Cookie字段
		})
		.then(async (res) => { //網絡請求成功的處理, 實例函數帶有async關鍵字, 表示裡面有異步操作
			const r = JSON.parse(res.body); //解析響應體json為對象
			if (r.token) { //如果有題目
				$.log('', `✅獲取動畫瘋題目成功`, ``, `🔶<${r.game}> ${r.question}`,
					`1️⃣${r.a1}`, `2️⃣${r.a2}`, `3️⃣${r.a3}`, `4️⃣${r.a4}`); //打印日誌
				const article = await GetAanswerArticles(); //獲取答案文章ID
				const getAnswer = await StartSearchAnswers(article); //傳入文章ID, 再從文章內獲取答案
				const sendAnswer = await StartBahamutAnswer(getAnswer, r.token); //傳入答案和題目令牌, 開始答題
				$.notifyMsg.push(`動畫答題: ${sendAnswer}`); //答題後的結果添加到全局變量備用 (通知)
			} else { //未獲取到題目
				throw new Error(r.msg || `獲取題目失敗`); //帶上原因拋出異常
			}
		})
		.catch(e => { //捕獲異常, 打印日誌
			$.notifyMsg.push(`動畫答題: ${e.message||e||`失敗`}`); //添加到全局變量備用 (通知)
			$.log('', `❌動畫瘋答題失敗`, `❌${e.message||e}`); //打印日誌
		});
}

function GetAanswerArticles() { // 從blackxblue的小屋查詢含答案的文章ID
	$.log('', `🔶開始獲取文章`); //打印日誌
	return $.http.get({ //使用get方法獲取文章ID (Promise實例對象)
			url: 'https://api.gamer.com.tw/mobile_app/bahamut/v1/home.php?owner=blackXblue&page=1', //獲取文章ID接口
			headers: {}
		})
		.then((res) => { //網絡請求成功後的處理
			const body = JSON.parse(res.body); //解析響應體json為對象
			const tDate = $.time('MM/dd'); //返回今日日期
			const title = (body.creation || []).filter(t => t.title.includes(tDate)); //過濾後返回今日答案文章
			if (title.length && title[0].sn) { //如果有答案文章
				$.log('', `✅獲取文章成功 (${title[0].sn})`); //打印日誌
				return title[0].sn; //返回文章ID
			} else { //否則帶上原因拋出異常, 被調用該函數時的catch捕獲
				throw new Error('今日答案未發表');
			}
		})
}

function StartSearchAnswers(id) { //獲取文章內答案
	$.log('', `🔶開始獲取答案`); //打印日誌
	return $.http.get({ //使用get方法獲取答案 (Promise實例對象)
			url: 'https://api.gamer.com.tw/mobile_app/bahamut/v1/home_creation_detail.php?sn=' + id, //獲取答案接口
			headers: {}
		})
		.then((res) => { //網絡請求成功後的處理
			const body = JSON.parse(res.body); //解析響應體json為對象
			const answers = body.content.split(/A[:;：](\d)/)[1]; //正則提取答案
			if (answers) { //如果成功提取答案
				$.log('', `✅獲取答案成功 (${answers})`); //打印日誌
				return answers; //返回答案
			} else { //否則帶上原因拋出異常, 被調用該函數時的catch捕獲
				throw new Error('提取答案失敗');
			}
		})
}

function StartBahamutAnswer(answer, token) { //動畫瘋答題

	//答題正確: {"ok":1,"gift":"恭喜您得到：300 巴幣"}
	//答題錯誤: {"error":1,"msg":"答題錯誤"}
	//令牌過期: {"error":1,"msg":"很抱歉！本題目已超過時效！"}
	//已答題: {"error":1,"msg":"今日已經答過題目了，一天僅限一次機會"}
	//未登錄: {"error":1,"nologin":1,"msg":"請先登入"}

	$.log('', `🔶開始答題`); //打印日誌
	return $.http.post({ //使用post方法提交答案 (Promise實例對象)
			url: 'https://ani.gamer.com.tw/ajax/animeAnsQuestion.php', //提交答案接口
			headers: {}, //請求頭, 客戶端將自動設置Cookie字段
			body: `token=${token}&ans=${answer}&t=${Date.now()}`, //請求體帶上答案和答案令牌
		})
		.then((res) => { //網絡請求成功後的處理
			const body = JSON.parse(res.body); //解析響應體json為對象
			if (body.ok) { //如果答題成功
				$.log('', `✅${body.gift}`); //打印獎勵日誌
				return body.gift; //返回獎勵內容
			} else { //否則答題失敗
				const failMsg = body.error ? body.error.message : null; //提取簽到失敗原因
				throw new Error(body.msg || failMsg || '未知'); //否則帶上原因拋出異常, 被調用該函數時的catch捕獲
			}
		})
}

function getArgs() {
  if (typeof $argument === 'undefined') {
    return '';
  }
  return Object.fromEntries(
    $argument
      .split("&")
      .map((item) => item.split("="))
      .map(([k, v]) => [k, v])
  );
}

//Bark APP notify
async function BarkNotify(c,k,t,b){for(let i=0;i<3;i++){console.log(`🔷Bark notify >> Start push (${i+1})`);const s=await new Promise((n)=>{c.post({url:'https://api.day.app/push',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:t,body:b,device_key:k,ext_params:{group:t}})},(e,r,d)=>r&&r.status==200?n(1):n(d||e))});if(s===1){console.log('✅Push success!');break}else{console.log(`❌Push failed! >> ${s.message||s}`)}}};

//修改自 https://github.com/chavyleung/scripts/blob/master/Env.js 的兼容函數
function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,i)=>{s.call(this,t,(t,s,r)=>{t?i(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.ua="Anime/2.13.9 (tw.com.gamer.anime;build:437;iOS 14.5.0) Alamofire/5.4.1",this.logs=[],this.isMute=!1,this.isNeedRewrite=!0,this.logSeparator="\n",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`\ud83d\udd14${this.name}`)}isNode(){return"undefined"!=typeof module&&!!module.exports}isQuanX(){return"undefined"!=typeof $task}isSurge(){return"undefined"!=typeof $httpClient&&"undefined"==typeof $loon}isLoon(){return"undefined"!=typeof $loon}isShadowrocket(){return"undefined"!=typeof $rocket}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const i=this.getdata(t);if(i)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,i)=>e(i))})}runScript(t,e){return new Promise(s=>{let i=this.getdata("@chavy_boxjs_userCfgs.httpapi");i=i?i.replace(/\n/g,"").trim():i;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[o,h]=i.split("@"),a={url:`http:\/\/${h}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":o,Accept:"*/*"}};this.post(a,(t,e,i)=>s(i))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):i?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of i)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,r]=/^@(.*?)\.(.*?)$/.exec(e),o=this.getval(i),h=i?"null"===o?null:o||"{}":"{}";try{const e=JSON.parse(h);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),i)}catch(e){const o={};this.lodash_set(o,r,t),s=this.setval(JSON.stringify(o),i)}}else s=this.setval(t,e);return s}getval(t){return this.isSurge()||this.isLoon()?$persistentStore.read(t):this.isQuanX()?$prefs.valueForKey(t):this.isNode()?(this.data=this.loaddata(),this.data[t]):this.data&&this.data[t]||null}setval(t,e){return this.isSurge()||this.isLoon()?$persistentStore.write(t,e):this.isQuanX()?$prefs.setValueForKey(t,e):this.isNode()?(this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0):this.data&&this.data[e]||null}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},((void 0===t.headers.Cookie||/ckAPP_VCODE/.test(t.headers.Cookie))&&void 0===t.cookieJar)&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){t.headers&&(t.headers["User-Agent"]=this.ua,delete t.headers["Content-Type"],delete t.headers["Content-Length"]),this.isSurge()||this.isLoon()?(this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)})):this.isQuanX()?(this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t))):this.isNode()&&(this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)}))}post(t,e=(()=>{})){const s=t.method?t.method.toLocaleLowerCase():"post";if(t.body&&t.headers&&!t.headers["Content-Type"]&&(t.headers["Content-Type"]="application/x-www-form-urlencoded"),t.headers&&(t.headers["User-Agent"]=this.ua,delete t.headers["Content-Length"]),this.isSurge()||this.isLoon())this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient[s](t,(t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status),e(t,s,i)});else if(this.isQuanX())t.method=s,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>e(t));else if(this.isNode()){this.initGotEnv(t);const{url:i,...r}=t;this.got[s](i,r).then(t=>{const{statusCode:s,statusCode:i,headers:r,body:o}=t;e(null,{status:s,statusCode:i,headers:r,body:o},o)},t=>{const{message:s,response:i}=t;e(s,i,i&&i.body)})}}time(t,e=null){const s=e?new Date(e):new Date;let i={"M+":s.getMonth()+1,"d+":s.getDate(),"H+":s.getHours(),"m+":s.getMinutes(),"s+":s.getSeconds(),"q+":Math.floor((s.getMonth()+3)/3),S:s.getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,(s.getFullYear()+"").substr(4-RegExp.$1.length)));for(let e in i)new RegExp("("+e+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?i[e]:("00"+i[e]).substr((""+i[e]).length)));return t}msg(e=t,s="",i="",r){const o=t=>{if(!t)return t;if("string"==typeof t)return this.isLoon()?t:this.isQuanX()?{"open-url":t}:this.isSurge()?{url:t}:void 0;if("object"==typeof t){if(this.isLoon()){let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}if(this.isQuanX()){let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl;return{"open-url":e,"media-url":s}}if(this.isSurge()){let e=t.url||t.openUrl||t["open-url"];return{url:e}}}};if(this.isMute||(this.isSurge()||this.isLoon()?$notification.post(e,s,i,o(r)):this.isQuanX()&&$notify(e,s,i,o(r))),!this.isMuteLog){let t=["","================================="];t.push(e),s&&t.push(s),i&&t.push(i),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){const s=!this.isSurge()&&!this.isQuanX()&&!this.isLoon();s?this.log("",`\u2757\ufe0f${this.name},\u9519\u8bef!`,t.stack):this.log("",`\u2757\ufe0f${this.name},\u9519\u8bef!`,t)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;this.log("",`${s}\u79d2`,`=================================`),(this.isSurge()||this.isQuanX()||this.isLoon())&&$done(t)}}(t,e)};

// 從 https://jsfiddle.net/russau/rbyjk774 魔改的TOTP兩部驗證算法, 完全使用原生javascript實現
function TOTP(token){if(typeof token!=='string'||token.length===0||token.length>32){throw new Error('Invalid TOTP token length')}function t(e,a,d){var g=0,c=[],b=0,f,k,l,h,m,w,n,y,p=!1,q=[],t=[],v,u=!1;d=d||{};f=d.encoding||"UTF8";v=d.numRounds||1;l=z(a,f);if(v!==parseInt(v,10)||1>v)throw Error("numRounds must a integer >= 1");if("SHA-1"===e)m=512,w=A,n=H,h=160,y=function(a){return a.slice()};else throw Error("Chosen SHA variant is not supported");k=x(e);this.setHMACKey=function(a,b,c){var d;if(!0===p)throw Error("HMAC key already set");if(!0===u)throw Error("Cannot set HMAC key after calling update");f=(c||{}).encoding||"UTF8";b=z(b,f)(a);a=b.binLen;b=b.value;d=m>>>3;c=d/4-1;if(d<a/8){for(b=n(b,a,0,x(e),h);b.length<=c;)b.push(0);b[c]&=4294967040}else if(d>a/8){for(;b.length<=c;)b.push(0);b[c]&=4294967040}for(a=0;a<=c;a+=1)q[a]=b[a]^909522486,t[a]=b[a]^1549556828;k=w(q,k);g=m;p=!0};this.update=function(a){var d,e,f,h=0,n=m>>>5;d=l(a,c,b);a=d.binLen;e=d.value;d=a>>>5;for(f=0;f<d;f+=n)h+m<=a&&(k=w(e.slice(f,f+n),k),h+=m);g+=h;c=e.slice(h>>>5);b=a%m;u=!0};this.getHash=function(a,d){var f,l,m,r;if(!0===p)throw Error("Cannot call getHash after setting HMAC key");m=B(d);switch(a){case"HEX":f=function(a){return C(a,h,m)};break;case"B64":f=function(a){return D(a,h,m)};break;case"BYTES":f=function(a){return E(a,h)};break;case"ARRAYBUFFER":try{l=new ArrayBuffer(0)}catch(I){throw Error("ARRAYBUFFER not supported by this environment");}f=function(a){return F(a,h)};break;default:throw Error("format must be HEX, B64, BYTES, or ARRAYBUFFER");}r=n(c.slice(),b,g,y(k),h);for(l=1;l<v;l+=1)r=n(r,h,0,x(e),h);return f(r)};this.getHMAC=function(a,d){var f,l,q,r;if(!1===p)throw Error("Cannot call getHMAC without first setting HMAC key");q=B(d);switch(a){case"HEX":f=function(a){return C(a,h,q)};break;case"B64":f=function(a){return D(a,h,q)};break;case"BYTES":f=function(a){return E(a,h)};break;case"ARRAYBUFFER":try{f=new ArrayBuffer(0)}catch(I){throw Error("ARRAYBUFFER not supported by this environment");}f=function(a){return F(a,h)};break;default:throw Error("outputFormat must be HEX, B64, BYTES, or ARRAYBUFFER");}l=n(c.slice(),b,g,y(k),h);r=w(t,x(e));r=n(l,h,m,r,h);return f(r)}}function J(e,a,d){var g=e.length,c,b,f,k,l;a=a||[0];d=d||0;l=d>>>3;if(0!==g%2)throw Error("String of HEX type must be in byte increments");for(c=0;c<g;c+=2){b=parseInt(e.substr(c,2),16);if(isNaN(b))throw Error("String of HEX type contains invalid characters");k=(c>>>1)+l;for(f=k>>>2;a.length<=f;)a.push(0);a[f]|=b<<8*(3-k%4)}return{value:a,binLen:4*g+d}}function K(e,a,d){var g=[],c,b,f,k,g=a||[0];d=d||0;b=d>>>3;for(c=0;c<e.length;c+=1)a=e.charCodeAt(c),k=c+b,f=k>>>2,g.length<=f&&g.push(0),g[f]|=a<<8*(3-k%4);return{value:g,binLen:8*e.length+d}}function L(e,a,d){var g=[],c=0,b,f,k,l,h,m,g=a||[0];d=d||0;a=d>>>3;if(-1===e.search(/^[a-zA-Z0-9=+\/]+$/))throw Error("Invalid character in base-64 string");f=e.indexOf("=");e=e.replace(/\=/g,"");if(-1!==f&&f<e.length)throw Error("Invalid '=' found in base-64 string");for(f=0;f<e.length;f+=4){h=e.substr(f,4);for(k=l=0;k<h.length;k+=1)b="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".indexOf(h[k]),l|=b<<18-6*k;for(k=0;k<h.length-1;k+=1){m=c+a;for(b=m>>>2;g.length<=b;)g.push(0);g[b]|=(l>>>16-8*k&255)<<8*(3-m%4);c+=1}}return{value:g,binLen:8*c+d}}function M(e,a,d){var g=[],c,b,f,g=a||[0];d=d||0;c=d>>>3;for(a=0;a<e.byteLength;a+=1)f=a+c,b=f>>>2,g.length<=b&&g.push(0),g[b]|=e[a]<<8*(3-f%4);return{value:g,binLen:8*e.byteLength+d}}function C(e,a,d){var g="";a/=8;var c,b;for(c=0;c<a;c+=1)b=e[c>>>2]>>>8*(3-c%4),g+="0123456789abcdef".charAt(b>>>4&15)+"0123456789abcdef".charAt(b&15);return d.outputUpper?g.toUpperCase():g}function D(e,a,d){var g="",c=a/8,b,f,k;for(b=0;b<c;b+=3)for(f=b+1<c?e[b+1>>>2]:0,k=b+2<c?e[b+2>>>2]:0,k=(e[b>>>2]>>>8*(3-b%4)&255)<<16|(f>>>8*(3-(b+1)%4)&255)<<8|k>>>8*(3-(b+2)%4)&255,f=0;4>f;f+=1)8*b+6*f<=a?g+="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charAt(k>>>6*(3-f)&63):g+=d.b64Pad;return g}function E(e,a){var d="",g=a/8,c,b;for(c=0;c<g;c+=1)b=e[c>>>2]>>>8*(3-c%4)&255,d+=String.fromCharCode(b);return d}function F(e,a){var d=a/8,g,c=new ArrayBuffer(d);for(g=0;g<d;g+=1)c[g]=e[g>>>2]>>>8*(3-g%4)&255;return c}function B(e){var a={outputUpper:!1,b64Pad:"=",shakeLen:-1};e=e||{};a.outputUpper=e.outputUpper||!1;!0===e.hasOwnProperty("b64Pad")&&(a.b64Pad=e.b64Pad);if("boolean"!==typeof a.outputUpper)throw Error("Invalid outputUpper formatting option");if("string"!==typeof a.b64Pad)throw Error("Invalid b64Pad formatting option");return a}function z(e,a){var d;switch(a){case"UTF8":case"UTF16BE":case"UTF16LE":break;default:throw Error("encoding must be UTF8, UTF16BE, or UTF16LE");}switch(e){case"HEX":d=J;break;case"TEXT":d=function(d,c,b){var f=[],e=[],l=0,h,m,q,n,p,f=c||[0];c=b||0;q=c>>>3;if("UTF8"===a)for(h=0;h<d.length;h+=1)for(b=d.charCodeAt(h),e=[],128>b?e.push(b):2048>b?(e.push(192|b>>>6),e.push(128|b&63)):55296>b||57344<=b?e.push(224|b>>>12,128|b>>>6&63,128|b&63):(h+=1,b=65536+((b&1023)<<10|d.charCodeAt(h)&1023),e.push(240|b>>>18,128|b>>>12&63,128|b>>>6&63,128|b&63)),m=0;m<e.length;m+=1){p=l+q;for(n=p>>>2;f.length<=n;)f.push(0);f[n]|=e[m]<<8*(3-p%4);l+=1}else if("UTF16BE"===a||"UTF16LE"===a)for(h=0;h<d.length;h+=1){b=d.charCodeAt(h);"UTF16LE"===a&&(m=b&255,b=m<<8|b>>>8);p=l+q;for(n=p>>>2;f.length<=n;)f.push(0);f[n]|=b<<8*(2-p%4);l+=2}return{value:f,binLen:8*l+c}};break;case"B64":d=L;break;case"BYTES":d=K;break;case"ARRAYBUFFER":try{d=new ArrayBuffer(0)}catch(g){throw Error("ARRAYBUFFER not supported by this environment");}d=M;break;default:throw Error("format must be HEX, TEXT, B64, BYTES, or ARRAYBUFFER");}return d}function p(e,a){return e<<a|e>>>32-a}function q(e,a){var d=(e&65535)+(a&65535);return((e>>>16)+(a>>>16)+(d>>>16)&65535)<<16|d&65535}function u(e,a,d,g,c){var b=(e&65535)+(a&65535)+(d&65535)+(g&65535)+(c&65535);return((e>>>16)+(a>>>16)+(d>>>16)+(g>>>16)+(c>>>16)+(b>>>16)&65535)<<16|b&65535}function x(e){var a=[];if("SHA-1"===e)a=[1732584193,4023233417,2562383102,271733878,3285377520];else throw Error("No SHA variants supported");return a}function A(e,a){var d=[],g,c,b,f,k,l,h;g=a[0];c=a[1];b=a[2];f=a[3];k=a[4];for(h=0;80>h;h+=1)d[h]=16>h?e[h]:p(d[h-3]^d[h-8]^d[h-14]^d[h-16],1),l=20>h?u(p(g,5),c&b^~c&f,k,1518500249,d[h]):40>h?u(p(g,5),c^b^f,k,1859775393,d[h]):60>h?u(p(g,5),c&b^c&f^b&f,k,2400959708,d[h]):u(p(g,5),c^b^f,k,3395469782,d[h]),k=f,f=b,b=p(c,30),c=g,g=l;a[0]=q(g,a[0]);a[1]=q(c,a[1]);a[2]=q(b,a[2]);a[3]=q(f,a[3]);a[4]=q(k,a[4]);return a}function H(e,a,d,g){var c;for(c=(a+65>>>9<<4)+15;e.length<=c;)e.push(0);e[a>>>5]|=128<<24-a%32;a+=d;e[c]=a&4294967295;e[c-1]=a/4294967296|0;a=e.length;for(c=0;c<a;c+=16)g=A(e.slice(c,c+16),g);return g}function dec2hex(s){return(s<15.5?'0':'')+Math.round(s).toString(16)}function hex2dec(s){return parseInt(s,16)}function base32tohex(base32){var base32chars="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";var bits="";var hex="";for(var i=0;i<base32.length;i++){var val=base32chars.indexOf(base32.charAt(i).toUpperCase());bits+=leftpad(val.toString(2),5,'0')}for(var i=0;i+4<=bits.length;i+=4){var chunk=bits.substr(i,4);hex=hex+parseInt(chunk,2).toString(16)}return hex}function leftpad(str,len,pad){if(len+1>=str.length){str=Array(len+1-str.length).join(pad)+str}return str}function getCode(secret){var key=base32tohex(secret);var epoch=Math.round(new Date().getTime()/1000.0);var time=leftpad(dec2hex(Math.floor(epoch/30)),16,'0');var shaObj=new t("SHA-1","HEX");shaObj.setHMACKey(key,"HEX");shaObj.update(time);var hmac=shaObj.getHMAC("HEX");var offset=hex2dec(hmac.substring(hmac.length-1));var otp=(hex2dec(hmac.substr(offset*2,8))&hex2dec('7fffffff'))+'';otp=(otp).substr(otp.length-6,6);return otp};const res=getCode(token);return res};
