// modal.js
// Item slots and the item picker dialog.

const SLOT_COUNT = 6;
let selectedSlotIndex = null; // Track which slot the picker is choosing for
const selectedItems = Array(SLOT_COUNT).fill(null); // Store selected items for each slot
let allItems = [];
let activeFilter = "all";

const modal = document.getElementById("itemModal");
const itemGrid = document.getElementById("itemGrid");
const searchInput = document.getElementById("itemSearch");
const tooltip = document.getElementById("itemTooltip");

const ITEM_FILTERS = {
  all: () => true,
  ad: (item) => item.ad,
  as: (item) => item.as,
  crit: (item) => item.critChance || item.critDamage,
  lethality: (item) => item.lethality,
  pen: (item) => item.pen || item.armorShred,
  components: (item) => item.component,
};

const STAT_DISPLAY = [
  { key: "ad", icon: "img/AD.png", label: "Attack Damage", suffix: "" },
  { key: "as", icon: "img/attack-speed.webp", label: "Attack Speed", suffix: "%" },
  { key: "critChance", icon: "img/Critical_strike_icon.webp", label: "Crit Chance", suffix: "%" },
  { key: "critDamage", icon: "img/crit-damage.png", label: "Crit Damage", suffix: "%" },
  { key: "lethality", icon: "img/armor_pen.png", label: "Lethality", suffix: "" },
  { key: "pen", icon: "img/armor_pen.png", label: "Armor Penetration", suffix: "%" },
];

function statLines(item) {
  const lines = STAT_DISPLAY.filter((stat) => item[stat.key]).map(
    (stat) => `<li><img src="${stat.icon}" alt=""> ${item[stat.key]}${stat.suffix} ${stat.label}</li>`
  );
  if (item.armorShred) {
    const { perStack, maxStacks } = item.armorShred;
    lines.push(`<li><img src="img/armor_pen.png" alt=""> ${perStack}% armor shred per hit (up to ${maxStacks})</li>`);
  }
  return lines.join("");
}

// Last Whisper and the items built from it share a unique passive
function getBlockReason(item) {
  if (!item.lastWhisper) return null;
  const conflict = selectedItems.find((selected, index) => index !== selectedSlotIndex && selected?.lastWhisper);
  return conflict ? `Only one Last Whisper item allowed (you have ${conflict.name}).` : null;
}

// ---------- Slots ----------

function renderSlots() {
  const container = document.getElementById("items");
  container.innerHTML = "";

  selectedItems.forEach((item, index) => {
    const wrap = document.createElement("div");
    wrap.className = "item-slot-wrap";

    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = item ? "item-slot filled" : "item-slot";
    slot.setAttribute("aria-label", item ? `Slot ${index + 1}: ${item.name}. Change item` : `Slot ${index + 1}: empty. Add item`);
    if (item) {
      slot.title = item.name;
      slot.innerHTML = `<img src="${item.icon}" alt="">`;
    } else {
      slot.innerHTML = `<span class="slot-plus" aria-hidden="true">+</span>`;
    }
    slot.addEventListener("click", () => openModal(index));
    wrap.appendChild(slot);

    if (item) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "slot-remove";
      remove.setAttribute("aria-label", `Remove ${item.name}`);
      remove.textContent = "\u00d7";
      remove.addEventListener("click", () => {
        setSlot(index, null);
        focusSlot(index);
      });
      wrap.appendChild(remove);
    }

    container.appendChild(wrap);
  });
}

function focusSlot(index) {
  document.querySelectorAll(".item-slot")[index]?.focus();
}

function setSlot(index, item) {
  selectedItems[index] = item;
  renderSlots();
  updateStats();
}

// ---------- Picker ----------

function openModal(index) {
  selectedSlotIndex = index;
  const current = selectedItems[index];
  document.getElementById("pickerTitle").textContent = current ? `Replace ${current.name}` : `Choose item for slot ${index + 1}`;
  document.getElementById("removeItem").hidden = !current;
  renderItemGrid();
  modal.showModal();
  searchInput.focus();
}

function closeModal() {
  modal.close();
}

function renderItemGrid() {
  const query = searchInput.value.trim().toLowerCase();
  const matchesFilter = ITEM_FILTERS[activeFilter];
  const visible = allItems.filter((item) => matchesFilter(item) && item.name.toLowerCase().includes(query));

  itemGrid.innerHTML = "";
  if (!visible.length) {
    itemGrid.innerHTML = `<p class="grid-empty">No items match.</p>`;
    return;
  }

  const current = selectedItems[selectedSlotIndex];
  for (const item of visible) {
    const reason = getBlockReason(item);
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = item === current ? "item-tile current" : "item-tile";
    tile.setAttribute("aria-label", `${item.name}, ${item.gold} gold${reason ? `. ${reason}` : ""}`);
    if (reason) tile.setAttribute("aria-disabled", "true");
    tile.innerHTML = `<img src="${item.icon}" alt="" loading="lazy"><span class="tile-gold">${item.gold}</span>`;

    tile.addEventListener("click", () => {
      if (!reason) selectItem(item);
    });
    tile.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse") showTooltip(item, tile, reason);
    });
    tile.addEventListener("pointerleave", hideTooltip);
    tile.addEventListener("focus", () => showTooltip(item, tile, reason));
    tile.addEventListener("blur", hideTooltip);

    itemGrid.appendChild(tile);
  }
}

function selectItem(item) {
  if (selectedSlotIndex === null) return;
  setSlot(selectedSlotIndex, item);
  closeModal();
}

function showTooltip(item, anchor, reason) {
  tooltip.innerHTML = `
    <div class="tooltip-head">
      <img src="${item.icon}" alt="">
      <div><strong>${item.name}</strong><span class="tooltip-gold">${item.gold} gold</span></div>
    </div>
    <ul class="tooltip-stats">${statLines(item)}</ul>
    ${reason ? `<p class="tooltip-warning">${reason}</p>` : ""}
  `;
  tooltip.hidden = false;

  const margin = 8;
  const anchorRect = anchor.getBoundingClientRect();
  const tipRect = tooltip.getBoundingClientRect();
  const left = clamp(
    anchorRect.left + anchorRect.width / 2 - tipRect.width / 2,
    margin,
    window.innerWidth - tipRect.width - margin
  );
  let top = anchorRect.top - tipRect.height - margin;
  if (top < margin) top = anchorRect.bottom + margin;

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideTooltip() {
  tooltip.hidden = true;
}

// Initialize slots and picker
async function initializeModal() {
  renderSlots();

  searchInput.addEventListener("input", renderItemGrid);

  document.querySelectorAll("#itemFilters [data-filter]").forEach((chip) => {
    chip.addEventListener("click", () => {
      activeFilter = chip.dataset.filter;
      document.querySelectorAll("#itemFilters [data-filter]").forEach((other) => {
        other.setAttribute("aria-pressed", String(other === chip));
      });
      renderItemGrid();
    });
  });

  document.getElementById("closePicker").addEventListener("click", closeModal);
  document.getElementById("removeItem").addEventListener("click", () => {
    setSlot(selectedSlotIndex, null);
    closeModal();
  });

  // Close when clicking the backdrop
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  modal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
    }
  });

  modal.addEventListener("close", () => {
    hideTooltip();
    focusSlot(selectedSlotIndex);
  });

  itemGrid.addEventListener("scroll", hideTooltip);

  try {
    ({ items: allItems } = await gameData);
  } catch (error) {
    console.error("Error loading items:", error);
  }
}

document.addEventListener("DOMContentLoaded", initializeModal);
