/**
 * Hole.io — Surge HTTP Response Script
 * Bundle ID: com.nguyenvh.holeio
 *
 * 只修改五個自訂參數：
 * - LevelReward (過關金幣；預設 600)
 * - BiggerPrice / SandglassPrice (道具價格；預設各 300)
 * - BiggerQuantity / SandglassQuantity (每次購買數量；預設各 6)
 */

(() => {
  const TAG = '[Hole.io Rewards]';
  const url = String($request.url || '');
  const endpoint = /^https:\/\/remote-settings-v2\.voodoo-tech\.io\/api\/settings(?:\?|$)/i;
  const bundleId = /[?&]bundle_id=com\.nguyenvh\.holeio(?:&|$)/i;

  // Voodoo 的 API 由多款遊戲共用，僅處理 Hole.io。
  if (!endpoint.test(url) || !bundleId.test(url)) return $done({});
  if (Number($response.status) !== 200 || typeof $response.body !== 'string') {
    return $done({});
  }

  const DEFAULTS = {
    LevelReward: 2000,
    BiggerPrice: 300,
    SandglassPrice: 300,
    BiggerQuantity: 10,
    SandglassQuantity: 10
  };

  // Surge 模組 argument="key=value&key=value..."
  const input = Object.create(null);
  const rawArguments = typeof $argument === 'string' ? $argument : '';
  for (const part of rawArguments.split('&')) {
    const pos = part.indexOf('=');
    if (pos > 0) input[part.slice(0, pos)] = part.slice(pos + 1);
  }

  function getInteger(name) {
    const raw = String(input[name] ?? '').trim();
    if (raw === '') return DEFAULTS[name];
    const value = /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (Number.isSafeInteger(value) && value <= 2147483647) return value;
    console.log(`${TAG} ${name}=${raw} 無效，使用預設值 ${DEFAULTS[name]}`);
    return DEFAULTS[name];
  }

  const target = {};
  for (const name of Object.keys(DEFAULTS)) target[name] = getInteger(name);

  try {
    const data = JSON.parse($response.body);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return $done({});
    }

    let changed = 0;
    const hasOwn = (obj, key) =>
      obj !== null && typeof obj === 'object' &&
      Object.prototype.hasOwnProperty.call(obj, key);

    function setExisting(obj, key, value) {
      if (!hasOwn(obj, key) || obj[key] === value) return;
      obj[key] = value;
      changed++;
    }

    // 維持 JSON 字串欄位的原有型別，不新增不存在的鍵。
    function editJsonString(parent, key, edit) {
      if (!hasOwn(parent, key) || typeof parent[key] !== 'string') return;
      try {
        const nested = JSON.parse(parent[key]);
        const before = changed;
        edit(nested);
        if (changed !== before) parent[key] = JSON.stringify(nested);
      } catch (error) {
        console.log(`${TAG} ${key} 解析失敗，略過：${String(error)}`);
      }
    }

    const pricesById = {
      booster_bigger: target.BiggerPrice,
      booster_sandglass: target.SandglassPrice
    };
    const quantitiesById = {
      booster_bigger: target.BiggerQuantity,
      booster_sandglass: target.SandglassQuantity
    };
    const pricesByName = {
      Bigger: target.BiggerPrice,
      Sandglass: target.SandglassPrice
    };
    const quantitiesByName = {
      Bigger: target.BiggerQuantity,
      Sandglass: target.SandglassQuantity
    };

    if (Array.isArray(data.EconomyConfig)) {
      for (const economy of data.EconomyConfig) {
        // 過關獎勵：standard_end_level_reward / Coins
        editJsonString(economy, 'LevelCompleteRewards', (entries) => {
          if (!Array.isArray(entries)) return;
          for (const entry of entries) {
            if (!entry || entry.id !== 'standard_end_level_reward' ||
                !Array.isArray(entry.rewards)) continue;
            for (const reward of entry.rewards) {
              if (reward && reward.type === 'Coins') {
                setExisting(reward, 'amount', target.LevelReward);
              }
            }
          }
        });

        // 商店中 Bigger、Sandglass 的價格。
        editJsonString(economy, 'ShopPayments', (shop) => {
          if (!shop || !Array.isArray(shop.boosters)) return;
          for (const booster of shop.boosters) {
            if (booster && booster.type === 'Coins' && hasOwn(pricesById, booster.id)) {
              setExisting(booster, 'amount', pricesById[booster.id]);
            }
          }
        });

        // 商店中每次購買可得到的 Bigger、Sandglass 數量。
        editJsonString(economy, 'ShopRewards', (shop) => {
          if (!shop || !Array.isArray(shop.boosters)) return;
          for (const booster of shop.boosters) {
            if (booster && hasOwn(quantitiesById, booster.id)) {
              setExisting(booster, 'amount', quantitiesById[booster.id]);
            }
          }
        });

        // 遊戲內開局前購買道具的價格。
        editJsonString(economy, 'BuyPregameBoosterCost', (entries) => {
          if (!Array.isArray(entries)) return;
          for (const entry of entries) {
            if (!entry || !hasOwn(pricesByName, entry.BoosterType) ||
                !Array.isArray(entry.cost)) continue;
            for (const cost of entry.cost) {
              if (cost && cost.type === 'Coins') {
                setExisting(cost, 'amount', pricesByName[entry.BoosterType]);
              }
            }
          }
        });
      }
    }

    // 開局前道具的定價與每次購買數量（不修改 PreGameInitialQuantity）。
    if (Array.isArray(data.BoostersConfig)) {
      for (const config of data.BoostersConfig) {
        if (!config || !Array.isArray(config.PregameBoosters)) continue;
        for (let i = 0; i < config.PregameBoosters.length; i++) {
          const name = config.PregameBoosters[i];
          if (!hasOwn(pricesByName, name)) continue;

          if (Array.isArray(config.PregamePrice) &&
              i < config.PregamePrice.length &&
              config.PregamePrice[i] !== pricesByName[name]) {
            config.PregamePrice[i] = pricesByName[name];
            changed++;
          }

          if (Array.isArray(config.PregameQuantity) &&
              i < config.PregameQuantity.length &&
              config.PregameQuantity[i] !== quantitiesByName[name]) {
            config.PregameQuantity[i] = quantitiesByName[name];
            changed++;
          }
        }
      }
    }

    if (changed === 0) {
      console.log(`${TAG} 無需修改（數值已相同或欄位不存在）`);
      return $done({});
    }

    console.log(
      `${TAG} 已修改 ${changed} 個值；` +
      `獎勵=${target.LevelReward}；` +
      `Bigger=${target.BiggerPrice}/${target.BiggerQuantity}；` +
      `Sandglass=${target.SandglassPrice}/${target.SandglassQuantity}`
    );
    return $done({ body: JSON.stringify(data) });
  } catch (error) {
    console.log(`${TAG} JSON 解析失敗，保留原始回應：${String(error)}`);
    return $done({});
  }
})();
