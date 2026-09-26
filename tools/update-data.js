// Regenerates data/garen.json, data/items.json and data/modifiers.json from Riot's Data Dragon and CommunityDragon.
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

const round = (n, digits = 4) => Number(n.toFixed(digits));

// Spell data arrays have 7 entries; rank n is index n.
function spellReader(bin, path) {
  const spell = bin[path]?.mSpell;
  if (!spell) throw new Error(`${path} not found in CommunityDragon data`);
  const values = (name) => {
    const entry = spell.DataValues.find((v) => v.name === name);
    if (!entry) throw new Error(`${path} is missing data value "${name}"`);
    return entry.values;
  };
  return {
    ranks: (name, count) => values(name).slice(1, count + 1).map((v) => round(v)),
    single: (name) => round(values(name)[1]),
  };
}

function buildGaren(bin, patch, contentVersion) {
  const root = bin["Characters/Garen/CharacterRecords/Root"];
  if (!root) throw new Error("Garen character record not found in CommunityDragon data");

  const q = spellReader(bin, "Characters/Garen/Spells/GarenQAbility/GarenQ");
  const e = spellReader(bin, "Characters/Garen/Spells/GarenEAbility/GarenE");
  const r = spellReader(bin, "Characters/Garen/Spells/GarenRAbility/GarenR");
  const ranks = (name) => e.ranks(name, 5);
  const single = e.single;

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
    decisiveStrike: {
      bonusDamage: q.ranks("BaseDamage", 5),
      // tADRatio covers the whole empowered attack; the attack itself is 100% AD
      bonusADRatio: round(q.single("tADRatio") - 1),
    },
    demacianJustice: {
      baseDamage: r.ranks("BaseDamage", 3),
      missingHealthRatio: r.ranks("ExecuteDamage", 3),
    },
    icons: Object.fromEntries(
      ["Q", "E", "R"].map((key) => [key.toLowerCase(), `${DDRAGON}/cdn/${patch}/img/spell/Garen${key}.png`])
    ),
  };
}

// ---------- Runes and item passives ----------

const stripTags = (html) => html.replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ");

function match(text, re, label) {
  const m = re.exec(text);
  if (!m) throw new Error(`Could not parse ${label} from: "${text}"`);
  return m.slice(1).map(Number);
}

function findItem(itemData, name, patch) {
  const entry = Object.entries(itemData.data).find(([id, item]) => Number(id) < 10000 && item.name === name);
  if (!entry) throw new Error(`Item "${name}" not found in Data Dragon`);
  return {
    text: stripTags(entry[1].description),
    icon: `${DDRAGON}/cdn/${patch}/img/item/${entry[1].image.full}`,
  };
}

function findPerk(perks, name) {
  const perk = perks.find((p) => p.name === name);
  if (!perk) throw new Error(`Rune "${name}" not found in CommunityDragon perks`);
  return {
    text: stripTags(perk.longDesc),
    icon: `${DDRAGON}/cdn/img/${perk.iconPath.replace("/lol-game-data/assets/v1/", "")}`,
  };
}

function buildModifiers(itemData, perks, patch) {
  const lastStand = findPerk(perks, "Last Stand");
  const [minBonus, maxBonus] = match(lastStand.text, /(\d+)% - (\d+)% increased damage/, "Last Stand bonus");
  const [startHealth] = match(lastStand.text, /below (\d+)% health/, "Last Stand start health");
  const [fullHealth] = match(lastStand.text, /at (\d+)% health/, "Last Stand max health");

  const axiom = findPerk(perks, "Axiom Arcanist");
  const [ultimateBonus] = match(axiom.text, /Ultimate has (\d+)% increased damage/, "Axiom Arcanist bonus");
  const [aoeUltimateBonus] = match(axiom.text, /reduced to a (\d+)% increase/, "Axiom Arcanist AoE bonus");

  const shojin = findItem(itemData, "Spear of Shojin", patch);
  const [perStack] = match(shojin.text, /Passive damage by (\d+)%/, "Spear of Shojin per stack");
  const [maxStacks] = match(shojin.text, /stacks (\d+) times/, "Spear of Shojin stacks");

  const ldr = findItem(itemData, "Lord Dominik's Regards", patch);
  const [giantSlayerMax] = match(ldr.text, /up to (\d+)% bonus damage/, "Giant Slayer bonus");
  const [maxBonusHealth] = match(ldr.text, /reached at (\d+) bonus Health/, "Giant Slayer bonus health");

  const shadowflame = findItem(itemData, "Shadowflame", patch);
  const [threshold, cinderbloomBonus] = match(
    shadowflame.text,
    /below (\d+)% Health, dealing (\d+)% increased damage/,
    "Cinderbloom"
  );

  return {
    patch,
    lastStand: { minBonus, maxBonus, startHealth, fullHealth, icon: lastStand.icon },
    axiomArcanist: { ultimateBonus, aoeUltimateBonus, icon: axiom.icon },
    spearOfShojin: { item: "Spear of Shojin", perStack, maxStacks, icon: shojin.icon },
    giantSlayer: { item: "Lord Dominik's Regards", maxBonus: giantSlayerMax, maxBonusHealth, icon: ldr.icon },
    cinderbloom: { item: "Shadowflame", healthThreshold: threshold, bonus: cinderbloomBonus, icon: shadowflame.icon },
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

  const [itemData, garenBin, content, perks] = await Promise.all([
    getJSON(`${DDRAGON}/cdn/${patch}/data/en_US/item.json`),
    getJSON(`${CDRAGON}/game/data/characters/garen/garen.bin.json`),
    getJSON(`${CDRAGON}/content-metadata.json`),
    getJSON(`${CDRAGON}/plugins/rcp-be-lol-game-data/global/default/v1/perks.json`),
  ]);

  // Built first so a parsing failure stops the script before any file is written
  const modifiers = buildModifiers(itemData, perks, patch);

  const garen = buildGaren(garenBin, patch, content.version);
  writeJSON("garen.json", garen);
  console.log(`Wrote data/garen.json (CommunityDragon ${content.version})`);

  const items = buildItems(itemData, patch);
  writeJSON("items.json", items);
  console.log(`Wrote data/items.json (${items.items.length} items)`);

  writeJSON("modifiers.json", modifiers);
  console.log("Wrote data/modifiers.json");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
