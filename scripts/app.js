// app.js

let garenData = null;

// Enforce limits on input values
function enforceLimits() {
  const levelInput = document.getElementById("championLevel");
  const eRankInput = document.getElementById("eRank");
  levelInput.value = Math.min(Math.max(1, levelInput.value), 18);
  eRankInput.value = Math.min(Math.max(1, eRankInput.value), 5);
}

// Sum item stats from selected items
function getItemBonuses() {
  return selectedItems.reduce(
    (acc, item) => {
      if (item) {
        acc.ad += item.ad || 0;
        acc.as += item.as || 0;
        acc.critChance = Math.min(100, acc.critChance + (item.critChance || 0));
        acc.critDamage += item.critDamage || 0;
        acc.lethality += item.lethality || 0;
        acc.pen += item.pen || 0;
        if (item.armorShred) acc.armorShred = item.armorShred;
      }
      return acc;
    },
    { ad: 0, as: 0, critChance: 0, critDamage: garenData.critDamage, lethality: 0, pen: 0, armorShred: null }
  );
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function updateStats() {
  if (!garenData) return;
  enforceLimits();

  const level = parseInt(document.getElementById("championLevel").value) || 1;
  const eRank = parseInt(document.getElementById("eRank").value) || 1;
  const armor = parseFloat(document.getElementById("enemyArmor").value) || 0;
  const targetIsChampion = document.getElementById("targetIsChampion").checked;

  const bonuses = getItemBonuses();
  const totalAD = calculateLevelBasedAD(garenData, level) + bonuses.ad;
  const totalBonusAS = calculateLevelBonusAS(garenData, level) + bonuses.as;
  const totalAS = calculateTotalAS(garenData, totalBonusAS);
  const spins = calculateSpinCount(garenData, totalBonusAS);

  setText("adValue", totalAD.toFixed(2));
  setText("asValue", `${totalAS.toFixed(3)} / ${totalBonusAS.toFixed(2)}%`);
  setText("critValue", `${bonuses.critChance}% / ${bonuses.critDamage}%`);
  setText("penValue", `${bonuses.lethality} / ${bonuses.pen}%`);
  setText("spinCount", spins);

  const result = calculateJudgment(garenData, {
    eRank,
    totalAD,
    spins,
    critChance: bonuses.critChance,
    critDamage: bonuses.critDamage,
    armor,
    lethality: bonuses.lethality,
    pen: bonuses.pen,
    armorShred: bonuses.armorShred,
    targetIsChampion,
  });

  setText("dmgPerSpin", result.firstSpin.toFixed(2));
  setText("closestDmgPerSpin", result.nearest.firstSpin.toFixed(2));
  setText("critSpinMultiplier", `${Math.round(result.critMultiplier * 100)}%`);
  setText("dmgPerCritSpin", result.firstCritSpin.toFixed(2));
  setText("closestDmgPerCritSpin", result.nearest.firstCritSpin.toFixed(2));

  // Only worth showing when armor shred makes later spins hit harder
  const shredRow = document.getElementById("shredded-spin-row");
  shredRow.hidden = result.lastSpin.toFixed(2) === result.firstSpin.toFixed(2);
  setText("dmgPerShreddedSpin", result.lastSpin.toFixed(2));
  setText("closestDmgPerShreddedSpin", result.nearest.lastSpin.toFixed(2));

  setText("totalEDmg", result.totalDamage.toFixed(2));
  setText("closestTotalEDmg", result.nearest.totalDamage.toFixed(2));
}

// Add event listeners for input changes
document.getElementById("championLevel").addEventListener("input", updateStats);
document.getElementById("eRank").addEventListener("input", updateStats);
document.getElementById("enemyArmor").addEventListener("input", updateStats);
document.getElementById("targetIsChampion").addEventListener("change", updateStats);

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const { garen } = await gameData;
    garenData = garen;
    setText("patchInfo", `Data: patch ${garen.patch}`);
    updateStats();
  } catch (error) {
    console.error("Error loading game data:", error);
    setText("patchInfo", "Could not load game data. Serve this folder over HTTP (see README).");
  }
});
