/*
 * Surge - PChome Daily Signin
 * Flow:
 *   0. If cron minute is a range/list, pick one random minute per day and run only at that minute.
 *   1. Read stored Cookie captured from PChome App request.
 *   2. GET current activity.
 *   3. Stop early if activity is BUDGETS_FULL.
 *   4. Pick today's gift_id by activity start date + elapsed days.
 *   5. POST signin with { activity_id, gift_id }.
 *
 * Known response:
 *   Activity current_activity_status = BUDGETS_FULL  => 簽到名額已滿
 *   Signin {"status":"success"}                  => 簽到成功
 *   Signin {"status":"400-004"}                  => 今日已簽到
 */

const ACTIVITY_URL = 'https://ecapi.pchome.com.tw/fsapi/marketing/signingift/v1/activity';
const SIGNIN_URL = 'https://ecapi.pchome.com.tw/fsapi/marketing/signingift/v1/signin';

const KEY_COOKIE = 'pchome.signin.cookie';
const KEY_UA = 'pchome.signin.ua';
const KEY_LAST_CAPTURE = 'pchome.signin.last_capture';
const KEY_LAST_RESULT = 'pchome.signin.last_result';
const KEY_RANDOM_PLAN = 'pchome.signin.random_plan';
const KEY_RANDOM_LAST_RUN = 'pchome.signin.random_last_run';

const DEFAULT_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) PChome_APP_ios_4.16.5';

const ACTIVITY_STATUS_TEXT = {
  IN_PROGRESS: '活動進行中',
  BUDGETS_FULL: '簽到名額已滿',
};

function done() {
  $done();
}

function nowText() {
  return new Date().toLocaleString('zh-TW', { hour12: false });
}

function log(...args) {
  console.log(`[PChome Signin][${nowText()}] ${args.filter(v => v !== undefined && v !== null && v !== '').join(' ')}`);
}

function notify(title, subtitle, body) {
  if (typeof $notification !== 'undefined') {
    $notification.post(title, subtitle || '', body || '');
  }
}

function httpGet(options) {
  return new Promise((resolve, reject) => {
    $httpClient.get(options, (err, resp, data) => {
      if (err) return reject(err);
      resolve({ resp: resp || {}, data });
    });
  });
}

function httpPost(options) {
  return new Promise((resolve, reject) => {
    $httpClient.post(options, (err, resp, data) => {
      if (err) return reject(err);
      resolve({ resp: resp || {}, data });
    });
  });
}

function baseHeaders(cookie, ua) {
  return {
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    'Origin': 'https://24h.pchome.com.tw',
    'Referer': 'https://24h.pchome.com.tw/',
    'User-Agent': ua || DEFAULT_UA,
    'Accept-Language': 'zh-TW,zh-Hant;q=0.9',
    'Cookie': cookie,
  };
}

function parseJson(text, label) {
  try {
    return JSON.parse(text || '{}');
  } catch (e) {
    throw new Error(`${label} JSON 解析失敗：${String(text || '').slice(0, 200)}`);
  }
}

function httpStatus(resp) {
  return Number(resp && (resp.status || resp.statusCode)) || 0;
}

function briefJson(obj, len = 300) {
  try {
    return JSON.stringify(obj).slice(0, len);
  } catch (e) {
    return String(obj).slice(0, len);
  }
}

function statusText(obj) {
  if (!obj || typeof obj !== 'object') return '';
  return obj.status || obj.message || obj.msg || obj.code || briefJson(obj, 120);
}

function normalizeActivity(activity) {
  if (!activity || !activity.current) throw new Error('找不到 current activity');

  const current = activity.current;
  const currentStatus = current.current_activity_status || '';
  const gifts = Array.isArray(current.activity_duration) ? current.activity_duration : [];

  return {
    activity_id: current.activity_id || '',
    status: currentStatus,
    status_text: ACTIVITY_STATUS_TEXT[currentStatus] || currentStatus || '未知狀態',
    start: current.activity_star_date || current.activity_start_date || '',
    end: current.activity_end_date || '',
    gifts,
  };
}

function todayGift(activityInfo) {
  if (!activityInfo.activity_id) throw new Error('找不到 activity_id');

  if (activityInfo.status === 'BUDGETS_FULL') {
    const err = new Error('簽到名額已滿');
    err.code = 'BUDGETS_FULL';
    throw err;
  }

  if (activityInfo.status && activityInfo.status !== 'IN_PROGRESS') {
    throw new Error(`活動狀態不是 IN_PROGRESS：${activityInfo.status}`);
  }

  const startMs = Date.parse(activityInfo.start || '');
  const endMs = Date.parse(activityInfo.end || '');
  const nowMs = Date.now();

  if (!Number.isFinite(startMs)) throw new Error('活動開始時間格式異常');
  if (Number.isFinite(endMs) && nowMs > endMs) throw new Error('目前活動已結束');
  if (nowMs < startMs) throw new Error('目前活動尚未開始');

  const day = Math.floor((nowMs - startMs) / 86400000) + 1;
  const gift = activityInfo.gifts.find(x => Number(x.day) === day) || activityInfo.gifts[day - 1];

  if (!gift || !gift.gift_id) {
    throw new Error(`找不到第 ${day} 天 gift_id`);
  }

  return {
    activity_id: activityInfo.activity_id,
    gift_id: gift.gift_id,
    day,
    p_coin: gift.p_coin || '',
    start: activityInfo.start,
    end: activityInfo.end,
    activity_status: activityInfo.status,
  };
}

function writeResult(record) {
  $persistentStore.write(JSON.stringify(record), KEY_LAST_RESULT);
}


function getCronExpression() {
  try {
    if (typeof $cronexp !== 'undefined' && $cronexp) return String($cronexp).trim();
  } catch (e) {}
  return '';
}

function localDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseMinuteField(field) {
  const text = String(field || '').trim();
  if (!text || text === '*') return null;

  const minutes = new Set();

  function addMinute(n) {
    const v = Number(n);
    if (Number.isInteger(v) && v >= 0 && v <= 59) minutes.add(v);
  }

  for (const partRaw of text.split(',')) {
    const part = partRaw.trim();
    if (!part) continue;

    if (/^\d+$/.test(part)) {
      addMinute(part);
      continue;
    }

    const rangeMatch = part.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      let start = Number(rangeMatch[1]);
      let end = Number(rangeMatch[2]);
      if (Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end <= 59 && start <= end) {
        for (let i = start; i <= end; i += 1) minutes.add(i);
      }
      continue;
    }

    const stepMatch = part.match(/^\*\/(\d+)$/);
    if (stepMatch) {
      const step = Number(stepMatch[1]);
      if (Number.isInteger(step) && step > 0) {
        for (let i = 0; i <= 59; i += step) minutes.add(i);
      }
    }
  }

  return minutes.size ? Array.from(minutes).sort((a, b) => a - b) : null;
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function readJsonStore(key) {
  try {
    const raw = $persistentStore.read(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function writeJsonStore(key, value) {
  $persistentStore.write(JSON.stringify(value), key);
}

function randomCronGate() {
  const cron = getCronExpression();
  if (!cron) {
    log('未取得 $cronexp，略過隨機排程判斷，直接執行');
    return true;
  }

  const fields = cron.split(/\s+/).filter(Boolean);
  const minuteField = fields[0] || '';
  const hourField = fields[1] || '';
  const candidates = parseMinuteField(minuteField);

  if (!candidates || candidates.length <= 1) {
    log('cron 為單一觸發時間，直接執行：', cron);
    return true;
  }

  const now = new Date();
  const dateKey = localDateKey(now);
  const planKey = `${dateKey}|${minuteField}|${hourField}`;
  const currentMinute = now.getMinutes();
  const currentHour = now.getHours();

  let plan = readJsonStore(KEY_RANDOM_PLAN);
  if (!plan || plan.key !== planKey || !candidates.includes(Number(plan.minute))) {
    plan = {
      key: planKey,
      date: dateKey,
      cron,
      minute_field: minuteField,
      hour_field: hourField,
      minute: pickRandom(candidates),
      created_at: now.toISOString(),
    };
    writeJsonStore(KEY_RANDOM_PLAN, plan);
    log('建立今日隨機簽到時間：', `${String(currentHour).padStart(2, '0')}:${String(plan.minute).padStart(2, '0')}`, `候選分鐘=${candidates.join(',')}`);
  } else {
    log('今日隨機簽到時間：', `${String(currentHour).padStart(2, '0')}:${String(plan.minute).padStart(2, '0')}`);
  }

  const lastRun = readJsonStore(KEY_RANDOM_LAST_RUN);
  if (lastRun && lastRun.key === planKey && lastRun.done) {
    log('今日此 cron 視窗已執行過，略過：', lastRun.executed_at || '');
    return false;
  }

  const targetMinute = Number(plan.minute);
  if (currentMinute < targetMinute && candidates.includes(currentMinute)) {
    log('尚未到今日隨機分鐘，略過本次觸發：', `目前=${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`, `目標=${String(currentHour).padStart(2, '0')}:${String(targetMinute).padStart(2, '0')}`);
    return false;
  }

  if (currentMinute > targetMinute && candidates.includes(currentMinute)) {
    log('今日隨機分鐘已過但尚未執行，改在本次補執行：', `目前分鐘=${currentMinute}`, `目標分鐘=${targetMinute}`);
  } else {
    log('到達今日隨機分鐘，開始執行：', `分鐘=${targetMinute}`);
  }

  writeJsonStore(KEY_RANDOM_LAST_RUN, {
    key: planKey,
    done: true,
    target_minute: targetMinute,
    executed_minute: currentMinute,
    executed_at: now.toISOString(),
  });
  return true;
}

(async () => {
  const startedAt = new Date();
  log('開始執行每日簽到');

  if (!randomCronGate()) {
    return done();
  }

  const cookie = $persistentStore.read(KEY_COOKIE);
  const ua = $persistentStore.read(KEY_UA) || DEFAULT_UA;
  const lastCapture = $persistentStore.read(KEY_LAST_CAPTURE) || '無紀錄';

  if (!cookie) {
    const msg = '尚未擷取 Cookie，請先開啟 PChome App 的每日簽到頁，或手動簽到一次讓 Surge 擷取 Cookie。';
    log('停止：', msg);
    notify('🧧 PChome 每日簽到失敗', '尚未擷取 Cookie', msg);
    return done();
  }

  log('已讀取 Cookie；上次擷取時間：', lastCapture);

  const headers = baseHeaders(cookie, ua);

  try {
    log('取得活動資訊：', ACTIVITY_URL);
    const activityRes = await httpGet({
      url: ACTIVITY_URL,
      headers,
      timeout: 10,
      'auto-cookie': false,
    });

    const activityHttpStatus = httpStatus(activityRes.resp);
    log('活動資訊 HTTP 狀態：', activityHttpStatus);

    if (activityHttpStatus < 200 || activityHttpStatus >= 300) {
      throw new Error(`活動資訊 HTTP ${activityHttpStatus}：${String(activityRes.data || '').slice(0, 200)}`);
    }

    const activity = parseJson(activityRes.data, '活動資訊');
    const activityInfo = normalizeActivity(activity);

    log('活動狀態：', activityInfo.status || '空', `(${activityInfo.status_text})`);
    log('活動 ID：', activityInfo.activity_id);
    log('活動期間：', `${activityInfo.start} ~ ${activityInfo.end}`);
    log('活動獎勵天數：', activityInfo.gifts.length);

    if (activityInfo.status === 'BUDGETS_FULL') {
      const record = {
        time: startedAt.toISOString(),
        activity_id: activityInfo.activity_id,
        activity_status: activityInfo.status,
        result: 'BUDGETS_FULL',
        message: '簽到名額已滿，未送出 signin 請求',
      };
      writeResult(record);
      log('簽到名額已滿，停止送出 signin 請求');
      notify('🧧 PChome 每日簽到已額滿', 'BUDGETS_FULL', `activity_id: ${activityInfo.activity_id}`);
      return done();
    }

    const gift = todayGift(activityInfo);
    log('今日簽到內容：', `第 ${gift.day} 天`, `gift_id=${gift.gift_id}`, gift.p_coin ? `p_coin=${gift.p_coin}` : '');

    const bodyObj = {
      activity_id: gift.activity_id,
      gift_id: gift.gift_id,
    };

    log('送出簽到請求：', briefJson(bodyObj));
    const signinRes = await httpPost({
      url: SIGNIN_URL,
      headers,
      body: JSON.stringify(bodyObj),
      timeout: 10,
      'auto-cookie': false,
    });

    const signinHttpStatus = httpStatus(signinRes.resp);
    const signinBody = parseJson(signinRes.data, '簽到結果');
    const result = statusText(signinBody);

    log('簽到 HTTP 狀態：', signinHttpStatus);
    log('簽到回傳：', briefJson(signinBody));

    const record = {
      time: startedAt.toISOString(),
      http_status: signinHttpStatus,
      activity_id: gift.activity_id,
      activity_status: gift.activity_status,
      gift_id: gift.gift_id,
      day: gift.day,
      p_coin: gift.p_coin,
      result: signinBody,
    };
    writeResult(record);

    if (signinHttpStatus >= 200 && signinHttpStatus < 300 && String(result).toLowerCase() === 'success') {
      log('簽到成功');
      notify('🧧 PChome 每日簽到成功', `第 ${gift.day} 天${gift.p_coin ? `｜${gift.p_coin} P幣` : ''}`, `activity_id: ${gift.activity_id}`);
    } else if (String(result) === '400-004') {
      log('今日已簽到，視為完成');
      notify('🧧 PChome 今日已簽到', '400-004', `第 ${gift.day} 天｜activity_id: ${gift.activity_id}`);
    } else {
      log('簽到完成但狀態需確認：', result);
      notify('🧧 PChome 每日簽到完成但狀態需確認', `HTTP ${signinHttpStatus}｜${result}`, briefJson(signinBody));
    }
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    const code = e && e.code ? String(e.code) : '';
    log('執行失敗：', code, msg);
    writeResult({
      time: startedAt.toISOString(),
      result: 'ERROR',
      code,
      message: msg,
    });
    notify('🧧 PChome 每日簽到失敗', code, msg);
  } finally {
    log('執行結束');
    done();
  }
})();