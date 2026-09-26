# Garen Spin Calculator

A calculator for the damage of Garen's **Judgment** (E) in League of Legends. Pick Garen's level, E rank, items and the enemy's armor to see:

- how many spins you get (7, plus 1 per 25% bonus attack speed from items and levels)
- damage per spin, per crit spin, and on the nearest enemy (+25%)
- total E damage, including expected crit damage and armor shred

## How the damage is calculated

- **Per spin**: base damage by rank + a percentage of total AD by rank (values come from the game data, see below).
- **Crits**: Judgment only gets 30% of your crit damage. A crit spin does `1 + 0.3 × (crit damage − 1)`, which is 130% normally and 139% with Infinity Edge. Total damage uses your crit chance as the expected share of crit spins.
- **Armor**: each spin is calculated against the armor it actually hits. Against champions, Judgment removes 25% armor after 6 spins, and Black Cleaver adds 6% per stack (up to 5 stacks, one per spin). Percent reductions multiply together, then percent armor penetration applies, then lethality.
- Only one Last Whisper item (Last Whisper, Lord Dominik's Regards, Mortal Reminder, Serylda's Grudge) can be equipped.

Not modelled: runes, conditional item passives (Terminus, Hubris, and so on), and extra damage from items like Bastionbreaker.

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

This rewrites `data/garen.json` and `data/items.json` from:

- [Data Dragon](https://developer.riotgames.com/docs/lol#data-dragon) for the latest patch number, item stats and icons
- [CommunityDragon](https://www.communitydragon.org/) for Garen's base stats and Judgment's damage values, which Data Dragon doesn't include

Check the diff of the two JSON files before committing so you can see what changed that patch.

## Credits

Originally created by [lamoo7](https://github.com/lamoo7/spin-calculator). 

## Legal

Garen Spin Calculator isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
