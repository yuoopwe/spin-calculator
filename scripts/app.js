// app.js

let garenData = null;
let modifierData = null;
const ranks = { q: 1, e: 1, r: 1 };
let comboOrder = "e";

const levelInput = document.getElementById("championLevel");
const armorInput = document.getElementById("enemyArmor");
const armorSlider = document.getElementById("armorSlider");
const healthInput = document.getElementById("enemyHealth");
const healthSlider = document.getElementById("healthSlider");
const startHealthInput = document.getElementById("startHealth");
const championToggle = document.getElementById("targetIsChampion");
const useRToggle = document.getElementById("useR");
const modifierElements = [...document.querySelectorAll("[data-modifier]")];

const ABILITY_NAMES = { Q: "Decisive Strike", E: "Judgment", R: "Demacian Justice" };

// Rune and item passive controls. `range` gives the slider's [min, max]; `bonus` turns its value into % damage.
// Controls with an `item` are only shown while that item is equipped.
const MODIFIERS = {
  lastStand: {
    range: (m) => [m.lastStand.minBonus, m.lastStand.maxBonus],
    bonus: (value) => value,
    value: (value) => `+${value}%`,
    hint: (value, m) => {
      const { minBonus, maxBonus, startHealth, fullHealth } = m.lastStand;
      if (value >= maxBonus) return `Garen at ${fullHealth}% health or lower. Boosts Q, E and R.`;
      const health = startHealth - ((value - minBonus) / (maxBonus - minBonus)) * (startHealth - fullHealth);
      return `Garen at ${Math.round(health)}% health. Boosts Q, E and R.`;
    },
  },
  axiom: {
    hint: (value, m) => `+${m.axiomArcanist.ultimateBonus}% R damage against a single champion.`,
  },
  shojin: {
    item: (m) => m.spearOfShojin.item,
    range: (m) => [1, m.spearOfShojin.maxStacks],
    bonus: (value, m) => value * m.spearOfShojin.perStack,
    value: (value, m) => `${value} (+${value * m.spearOfShojin.perStack}%)`,
    hint: () => "Stacks built before the combo. Boosts Q's bonus damage, E and R.",
  },
  giantSlayer: {
    item: (m) => m.giantSlayer.item,
    range: (m) => [0, m.giantSlayer.maxBonus],
    bonus: (value) => value,
    value: (value) => `+${value}%`,
    hint: (value, m, stats) => {
      if (!stats.targetIsChampion) return "Only works against champions.";
      const { maxBonus, maxBonusHealth } = m.giantSlayer;
      const health = Math.round((value / maxBonus) * maxBonusHealth);
      return `Target has ${health}${value >= maxBonus ? "+" : ""} bonus health. Boosts Q, E and R.`;
    },
  },
  cinderbloom: {
    hint: (value, m, stats) => {
      const { healthThreshold, bonus } = m.cinderbloom;
      const percent = bonus * (1 + (stats.critDamage - garenData.critDamage) / 100);
      return `R deals +${Number(percent.toFixed(1))}% when the target is below ${healthThreshold}% health. AP item, so it takes an item slot.`;
    },
  },
};

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

// Shows item passives only while their item is equipped, switching them on when it's added
function syncItemModifiers() {
  const missing = [];
  for (const element of modifierElements) {
    const config = MODIFIERS[element.dataset.modifier];
    if (!config.item) continue;
    const name = config.item(modifierData);
    const equipped = selectedItems.some((item) => item?.name === name);
    if (equipped && element.hidden) element.querySelector(".modifier-toggle").checked = true;
    element.hidden = !equipped;
    if (!equipped) missing.push(name);
  }
  const hint = document.getElementById("itemPassivesHint");
  hint.hidden = missing.length === 0;
  hint.textContent = `Equip ${missing.join(" or ")} to use ${missing.length > 1 ? "their passives" : "its passive"}.`;
}

function readModifiers(stats) {
  const bonuses = { lastStand: 0, giantSlayer: 0, shojin: 0, axiom: false, cinderbloom: false };

  for (const element of modifierElements) {
    const key = element.dataset.modifier;
    const config = MODIFIERS[key];
    const on = !element.hidden && element.querySelector(".modifier-toggle").checked;
    const range = element.querySelector(".modifier-range");
    const value = range ? Number(range.value) : 0;

    if (range) {
      element.querySelector(".modifier-body").hidden = !on;
      element.querySelector(".modifier-value").textContent = config.value(value, modifierData);
      setRangeFill(range);
      bonuses[key] = on ? config.bonus(value, modifierData) : 0;
    } else {
      bonuses[key] = on;
    }
    element.querySelector(".modifier-hint").textContent = config.hint(value, modifierData, stats);
  }
  return bonuses;
}

function updateStats() {
  if (!garenData) return;

  const level = clamp(parseInt(levelInput.value) || 1, 1, 18);
  const armor = Math.max(0, parseFloat(armorInput.value) || 0);
  const maxHealth = Math.max(1, parseFloat(healthInput.value) || 1);
  const startHealthPercent = Number(startHealthInput.value);
  const targetIsChampion = championToggle.checked;

  const stats = getItemBonuses();
  const totalAD = calculateLevelBasedAD(garenData, level) + stats.ad;
  const totalBonusAS = calculateLevelBonusAS(garenData, level) + stats.as;
  const totalAS = calculateTotalAS(garenData, totalBonusAS);
  const spins = calculateSpinCount(garenData, totalBonusAS);

  syncItemModifiers();
  const bonuses = readModifiers({ ...stats, targetIsChampion });
  if (!targetIsChampion) bonuses.giantSlayer = 0;

  setText("adValue", totalAD.toFixed(2));
  setText("asValue", `${totalAS.toFixed(3)} / ${totalBonusAS.toFixed(2)}%`);
  setText("critValue", `${stats.critChance}% / ${stats.critDamage}%`);
  setText("penValue", `${stats.lethality} / ${stats.pen}%`);
  setText("spinCount", spins);

  const options = {
    qRank: ranks.q,
    eRank: ranks.e,
    rRank: ranks.r,
    totalAD,
    spins,
    critChance: stats.critChance,
    critDamage: stats.critDamage,
    armor,
    lethality: stats.lethality,
    pen: stats.pen,
    armorShred: stats.armorShred,
    targetIsChampion,
  };

  const result = calculateJudgment(garenData, {
    ...options,
    damageMultiplier: 1 + (bonuses.lastStand + bonuses.giantSlayer + bonuses.shojin) / 100,
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

  const combo = calculateCombo(garenData, modifierData, {
    ...options,
    order: comboOrder,
    useR: useRToggle.checked,
    bonuses,
    maxHealth,
    startHealthPercent,
  });
  renderCombo(combo, maxHealth);
}

function renderCombo(combo, maxHealth) {
  setText("comboTotal", combo.totalDamage.toFixed(2));
  setText("comboRemaining", Math.round(combo.remainingHealth));
  const badge = document.getElementById("killBadge");
  badge.hidden = !combo.kills;
  badge.title = combo.kills ? `Killed by ${ABILITY_NAMES[combo.killedBy]}` : "";

  const rows = document.getElementById("comboRows");
  const bar = document.getElementById("healthBar");
  rows.innerHTML = "";
  bar.innerHTML = "";

  const addSegment = (className, health, title) => {
    if (health <= 0) return;
    const segment = document.createElement("div");
    segment.className = `health-segment ${className}`;
    segment.style.width = `${(health / maxHealth) * 100}%`;
    segment.title = title;
    bar.appendChild(segment);
  };
  addSegment("lost", maxHealth - combo.startHealth, "Missing before the combo");

  let healthBefore = combo.startHealth;
  for (const step of combo.steps) {
    const key = step.ability.toLowerCase();
    const row = document.createElement("div");
    row.className = "result-row combo-row";
    if (step.ability === "Q") {
      row.title = `${step.attack.toFixed(2)} from the attack, ${step.bonus.toFixed(2)} bonus damage`;
    }
    const tag = step.cinderbloom ? `<span class="tag">Cinderbloom</span>` : step.ability === "R" ? `<span class="tag">True</span>` : "";
    row.innerHTML = `
      <dt>
        <span class="swatch swatch-${key}"></span>
        <img class="inline-icon" src="${garenData.icons[key]}" alt="" />
        <span>${step.ability} &middot; ${ABILITY_NAMES[step.ability]}</span>
        ${tag}
      </dt>
      <dd><span class="${step.skipped ? "muted" : ""}">${step.skipped ? "Not needed" : step.damage.toFixed(2)}</span></dd>
    `;
    rows.appendChild(row);

    const dealt = Math.min(step.damage, healthBefore);
    addSegment(`dealt-${key}`, dealt, `${ABILITY_NAMES[step.ability]}: ${Math.round(dealt)} damage`);
    healthBefore -= dealt;
  }
  addSegment("left", combo.remainingHealth, `${Math.round(combo.remainingHealth)} health left`);

  bar.setAttribute(
    "aria-label",
    `Target health: ${Math.round(combo.startHealth)} before the combo, ${Math.round(combo.remainingHealth)} after`
  );
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

// Radio group of buttons with roving tabindex and arrow-key support
function setupRadioGroup(group, onSelect) {
  const buttons = [...group.querySelectorAll('[role="radio"]')];
  const select = (selected) => {
    for (const button of buttons) {
      const checked = button === selected;
      button.setAttribute("aria-checked", String(checked));
      button.tabIndex = checked ? 0 : -1;
    }
    onSelect(selected.dataset.value);
    updateStats();
  };

  buttons.forEach((button, index) => {
    button.addEventListener("click", () => select(button));
    button.addEventListener("keydown", (e) => {
      const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (!(e.key in moves)) return;
      e.preventDefault();
      const next = buttons[clamp(index + moves[e.key], 0, buttons.length - 1)];
      next.focus();
      select(next);
    });
  });
}

// Keeps a number box and its slider in sync; the box can go past the slider's max
function bindNumberSlider(input, slider, minimum) {
  const set = (value, { fromSlider = false } = {}) => {
    const number = Math.max(minimum, Number(value) || 0);
    if (!fromSlider) slider.value = Math.min(number, Number(slider.max));
    if (fromSlider || String(number) !== input.value) input.value = number;
    setRangeFill(slider);
    updateStats();
  };

  input.addEventListener("input", () => {
    // Leave an empty box alone while the user is typing
    if (input.value === "") {
      slider.value = slider.min;
      setRangeFill(slider);
      updateStats();
      return;
    }
    set(input.value);
  });
  slider.addEventListener("input", () => set(slider.value, { fromSlider: true }));
  return set;
}

levelInput.addEventListener("input", () => setLevel(Number(levelInput.value)));

document.querySelectorAll(".step-btn").forEach((button) => {
  button.addEventListener("click", () => setLevel(Number(levelInput.value) + Number(button.dataset.step)));
});

document.querySelectorAll("[data-rank]").forEach((group) => {
  setupRadioGroup(group, (value) => (ranks[group.dataset.rank] = Number(value)));
});
setupRadioGroup(document.getElementById("comboOrder"), (value) => (comboOrder = value));

const setArmor = bindNumberSlider(armorInput, armorSlider, 0);
bindNumberSlider(healthInput, healthSlider, 1);

document.querySelectorAll("[data-armor]").forEach((button) => {
  button.addEventListener("click", () => setArmor(button.dataset.armor));
});

startHealthInput.addEventListener("input", () => {
  setText("startHealthValue", `${startHealthInput.value}%`);
  setRangeFill(startHealthInput);
  updateStats();
});

championToggle.addEventListener("change", updateStats);
useRToggle.addEventListener("change", updateStats);
document.querySelectorAll(".modifier-toggle").forEach((toggle) => toggle.addEventListener("change", updateStats));
document.querySelectorAll(".modifier-range").forEach((range) => range.addEventListener("input", updateStats));

function setupModifierControls() {
  document.querySelectorAll("[data-spell]").forEach((img) => (img.src = garenData.icons[img.dataset.spell]));
  document.querySelectorAll("[data-icon]").forEach((img) => (img.src = modifierData[img.dataset.icon].icon));

  for (const element of modifierElements) {
    const config = MODIFIERS[element.dataset.modifier];
    const range = element.querySelector(".modifier-range");
    if (!range) continue;
    const [min, max] = config.range(modifierData);
    Object.assign(range, { min, max, step: 1, value: max });
  }
}

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  for (const range of [levelInput, armorSlider, healthSlider, startHealthInput]) setRangeFill(range);
  try {
    const { garen, modifiers } = await gameData;
    garenData = garen;
    modifierData = modifiers;
    setupModifierControls();
    const badge = document.getElementById("patchInfo");
    badge.textContent = `Patch ${garen.patch.split(".").slice(0, 2).join(".")}`;
    badge.title = `Data Dragon ${garen.patch}`;
    updateStats();
  } catch (error) {
    console.error("Error loading game data:", error);
    setText("patchInfo", "Data failed to load");
  }
});
