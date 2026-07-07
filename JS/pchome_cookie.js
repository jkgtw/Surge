/*
 * Surge - PChome Cookie Capture
 * Match:
 *   https://ecapi.pchome.com.tw/fsapi/marketing/signingift/v1/activity
 *   https://ecapi.pchome.com.tw/fsapi/marketing/signingift/v1/signin
 */

const KEY_COOKIE = 'pchome.signin.cookie';
const KEY_UA = 'pchome.signin.ua';
const KEY_LAST_CAPTURE = 'pchome.signin.last_capture';

function nowText() {
  return new Date().toLocaleString('zh-TW', { hour12: false });
}

function log(...args) {
  console.log(`[PChome Cookie][${nowText()}] ${args.filter(Boolean).join(' ')}`);
}

function getHeader(headers, name) {
  if (!headers) return '';
  const target = name.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === target) return headers[k];
  }
  return '';
}

function notify(title, subtitle, body) {
  if (typeof $notification !== 'undefined') {
    $notification.post(title, subtitle || '', body || '');
  }
}

try {
  const headers = $request.headers || {};
  const url = $request.url || '';
  const cookie = getHeader(headers, 'Cookie');
  const ua = getHeader(headers, 'User-Agent');

  log('觸發擷取：', url);

  if (cookie) {
    $persistentStore.write(cookie, KEY_COOKIE);
    if (ua) $persistentStore.write(ua, KEY_UA);
    $persistentStore.write(new Date().toISOString(), KEY_LAST_CAPTURE);

    const cookieNames = cookie
      .split(';')
      .map(s => s.trim().split('=')[0])
      .filter(Boolean)
      .join(', ');

    log('Cookie 已更新：', cookieNames || '已儲存 Cookie');
    if (ua) log('User-Agent 已更新：', ua);

    notify('🧧 PChome 簽到 Cookie 已更新', '可執行每日自動簽到', cookieNames || '已儲存 Cookie');
  } else {
    log('未找到 Cookie，略過儲存');
  }
} catch (e) {
  const msg = String(e && e.message ? e.message : e);
  log('擷取失敗：', msg);
  notify('🧧 PChome Cookie 擷取失敗', '', msg);
}

$done({});