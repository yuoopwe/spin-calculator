async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return response.json();
}

// Shared by app.js and modal.js so the data files are only fetched once
const gameData = Promise.all([fetchJSON("data/garen.json"), fetchJSON("data/items.json")]).then(
  ([garen, itemData]) => ({ garen, items: itemData.items })
);
