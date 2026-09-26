// calculator.js
// All champion constants come from data/garen.json (see tools/update-data.js).

// Riot's per-level stat growth: stat * (n - 1) * (0.7025 + 0.0175 * (n - 1))
function levelGrowth(level) {
  const levelUps = level - 1;
  return levelUps * (0.7025 + 0.0175 * levelUps);
}

function calculateLevelBasedAD(garen, level) {
  return garen.baseAD + garen.adPerLevel * levelGrowth(level);
}

// Bonus attack speed (%) gained from levels
function calculateLevelBonusAS(garen, level) {
  return garen.asPerLevel * levelGrowth(level);
}

function calculateTotalAS(garen, totalBonusAS) {
  return garen.baseAS + (totalBonusAS / 100) * garen.asRatio;
}

// Only bonus attack speed from items and levels adds spins
function calculateSpinCount(garen, totalBonusAS) {
  const e = garen.judgment;
  return e.baseSpins + Math.floor(totalBonusAS / e.bonusASPerSpin);
}

// Judgment only gets a fraction of the bonus crit damage: 130% normally, 139% with Infinity Edge
function calculateCritSpinMultiplier(garen, critDamage) {
  return 1 + garen.judgment.critMod * (critDamage / 100 - 1);
}

// Order of application: % armor reduction (multiplicative), % armor pen, then lethality
function calculateEffectiveArmor(armor, reductions, pen, lethality) {
  if (armor <= 0) return armor;
  const reducedArmor = reductions.reduce((acc, r) => acc * (1 - r), armor);
  const penetratedArmor = reducedArmor * (1 - pen / 100);
  return Math.max(0, penetratedArmor - lethality);
}

function calculateDamageMultiplier(armor) {
  return armor >= 0 ? 100 / (100 + armor) : 2 - 100 / (100 - armor);
}

// Armor reductions active when spin number `spin` (1-based) lands
function getArmorReductions(garen, spin, { armorShred, targetIsChampion }) {
  const reductions = [];
  if (!targetIsChampion) return reductions;

  if (armorShred) {
    const stacks = Math.min(spin - 1, armorShred.maxStacks);
    if (stacks > 0) reductions.push((stacks * armorShred.perStack) / 100);
  }

  if (spin > garen.judgment.hitsToShred) {
    reductions.push(garen.judgment.shredAmount);
  }
  return reductions;
}

function calculateJudgment(garen, options) {
  const { eRank, totalAD, spins, critChance, critDamage, armor, lethality, pen } = options;
  const e = garen.judgment;

  const rawDamagePerSpin = e.baseDamagePerSpin[eRank - 1] + e.adRatioPerSpin[eRank - 1] * totalAD;
  const critMultiplier = calculateCritSpinMultiplier(garen, critDamage);
  const expectedCritMultiplier = 1 + (critChance / 100) * (critMultiplier - 1);
  const nearestMultiplier = 1 + e.nearestEnemyBonus;

  const spinDamage = [];
  const spinDetails = [];
  for (let spin = 1; spin <= spins; spin++) {
    const reductions = getArmorReductions(garen, spin, options);
    const finalArmor = calculateEffectiveArmor(armor, reductions, pen, lethality);
    const damage = rawDamagePerSpin * calculateDamageMultiplier(finalArmor);
    spinDamage.push(damage);
    spinDetails.push({
      spin,
      damage,
      armor: finalArmor,
      judgmentShred: options.targetIsChampion && armor > 0 && spin > e.hitsToShred,
    });
  }

  const firstSpin = spinDamage[0];
  const lastSpin = spinDamage[spinDamage.length - 1];
  const totalDamage = spinDamage.reduce((sum, dmg) => sum + dmg, 0) * expectedCritMultiplier;

  return {
    critMultiplier,
    spinDamage,
    spinDetails,
    firstSpin,
    firstCritSpin: firstSpin * critMultiplier,
    lastSpin,
    lastCritSpin: lastSpin * critMultiplier,
    totalDamage,
    nearest: {
      firstSpin: firstSpin * nearestMultiplier,
      firstCritSpin: firstSpin * critMultiplier * nearestMultiplier,
      lastSpin: lastSpin * nearestMultiplier,
      lastCritSpin: lastSpin * critMultiplier * nearestMultiplier,
      totalDamage: totalDamage * nearestMultiplier,
    },
  };
}
