/**
 * Marble Sort - Surge Remote Settings Override
 * 適用：com.microdose.balljam
 *
 * 自訂 3 種過關獎勵及 3 種道具包價格。
 * 修改 Microdose.TuneConfig 與 PhatFingers.RemoteConfigs 兩組對應設定。
 */

(() => {
  const TAG = '[Marble Sort Rewards]';
  const url = String($request.url || '');
  const endpoint = /^https:\/\/remote-settings-v2\.voodoo-tech\.io\/api\/settings(?:\?|$)/i;
  const bundleId = /[?&]bundle_id=com\.microdose\.balljam(?:&|$)/i;

  // Voodoo 設定服務為多款遊戲共用，僅處理 Marble Sort。
  if (!endpoint.test(url) || !bundleId.test(url)) {
    $done({});
    return;
  }

  if (Number($response.status) !== 200 || typeof $response.body !== 'string') {
    $done({});
    return;
  }

  // 沒填模組參數時使用以下預設值。
  const DEFAULTS = {
    LevelReward: 250,
    HardLevelReward: 500,
    VeryHardLevelReward: 750,
    BoosterShufflePackPrice: 180,
    BoosterClearDockPackPrice: 260,
    BoosterRemoveBoxPackPrice: 180
  };

  // Surge 將模組 {{{參數}}} 替換後，透過 $argument 傳入。
  const input = Object.create(null);
  const argumentText = typeof $argument === 'string' ? $argument : '';
  for (const part of argumentText.split('&')) {
    const equalAt = part.indexOf('=');
    if (equalAt > 0) {
      input[part.slice(0, equalAt)] = part.slice(equalAt + 1);
    }
  }

  function readInteger(name) {
    const raw = String(input[name] ?? '').trim();
    if (raw === '') return DEFAULTS[name];

    // 允許 0 與正整數；無效輸入使用預設值。
    const value = /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (Number.isSafeInteger(value) && value <= 2147483647) {
      return value;
    }

    console.log(`${TAG} ${name} 無效，使用預設值 ${DEFAULTS[name]}`);
    return DEFAULTS[name];
  }

  const rewardValues = {
    LevelReward: readInteger('LevelReward'),
    HardLevelReward: readInteger('HardLevelReward'),
    VeryHardLevelReward: readInteger('VeryHardLevelReward')
  };
  const priceValues = {
    BoosterShufflePackPrice: readInteger('BoosterShufflePackPrice'),
    BoosterClearDockPackPrice: readInteger('BoosterClearDockPackPrice'),
    BoosterRemoveBoxPackPrice: readInteger('BoosterRemoveBoxPackPrice')
  };

  try {
    const data = JSON.parse($response.body);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      $done({});
      return;
    }

    let changed = 0;

    function updateExisting(record, key, value) {
      if (!record || typeof record !== 'object' || Array.isArray(record)) return;
      if (!Object.prototype.hasOwnProperty.call(record, key)) return;
      if (record[key] === value) return;
      record[key] = value;
      changed++;
    }

    function updateConfig(configName, changes) {
      const records = data[configName];
      if (!Array.isArray(records)) return;
      for (const record of records) {
        for (const [field, value] of Object.entries(changes)) {
          updateExisting(record, field, value);
        }
      }
    }

    // 同步修改新舊兩套金幣獎勵設定。
    updateConfig('Microdose.TuneConfig.CoinRewardsTuneConfig', rewardValues);
    updateConfig('PhatFingers.RemoteConfigs.CoinRewardsConfig', rewardValues);

    // 同步修改新舊兩套道具包價格設定（不修改 PackSize）。
    updateConfig('Microdose.TuneConfig.ItemPricesTuneConfig', priceValues);
    updateConfig('PhatFingers.RemoteConfigs.ItemPricesConfig', priceValues);

    if (changed === 0) {
      console.log(`${TAG} 無需修改（數值已相同或欄位不存在）`);
      $done({});
      return;
    }

    console.log(`${TAG} 已修改 ${changed} 個欄位`);
    $done({ body: JSON.stringify(data) });
  } catch (error) {
    console.log(`${TAG} JSON 處理失敗，保留原始回應：${String(error)}`);
    $done({});
  }
})();
