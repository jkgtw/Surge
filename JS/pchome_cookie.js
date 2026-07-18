/*
 * Surge - PChome Cookie Capture
 *
 * 攔截：
 * https://ecapi.pchome.com.tw/fsapi/marketing/signingift/v1/activity
 * https://ecapi.pchome.com.tw/fsapi/marketing/signingift/v1/signin
 *
 * 功能：
 * 1. 擷取並儲存 Cookie
 * 2. 擷取並儲存 User-Agent
 * 3. 輸出簡要 Surge 日誌
 * 4. 無論是否取得 Cookie，都顯示通知方便排查
 * 5. 支援一般字串與 full-header-mode 的陣列 header
 */

const KEY_COOKIE = 'pchome.signin.cookie';
const KEY_UA = 'pchome.signin.ua';
const KEY_LAST_CAPTURE = 'pchome.signin.last_capture';

function nowText() {
  return new Date().toLocaleString('zh-TW', {
    hour12: false,
  });
}

function log(...args) {
  const text = args
    .filter(value => value !== undefined && value !== null && value !== '')
    .join(' ');

  console.log(`[PChome Cookie][${nowText()}] ${text}`);
}

function notify(title, subtitle = '', body = '') {
  if (typeof $notification !== 'undefined') {
    $notification.post(title, subtitle, body);
  }
}

/**
 * 取得指定 header 的所有值。
 *
 * 一般模式可能是：
 * {
 *   Cookie: "a=1; b=2"
 * }
 *
 * full-header-mode 可能是：
 * {
 *   Cookie: ["a=1", "b=2"]
 * }
 */
function getHeaderValues(headers, targetName) {
  if (!headers || typeof headers !== 'object') {
    return [];
  }

  const target = String(targetName).toLowerCase();
  const values = [];

  for (const [name, value] of Object.entries(headers)) {
    if (String(name).toLowerCase() !== target) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null && String(item).trim()) {
          values.push(String(item).trim());
        }
      }
    } else if (value !== undefined && value !== null && String(value).trim()) {
      values.push(String(value).trim());
    }
  }

  return values;
}

function getFirstHeader(headers, targetName) {
  const values = getHeaderValues(headers, targetName);
  return values.length ? values[0] : '';
}

/**
 * 整理多組 Cookie header。
 *
 * 同名 Cookie 重複出現時保留後面取得的值，
 * 並避免在日誌或通知中顯示 Cookie 的實際內容。
 */
function normalizeCookieHeaders(cookieHeaders) {
  const cookieMap = new Map();

  for (const headerValue of cookieHeaders) {
    const segments = String(headerValue)
      .split(';')
      .map(item => item.trim())
      .filter(Boolean);

    for (const segment of segments) {
      const separatorIndex = segment.indexOf('=');

      if (separatorIndex <= 0) {
        continue;
      }

      const name = segment.slice(0, separatorIndex).trim();
      const value = segment.slice(separatorIndex + 1).trim();

      if (!name) {
        continue;
      }

      cookieMap.set(name, value);
    }
  }

  return Array.from(cookieMap.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function getEndpointName(url) {
  try {
    const cleanUrl = String(url || '').split('?')[0];

    if (cleanUrl.endsWith('/activity')) {
      return 'activity';
    }

    if (cleanUrl.endsWith('/signin')) {
      return 'signin';
    }
  } catch (error) {
    // 忽略 URL 分析錯誤
  }

  return 'unknown';
}

try {
  const request = typeof $request !== 'undefined' ? $request : {};
  const headers = request.headers || {};
  const url = String(request.url || '');
  const method = String(request.method || 'UNKNOWN').toUpperCase();
  const endpoint = getEndpointName(url);

  log('腳本已觸發：', method, endpoint, url);

  const cookieHeaders = getHeaderValues(headers, 'Cookie');
  const cookie = normalizeCookieHeaders(cookieHeaders);
  const userAgent = getFirstHeader(headers, 'User-Agent');

  if (!cookie) {
    const oldCookie = $persistentStore.read(KEY_COOKIE);

    log(
      '此次請求未找到 Cookie；',
      oldCookie ? '已保留先前儲存的 Cookie' : '目前也沒有舊 Cookie'
    );

    /*
     * 這個通知很重要：
     * 可以區分「腳本有被觸發但請求沒帶 Cookie」
     * 與「模組根本沒有攔截到請求」。
     */
    notify(
      '🧧 PChome 請求已攔截',
      '此次請求沒有 Cookie',
      oldCookie
        ? `${endpoint} 請求未攜帶 Cookie，已保留之前儲存的 Cookie。`
        : `${endpoint} 請求未攜帶 Cookie，請嘗試手動簽到一次。`
    );

    $done({});
  } else {
    const oldCookie = $persistentStore.read(KEY_COOKIE) || '';
    const cookieChanged = oldCookie !== cookie;

    const cookieSaved = $persistentStore.write(cookie, KEY_COOKIE);

    let uaSaved = true;

    if (userAgent) {
      uaSaved = $persistentStore.write(userAgent, KEY_UA);
    }

    const capturedAt = new Date().toISOString();
    const timeSaved = $persistentStore.write(
      capturedAt,
      KEY_LAST_CAPTURE
    );

    const cookieNames = cookie
      .split(';')
      .map(item => {
        const segment = item.trim();
        const separatorIndex = segment.indexOf('=');

        return separatorIndex > 0
          ? segment.slice(0, separatorIndex).trim()
          : '';
      })
      .filter(Boolean);

    const uniqueCookieNames = Array.from(new Set(cookieNames));

    log(
      cookieChanged ? 'Cookie 已更新：' : 'Cookie 已重新取得：',
      `來源=${endpoint}`,
      `數量=${uniqueCookieNames.length}`,
      `名稱=${uniqueCookieNames.join(', ') || '未識別'}`
    );

    if (userAgent) {
      log('User-Agent 已取得：', userAgent);
    } else {
      log('此次請求未找到 User-Agent，保留原有紀錄');
    }

    if (!cookieSaved || !uaSaved || !timeSaved) {
      log(
        '警告：持久化儲存可能失敗',
        `cookie=${cookieSaved}`,
        `ua=${uaSaved}`,
        `time=${timeSaved}`
      );

      notify(
        '⚠️ PChome Cookie 儲存異常',
        `已攔截 ${endpoint} 請求`,
        '已讀取 Cookie，但寫入 Surge 持久化儲存時可能發生問題，請查看腳本日誌。'
      );
    } else {
      notify(
        cookieChanged
          ? '🧧 PChome 簽到 Cookie 已更新'
          : '🧧 PChome 簽到 Cookie 已取得',
        `來源：${endpoint}`,
        uniqueCookieNames.length
          ? `已儲存 ${uniqueCookieNames.length} 個 Cookie：${uniqueCookieNames.join(', ')}`
          : 'Cookie 已成功儲存，可執行每日自動簽到。'
      );
    }

    $done({});
  }
} catch (error) {
  const message = String(
    error && error.message
      ? error.message
      : error
  );

  log('Cookie 擷取失敗：', message);

  notify(
    '❌ PChome Cookie 擷取失敗',
    '',
    message
  );

  $done({});
}
