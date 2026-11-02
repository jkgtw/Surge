/**
 * Loop Sort - Surge Remote Settings Override
 * Target bundle: com.Garawell.LoopSort
 *
 * 可調整：三種過關金幣、四種道具價格（共 7 個模組參數）
 */

(() => {
  const TAG = '[Loop Sort Rewards]';
  const endpoint = /^https:\/\/remote-settings-v2\.voodoo-tech\.io\/api\/settings(?:\?|$)/i;
  const bundleId = /[?&]bundle_id=com\.Garawell\.LoopSort(?:&|$)/i;
  const url = String($request.url || '');

  // 避免影響其他遊戲及非正常回應
  if (!endpoint.test(url) || !bundleId.test(url)) return $done({});
  if (Number($response.status) !== 200 || typeof $response.body !== 'string') {
    return $done({});
  }

  // 只有這七個參數可從 Surge 模組介面修改；留空則使用預設值
  const DEFAULTS = {
    WinReward: 100,
    HardLevelReward: 300,
    SuperHardLevelReward: 500,
    UndoCost: 30,
    ShuffleCost: 30,
    ConveyorCapacityCost: 80,
    CapacityCost: 90
  };
  const FREE_AT_START = 99;

  // $argument 格式：WinReward=1000&HardLevelReward=3000&...
  const input = Object.create(null);
  const args = typeof $argument === 'string' ? $argument : '';
  for (const part of args.split('&')) {
    const pos = part.indexOf('=');
    if (pos > 0) input[part.slice(0, pos)] = part.slice(pos + 1);
  }

  const settings = {};
  for (const key of Object.keys(DEFAULTS)) {
    const raw = String(input[key] ?? '').trim();
    const n = /^\d+$/.test(raw) ? Number(raw) : NaN;
    settings[key] = Number.isSafeInteger(n) && n <= 2147483647
      ? n
      : DEFAULTS[key];
    if (raw !== '' && settings[key] === DEFAULTS[key] && raw !== String(DEFAULTS[key])) {
      console.log(`${TAG} ${key} 輸入無效時採預設值 ${DEFAULTS[key]}`);
    }
  }

  try {
    const body = JSON.parse($response.body);
    let changed = 0;

    // 不新增鍵，只改寫原回應中已有的設定
    function setExisting(obj, key, value) {
      if (!obj || typeof obj !== 'object' || !Object.prototype.hasOwnProperty.call(obj, key)) return;
      if (obj[key] !== value) {
        obj[key] = value;
        changed++;
      }
    }

    // ConstantsOverrideSheet.Data 是 JSON 字串，Value 需維持字串型別
    const rewards = {
      WinReward: String(settings.WinReward),
      HardLevelReward: String(settings.HardLevelReward),
      SuperHardLevelReward: String(settings.SuperHardLevelReward)
    };
    for (const sheet of body.ConstantsOverrideSheet || []) {
      if (!sheet || typeof sheet.Data !== 'string') continue;
      const records = JSON.parse(sheet.Data);
      if (!Array.isArray(records)) continue;
      const before = changed;
      for (const record of records) {
        if (record && Object.prototype.hasOwnProperty.call(rewards, record.Id)) {
          setExisting(record, 'Value', rewards[record.Id]);
        }
      }
      if (changed !== before) sheet.Data = JSON.stringify(records);
    }

    // BoosterConfig：僅修改三種道具價格
    for (const config of body.BoosterConfig || []) {
      setExisting(config, 'UndoCost', settings.UndoCost);
      setExisting(config, 'ShuffleCost', settings.ShuffleCost);
      setExisting(config, 'CapacityCost', settings.CapacityCost);
    }

    // BoostersOverrideSheet：四種價格可自訂
    const boosterPrices = {
      Undo: settings.UndoCost,
      Shuffle: settings.ShuffleCost,
      ConveyorCapacity: settings.ConveyorCapacityCost,
      Capacity: settings.CapacityCost
    };
    for (const sheet of body.BoostersOverrideSheet || []) {
      if (!sheet || typeof sheet.Data !== 'string') continue;
      const records = JSON.parse(sheet.Data);
      if (!Array.isArray(records)) continue;
      const before = changed;
      for (const record of records) {
        if (record && Object.prototype.hasOwnProperty.call(boosterPrices, record.Id)) {
          setExisting(record, 'Cost', boosterPrices[record.Id]);
          setExisting(record, 'FreeAtStart', FREE_AT_START);
        }
      }
      if (changed !== before) sheet.Data = JSON.stringify(records);
    }

    if (changed === 0) return $done({});
    console.log(`${TAG} 已修改 ${changed} 個欄位值（四種道具免費次數固定 ${FREE_AT_START}）`);
    $done({ body: JSON.stringify(body) });
  } catch (error) {
    console.log(`${TAG} 設定解析失敗，保留原始回應：${String(error)}`);
    $done({});
  }
})();
