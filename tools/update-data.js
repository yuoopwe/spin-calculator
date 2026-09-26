// Regenerates data/garen.json and data/items.json from Riot's Data Dragon and CommunityDragon.
// Usage: node tools/update-data.js

const https = require("https");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const DDRAGON = "https://ddragon.leagueoflegends.com";
const CDRAGON = "https://raw.communitydragon.org/latest";

const LAST_WHISPER_ID = "3035";
const EXCLUDED_NAMES = [/^Guardian's /]; // ARAM-only starters flagged as Summoner's Rift items

function getJSON(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`${url} returned ${res.statusCode}`));
          return;
        }
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(new Error(`Invalid JSON from ${url}: ${err.message}`));
          }
        });
      })
      .on("error", reject);
  });
}

function writeJSON(file, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2) + "\n");
}

// ---------- Garen ----------

function dataValue(spell, name) {
  const entry = spell.DataValues.find((v) => v.name === name);
  if (!entry) throw new Error(`GarenE is missing data value "${name}"`);
  return entry.values;
}

const round = (n, digits = 4) => Number(n.toFixed(digits));

function buildGaren(bin, patch, contentVersion) {
  const root = bin["Characters/Garen/CharacterRecords/Root"];
  const e = bin["Characters/Garen/Spells/GarenEAbility/GarenE"];
  if (!root || !e) throw new Error("Garen records not found in CommunityDragon data");

  const spell = e.mSpell;
  // Spell data arrays have 7 entries; ranks 1-5 are indices 1-5.
  const ranks = (name) => dataValue(spell, name).slice(1, 6).map((v) => round(v));
  const single = (name) => round(dataValue(spell, name)[1]);

  return {
    patch,
    contentVersion,
    baseAD: root.baseDamageModifiable.baseValue,
    adPerLevel: round(root.damagePerLevelModifiable.baseValue),
    baseAS: round(root.attackSpeedModifiable.baseValue),
    asRatio: round(root.attackSpeedRatioModifiable.baseValue),
    asPerLevel: round(root.attackSpeedPerLevelModifiable.baseValue),
    critDamage: round((root.critDamageMultiplier ?? 2) * 100),
    judgment: {
      baseDamagePerSpin: ranks("BaseDamagePerTick"),
      adRatioPerSpin: ranks("ADRatioPerTick"),
      baseSpins: single("NumTicks"),
      bonusASPerSpin: round(single("ASPerTick") * 100),
      nearestEnemyBonus: single("NearestEnemyBonus"),
      critMod: single("CritMod"),
      shredAmount: single("ShredAmount"),
      hitsToShred: single("StacksToShred"),
    },
  };
}

// ---------- Items ----------

const STAT_LABELS = {
  "Attack Damage": "ad",
  "Attack Speed": "as",
  "Critical Strike Chance": "critChance",
  "Critical Strike Damage": "critDamage",
  Lethality: "lethality",
  "Armor Penetration": "pen",
};

function parseStats(description) {
  const block = /<stats>([\s\S]*?)<\/stats>/.exec(description);
  const stats = {};
  if (!block) return stats;
  const re = /<attention>\s*([\d.]+)%?\s*<\/attention>\s*([^<]+)/g;
  let m;
  while ((m = re.exec(block[1]))) {
    const key = STAT_LABELS[m[2].trim()];
    const value = Number(m[1]);
    if (key && value > 0) stats[key] = value;
  }
  return stats;
}

function parseArmorShred(description) {
  const amount = /Armor by (\d+)%/.exec(description);
  const stacks = /stacks (\d+) times/.exec(description);
  if (!amount || !stacks) return null;
  return { perStack: Number(amount[1]), maxStacks: Number(stacks[1]) };
}

function buildItems(itemData, patch) {
  const seen = new Set();
  const items = [];

  for (const [id, item] of Object.entries(itemData.data)) {
    if (Number(id) >= 10000) continue; // mode-specific copies (Arena, Swarm, etc.)
    if (!item.gold?.purchasable || !item.maps?.["11"]) continue;
    if (item.requiredChampion || item.requiredAlly) continue;
    if (EXCLUDED_NAMES.some((re) => re.test(item.name))) continue;
    if (seen.has(item.name)) continue;

    const stats = parseStats(item.description);
    const entry = { id, name: item.name, gold: item.gold.total, ...stats };

    if (item.name === "Black Cleaver") {
      const shred = parseArmorShred(item.description);
      if (shred) entry.armorShred = shred;
    }
    if (id === LAST_WHISPER_ID || item.from?.includes(LAST_WHISPER_ID)) {
      entry.lastWhisper = true;
    }
    if (item.into?.length) {
      entry.component = true;
    }

    const relevant = ["ad", "as", "critChance", "critDamage", "lethality", "pen"].some((k) => entry[k]);
    if (!relevant && !entry.armorShred) continue;

    entry.icon = `${DDRAGON}/cdn/${patch}/img/item/${item.image.full}`;
    seen.add(item.name);
    items.push(entry);
  }

  items.sort((a, b) => a.gold - b.gold || a.name.localeCompare(b.name));
  return { patch, items };
}

// ---------- Main ----------

async function main() {
  const [patch] = await getJSON(`${DDRAGON}/api/versions.json`);
  console.log(`Latest Data Dragon patch: ${patch}`);

  const [itemData, garenBin, content] = await Promise.all([
    getJSON(`${DDRAGON}/cdn/${patch}/data/en_US/item.json`),
    getJSON(`${CDRAGON}/game/data/characters/garen/garen.bin.json`),
    getJSON(`${CDRAGON}/content-metadata.json`),
  ]);

  const garen = buildGaren(garenBin, patch, content.version);
  writeJSON("garen.json", garen);
  console.log(`Wrote data/garen.json (CommunityDragon ${content.version})`);

  const items = buildItems(itemData, patch);
  writeJSON("items.json", items);
  console.log(`Wrote data/items.json (${items.items.length} items)`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
