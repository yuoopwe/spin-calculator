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

// Armor reductions active when spin number `spin` (1-based) lands.
// `priorCleaverStacks` counts Black Cleaver stacks applied before Judgment (e.g. by Q).
function getArmorReductions(garen, spin, { armorShred, targetIsChampion, priorCleaverStacks = 0 }) {
  const reductions = [];
  if (!targetIsChampion) return reductions;

  if (armorShred) {
    const stacks = Math.min(priorCleaverStacks + spin - 1, armorShred.maxStacks);
    if (stacks > 0) reductions.push((stacks * armorShred.perStack) / 100);
  }

  if (spin > garen.judgment.hitsToShred) {
    reductions.push(garen.judgment.shredAmount);
  }
  return reductions;
}

function calculateJudgment(garen, options) {
  const { eRank, totalAD, spins, critChance, critDamage, armor, lethality, pen, damageMultiplier = 1 } = options;
  const e = garen.judgment;

  const rawDamagePerSpin =
    (e.baseDamagePerSpin[eRank - 1] + e.adRatioPerSpin[eRank - 1] * totalAD) * damageMultiplier;
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

// Decisive Strike: an empowered basic attack. The attack part crits normally; the bonus part never crits.
function calculateDecisiveStrike(garen, options) {
  const { qRank, totalAD, critChance, critDamage, armorMultiplier, attackMultiplier, bonusMultiplier } = options;
  const q = garen.decisiveStrike;
  const expectedCritMultiplier = 1 + (critChance / 100) * (critDamage / 100 - 1);

  const attack = totalAD * expectedCritMultiplier * attackMultiplier * armorMultiplier;
  const bonus = (q.bonusDamage[qRank - 1] + q.bonusADRatio * totalAD) * bonusMultiplier * armorMultiplier;
  return { attack, bonus, total: attack + bonus };
}

// Demacian Justice: true damage, so armor doesn't apply
function calculateDemacianJustice(garen, { rRank, maxHealth, currentHealth, damageMultiplier, cinderbloomMultiplier }) {
  const r = garen.demacianJustice;
  const missingHealth = Math.max(0, maxHealth - currentHealth);
  return (r.baseDamage[rRank - 1] + r.missingHealthRatio[rRank - 1] * missingHealth) * damageMultiplier * cinderbloomMultiplier;
}

// Cinderbloom crits magic and true damage; its 20% scales with bonus crit damage (26% with Infinity Edge)
function calculateCinderbloomMultiplier(garen, modifiers, { enabled, critDamage, currentHealth, maxHealth }) {
  const { healthThreshold, bonus } = modifiers.cinderbloom;
  if (!enabled || currentHealth >= (maxHealth * healthThreshold) / 100) return 1;
  const bonusCritDamage = (critDamage - garen.critDamage) / 100;
  return 1 + (bonus / 100) * (1 + bonusCritDamage);
}

const COMBO_ORDERS = {
  e: ["E"],
  qe: ["Q", "E"],
  eq: ["E", "Q"],
};

// `bonuses` holds percentages: lastStand, giantSlayer, shojin, plus axiom / cinderbloom flags.
// Damage-dealt modifiers add together (since V26.09).
function calculateCombo(garen, modifiers, options) {
  const { order, useR, qRank, rRank, bonuses, maxHealth, startHealthPercent, critDamage } = options;
  const { armor, pen, lethality, armorShred, targetIsChampion, spins } = options;

  const sharedBonus = bonuses.lastStand + bonuses.giantSlayer;
  const attackMultiplier = 1 + sharedBonus / 100;
  const abilityMultiplier = 1 + (sharedBonus + bonuses.shojin) / 100;
  const axiomBonus = bonuses.axiom ? modifiers.axiomArcanist.ultimateBonus : 0;
  const ultimateMultiplier = 1 + (sharedBonus + bonuses.shojin + axiomBonus) / 100;

  const startHealth = (maxHealth * startHealthPercent) / 100;
  let health = startHealth;
  let hitsLanded = 0; // every hit applies a Black Cleaver stack
  let judgmentHits = 0; // only Judgment spins count towards its armor shred
  let killedBy = null;
  const steps = [];

  const record = (ability, damage, details = {}) => {
    health -= damage;
    steps.push({ ability, damage, healthAfter: Math.max(0, health), ...details });
    if (!killedBy && health <= 0) killedBy = ability;
  };

  for (const ability of COMBO_ORDERS[order]) {
    if (ability === "Q") {
      const reductions = getArmorReductions(garen, judgmentHits + 1, {
        armorShred,
        targetIsChampion,
        priorCleaverStacks: hitsLanded - judgmentHits,
      });
      const armorMultiplier = calculateDamageMultiplier(calculateEffectiveArmor(armor, reductions, pen, lethality));
      const q = calculateDecisiveStrike(garen, {
        ...options,
        qRank,
        armorMultiplier,
        attackMultiplier,
        bonusMultiplier: abilityMultiplier,
      });
      hitsLanded += 1;
      record("Q", q.total, { attack: q.attack, bonus: q.bonus });
    } else {
      const e = calculateJudgment(garen, {
        ...options,
        priorCleaverStacks: hitsLanded,
        damageMultiplier: abilityMultiplier,
      });
      hitsLanded += spins;
      judgmentHits += spins;
      // Single-target combo, so the target is always the nearest enemy
      record("E", e.nearest.totalDamage);
    }
  }

  if (useR) {
    if (health <= 0) {
      steps.push({ ability: "R", damage: 0, healthAfter: 0, skipped: true });
    } else {
      const cinderbloomMultiplier = calculateCinderbloomMultiplier(garen, modifiers, {
        enabled: bonuses.cinderbloom,
        critDamage,
        currentHealth: health,
        maxHealth,
      });
      const damage = calculateDemacianJustice(garen, {
        rRank,
        maxHealth,
        currentHealth: health,
        damageMultiplier: ultimateMultiplier,
        cinderbloomMultiplier,
      });
      record("R", damage, { cinderbloom: cinderbloomMultiplier > 1 });
    }
  }

  return {
    steps,
    totalDamage: steps.reduce((sum, step) => sum + step.damage, 0),
    startHealth,
    remainingHealth: Math.max(0, health),
    kills: health <= 0,
    killedBy,
  };
}
