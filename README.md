# Garen Spin Calculator

A calculator for the damage of Garen's **Judgment** (E) and his Q, E and R combos in League of Legends. Pick Garen's level, ability ranks, items, runes and the enemy's armor and health to see:

- how many spins you get (7, plus 1 per 25% bonus attack speed from items and levels)
- damage per spin, per crit spin, and on the nearest enemy (+25%)
- total E damage, including expected crit damage and armor shred
- the damage of a full combo (E, Q then E, or E then Q, optionally finished with R) and how much health the target has left

## How the damage is calculated

- **Per spin**: base damage by rank + a percentage of total AD by rank (values come from the game data, see below).
- **Crits**: Judgment only gets 30% of your crit damage. A crit spin does `1 + 0.3 × (crit damage − 1)`, which is 130% normally and 139% with Infinity Edge. Total damage uses your crit chance as the expected share of crit spins.
- **Armor**: each spin is calculated against the armor it actually hits. Against champions, Judgment removes 25% armor after 6 spins, and Black Cleaver adds 6% per stack (up to 5 stacks, one per hit). Percent reductions multiply together, then percent armor penetration applies, then lethality.
- Only one Last Whisper item (Last Whisper, Lord Dominik's Regards, Mortal Reminder, Serylda's Grudge) can be equipped.

### Combos

The combo is against a single target, so Judgment always gets the nearest-enemy bonus.

- **Decisive Strike (Q)** is an empowered attack: 100% AD that can crit, plus 30/60/90/120/150 + 50% AD bonus physical damage that can't crit.
- **Order matters for armor**. Q then E gives Judgment one extra Black Cleaver stack. E then Q hits after Judgment's armor shred and all its Black Cleaver stacks.
- **Demacian Justice (R)** deals 125/200/275 + 25/30/35% of the target's missing health as true damage, using the health left after the rest of the combo. It shows as "Not needed" if the target is already dead.
- **Starting health** lets you calculate the combo against a target that has already taken damage.

### Runes and item passives

Since V26.09, damage-dealt bonuses add together rather than multiplying.

| Modifier | Value | Applies to |
| --- | --- | --- |
| Last Stand | 5% below 60% health, up to 11% at 30% health | Q, E and R |
| Axiom Arcanist | 12% (single target) | R |
| Spear of Shojin | 3% per stack, up to 4 stacks | Q's bonus damage, E and R |
| Giant Slayer (Lord Dominik's Regards) | 1% per 100 bonus health on the target, up to 15% at 1500 | Q, E and R, champions only |
| Cinderbloom (Shadowflame) | 20% × (1 + bonus crit damage), so 26% with Infinity Edge | R, when the target is below 40% health |

The sliders set the value that applies for the whole combo, for example how many Shojin stacks are built before it starts. Shojin and Giant Slayer only appear while their item is equipped. Shadowflame is an AP item and has no AD stats, so it's a separate toggle rather than an item you equip. Cinderbloom is its own multiplier on top of the other bonuses.

These modifiers also apply to the Judgment breakdown and per-spin chart.

Not modelled: other runes, other conditional item passives (Terminus, Hubris, and so on), and extra damage from items like Bastionbreaker.

## Running locally

The page loads its data with `fetch`, so it has to be served over HTTP rather than opened as a file:

```sh
npx http-server
```

Then open the address it prints (usually http://localhost:8080).

## Updating for a new patch

```sh
node tools/update-data.js
```

This rewrites `data/garen.json`, `data/items.json` and `data/modifiers.json` from:

- [Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon) for the latest patch number, item stats, item descriptions and icons
- [CommunityDragon](https://www.communitydragon.org/) for Garen's base stats, his Q, E and R damage values (which Data Dragon doesn't include), and rune descriptions

Rune and item passive values are read from their descriptions. If Riot rewords one, the script stops with an error saying which value it couldn't find, before writing any files.

Check the diff of the JSON files before committing so you can see what changed that patch.

## Credits

Originally created by [lamoo7](https://github.com/lamoo7/spin-calculator). 

## Legal

Garen Spin Calculator isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
