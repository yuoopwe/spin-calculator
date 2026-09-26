// app.js

let garenData = null;
let currentRank = 1;

const levelInput = document.getElementById("championLevel");
const armorInput = document.getElementById("enemyArmor");
const armorSlider = document.getElementById("armorSlider");
const championToggle = document.getElementById("targetIsChampion");
const rankButtons = [...document.querySelectorAll("#eRank [data-rank]")];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Colours the part of the slider track left of the thumb
function setRangeFill(range) {
  const min = Number(range.min);
  const max = Number(range.max);
  const percent = ((Number(range.value) - min) / (max - min)) * 100;
  range.style.setProperty("--fill", `${percent}%`);
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

  const level = clamp(parseInt(levelInput.value) || 1, 1, 18);
  const armor = Math.max(0, parseFloat(armorInput.value) || 0);
  const targetIsChampion = championToggle.checked;

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
    eRank: currentRank,
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

  renderSpinChart(result.spinDetails);
}

function renderSpinChart(spinDetails) {
  const chart = document.getElementById("spinChart");
  const maxDamage = Math.max(...spinDetails.map((s) => s.damage));
  chart.innerHTML = "";

  for (const spin of spinDetails) {
    const bar = document.createElement("div");
    bar.className = spin.judgmentShred ? "bar shredded" : "bar";
    bar.title = `Spin ${spin.spin}: ${spin.damage.toFixed(2)} damage against ${spin.armor.toFixed(1)} armor`;
    bar.innerHTML = `
      <div class="bar-track">
        <span class="bar-value">${Math.round(spin.damage)}</span>
        <div class="bar-fill" style="--height: ${maxDamage > 0 ? (spin.damage / maxDamage) * 100 : 0}%"></div>
      </div>
      <span class="bar-label">${spin.spin}</span>
    `;
    chart.appendChild(bar);
  }

  const first = spinDetails[0].damage.toFixed(2);
  const last = spinDetails[spinDetails.length - 1].damage.toFixed(2);
  chart.setAttribute("aria-label", `${spinDetails.length} spins, from ${first} to ${last} damage each`);
  document.getElementById("legendShred").hidden = !spinDetails.some((s) => s.judgmentShred);
}

// ---------- Controls ----------

function setLevel(value) {
  levelInput.value = clamp(value, 1, 18);
  setText("levelValue", levelInput.value);
  setRangeFill(levelInput);
  updateStats();
}

function setRank(rank) {
  currentRank = rank;
  for (const button of rankButtons) {
    const checked = Number(button.dataset.rank) === rank;
    button.setAttribute("aria-checked", String(checked));
    button.tabIndex = checked ? 0 : -1;
  }
  updateStats();
}

function setArmor(value, { fromSlider = false } = {}) {
  const armor = Math.max(0, Number(value) || 0);
  if (!fromSlider) armorSlider.value = Math.min(armor, Number(armorSlider.max));
  if (fromSlider || String(armor) !== armorInput.value) armorInput.value = armor;
  setRangeFill(armorSlider);
  updateStats();
}

levelInput.addEventListener("input", () => setLevel(Number(levelInput.value)));

document.querySelectorAll(".step-btn").forEach((button) => {
  button.addEventListener("click", () => setLevel(Number(levelInput.value) + Number(button.dataset.step)));
});

rankButtons.forEach((button, index) => {
  button.addEventListener("click", () => setRank(Number(button.dataset.rank)));
  button.addEventListener("keydown", (e) => {
    const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const next = rankButtons[clamp(index + moves[e.key], 0, rankButtons.length - 1)];
    next.focus();
    setRank(Number(next.dataset.rank));
  });
});

armorInput.addEventListener("input", () => {
  // Leave an empty box alone while the user is typing
  if (armorInput.value === "") {
    armorSlider.value = 0;
    setRangeFill(armorSlider);
    updateStats();
    return;
  }
  setArmor(armorInput.value);
});
armorSlider.addEventListener("input", () => setArmor(armorSlider.value, { fromSlider: true }));

document.querySelectorAll("[data-armor]").forEach((button) => {
  button.addEventListener("click", () => setArmor(button.dataset.armor));
});

championToggle.addEventListener("change", updateStats);

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  setRangeFill(levelInput);
  setRangeFill(armorSlider);
  try {
    const { garen } = await gameData;
    garenData = garen;
    const badge = document.getElementById("patchInfo");
    badge.textContent = `Patch ${garen.patch.split(".").slice(0, 2).join(".")}`;
    badge.title = `Data Dragon ${garen.patch}`;
    updateStats();
  } catch (error) {
    console.error("Error loading game data:", error);
    setText("patchInfo", "Data failed to load");
  }
});
