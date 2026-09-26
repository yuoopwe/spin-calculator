let selectedSlotIndex = null; // Track which slot is selected
const selectedItems = [null, null, null, null, null, null]; // Store selected items for each slot

// Event listeners for item slots to open the modal
document.querySelectorAll(".item").forEach((slot, index) => {
  slot.addEventListener("click", () => {
    selectedSlotIndex = index; // Track which slot is selected
    openModal();
  });
});

// Function to open the modal
function openModal() {
  const modal = document.getElementById("itemModal");
  modal.showModal();
}

// Function to close the modal
function closeModal() {
  const modal = document.getElementById("itemModal");
  modal.close();
}

// Function to render items in the modal
function renderItems(items) {
  const modalBody = document.querySelector("#itemModal .modal-body");
  modalBody.innerHTML = ""; // Clear any existing items

  // Add the "Remove Item" option at the top with the not-allowed icon
  const removeItemElement = document.createElement("div");
  removeItemElement.classList.add("item-row");
  removeItemElement.innerHTML = `
    <div class="item-image">
      <img src="img/not-allowed.png" alt="Remove Item" />
    </div>
    <div class="item-info">
      <h4>Remove Item</h4>
    </div>
  `;
  removeItemElement.addEventListener("click", () => {
    removeItem(); // Call the function to remove the selected item
  });
  modalBody.appendChild(removeItemElement);

  // Render the other items in the list
  items.forEach((item) => {
    const itemElement = document.createElement("div");
    itemElement.classList.add("item-row");

    itemElement.innerHTML = `
      <div class="item-image">
        <img src="${item.icon}" alt="${item.name}">
      </div>
      <div class="item-info">
        <h4>${item.name} <span class="item-gold">${item.gold}g</span></h4>
        ${item.ad ? `<span class="item-stats"><img src="img/AD.png" alt="AD"> ${item.ad}</span>` : ""}
        ${item.as ? `<span class="item-stats"><img src="img/attack-speed.webp" alt="AS"> ${item.as}%</span>` : ""}
        ${item.critChance ? `<span class="item-stats"><img src="img/Critical_strike_icon.webp" alt="Crit Chance"> ${item.critChance}%</span>` : ""}
        ${item.critDamage ? `<span class="item-stats"><img src="img/crit-damage.png" alt="Crit Damage"> ${item.critDamage}%</span>` : ""}
        ${item.lethality ? `<span class="item-stats"><img src="img/armor_pen.png" alt="Lethality"> ${item.lethality}</span>` : ""}
        ${item.pen ? `<span class="item-stats"><img src="img/armor_pen.png" alt="%PEN"> ${item.pen}%</span>` : ""}
        ${item.armorShred ? `<span class="item-stats"><img src="img/armor_pen.png" alt="Armor Shred"> ${item.armorShred.perStack}% x${item.armorShred.maxStacks} shred</span>` : ""}
      </div>
    `;

    modalBody.appendChild(itemElement);

    // Event listener to select item when clicked
    itemElement.addEventListener("click", () => {
      selectItem(item);
    });
  });
}

function selectItem(item) {
  if (selectedSlotIndex !== null) {
    // Last Whisper and the items built from it share a unique passive
    const hasOtherLastWhisper = selectedItems.some(
      (selectedItem, index) => index !== selectedSlotIndex && selectedItem?.lastWhisper
    );
    if (item.lastWhisper && hasOtherLastWhisper) {
      alert("You can only have one Last Whisper item (Last Whisper, Lord Dominik's Regards, Mortal Reminder, Serylda's Grudge).");
      return; // Prevent selection
    }

    // Set the selected item in the selected slot
    selectedItems[selectedSlotIndex] = item;

    // Update the slot with the item's image
    const itemSlot = document.querySelectorAll(".item")[selectedSlotIndex];
    itemSlot.innerHTML = `<img src="${item.icon}" alt="${item.name}" title="${item.name}">`;

    closeModal(); // Close the modal after selecting an item

    // Update the stats to include item bonuses
    updateStats();
  }
}

// Function to remove the selected item
function removeItem() {
  if (selectedSlotIndex !== null) {
    // Remove the item by setting it to null
    selectedItems[selectedSlotIndex] = null;

    // Clear the corresponding slot (set the slot to empty)
    const itemSlot = document.querySelectorAll(".item")[selectedSlotIndex];
    itemSlot.innerHTML = ""; // Empty the slot

    closeModal(); // Close the modal after removing the item

    // Update the stats to reflect the removal
    updateStats();
  }
}

// Initialize modal and set up event listeners
async function initializeModal() {
  try {
    const { items } = await gameData;
    renderItems(items); // Render items in modal initially

    // Set up search functionality
    const searchInput = document.getElementById("itemSearch");
    searchInput.addEventListener("input", () => {
      const query = searchInput.value.toLowerCase();
      const filteredItems = items.filter((item) => item.name.toLowerCase().includes(query));
      renderItems(filteredItems); // Re-render items based on search query
    });

    // Close modal when clicking outside
    document.getElementById("itemModal").addEventListener("click", (e) => {
      if (e.target === document.getElementById("itemModal")) {
        closeModal();
      }
    });
  } catch (error) {
    console.error("Error initializing modal:", error);
  }
}

document.addEventListener("DOMContentLoaded", initializeModal);