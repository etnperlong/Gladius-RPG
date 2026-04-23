import { useCallback, useEffect, useRef, useState } from "react";

import {
  INITIAL_EQUIPMENT,
  INITIAL_PLAYER,
} from "../game/constants";
import { clearGameState, loadGameState, saveGameState } from "../game/persistence";
import type {
  RuntimeArenaOpponent,
  RuntimeItem,
  RuntimePlayer,
  RuntimeQuestState,
  RuntimeReplay,
} from "../game/types";

type AnyRecord = Record<string, any>;
type AnyList = any[];

// ══════════════════════════════════════════════════════════════════════════════
// WEAPON CATEGORIES — each has unique passive combat traits
// ══════════════════════════════════════════════════════════════════════════════
const WEAPON_CATEGORIES: AnyRecord = {
  sword:    { label:"劍",     icon:"⚔️",  trait:"balanced",   traitDesc:"平衡型，無特殊效果"             },
  dagger:   { label:"匕首",   icon:"🗡️",  trait:"swift",      traitDesc:"速度+3，首回合傷害×1.5"         },
  axe:      { label:"斧",     icon:"🪓",  trait:"armorbreak", traitDesc:"無視敵方 20% 防禦"              },
  hammer:   { label:"錘",     icon:"🔨",  trait:"stun",       traitDesc:"10% 機率使敵人本回合無法攻擊"   },
  spear:    { label:"長矛",   icon:"🏹",  trait:"firstblood", traitDesc:"先手攻擊，永遠先出手"           },
  trident:  { label:"三叉戟", icon:"🔱",  trait:"bleed",      traitDesc:"造成流血，每回合額外 3 傷害"    },
  sickle:   { label:"鐮刀",   icon:"☽",   trait:"crit_boost", traitDesc:"爆擊率額外 +10%"               },
  angel:    { label:"死亡天使",icon:"🪽",  trait:"soulstrike",  traitDesc:"低血時傷害+50%（敵人HP<30%）"  },
  club:     { label:"棍棒",   icon:"🪵",  trait:"bonecrush",  traitDesc:"每回合額外 2 點固定傷害"        },
  staff:    { label:"法杖",   icon:"🪄",  trait:"spellpower", traitDesc:"吸血效果翻倍"                   },
};

const EQUIP_SLOTS: AnyList = [
  { id:"weapon",  label:"武器",   icon:"⚔️",  row:0 },
  { id:"offhand", label:"副手",   icon:"🛡️",  row:0 },
  { id:"helmet",  label:"頭盔",   icon:"⛑️",  row:1 },
  { id:"armor",   label:"胸甲",   icon:"🥋",  row:1 },
  { id:"gloves",  label:"手套",   icon:"🧤",  row:2 },
  { id:"boots",   label:"靴子",   icon:"👢",  row:2 },
  { id:"ring",    label:"戒指",   icon:"💍",  row:3 },
  { id:"amulet",  label:"護符",   icon:"📿",  row:3 },
];

const ENHANCE_LEVELS: AnyList = [
  { lv:1,  rate:0.90, costMult:1.0,  bonus:0.08 },
  { lv:2,  rate:0.85, costMult:1.2,  bonus:0.08 },
  { lv:3,  rate:0.80, costMult:1.5,  bonus:0.10 },
  { lv:4,  rate:0.65, costMult:2.0,  bonus:0.10 },
  { lv:5,  rate:0.55, costMult:3.0,  bonus:0.12 },
  { lv:6,  rate:0.45, costMult:4.5,  bonus:0.12 },
  { lv:7,  rate:0.35, costMult:6.5,  bonus:0.15 },
  { lv:8,  rate:0.25, costMult:9.0,  bonus:0.15 },
  { lv:9,  rate:0.15, costMult:13.0, bonus:0.20 },
  { lv:10, rate:0.08, costMult:20.0, bonus:0.20 },
];

function enhanceCost(item) {
  const base = Math.max(30, calcSellPrice(item) * 1.5);
  const lvData = ENHANCE_LEVELS[(item.enhLv||0)];
  return lvData ? Math.floor(base * lvData.costMult) : 0;
}

function applyEnhanceBonus(item) {
  if(!item.enhLv || item.enhLv === 0) return item;
  const totalBonus = ENHANCE_LEVELS.slice(0, item.enhLv).reduce((s,l) => s + l.bonus, 0);
  return {
    ...item,
    attack:  Math.floor((item.baseAttack  ||item.attack||0)  * (1 + totalBonus)),
    defense: Math.floor((item.baseDefense ||item.defense||0) * (1 + totalBonus)),
    hp:      Math.floor((item.baseHp      ||item.hp||0)      * (1 + totalBonus)),
    speed:   Math.floor((item.baseSpeed   ||item.speed||0)   * (1 + totalBonus)),
  };
}

const TRAIN_STATS: AnyList = [
  { id:"trainedAtk", label:"攻擊力", icon:"⚔️", color:"#c8781e", desc:"永久提升基礎攻擊" },
  { id:"trainedDef", label:"防禦力", icon:"🛡️", color:"#4a9fd4", desc:"永久提升基礎防禦" },
  { id:"trainedHp",  label:"生命值", icon:"❤️", color:"#c84040", desc:"永久提升最大HP",  hpStat:true },
  { id:"trainedSpd", label:"速度",   icon:"💨", color:"#4caf50", desc:"永久提升速度"     },
];

function trainCost(playerLevel, currentTrained) {
  return Math.max(5, Math.floor(playerLevel * 5 + currentTrained * 8));
}

const BASE_WEAPONS: AnyList = [
  { name:"短劍",    slot:"weapon", cat:"sword",   attack:6,  icon:"⚔️", lvReq:1  },
  { name:"長劍",    slot:"weapon", cat:"sword",   attack:11, icon:"⚔️", lvReq:4  },
  { name:"闊劍",    slot:"weapon", cat:"sword",   attack:17, icon:"⚔️", lvReq:8  },
  { name:"格鬥劍",  slot:"weapon", cat:"sword",   attack:22, icon:"⚔️", lvReq:12 },
  { name:"匕首",    slot:"weapon", cat:"dagger",  attack:5,  speed:2, icon:"🗡️", lvReq:1 },
  { name:"刺刀",    slot:"weapon", cat:"dagger",  attack:9,  speed:3, icon:"🗡️", lvReq:4 },
  { name:"影刃",    slot:"weapon", cat:"dagger",  attack:14, speed:4, icon:"🗡️", lvReq:8 },
  { name:"手斧",    slot:"weapon", cat:"axe",     attack:8,  icon:"🪓", lvReq:2  },
  { name:"戰斧",    slot:"weapon", cat:"axe",     attack:15, icon:"🪓", lvReq:6  },
  { name:"雙頭戰斧",slot:"weapon", cat:"axe",     attack:24, icon:"🪓", lvReq:11 },
  { name:"木槌",    slot:"weapon", cat:"hammer",  attack:7,  icon:"🔨", lvReq:1  },
  { name:"戰鎚",    slot:"weapon", cat:"hammer",  attack:13, icon:"🔨", lvReq:5  },
  { name:"重力鎚",  slot:"weapon", cat:"hammer",  attack:21, icon:"🔨", lvReq:10 },
  { name:"短矛",    slot:"weapon", cat:"spear",   attack:8,  icon:"🏹", lvReq:2  },
  { name:"長矛",    slot:"weapon", cat:"spear",   attack:14, icon:"🏹", lvReq:6  },
  { name:"龍牙矛",  slot:"weapon", cat:"spear",   attack:22, icon:"🏹", lvReq:11 },
  { name:"漁夫三叉戟",slot:"weapon",cat:"trident", attack:9,  icon:"🔱", lvReq:3  },
  { name:"戰士三叉戟",slot:"weapon",cat:"trident", attack:18, icon:"🔱", lvReq:9  },
  { name:"收割鐮",  slot:"weapon", cat:"sickle",  attack:7,  icon:"☽",  lvReq:2  },
  { name:"死亡鐮",  slot:"weapon", cat:"sickle",  attack:16, icon:"☽",  lvReq:8  },
  { name:"死神之翼",slot:"weapon", cat:"angel",   attack:20, icon:"🪽", lvReq:10 },
  { name:"末日使者",slot:"weapon", cat:"angel",   attack:28, icon:"🪽", lvReq:14 },
  { name:"棍棒",    slot:"weapon", cat:"club",    attack:5,  icon:"🪵", lvReq:1  },
  { name:"法杖",    slot:"weapon", cat:"staff",   attack:10, icon:"🪄", lvReq:3  },
  { name:"古代法杖",slot:"weapon", cat:"staff",   attack:18, icon:"🪄", lvReq:9  },
];

const BASE_OFFHANDS: AnyList = [
  { name:"木盾",   slot:"offhand", defense:4,  hp:10, icon:"🛡️", lvReq:1 },
  { name:"鐵盾",   slot:"offhand", defense:8,  hp:20, icon:"🛡️", lvReq:4 },
  { name:"塔盾",   slot:"offhand", defense:14, hp:35, icon:"🛡️", lvReq:8 },
  { name:"龍鱗盾", slot:"offhand", defense:20, hp:50, icon:"🛡️", lvReq:12},
  { name:"魔法典籍",slot:"offhand", attack:5,  hp:15, icon:"📖", lvReq:5 },
];
const BASE_HELMETS: AnyList = [
  { name:"皮帽",   slot:"helmet", defense:3,  hp:15, icon:"⛑️", lvReq:1 },
  { name:"鐵盔",   slot:"helmet", defense:6,  hp:22, icon:"⛑️", lvReq:4 },
  { name:"鋼盔",   slot:"helmet", defense:10, hp:32, icon:"🪖", lvReq:8 },
  { name:"龍骨盔", slot:"helmet", defense:15, hp:50, icon:"🪖", lvReq:12},
];
const BASE_ARMORS: AnyList = [
  { name:"皮甲",   slot:"armor", defense:4,        icon:"🥋", lvReq:1 },
  { name:"鎖甲",   slot:"armor", defense:9,        icon:"🥋", lvReq:3 },
  { name:"板甲",   slot:"armor", defense:16,       icon:"🥋", lvReq:7 },
  { name:"法袍",   slot:"armor", defense:5, hp:25,  icon:"👘", lvReq:2 },
  { name:"龍鱗甲", slot:"armor", defense:22,       icon:"🥋", lvReq:12},
];
const BASE_GLOVES: AnyList = [
  { name:"皮手套",  slot:"gloves", defense:2, attack:1, icon:"🧤", lvReq:1 },
  { name:"鐵腕甲",  slot:"gloves", defense:5, attack:2, icon:"🧤", lvReq:5 },
  { name:"爪刃手套",slot:"gloves", defense:4, attack:5, icon:"🧤", lvReq:9 },
];
const BASE_BOOTS: AnyList = [
  { name:"皮靴",   slot:"boots", defense:2, speed:1, icon:"👢", lvReq:1 },
  { name:"鐵靴",   slot:"boots", defense:5, speed:1, icon:"👢", lvReq:5 },
  { name:"疾風靴", slot:"boots", defense:3, speed:4, icon:"👢", lvReq:9 },
];
const BASE_RINGS: AnyList = [
  { name:"銅戒指",  slot:"ring", attack:2,  icon:"💍", lvReq:1 },
  { name:"銀戒指",  slot:"ring", attack:4,  icon:"💍", lvReq:5 },
  { name:"金戒指",  slot:"ring", hp:20,     icon:"💍", lvReq:3 },
  { name:"寶石戒指",slot:"ring", attack:6, defense:3, icon:"💍", lvReq:9 },
];
const BASE_AMULETS: AnyList = [
  { name:"骨質護符", slot:"amulet", defense:3,        icon:"📿", lvReq:1 },
  { name:"月神護符", slot:"amulet", hp:25,            icon:"📿", lvReq:4 },
  { name:"戰神護符", slot:"amulet", attack:5,         icon:"📿", lvReq:7 },
  { name:"龍魂護符", slot:"amulet", attack:4, hp:30,  icon:"📿", lvReq:11},
];

const ALL_BASE_ITEMS: AnyList = [
  ...BASE_WEAPONS, ...BASE_OFFHANDS, ...BASE_HELMETS, ...BASE_ARMORS,
  ...BASE_GLOVES, ...BASE_BOOTS, ...BASE_RINGS, ...BASE_AMULETS,
];

function calcSellPrice(item) {
  if(!item) return 0;
  const rarMult = {normal:1, magic:2.5, rare:6, legendary:15, mythic:35}[item.rarity||"normal"]||1;
  const statSum = (item.attack||0)+(item.defense||0)+(item.hp||0)*0.4+(item.speed||0)*2;
  const lvMult  = item.itemLevel ? (1 + item.itemLevel*0.05) : 1;
  if(item.type==="potion") return Math.max(5, Math.floor(item.cost*0.4||10));
  if(item.type==="merc_scroll") return Math.floor(30 * rarMult);
  return Math.max(5, Math.floor(statSum * rarMult * lvMult * 0.4));
}

function genShopItem(playerLevel, slotHint=null) {
  const slots = ["weapon","offhand","armor","helmet","gloves","boots","ring","amulet"];
  const slot = slotHint || slots[Math.floor(Math.random()*slots.length)];
  const pool  = ALL_BASE_ITEMS.filter(b=>b.slot===slot && b.lvReq <= playerLevel+3);
  const base  = pool.length ? pool[Math.floor(Math.random()*pool.length)]
                             : ALL_BASE_ITEMS.find(b=>b.slot===slot) || ALL_BASE_ITEMS[0];
  const rar   = rollRarity(Math.min(0.4, playerLevel*0.01));
  const aff   = rollAffixes(base.slot, rar, playerLevel);
  const name  = buildName(base, rar, aff);
  const bon   = {attack:0,defense:0,hp:0,speed:0};
  const spec  = [];
  for(const a of aff){
    if(a.stat) bon[a.stat]=(bon[a.stat]||0)+a.rolledVal;
    if(a.special) spec.push({type:a.special,val:a.rolledVal});
  }
  const sc = itemLevelScale(playerLevel);
  const item = {
    ...base, name,
    attack:  Math.floor(((base.attack||0)+bon.attack)*sc),
    defense: Math.floor(((base.defense||0)+bon.defense)*sc),
    hp:      Math.floor(((base.hp||0)+bon.hp)*sc),
    speed:   Math.floor(((base.speed||0)+bon.speed)*sc),
    rarity:rar.id, rarityLabel:rar.label, rarityColor:rar.color, rarityGlow:rar.glow||"",
    affixes:aff, specials:spec,
    uid:Date.now()+Math.random(),
    type:base.slot, itemLevel:playerLevel,
  };
  const rarCostMult = {normal:1,magic:2.8,rare:7,legendary:18,mythic:45}[rar.id]||1;
  item.cost = Math.floor(calcSellPrice(item) * 2.5 * rarCostMult);
  return item;
}

function genAuctionItem(playerLevel) {
  const rarPool = ["rare","legendary","mythic"];
  const forcedGrade = rarPool[Math.floor(Math.random()*rarPool.length)];
  const item = genShopItem(playerLevel);
  const rar = getRarity(forcedGrade);
  const slots = ["weapon","offhand","armor","helmet","gloves","boots","ring","amulet"];
  const slot = slots[Math.floor(Math.random()*slots.length)];
  const pool = ALL_BASE_ITEMS.filter(b=>b.slot===slot&&b.lvReq<=playerLevel+3);
  const base = pool.length ? pool[Math.floor(Math.random()*pool.length)] : ALL_BASE_ITEMS[0];
  const aff  = rollAffixes(base.slot, rar, playerLevel);
  const name = buildName(base, rar, aff);
  const bon  = {attack:0,defense:0,hp:0,speed:0};
  const spec = [];
  for(const a of aff){ if(a.stat)bon[a.stat]=(bon[a.stat]||0)+a.rolledVal; if(a.special)spec.push({type:a.special,val:a.rolledVal}); }
  const sc = itemLevelScale(playerLevel);
  const auctionItem = {
    ...base, name,
    attack:  Math.floor(((base.attack||0)+bon.attack)*sc),
    defense: Math.floor(((base.defense||0)+bon.defense)*sc),
    hp:      Math.floor(((base.hp||0)+bon.hp)*sc),
    speed:   Math.floor(((base.speed||0)+bon.speed)*sc),
    rarity:rar.id, rarityLabel:rar.label, rarityColor:rar.color, rarityGlow:rar.glow||"",
    affixes:aff, specials:spec,
    uid:Date.now()+Math.random(), type:base.slot, itemLevel:playerLevel,
  };
  const rarCostMult={normal:1,magic:2.8,rare:7,legendary:18,mythic:45}[rar.id]||1;
  auctionItem.cost = Math.floor(calcSellPrice(auctionItem)*2.5*rarCostMult);
  const baseBid = Math.floor(auctionItem.cost*0.5);
  return {
    ...auctionItem,
    auctionId: Date.now()+Math.random(),
    baseBid, currentBid:baseBid, myBid:0,
    bidCount: Math.floor(Math.random()*5),
    endsIn: Math.floor(3+Math.random()*5),
    sold: false,
  };
}

const RARITIES: AnyList = [
  { id:"normal",    label:"普通", weight:50, color:"#c8c8b0", glow:"",                      maxAffixes:0 },
  { id:"magic",     label:"魔法", weight:28, color:"#4caf50", glow:"0 0 8px #4caf5066",     maxAffixes:2 },
  { id:"rare",      label:"稀有", weight:14, color:"#4a9fd4", glow:"0 0 8px #4a9fd466",     maxAffixes:4 },
  { id:"legendary", label:"傳說", weight:5,  color:"#9c50d4", glow:"0 0 10px #9c50d455",    maxAffixes:6 },
  { id:"mythic",    label:"神話", weight:3,  color:"#e07020", glow:"0 0 14px #e0702055",    maxAffixes:8 },
];

const getRarity = id => RARITIES.find(r=>r.id===id) || RARITIES[0];

function itemLevelScale(playerLevel) {
  const tier = Math.floor(playerLevel / 10);
  return Math.pow(1.25, tier);
}

const MERC_BASES: AnyList = [
  { id:"soldier",  name:"退役士兵",   icon:"🗡️", attack:8,  defense:3,  hp:60,  heal:0, desc:"穩定輸出型步兵",   grade:"normal"    },
  { id:"archer",   name:"流浪弓手",   icon:"🏹", attack:14, defense:1,  hp:40,  heal:0, desc:"高攻擊低防禦",     grade:"magic"     },
  { id:"smith",    name:"矮人鐵匠",   icon:"⚒️", attack:6,  defense:12, hp:100, heal:0, desc:"高防替你擋傷",     grade:"rare"      },
  { id:"mage",     name:"侏儒法師",   icon:"🧙", attack:20, defense:2,  hp:35,  heal:0, desc:"最高傷害輸出",     grade:"legendary" },
  { id:"healer",   name:"精靈治癒師", icon:"🧝", attack:5,  defense:4,  hp:50,  heal:8, desc:"每回合回復 8HP",   grade:"mythic"    },
  { id:"berserker",name:"狂戰士",     icon:"🪖", attack:25, defense:5,  hp:80,  heal:0, desc:"狂暴：攻擊+30%",   grade:"legendary" },
  { id:"paladin",  name:"聖騎士",     icon:"⚜️", attack:12, defense:15, hp:120, heal:5, desc:"聖護：防禦+回血",  grade:"mythic"    },
  { id:"assassin", name:"暗殺者",     icon:"🌑", attack:30, defense:2,  hp:30,  heal:0, desc:"暗殺：首攻×2",     grade:"mythic"    },
];

const MERC_SCROLL_AFFIXES: AnyList = [
  { id:"ms_atk",   tag:"勇武", stat:"attack",  min:3,  max:15 },
  { id:"ms_def",   tag:"堅壁", stat:"defense", min:2,  max:10 },
  { id:"ms_hp",    tag:"強健", stat:"hp",      min:10, max:50 },
  { id:"ms_heal",  tag:"治癒", stat:"heal",    min:1,  max:6  },
  { id:"ms_all",   tag:"精英", special:"all",  val:0.15 },
  { id:"ms_first", tag:"先鋒", special:"first", val:0.25 },
];

function genMercScroll(playerLevel, forceGrade=null) {
  const bonus = Math.min(0.5, playerLevel * 0.015);
  const rar = forceGrade ? getRarity(forceGrade) : rollRarity(bonus);
  const eligBases = MERC_BASES.filter(b => {
    const bRar = RARITIES.findIndex(r=>r.id===b.grade);
    const sRar = RARITIES.findIndex(r=>r.id===rar.id);
    return bRar <= sRar + 1;
  });
  const chosenBase = eligBases[Math.floor(Math.random() * eligBases.length)];
  const affixCount = rar.id==="mythic"?3 : rar.id==="legendary"?2 : rar.id==="rare"?1 : 0;
  const rolledAffixes = [];
  const usedAff = new Set();
  const sc = 1 + (playerLevel - 1) * 0.05;
  for (let i = 0; i < affixCount; i++) {
    const pool = MERC_SCROLL_AFFIXES.filter(a => !usedAff.has(a.id));
    if (!pool.length) break;
    const a = pool[Math.floor(Math.random() * pool.length)];
    usedAff.add(a.id);
    if (a.stat) rolledAffixes.push({...a, rolledVal: Math.round((a.min + Math.random()*(a.max-a.min))*sc)});
    else rolledAffixes.push({...a, rolledVal: a.val});
  }
  const bon = {attack:0, defense:0, hp:0, heal:0};
  const specials = [];
  for (const a of rolledAffixes) {
    if (a.stat) bon[a.stat] += a.rolledVal;
    if (a.special) specials.push({type:a.special, val:a.rolledVal});
  }
  const pre = rolledAffixes.find(a=>a.stat);
  const suf = rolledAffixes.find(a=>a.special);
  let name = chosenBase.name;
  if (pre) name = pre.tag + name;
  if (suf) name = name + "·" + suf.tag;
  if (rar.id==="mythic") name = "【神話】" + name;
  return {
    ...chosenBase,
    name,
    attack:  chosenBase.attack  + bon.attack,
    defense: chosenBase.defense + bon.defense,
    hp:      chosenBase.hp      + bon.hp,
    heal:    (chosenBase.heal||0) + bon.heal,
    rarity:  rar.id, rarityLabel: rar.label, rarityColor: rar.color, rarityGlow: rar.glow||"",
    affixes: rolledAffixes, specials,
    uid: Date.now() + Math.random(),
    type: "merc_scroll",
    slot: "merc_scroll",
    scrollGrade: rar.id,
  };
}

const SG: AnyRecord = {
  weapon:  ["weapon"],
  armor:   ["armor","offhand","helmet","gloves","boots"],
  jewelry: ["ring","amulet"],
  all:     ["weapon","offhand","armor","helmet","gloves","boots","ring","amulet"],
};

const AFFIXES: AnyList = [
  { id:"sharp",     tag:"鋒利",   type:"prefix", stat:"attack",  min:3,  max:10, slots:SG.weapon },
  { id:"heavy",     tag:"沉重",   type:"prefix", stat:"attack",  min:5,  max:14, slots:SG.weapon },
  { id:"blessed",   tag:"神佑",   type:"prefix", stat:"attack",  min:8,  max:20, slots:SG.weapon },
  { id:"brutal",    tag:"殘酷",   type:"prefix", stat:"attack",  min:12, max:28, slots:SG.weapon },
  { id:"sturdy",    tag:"堅固",   type:"prefix", stat:"defense", min:3,  max:8,  slots:SG.armor  },
  { id:"fortified", tag:"強化",   type:"prefix", stat:"defense", min:5,  max:14, slots:[...SG.armor,...SG.weapon] },
  { id:"vital",     tag:"活力",   type:"prefix", stat:"hp",      min:15, max:45, slots:SG.all    },
  { id:"swift",     tag:"迅捷",   type:"prefix", stat:"speed",   min:2,  max:7,  slots:[...SG.weapon,...SG.armor,"boots"] },
  { id:"power",     tag:"力量",   type:"prefix", stat:"attack",  min:4,  max:12, slots:[...SG.jewelry] },
  { id:"resilient", tag:"韌性",   type:"prefix", stat:"defense", min:3,  max:9,  slots:[...SG.jewelry] },
  { id:"lifesteal", tag:"吸血",   type:"suffix", special:"lifesteal", val:[3,10],  slots:SG.weapon },
  { id:"thorns",    tag:"荊棘",   type:"suffix", special:"thorns",    val:[2,8],   slots:SG.armor  },
  { id:"crit",      tag:"爆擊",   type:"suffix", special:"crit",      val:[5,25],  slots:SG.weapon },
  { id:"regen",     tag:"回復",   type:"suffix", special:"regen",     val:[2,6],   slots:[...SG.armor,...SG.jewelry] },
  { id:"fury",      tag:"狂怒",   type:"suffix", special:"fury",      val:[4,12],  slots:SG.weapon },
  { id:"pierce",    tag:"穿透",   type:"suffix", special:"pierce",    val:[10,30], slots:SG.weapon },
  { id:"vampiric",  tag:"吸魂",   type:"suffix", special:"vampiric",  val:[5,15],  slots:[...SG.armor,...SG.jewelry] },
  { id:"reflect",   tag:"反射",   type:"suffix", special:"reflect",   val:[3,10],  slots:["offhand"] },
];

const MONSTERS: AnyRecord = {
  wolf:       { name:"餓狼",     icon:"🐺", hpM:0.8,  atkM:0.9,  defM:0.5,  trait:"swift",    traitDesc:"先手攻擊",         lore:"飢餓的野狼，速度極快"         },
  boar:       { name:"野豬",     icon:"🐗", hpM:1.1,  atkM:1.0,  defM:0.8,  trait:"charge",   traitDesc:"第一擊傷害+30%",   lore:"憤怒衝鋒的野豬"               },
  bandit:     { name:"山賊",     icon:"🗡️", hpM:0.9,  atkM:1.1,  defM:0.7,  trait:"dodge",    traitDesc:"20%閃避",          lore:"亡命之徒，出手狡猾"           },
  wolfKing:   { name:"狼王",     icon:"🐺", hpM:2.5,  atkM:1.8,  defM:1.2,  trait:"howl",     traitDesc:"戰吼：攻擊+20%",   lore:"統領狼群的古老王者", boss:true },
  goblin:     { name:"地精",     icon:"👺", hpM:0.7,  atkM:1.0,  defM:0.6,  trait:"swarm",    traitDesc:"成群時攻擊+15%",   lore:"矮小貪婪的礦坑居民"           },
  ghostMiner: { name:"礦工亡魂", icon:"👻", hpM:0.8,  atkM:1.2,  defM:0.3,  trait:"phase",    traitDesc:"無視25%防禦",      lore:"死於坑難的礦工怨靈"           },
  golem:      { name:"石巨人",   icon:"🪨", hpM:1.8,  atkM:0.9,  defM:1.5,  trait:"armor",    traitDesc:"防禦+50%",         lore:"礦石能量凝聚而成的巨型石人"   },
  mineLord:   { name:"礦坑主",   icon:"⛏️", hpM:2.8,  atkM:1.6,  defM:1.8,  trait:"collapse", traitDesc:"每5回合岩石崩落",  lore:"腐化的礦坑領主", boss:true    },
  skeleton:   { name:"骷髏兵",   icon:"💀", hpM:0.7,  atkM:0.9,  defM:0.8,  trait:"undead",   traitDesc:"30%免疫流血",      lore:"被詛咒的古代士兵"             },
  cultist:    { name:"黑暗祭司", icon:"🧎", hpM:0.8,  atkM:1.3,  defM:0.5,  trait:"curse",    traitDesc:"詛咒：攻擊-10%",   lore:"供奉黑暗神明的祭司"           },
  demon:      { name:"惡魔",     icon:"😈", hpM:1.2,  atkM:1.4,  defM:0.9,  trait:"fire",     traitDesc:"火焰：每回合燒傷2",lore:"從地獄召喚的低階惡魔"         },
  templeGuard:{ name:"神殿守護者",icon:"🏛️",hpM:3.0,  atkM:2.0,  defM:1.5,  trait:"divine",   traitDesc:"神力護盾：首回合免傷",lore:"古神的最後守衛", boss:true   },
  wyvern:     { name:"幼龍",     icon:"🐲", hpM:1.3,  atkM:1.3,  defM:1.0,  trait:"breathe",  traitDesc:"龍息：額外傷害",   lore:"尚未成年的幼龍，仍極危險"     },
  fireGiant:  { name:"火焰巨人", icon:"🔥", hpM:2.0,  atkM:1.5,  defM:0.8,  trait:"inferno",  traitDesc:"每3回合全力一擊",  lore:"熔岩鑄造的巨人戰士"           },
  dragonKnight:{name:"龍族武士", icon:"⚔️", hpM:1.5,  atkM:1.6,  defM:1.3,  trait:"dragonArmor",traitDesc:"鱗甲：防禦+40%",lore:"古龍麾下最強戰士"             },
  ancientDragon:{name:"古龍",    icon:"🐉", hpM:4.0,  atkM:2.5,  defM:2.0,  trait:"dragonRage",traitDesc:"低血爆怒+60%傷害",lore:"千年古龍，大地之王", boss:true },
  shadowBeast:{ name:"暗影獸",   icon:"🌑", hpM:1.0,  atkM:1.4,  defM:0.7,  trait:"dark",     traitDesc:"黑暗：降低視野-攻擊",lore:"黑暗中游走的詭異生物"       },
  lich:       { name:"巫妖",     icon:"🧙", hpM:1.1,  atkM:1.8,  defM:0.6,  trait:"soulSuck", traitDesc:"吸魂：回復已損失HP的5%",lore:"追求永生的邪惡術士"       },
  titan:      { name:"泰坦",     icon:"🗿", hpM:2.5,  atkM:1.4,  defM:2.2,  trait:"stonewall", traitDesc:"石牆：每回合回復5HP",lore:"遠古時代的神秘巨人"          },
  abyssLord:  { name:"深淵之主", icon:"🌀", hpM:4.5,  atkM:2.8,  defM:2.0,  trait:"voidRip",  traitDesc:"虛空裂縫：無視防禦",lore:"從虛空而來的毀滅存在", boss:true},
};

const EXPEDITIONS: AnyList = [
  { id:"e1", name:"狼群獵場",  icon:"🐺", minLv:1,  monster:"wolf",        desc:"追蹤並獵殺草原餓狼",       expMult:0.8, goldMult:0.8, lootBonus:0    },
  { id:"e2", name:"山賊巢穴",  icon:"🗡️", minLv:2,  monster:"bandit",      desc:"清除盤踞山路的盜賊",       expMult:0.9, goldMult:1.1, lootBonus:0    },
  { id:"e3", name:"憤怒野豬",  icon:"🐗", minLv:2,  monster:"boar",        desc:"獵殺橫衝直撞的野豬",       expMult:0.9, goldMult:0.9, lootBonus:0.05 },
  { id:"e4", name:"礦坑地精",  icon:"👺", minLv:3,  monster:"goblin",      desc:"肅清礦坑中的地精群",       expMult:1.0, goldMult:1.0, lootBonus:0.05 },
  { id:"e5", name:"亡魂追擊",  icon:"👻", minLv:4,  monster:"ghostMiner",  desc:"驅散礦坑中的礦工怨靈",     expMult:1.1, goldMult:0.8, lootBonus:0.10 },
  { id:"e6", name:"骷髏哨所",  icon:"💀", minLv:5,  monster:"skeleton",    desc:"消滅神殿外的骷髏守衛",     expMult:1.0, goldMult:1.0, lootBonus:0.08 },
  { id:"e7", name:"黑暗儀式",  icon:"🧎", minLv:6,  monster:"cultist",     desc:"阻止祭司完成黑暗儀式",     expMult:1.2, goldMult:0.9, lootBonus:0.12 },
  { id:"e8", name:"惡魔現身",  icon:"😈", minLv:7,  monster:"demon",       desc:"討伐從地獄爬出的惡魔",     expMult:1.3, goldMult:1.0, lootBonus:0.15 },
  { id:"e9", name:"幼龍試練",  icon:"🐲", minLv:9,  monster:"wyvern",      desc:"挑戰棲息山谷的幼龍",       expMult:1.4, goldMult:1.2, lootBonus:0.18 },
  { id:"e10",name:"暗影獸窟",  icon:"🌑", minLv:11, monster:"shadowBeast", desc:"深入黑暗追殺暗影獸",       expMult:1.5, goldMult:1.1, lootBonus:0.20 },
  { id:"e11",name:"巫妖的塔",  icon:"🧙", minLv:13, monster:"lich",        desc:"攻入巫妖的不死之塔",       expMult:1.8, goldMult:1.0, lootBonus:0.25 },
  { id:"e12",name:"泰坦遺跡",  icon:"🗿", minLv:15, monster:"titan",       desc:"深入遠古遺跡對抗泰坦",     expMult:2.0, goldMult:1.5, lootBonus:0.30 },
];

const DUNGEONS: AnyList = [
  {
    id:1, name:"野狼森林", icon:"🌲", minLv:1,
    lore:"古老森林中，餓狼群和山賊聯手封鎖了道路。傳說深處有一頭稱王的巨狼。",
    waves:[
      { label:"第一波 — 外圍", monsters:["wolf","wolf","boar"],        desc:"巡邏的狼群和野豬" },
      { label:"第二波 — 林中", monsters:["bandit","bandit","wolf"],     desc:"山賊與狼的聯合伏擊" },
      { label:"第三波 — 巢穴", monsters:["boar","wolf","bandit"],       desc:"守衛巢穴的精銳" },
    ],
    boss:"wolfKing",
    bossIntro:"狼王現身！整片森林都在顫抖！",
  },
  {
    id:2, name:"廢棄礦坑", icon:"⛏️", minLv:3,
    lore:"古老礦坑深處藏有珍貴礦石，但礦工們的怨靈和石巨人讓探險者有去無回。",
    waves:[
      { label:"第一波 — 礦道入口", monsters:["goblin","goblin","goblin"],  desc:"成群的地精守衛" },
      { label:"第二波 — 深礦通道", monsters:["ghostMiner","goblin","golem"],desc:"亡魂與石巨人聯手" },
      { label:"第三波 — 礦坑核心", monsters:["golem","ghostMiner","goblin"],desc:"核心守衛精銳部隊" },
    ],
    boss:"mineLord",
    bossIntro:"礦坑主從黑暗中現身，手持巨型鶴嘴鋤！",
  },
  {
    id:3, name:"地下神殿", icon:"🏛️", minLv:6,
    lore:"沉睡千年的古神殿突然甦醒，不死怨靈和黑暗惡魔在石柱間遊蕩，古老的守護者也再度睜眼。",
    waves:[
      { label:"第一波 — 神殿外庭", monsters:["skeleton","skeleton","cultist"], desc:"骷髏兵和黑暗祭司" },
      { label:"第二波 — 祭壇大廳", monsters:["demon","cultist","skeleton"],    desc:"惡魔與祭司的聯合防線" },
      { label:"第三波 — 聖所深處", monsters:["demon","demon","cultist"],        desc:"最強惡魔守衛隊" },
    ],
    boss:"templeGuard",
    bossIntro:"神殿守護者從石像甦醒，散發神聖光輝！",
  },
  {
    id:4, name:"龍穴深淵", icon:"🐉", minLv:10,
    lore:"傳說古龍在深淵深處沉眠了三百年。牠的子嗣守護著洞穴，而覺醒的古龍將毀滅一切。",
    waves:[
      { label:"第一波 — 龍穴入口", monsters:["wyvern","dragonKnight"],       desc:"幼龍與龍族武士" },
      { label:"第二波 — 熔岩走廊", monsters:["fireGiant","wyvern","wyvern"], desc:"火焰巨人和幼龍群" },
      { label:"第三波 — 古龍前廳", monsters:["dragonKnight","dragonKnight","fireGiant"],desc:"龍族精銳" },
    ],
    boss:"ancientDragon",
    bossIntro:"古龍緩跨張開雙眼，千年的怒火瞬間噴發！",
  },
  {
    id:5, name:"虛空深淵", icon:"🌀", minLv:15,
    lore:"現實世界的裂縫正在擴大。暗影獸和巫妖從裂縫中湧出，而深淵之主即將踏入這個世界。",
    waves:[
      { label:"第一波 — 裂縫前線", monsters:["shadowBeast","shadowBeast","lich"],  desc:"暗影獸與巫妖" },
      { label:"第二波 — 虛空領域", monsters:["titan","shadowBeast","lich"],        desc:"泰坦帶領暗影部隊" },
      { label:"第三波 — 深淵核心", monsters:["lich","titan","shadowBeast"],        desc:"深淵最強守衛" },
    ],
    boss:"abyssLord",
    bossIntro:"深淵之主現身！虛空撕裂，現實崩潰！",
  },
];

const DUNGEON_TIERS: AnyList = [
  { id:"normal", label:"普通", color:"#8a9070", mult:1.0,  expMult:1.0, goldMult:1.0, lootBonus:0,    minLvOffset:0 },
  { id:"hero",   label:"英雄", color:"#4a9fd4", mult:1.35, expMult:1.6, goldMult:1.4, lootBonus:0.15, minLvOffset:4 },
  { id:"legend", label:"傳說", color:"#d4b84a", mult:1.75, expMult:2.5, goldMult:2.0, lootBonus:0.28, minLvOffset:8 },
];

const MERC_DUNGEONS: AnyList = [
  {
    id:"m1", label:"城鎮清剿", icon:"🏘️", minLv:1, lvBonus:0,
    lore:"一支盜賊團盤踞城鎮，傭兵們需要正面強攻。",
    waves:[
      { enemies:["bandit","bandit"],         desc:"門口守衛",   mult:0.9 },
      { enemies:["bandit","bandit","bandit"], desc:"主力盜賊隊", mult:1.0 },
    ],
    boss:{ name:"盜賊首領", icon:"🗡️", hpM:2.0, atkM:1.5, defM:1.0, trait:"dodge" },
    reward:{ expMult:1.2, goldMult:1.5, scrollBonus:0.20 },
  },
  {
    id:"m2", label:"礦坑奪寶", icon:"⛏️", minLv:3, lvBonus:2,
    lore:"深層礦坑藏有寶藏，但地精大軍和石巨人在守護。",
    waves:[
      { enemies:["goblin","goblin","goblin"], desc:"地精前鋒隊", mult:0.9 },
      { enemies:["goblin","golem"],           desc:"石巨人現身", mult:1.1 },
      { enemies:["golem","goblin","goblin"],  desc:"寶藏守護者", mult:1.2 },
    ],
    boss:{ name:"巨型石魔", icon:"🪨", hpM:3.0, atkM:1.4, defM:2.5, trait:"armor" },
    reward:{ expMult:1.4, goldMult:2.0, scrollBonus:0.30 },
  },
  {
    id:"m3", label:"神殿淨化", icon:"🏛️", minLv:6, lvBonus:4,
    lore:"被詛咒的神殿充滿不死怨靈，傭兵們需要徹底淨化。",
    waves:[
      { enemies:["skeleton","skeleton"],        desc:"骷髏前哨",   mult:1.0 },
      { enemies:["cultist","demon"],            desc:"祭司與惡魔", mult:1.1 },
      { enemies:["demon","demon","skeleton"],   desc:"惡魔大軍",   mult:1.2 },
    ],
    boss:{ name:"大惡魔君主", icon:"👿", hpM:3.5, atkM:2.0, defM:1.2, trait:"fire" },
    reward:{ expMult:1.8, goldMult:2.5, scrollBonus:0.40 },
  },
  {
    id:"m4", label:"龍巢突襲", icon:"🐉", minLv:10, lvBonus:6,
    lore:"趁古龍沉睡之際突入龍巢，傭兵們能取多少帶多少。",
    waves:[
      { enemies:["wyvern","wyvern"],                    desc:"幼龍巡邏隊",   mult:1.1 },
      { enemies:["dragonKnight","wyvern"],              desc:"龍騎士阻擊",   mult:1.2 },
      { enemies:["fireGiant","dragonKnight","wyvern"],  desc:"龍巢核心守衛", mult:1.4 },
    ],
    boss:{ name:"龍騎將軍", icon:"⚔️", hpM:4.0, atkM:2.2, defM:1.8, trait:"dragonArmor" },
    reward:{ expMult:2.2, goldMult:3.0, scrollBonus:0.50 },
  },
  {
    id:"m5", label:"虛空入侵", icon:"🌀", minLv:15, lvBonus:10,
    lore:"虛空裂縫突然開啟，高等傭兵緊急出動阻擋入侵者。",
    waves:[
      { enemies:["shadowBeast","shadowBeast","lich"],  desc:"虛空先鋒",     mult:1.2 },
      { enemies:["titan","shadowBeast"],               desc:"泰坦壓陣",     mult:1.4 },
      { enemies:["lich","lich","titan"],               desc:"巫妖與泰坦聯軍", mult:1.6 },
    ],
    boss:{ name:"虛空先驅", icon:"🌑", hpM:4.5, atkM:2.5, defM:2.0, trait:"voidRip" },
    reward:{ expMult:3.0, goldMult:4.0, scrollBonus:0.70 },
  },
];

function rollRarity(bonus=0){
  const adj=RARITIES.map(r=>({...r,weight:r.id==="normal"?Math.max(5,r.weight-bonus*80):r.weight+bonus*(r.id==="mythic"?30:r.id==="legendary"?15:5)}));
  const total=adj.reduce((s,r)=>s+r.weight,0); let roll=Math.random()*total;
  for(const r of adj){roll-=r.weight;if(roll<=0)return r;} return adj[0];
}
function rollAffixes(slot,rarity,lv){
  if(rarity.maxAffixes===0)return[];
  const cnt=rarity.id==="mythic"?6:rarity.id==="legendary"?4:rarity.id==="rare"?2+Math.floor(Math.random()*2):1+Math.floor(Math.random()*2);
  const elig=AFFIXES.filter(a=>a.slots.includes(slot)); const ch=[]; const used=new Set();
  for(let i=0;i<cnt&&i<elig.length;i++){
    const pool=elig.filter(a=>!used.has(a.id)); if(!pool.length)break;
    const a=pool[Math.floor(Math.random()*pool.length)]; used.add(a.id);
    const sc=1+(lv-1)*0.07;
    if(a.stat) ch.push({...a,rolledVal:Math.round((a.min+Math.random()*(a.max-a.min))*sc)});
    else{const[lo,hi]=a.val;ch.push({...a,rolledVal:Math.round((lo+Math.random()*(hi-lo))*sc)});}
  }
  return ch;
}
function buildName(base,rarity,affixes){
  if(rarity.id==="normal")return base.name;
  const pre=affixes.find(a=>a.type==="prefix");
  const suf=affixes.find(a=>a.type==="suffix");
  let n=base.name;
  if(pre)n=pre.tag+n;
  if(suf)n=n+"之"+suf.tag;
  if(rarity.id==="mythic") n="【神話】"+n;
  return n;
}
function genLoot(plv, bonus=0, forcedSlot=null){
  const slotGroups = {
    weapon:["weapon"], offhand:["offhand"], helmet:["helmet"],
    armor:["armor"], gloves:["gloves"], boots:["boots"],
    ring:["ring"], amulet:["amulet"],
  };
  let base;
  if(forcedSlot){
    const pool=ALL_BASE_ITEMS.filter(b=>b.slot===forcedSlot&&b.lvReq<=plv+2);
    base=pool[Math.floor(Math.random()*pool.length)];
  } else {
    const slots=Object.keys(slotGroups);
    const chosenSlot=slots[Math.floor(Math.random()*slots.length)];
    const pool=ALL_BASE_ITEMS.filter(b=>b.slot===chosenSlot&&b.lvReq<=plv+2);
    base=pool.length>0 ? pool[Math.floor(Math.random()*pool.length)]
                       : ALL_BASE_ITEMS.filter(b=>b.lvReq<=plv+2)[0];
  }
  const rar=rollRarity(bonus);
  const aff=rollAffixes(base.slot,rar,plv);
  const name=buildName(base,rar,aff);
  const bon={attack:0,defense:0,hp:0,speed:0};
  const spec=[];
  for(const a of aff){
    if(a.stat)bon[a.stat]=(bon[a.stat]||0)+a.rolledVal;
    if(a.special)spec.push({type:a.special,val:a.rolledVal});
  }
  const scale = itemLevelScale(plv);
  return{
    ...base, name,
    attack:  Math.floor(((base.attack||0)  + bon.attack)  * scale),
    defense: Math.floor(((base.defense||0) + bon.defense) * scale),
    hp:      Math.floor(((base.hp||0)      + bon.hp)      * scale),
    speed:   Math.floor(((base.speed||0)   + bon.speed)   * scale),
    rarity:rar.id, rarityLabel:rar.label, rarityColor:rar.color, rarityGlow:rar.glow||"",
    affixes:aff, specials:spec,
    uid:Date.now()+Math.random(),
    type:base.slot,
    itemLevel: plv,
  };
}

const sumEq=(player,stat)=>Object.values(player.equipment).reduce((s,e)=>{
  const item = e as any;
  if(!item) return s;
  const val = item.enhLv>0 ? applyEnhanceBonus(item)[stat]||0 : item[stat]||0;
  return s+val;
},0);
const cAtk =p=>p.attack  +(p.trainedAtk||0)+sumEq(p,"attack");
const cDef =p=>p.defense +(p.trainedDef||0)+sumEq(p,"defense");
const cMhp =p=>p.maxHp   +(p.trainedHp||0)*3+sumEq(p,"hp");
const cSpd =p=>p.speed   +(p.trainedSpd||0)+sumEq(p,"speed");
const gSpec=p=>{const s=[];Object.values(p.equipment).forEach(e=>{const item=e as any;if(item&&item.specials)s.push(...item.specials);});return s;};
const getWeaponCat=p=>{const w=p.equipment.weapon;return w&&w.cat?WEAPON_CATEGORIES[w.cat]:null;};

function applySpec(specials,dmg,target){
  let healed=0,extra=0,isCrit=false;
  for(const s of specials){
    if(s.type==="lifesteal")  healed+=Math.floor(dmg*s.val/100);
    if(s.type==="vampiric")   healed+=Math.floor(dmg*s.val/200);
    if(s.type==="crit"&&Math.random()*100<s.val){extra+=dmg;isCrit=true;}
    if(s.type==="fury"&&target.hp<target.maxHp*0.3) extra+=s.val;
    if(s.type==="pierce") extra+=Math.floor(dmg*s.val/100*0.3);
  }
  return{healed,extra,isCrit};
}

function applyWeaponTrait(cat, dmg, enemy, isFirstRound, bleedStacks){
  let finalDmg=dmg; let log=[]; let newBleed=bleedStacks||0;
  let stunned=false;
  if(!cat) return{finalDmg,log,newBleed,stunned};

  switch(cat.trait){
    case "armorbreak":
      finalDmg=Math.floor(finalDmg*1.2);
      break;
    case "stun":
      if(Math.random()<0.10){stunned=true;log.push(`🌀 【錘】震暈效果！敵人本回合無法攻擊！`);}
      break;
    case "bleed":
      newBleed=Math.min((bleedStacks||0)+1,5);
      log.push(`🩸 【三叉戟】流血層數：${newBleed}`);
      break;
    case "crit_boost":
      if(Math.random()<0.10){finalDmg*=2;log.push(`💥 【鐮刀】爆擊加成觸發！`);}
      break;
    case "soulstrike":
      if(enemy.hp<enemy.maxHp*0.3){finalDmg=Math.floor(finalDmg*1.5);log.push(`👻 【死亡天使】低血觸發！傷害×1.5`);}
      break;
    case "bonecrush":
      finalDmg+=2;
      break;
    case "spellpower":
      break;
  }
  return{finalDmg,log,newBleed,stunned};
}

function buildEnemy(monsterKey, playerLevel, mult=1, isBoss=false) {
  const m = MONSTERS[monsterKey] || MONSTERS.wolf;
  const sc = (0.85 + Math.random()*0.25) * mult;
  const base = playerLevel * 8 + 12;
  const bossHpMult  = isBoss ? 1.6 : 1;
  const bossAtkMult = isBoss ? 1.4 : 1;
  const bossDefMult = isBoss ? 1.2 : 1;
  return {
    key: monsterKey,
    name: m.name, icon: m.icon,
    trait: m.trait, traitDesc: m.traitDesc,
    lore: m.lore, isBoss: m.boss || isBoss,
    hp:      Math.floor(base * m.hpM  * sc * bossHpMult),
    maxHp:   Math.floor(base * m.hpM  * sc * bossHpMult),
    attack:  Math.floor((playerLevel*2.6+4) * m.atkM * sc * bossAtkMult),
    defense: Math.floor((playerLevel*1.3+2) * m.defM * sc * bossDefMult),
    expReward:  Math.floor((playerLevel*10+8) * m.hpM * mult * (isBoss?3:1)),
    goldReward: Math.floor((playerLevel*4+4)  * mult  * (isBoss?4:1)),
    burnStacks: 0, cursed: false, shielded: isBoss,
    regenVal: m.trait==="stonewall"?5:0,
  };
}

function applyMonsterTrait(enemy, dmgToEnemy, log) {
  let finalDmg = dmgToEnemy;
  switch(enemy.trait) {
    case "dodge":
      if(Math.random()<0.2){ finalDmg=0; log.push({txt:`${enemy.icon}${enemy.name} 閃避攻擊！`,type:"enemy"}); } break;
    case "armor":
      finalDmg = Math.floor(finalDmg * 0.6); break;
    case "phase":
      break;
    case "divine":
      if(enemy.shielded){ finalDmg=0; enemy.shielded=false; log.push({txt:`🛡 ${enemy.icon}${enemy.name} 的神力護盾抵擋了攻擊！`,type:"enemy"}); } break;
    case "dragonArmor":
      finalDmg = Math.floor(finalDmg * 0.65); break;
    default: break;
  }
  return finalDmg;
}

function enemyAttackPlayer(enemy, pDef, specials, np, pMhp, log, round) {
  let eDef = pDef;
  let baseDmg = Math.max(1, enemy.attack - eDef + Math.floor(Math.random()*4) - 2);

  if(enemy.trait==="fire") { enemy.burnStacks=(enemy.burnStacks||0)+1; }
  if(enemy.burnStacks>0) {
    np.hp=Math.max(0, np.hp - enemy.burnStacks*2);
    log.push({txt:`🔥 燒傷傷害 ${enemy.burnStacks*2}`,type:"enemy"});
  }

  if(enemy.trait==="soulSuck") {
    const suck=Math.floor(baseDmg*0.05);
    enemy.hp=Math.min(enemy.maxHp,enemy.hp+suck);
  }

  if(enemy.trait==="voidRip") baseDmg = Math.max(1, enemy.attack + Math.floor(Math.random()*4));

  if(enemy.regenVal>0) {
    enemy.hp=Math.min(enemy.maxHp,enemy.hp+enemy.regenVal);
    log.push({txt:`💚 ${enemy.name} 回復 ${enemy.regenVal}HP`,type:"enemy"});
  }

  if(enemy.trait==="charge" && round===1) { baseDmg=Math.floor(baseDmg*1.3); log.push({txt:`💥 ${enemy.icon}${enemy.name} 憤怒衝鋒！`,type:"enemy"}); }

  if(enemy.trait==="inferno" && round%3===0) { baseDmg=Math.floor(baseDmg*2); log.push({txt:`🔥 ${enemy.icon}${enemy.name} 全力一擊！`,type:"enemy"}); }

  if(enemy.trait==="collapse" && round%5===0) { baseDmg+=15; log.push({txt:`🪨 岩石崩落！額外 15 傷害`,type:"enemy"}); }

  if(enemy.trait==="dragonRage" && enemy.hp<enemy.maxHp*0.3) { baseDmg=Math.floor(baseDmg*1.6); log.push({txt:`😡 古龍暴怒！傷害×1.6`,type:"enemy"}); }

  const thorns=specials.filter(s=>s.type==="thorns").reduce((a,x)=>a+x.val,0);
  const reflect=specials.filter(s=>s.type==="reflect").reduce((a,x)=>a+x.val,0);
  if(thorns>0){ enemy.hp=Math.max(0,enemy.hp-thorns); log.push({txt:`🌵 荊棘反傷 ${thorns}`,type:"hit"}); }
  if(reflect>0){ enemy.hp=Math.max(0,enemy.hp-reflect); log.push({txt:`🔮 盾反 ${reflect}`,type:"hit"}); }

  np.hp=Math.max(0, np.hp - baseDmg);
  log.push({txt:`${enemy.icon}${enemy.name} 攻擊你，造成 ${baseDmg} 傷害`,type:"enemy"});
  return np;
}

// ══════════════════════════════════════════════════════════════════════════════
// QUEST SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

// Quest reward types
const QR: AnyRecord = {
  gold:  (v)=>({ type:"gold",  value:v, label:`🪙 ${v} 金幣` }),
  exp:   (v)=>({ type:"exp",   value:v, label:`✨ ${v} EXP` }),
  item:  (r)=>({ type:"item",  rarity:r, label:`🎁 ${r==="mythic"?"神話":r==="legendary"?"傳說":r==="rare"?"稀有":"魔法"}裝備×1` }),
  scroll:(r)=>({ type:"scroll",rarity:r, label:`📜 ${r==="mythic"?"神話":r==="legendary"?"傳說":r==="rare"?"稀有":"魔法"}傭兵捲軸×1` }),
};

// Quest definitions: id, type, title, desc, goal field, target, rewards
const QUEST_DEFS: AnyRecord = {
  // ── Daily (每天重置) ──────────────────────────────────────────────────────
  d1:  { cat:"daily", icon:"🗡", title:"今日狩獵",       desc:"完成 3 次探險",         field:"totalExpeditions", target:3,  rewards:[QR.gold(80),  QR.exp(120)]  },
  d2:  { cat:"daily", icon:"⚔", title:"副本出征",       desc:"完成 1 個副本",         field:"totalDungeons",    target:1,  rewards:[QR.gold(150), QR.exp(200)]  },
  d3:  { cat:"daily", icon:"💀", title:"每日殺戮",       desc:"擊殺 10 隻怪物",        field:"totalKills",       target:10, rewards:[QR.gold(60),  QR.exp(80)]   },
  d4:  { cat:"daily", icon:"🏟", title:"競技場試煉",     desc:"贏得 1 場競技場對決",   field:"totalArenaWins",   target:1,  rewards:[QR.gold(200), QR.exp(150)]  },
  d5:  { cat:"daily", icon:"🪙", title:"財富積累",       desc:"賺取 500 金幣",         field:"totalGoldEarned",  target:500,rewards:[QR.exp(100),  QR.item("magic")] },

  // ── Weekly (每週重置) ────────────────────────────────────────────────────
  w1:  { cat:"weekly", icon:"🏆", title:"周冠軍",        desc:"贏得 5 場競技場",       field:"totalArenaWins",   target:5,  rewards:[QR.gold(500),  QR.exp(600),   QR.item("rare")]     },
  w2:  { cat:"weekly", icon:"🐉", title:"副本征服者",    desc:"完成 5 個副本",         field:"totalDungeons",    target:5,  rewards:[QR.gold(400),  QR.exp(500),   QR.scroll("rare")]   },
  w3:  { cat:"weekly", icon:"⚒", title:"鍛造狂人",      desc:"強化裝備 10 次",        field:"totalEnhances",    target:10, rewards:[QR.gold(300),  QR.item("rare")]                     },
  w4:  { cat:"weekly", icon:"💪", title:"訓練達人",      desc:"訓練屬性 8 次",         field:"totalTrains",      target:8,  rewards:[QR.gold(400),  QR.exp(400),   QR.item("legendary")]},
  w5:  { cat:"weekly", icon:"🏴", title:"傭兵統帥",      desc:"完成 3 個傭兵副本",     field:"totalMercRuns",    target:3,  rewards:[QR.gold(350),  QR.scroll("legendary")]              },

  // ── Achievement (永久里程碑) ─────────────────────────────────────────────
  a1:  { cat:"achieve", icon:"🌟", title:"初出茅廬",     desc:"達到 Lv.5",             field:"highestLevel",     target:5,  rewards:[QR.gold(200),  QR.exp(300)]                         },
  a2:  { cat:"achieve", icon:"⭐", title:"戰場老兵",     desc:"達到 Lv.15",            field:"highestLevel",     target:15, rewards:[QR.gold(500),  QR.exp(800),   QR.item("rare")]     },
  a3:  { cat:"achieve", icon:"💫", title:"傳說鬥士",     desc:"達到 Lv.30",            field:"highestLevel",     target:30, rewards:[QR.gold(1000), QR.exp(2000),  QR.item("legendary")]},
  a4:  { cat:"achieve", icon:"💀", title:"屠夫",         desc:"累計擊殺 100 隻怪物",   field:"totalKills",       target:100,rewards:[QR.gold(300),  QR.item("rare")]                     },
  a5:  { cat:"achieve", icon:"☠", title:"死神",          desc:"累計擊殺 1000 隻怪物",  field:"totalKills",       target:1000,rewards:[QR.gold(800), QR.item("legendary")]                },
  a6:  { cat:"achieve", icon:"👑", title:"Boss獵人",     desc:"擊殺 10 個 Boss",       field:"totalBossKills",   target:10, rewards:[QR.gold(400),  QR.exp(600),   QR.item("legendary")]},
  a7:  { cat:"achieve", icon:"🏅", title:"競技場新星",   desc:"贏得 10 場競技場",      field:"totalArenaWins",   target:10, rewards:[QR.gold(400),  QR.exp(500),   QR.scroll("rare")]   },
  a8:  { cat:"achieve", icon:"🥇", title:"競技場王者",   desc:"贏得 50 場競技場",      field:"totalArenaWins",   target:50, rewards:[QR.gold(1000), QR.scroll("mythic")]                 },
  a9:  { cat:"achieve", icon:"⚒", title:"鍛造大師",     desc:"成功強化到 +7 以上",    field:"totalEnhances",    target:1,  rewards:[QR.gold(500),  QR.item("legendary")],special:"enh7"},
  a10: { cat:"achieve", icon:"💎", title:"神話收藏家",   desc:"擁有 3 件神話裝備",     field:"totalKills",       target:1,  rewards:[QR.gold(800),  QR.scroll("mythic")],  special:"3mythic"},
};

// Generate initial quest progress state
function initQuestState() {
  const today = new Date().toISOString().slice(0,10);
  const week  = getWeekKey();
  const progress = {};
  Object.keys(QUEST_DEFS).forEach(id => {
    progress[id] = { collected:false, baseVal:0 };
  });
  return { progress, dailyDate:today, weeklyDate:week };
}

function getWeekKey() {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(),0,1);
  const week = Math.ceil(((d.getTime()-jan1.getTime())/86400000 + jan1.getDay()+1)/7);
  return `${d.getFullYear()}-W${week}`;
}

// Get current progress value for a quest given player stats + current session delta
function getQuestProgress(questId, playerStats, questState) {
  const def = QUEST_DEFS[questId];
  if(!def) return 0;
  const base = (questState.progress[questId]&&questState.progress[questId].baseVal)||0;
  const current = playerStats[def.field]||0;
  return current - base;
}

// Check if a quest is completed
function isQuestDone(questId, playerStats, questState) {
  const def = QUEST_DEFS[questId];
  if(!def) return false;
  if(questState.progress[questId]&&questState.progress[questId].collected) return false; // already collected
  // Special achievement checks
  if(def.special==="enh7") {
    const equip = playerStats.equipment || {};
    return Object.values(equip).some(e=>{const item=e as any;return item&&(item.enhLv||0)>=7;});
  }
  if(def.special==="3mythic") {
    const equip = playerStats.equipment || {};
    const inv   = playerStats._inv || [];
    const mythicCount = Object.values(equip).filter(e=>{const item=e as any;return item&&item.rarity==="mythic";}).length
                      + inv.filter(i=>i.rarity==="mythic").length;
    return mythicCount >= 3;
  }
  return getQuestProgress(questId, playerStats, questState) >= def.target;
}

// ── Arena section continues below ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// ARENA SYSTEM — PvP opponents, injury timer, gold plunder
// ══════════════════════════════════════════════════════════════════════════════
const ARENA_FIRST_NAMES: AnyList = ["鐵拳","烈焰","暗影","血刃","雷霆","冰霜","狂狼","死神","石壁","毒牙","金鷹","黑熊","赤龍","幽靈","鋼爪"];
const ARENA_LAST_NAMES: AnyList  = ["戰士","屠夫","獵人","武者","刺客","法師","騎士","守衛","劊子手","征服者","破壞者","裁判者"];
const ARENA_TITLES      = ["不敗的","嗜血的","冷酷的","無情的","狂暴的","沉默的","傳奇的","恐怖的","古老的","神秘的"];

// Generate a fake PvP opponent matching roughly the player's level
function genArenaOpponent(playerLevel) {
  const firstName = ARENA_FIRST_NAMES[Math.floor(Math.random()*ARENA_FIRST_NAMES.length)];
  const lastName  = ARENA_LAST_NAMES[Math.floor(Math.random()*ARENA_LAST_NAMES.length)];
  const title     = ARENA_TITLES[Math.floor(Math.random()*ARENA_TITLES.length)];
  const name      = `${title}${firstName}${lastName}`;

  // Level varies ±3 around player
  const lvOffset = Math.floor(Math.random()*7) - 3;
  const oppLv    = Math.max(1, playerLevel + lvOffset);

  // Strength tier: weaker / similar / stronger
  const tierRoll = Math.random();
  const tier = tierRoll < 0.35 ? "weak" : tierRoll < 0.70 ? "normal" : "strong";
  const tierMult = tier==="weak" ? 0.70+Math.random()*0.15
                 : tier==="normal" ? 0.88+Math.random()*0.24
                 : 1.10+Math.random()*0.30;

  // Generate equipped gear for the opponent
  const equipment = { ...INITIAL_EQUIPMENT };
  const slots = ["weapon","offhand","armor","helmet","gloves","boots","ring","amulet"];
  // Higher level & stronger tier = better chance of good gear
  const lootBonus = (oppLv/50) + (tier==="strong"?0.25:tier==="weak"?-0.10:0.05);
  slots.forEach(slot => {
    if(Math.random() < 0.75) {
      equipment[slot] = genLoot(oppLv, Math.max(0, lootBonus), slot);
    } else {
      equipment[slot] = null;
    }
  });

  // Compute derived stats (same formula as player)
  const baseAtk  = Math.floor((8 + oppLv*1.8) * tierMult);
  const baseDef  = Math.floor((3 + oppLv*0.9) * tierMult);
  const baseMhp  = Math.floor((80 + oppLv*12) * tierMult);
  const eqAtk    = slots.reduce((s,sl)=>s+(equipment[sl]?equipment[sl].attack||0:0),0);
  const eqDef    = slots.reduce((s,sl)=>s+(equipment[sl]?equipment[sl].defense||0:0),0);
  const eqHp     = slots.reduce((s,sl)=>s+(equipment[sl]?equipment[sl].hp||0:0),0);

  const totalAtk = baseAtk + eqAtk;
  const totalDef = baseDef + eqDef;
  const totalMhp = baseMhp + eqHp;

  // Estimate gold they carry (more gold = higher level & stronger)
  const goldCarried = Math.floor((50 + oppLv*20 + Math.random()*oppLv*30) * tierMult);

  // Weapon category (random)
  const wcKeys = Object.keys(WEAPON_CATEGORIES);
  const wcKey  = wcKeys[Math.floor(Math.random()*wcKeys.length)];

  return {
    id: Date.now() + Math.random(),
    name, title, level: oppLv, tier,
    attack: totalAtk, defense: totalDef, maxHp: totalMhp, hp: totalMhp,
    equipment, goldCarried, wcKey,
    // Win streak for display flavour
    wins:  Math.floor(Math.random()*30),
    losses:Math.floor(Math.random()*15),
  };
}

// Simulate Arena PvP fight (player vs opponent)
// Returns {log, won, goldPlundered}
const css=`
@import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Cinzel:wght@400;600;700&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');

*{box-sizing:border-box;margin:0;padding:0}

::-webkit-scrollbar{width:6px}
::-webkit-scrollbar-track{background:#1a100a}
::-webkit-scrollbar-thumb{background:linear-gradient(180deg,#8b5a14,#5a3a0a);border-radius:3px}

.gw{
  min-height:100vh;
  background-color:#100c07;
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E"),
    radial-gradient(ellipse 120% 60% at 50% 0%, #2a1a08 0%, #100c07 55%),
    repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(0,0,0,.15) 39px, rgba(0,0,0,.15) 40px),
    repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(0,0,0,.08) 39px, rgba(0,0,0,.08) 40px);
  color:#d4b483;
  font-family:'Crimson Text',serif;
  font-size:16px;
}

.gh{
  background:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E"),
    linear-gradient(180deg, #2d1e08 0%, #1a0f04 50%, #0f0904 100%);
  border-bottom:3px solid transparent;
  border-image:linear-gradient(90deg,transparent 0%,#8b5a14 15%,#e8c050 50%,#8b5a14 85%,transparent 100%) 1;
  padding:0 24px;
  height:58px;
  display:flex;align-items:center;justify-content:space-between;
  position:sticky;top:0;z-index:100;
  box-shadow:0 6px 30px rgba(0,0,0,.7), inset 0 1px 0 rgba(232,192,80,.15);
}

.gh::before,.gh::after{
  content:'✦';
  font-size:18px;
  color:#5a3a10;
  position:absolute;
  top:50%;transform:translateY(-50%);
}
.gh::before{left:8px}.gh::after{right:8px}

.gt{
  font-family:'Cinzel Decorative',serif;
  font-size:22px;
  font-weight:900;
  letter-spacing:5px;
  color:transparent;
  background:linear-gradient(180deg,#f5e080 0%,#c8961e 40%,#8b5a14 70%,#e8c050 100%);
  -webkit-background-clip:text;background-clip:text;
  text-shadow:none;
  filter:drop-shadow(0 0 12px rgba(200,150,30,.5));
  position:relative;
}
.gt::before{
  content:'⚔';
  margin-right:12px;
  font-size:18px;
  filter:none;
  color:#c8961e;
}
.gt::after{
  content:'⚔';
  margin-left:12px;
  font-size:18px;
  color:#c8961e;
  transform:scaleX(-1);
  display:inline-block;
}

.gd{
  display:flex;align-items:center;gap:8px;
  background:linear-gradient(135deg,#2a1a08,#1a0f04);
  border:1px solid #8b5a14;
  padding:6px 14px;border-radius:3px;
  font-family:'Cinzel',serif;color:#f5d060;font-size:14px;
  box-shadow:0 0 10px rgba(139,90,20,.3), inset 0 1px 0 rgba(232,192,80,.1);
}

.ml{display:grid;grid-template-columns:272px 1fr;min-height:calc(100vh - 58px)}

.sb{
  background:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E"),
    linear-gradient(180deg,#140f07 0%,#0e0b05 100%);
  border-right:2px solid transparent;
  border-image:linear-gradient(180deg,#5a3a10,#2a1a08,#5a3a10) 1;
  padding:16px 13px;
  display:flex;flex-direction:column;gap:12px;overflow-y:auto;
}

.pn{
  background:linear-gradient(160deg,#1e1508 0%,#161005 60%,#1a1208 100%);
  border:1px solid #4a3010;
  border-radius:4px;
  overflow:hidden;
  box-shadow:inset 0 1px 0 rgba(200,150,30,.06), 0 2px 8px rgba(0,0,0,.4);
  position:relative;
}
.pn::before,.pn::after{
  content:'';
  position:absolute;
  width:6px;height:6px;
  border-radius:50%;
  background:radial-gradient(circle at 35% 35%,#c8a030,#5a3a08);
  box-shadow:0 0 4px rgba(0,0,0,.6);
  top:5px;
}
.pn::before{left:5px}.pn::after{right:5px}

.ph{
  background:linear-gradient(90deg,#1a1008 0%,#2e1e0a 30%,#2e1e0a 70%,#1a1008 100%);
  border-bottom:1px solid #4a3010;
  padding:7px 16px;
  font-family:'Cinzel',serif;font-size:10px;letter-spacing:3px;
  color:#c8961e;text-transform:uppercase;
  text-align:center;
  position:relative;
}
.ph::before,.ph::after{content:'—';color:#5a3a10;margin:0 6px}

.pb{padding:10px 12px}
.pname{font-family:'Cinzel',serif;font-size:15px;color:#e8d090;margin-bottom:8px;text-align:center;letter-spacing:1px}
.sr{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid rgba(90,60,10,.25);font-size:13px}
.sl{color:#7a6040}.sv{color:#e0c070;font-weight:600}

.bw{margin:8px 0 3px}
.bl{font-size:11px;color:#7a6040;margin-bottom:3px;display:flex;justify-content:space-between;letter-spacing:.5px}
.bt{
  height:10px;
  background:#0a0604;
  border:1px solid #3a2008;
  border-radius:1px;
  overflow:hidden;
  box-shadow:inset 0 2px 4px rgba(0,0,0,.5);
}
.bf{height:100%;border-radius:1px;transition:width .5s ease}
.hf{background:linear-gradient(90deg,#6a0a0a,#c03020,#e05030);box-shadow:0 0 6px rgba(200,50,30,.4)}
.ef{background:linear-gradient(90deg,#0a2a6a,#1850a8,#3070d0);box-shadow:0 0 6px rgba(30,80,200,.3)}

.eq-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px}
.eq-slot{
  display:flex;align-items:center;gap:4px;
  padding:4px 6px;
  background:rgba(0,0,0,.3);
  border:1px solid #2a1808;
  border-radius:3px;
  font-size:11px;cursor:pointer;
  transition:all .2s;
  position:relative;
}
.eq-slot:hover{border-color:#8b5a14;background:rgba(139,90,20,.1)}
.eq-slot:hover::after{content:'卸下';position:absolute;right:4px;top:50%;transform:translateY(-50%);font-size:9px;color:#8b5a14;font-family:'Cinzel',serif}
.eq-icon{font-size:12px;flex-shrink:0}
.eq-label{color:#4a3020;font-size:9px;font-family:'Cinzel',serif;display:block}
.eq-item{color:#c8a848;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;line-height:1.2}
.eq-empty{color:#1e1208;font-size:10px;font-style:italic;flex:1}
.weapon-trait{
  font-size:10px;color:#d08030;
  padding:4px 8px;
  background:linear-gradient(90deg,rgba(180,100,20,.08),rgba(180,100,20,.15),rgba(180,100,20,.08));
  border-top:1px solid rgba(180,100,20,.2);
  border-bottom:1px solid rgba(180,100,20,.2);
  margin-top:6px;line-height:1.5;
  text-align:center;
}

.nt{
  display:flex;
  border-bottom:2px solid transparent;
  border-image:linear-gradient(90deg,transparent,#5a3a10,#c8961e,#5a3a10,transparent) 1;
  background:linear-gradient(180deg,#140f07,#0e0a05);
  flex-wrap:wrap;
}
.nb{
  flex:1;min-width:60px;
  padding:11px 6px;
  text-align:center;
  font-family:'Cinzel',serif;font-size:10px;letter-spacing:1.5px;
  color:#4a3518;cursor:pointer;border:none;
  background:transparent;
  transition:all .25s;
  border-bottom:3px solid transparent;
  text-transform:uppercase;
  position:relative;
}
.nb:hover{color:#a07838;background:rgba(200,150,30,.04)}
.nb.active{
  color:#e8c050;
  border-bottom-color:#c8961e;
  background:linear-gradient(180deg,rgba(200,150,30,.06),transparent);
}
.nb.active::after{
  content:'';
  position:absolute;bottom:-3px;left:50%;transform:translateX(-50%);
  width:6px;height:6px;
  background:#c8961e;
  clip-path:polygon(50% 100%,0 0,100% 0);
}

.ca{
  padding:22px;
  overflow-y:auto;
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='s'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 0.55  0 0 0 0 0.38  0 0 0 0 0.12  0 0 0 0.12 0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23s)'/%3E%3C/svg%3E"),
    radial-gradient(ellipse 100% 80% at 50% 100%,rgba(30,20,10,.6),transparent);
}

.stl{
  font-family:'Cinzel',serif;font-size:15px;
  color:transparent;
  background:linear-gradient(90deg,#8b5a14,#e8c050,#c8961e,#8b5a14);
  -webkit-background-clip:text;background-clip:text;
  letter-spacing:3px;
  margin-bottom:16px;padding-bottom:8px;
  border-bottom:1px solid #3a2010;
  text-align:center;
  position:relative;
}
.stl::before,.stl::after{content:'✦ ';color:#5a3a10}

.sub{
  font-family:'Cinzel',serif;font-size:11px;
  color:#9a7030;
  letter-spacing:2px;
  margin:20px 0 10px;
  padding:6px 0;
  border-top:1px solid;
  border-bottom:1px solid;
  border-color:transparent;
  border-image:linear-gradient(90deg,transparent,#4a2e10 20%,#8b5a14 50%,#4a2e10 80%,transparent) 1;
  text-align:center;
  background:repeating-linear-gradient(90deg,rgba(139,90,20,.05) 0px,rgba(139,90,20,.05) 4px,transparent 4px,transparent 10px);
  text-transform:uppercase;
}

.dz{margin-bottom:24px}
.dr{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:10px;margin-top:8px}
.dc{
  background:linear-gradient(160deg,#1e1608,#141008,#181208);
  border:1px solid #3a2410;
  border-radius:4px;
  padding:14px 12px;
  cursor:pointer;
  transition:all .3s;
  position:relative;overflow:hidden;
  text-align:center;
}
.dc::before{
  content:'';
  position:absolute;top:0;left:0;right:0;
  height:3px;
  background:linear-gradient(90deg,transparent,#5a3a10,#c8961e,#5a3a10,transparent);
  opacity:0;transition:opacity .3s;
}
.dc:hover::before{opacity:1}
.dc:hover{
  border-color:#8b5a14;
  transform:translateY(-3px);
  box-shadow:0 8px 24px rgba(0,0,0,.5),0 0 0 1px rgba(139,90,20,.2);
  background:linear-gradient(160deg,#261e0a,#1a1208,#20160a);
}
.dc.lk{opacity:.28;cursor:not-allowed;pointer-events:none}
.di{font-size:22px;margin-bottom:6px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))}
.dn{font-family:'Cinzel',serif;font-size:12px;color:#c8961e;margin-bottom:4px;letter-spacing:.5px}
.dtl{
  font-size:9px;letter-spacing:1.5px;font-family:'Cinzel',serif;
  padding:2px 8px;border-radius:1px;
  border:1px solid currentColor;
  display:inline-block;margin-bottom:5px;
  background:rgba(0,0,0,.3);
}
.drq{font-size:10px;color:#5a4020;margin-top:2px}
.drw{font-size:10px;color:#6a5030;margin-top:3px;line-height:1.5}

.wcat-tabs{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px}
.wcat-btn{
  font-family:'Cinzel',serif;font-size:10px;
  padding:4px 10px;border-radius:2px;cursor:pointer;
  border:1px solid #2e1e0a;background:#120e06;color:#5a4020;
  transition:all .2s;
}
.wcat-btn:hover{border-color:#6a4a18;color:#a07830}
.wcat-btn.active{
  border-color:#c8961e;color:#e8c050;
  background:linear-gradient(135deg,#2a1a08,#1a1004);
  box-shadow:0 0 8px rgba(200,150,30,.2);
}
.wcat-info{
  padding:8px 12px;
  background:linear-gradient(90deg,rgba(180,100,20,.06),rgba(180,100,20,.1),rgba(180,100,20,.06));
  border:1px solid rgba(180,100,20,.2);
  border-radius:3px;margin-bottom:10px;
  font-size:12px;color:#8a6a30;
}
.wcat-trait{color:#d08030;font-style:italic}

.mg{display:grid;grid-template-columns:repeat(auto-fill,minmax(152px,1fr));gap:10px;margin-top:8px}
.mc{
  background:linear-gradient(160deg,#1c1408,#120e05);
  border:1px solid #2e1e08;
  border-radius:4px;padding:12px;text-align:center;
  cursor:pointer;transition:all .25s;
  position:relative;overflow:hidden;
}
.mc::after{
  content:'';
  position:absolute;bottom:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,transparent,#4a2e10,transparent);
}
.mc:hover{border-color:#6a4a18;box-shadow:0 4px 16px rgba(0,0,0,.4)}
.msel{border-color:#c8961e!important;background:linear-gradient(160deg,#2a1e0a,#1a1206)!important;box-shadow:0 0 12px rgba(200,150,30,.2)!important}
.mic{font-size:26px;margin-bottom:6px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))}
.mn{font-family:'Cinzel',serif;font-size:12px;color:#c8a848;margin-bottom:3px;letter-spacing:.5px}
.ms{font-size:11px;color:#5a4020;margin-bottom:4px;line-height:1.6}
.md{font-size:10px;color:#4a3820;font-style:italic;margin-bottom:7px}

.ba{max-width:680px;margin:0 auto}

.btl{
  font-family:'Cinzel',serif;font-size:19px;
  color:transparent;
  background:linear-gradient(180deg,#f5e080,#c8961e,#8b5a14);
  -webkit-background-clip:text;background-clip:text;
  text-align:center;letter-spacing:4px;
  margin-bottom:14px;
  position:relative;
  filter:drop-shadow(0 0 8px rgba(200,150,30,.4));
}
.btl::before,.btl::after{
  content:'🔥';
  font-size:16px;
  margin:0 10px;
  filter:none;
  animation:flicker 1.8s ease-in-out infinite alternate;
}
@keyframes flicker{0%{opacity:.7;transform:scaleY(1)}100%{opacity:1;transform:scaleY(1.05)}}

.cm{display:grid;grid-template-columns:1fr auto 1fr;gap:14px;align-items:start;margin-bottom:14px}
.cc{
  background:linear-gradient(160deg,#1e1608,#141008);
  border:1px solid #3a2a10;
  border-radius:4px;padding:14px;text-align:center;
  position:relative;overflow:hidden;
}
.cc::before{
  content:'';
  position:absolute;inset:0;
  background:repeating-linear-gradient(
    45deg,
    transparent 0px, transparent 8px,
    rgba(0,0,0,.04) 8px, rgba(0,0,0,.04) 9px
  );
  pointer-events:none;
}
.cc.en{
  border-color:#4a1a10;
  background:linear-gradient(160deg,#1e0e08,#140808);
}
.cc.en::after{
  content:'';
  position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,transparent,#c83020,transparent);
}
.cc.mcb{
  border-color:#1a3a1a;
  background:linear-gradient(160deg,#0e1a0e,#0a140a);
  padding:8px;margin-bottom:4px;
}
.cn{font-family:'Cinzel',serif;font-size:12px;color:#e8d080;margin-bottom:8px;letter-spacing:1px}
.cc.en .cn{color:#e05040}

.vs{
  display:flex;align-items:center;justify-content:center;
  padding-top:18px;
}
.vs-inner{
  font-family:'Cinzel Decorative',serif;
  font-size:16px;font-weight:900;
  color:transparent;
  background:linear-gradient(180deg,#e8c050,#8b5a14);
  -webkit-background-clip:text;background-clip:text;
  letter-spacing:2px;
  text-shadow:none;
  filter:drop-shadow(0 0 6px rgba(139,90,20,.5));
  border:1px solid #4a3010;
  padding:8px 10px;
  border-radius:50%;
  background-color:#0e0a04;
  background-image:linear-gradient(135deg,#2a1a08,#0e0a04);
  display:flex;align-items:center;justify-content:center;
  width:44px;height:44px;
}

.blog{
  background:linear-gradient(160deg,#0c0906,#0a0704);
  border:1px solid #2a1a08;
  border-left:3px solid #3a2410;
  border-radius:2px;
  padding:12px 14px;height:170px;
  overflow-y:auto;font-size:12.5px;line-height:1.8;
  margin-bottom:14px;
  font-family:'Crimson Text',serif;
  color:#a08060;
  box-shadow:inset 0 2px 8px rgba(0,0,0,.4);
}
.blog::-webkit-scrollbar{width:4px}
.blog::-webkit-scrollbar-thumb{background:#3a2010}
.lh{color:#d4a030;font-style:normal}
.lm{color:#5ab05a}
.le{color:#c84040}
.lw{color:#50c870;font-weight:600;font-style:normal;font-family:'Cinzel',serif;letter-spacing:.5px}
.ll{color:#c84040;font-weight:600;font-style:normal;font-family:'Cinzel',serif}

.bact{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}

.btn{
  font-family:'Cinzel',serif;font-size:11px;letter-spacing:1.5px;
  padding:10px 18px;
  border:none;border-radius:2px;
  cursor:pointer;transition:all .25s;
  text-transform:uppercase;
  position:relative;overflow:hidden;
}
.btn::before{
  content:'';position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(255,255,255,.06) 0%,transparent 50%);
  pointer-events:none;
}
.btp{
  background:linear-gradient(160deg,#9a6e14,#7a5010,#5a3a08);
  color:#f5e080;
  border:1px solid #c8961e;
  box-shadow:0 3px 10px rgba(0,0,0,.4),inset 0 1px 0 rgba(232,192,80,.2);
}
.btp:hover{
  background:linear-gradient(160deg,#b07c18,#8a5c14,#6a4410);
  box-shadow:0 4px 14px rgba(0,0,0,.4),0 0 16px rgba(200,150,30,.25);
  transform:translateY(-1px);
}
.btp:active{transform:translateY(0)}
.btd{
  background:linear-gradient(160deg,#7a1a14,#5a0e0a,#3a0808);
  color:#f0a090;
  border:1px solid #c03020;
  box-shadow:0 3px 10px rgba(0,0,0,.4);
}
.btd:hover{background:linear-gradient(160deg,#9a2018,#7a1410);box-shadow:0 0 14px rgba(200,50,30,.3)}
.btm{
  background:linear-gradient(160deg,#2a2018,#1e1610,#1a1208);
  color:#8a7050;
  border:1px solid #3a2a18;
  box-shadow:0 2px 6px rgba(0,0,0,.3);
}
.btm:hover{color:#b09060;border-color:#5a4028}
.btn:disabled{opacity:.35;cursor:not-allowed;transform:none!important;box-shadow:none!important}

.sg{display:grid;grid-template-columns:repeat(auto-fill,minmax(142px,1fr));gap:10px;margin-top:8px}
.si{
  background:linear-gradient(160deg,#1e1608,#141008);
  border:1px solid #3a2410;
  border-radius:3px;padding:12px;text-align:center;
  transition:border-color .2s;
  position:relative;
}
.si:hover{border-color:#6a4a18}
.sii{font-size:26px;margin-bottom:7px;filter:drop-shadow(0 3px 5px rgba(0,0,0,.6))}
.sin{font-family:'Cinzel',serif;font-size:11px;color:#c8a848;margin-bottom:4px;letter-spacing:.5px}
.sis{font-size:11px;color:#5a4020;margin-bottom:5px;line-height:1.6}
.sit{font-size:10px;color:#c8781e;font-style:italic;margin-bottom:6px}
.sic{font-size:12px;color:#f0c040;margin-bottom:8px;font-family:'Cinzel',serif}

.ig{display:grid;grid-template-columns:repeat(auto-fill,minmax(152px,1fr));gap:9px}
.ii{
  background:linear-gradient(160deg,#1a1208,#120e06);
  border:1px solid #2e1e0a;
  border-radius:3px;padding:11px;text-align:center;
  transition:all .2s;
}
.ii:hover{border-color:#5a3a14;box-shadow:0 3px 12px rgba(0,0,0,.4)}
.iii{font-size:22px;margin-bottom:6px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))}
.iin{font-family:'Cinzel',serif;font-size:11px;color:#c8a848;margin-bottom:5px;letter-spacing:.5px}
.iis{font-size:11px;color:#5a4020;margin-bottom:6px;line-height:1.6}
.icat{font-size:10px;color:#6a4818;font-style:italic;margin-bottom:4px}
.iaf{margin-top:5px;border-top:1px solid rgba(90,60,10,.2);padding-top:4px}
.al{font-size:10px;padding:1px 0;color:#6aaa6a;line-height:1.5}
.as{color:#c870d0}
.rb{
  display:inline-block;font-size:9px;font-family:'Cinzel',serif;
  letter-spacing:1.5px;padding:2px 6px;border-radius:1px;
  margin-bottom:5px;border:1px solid currentColor;
  background:rgba(0,0,0,.3);
}

.lp{
  position:fixed;inset:0;
  background:rgba(0,0,0,.88);
  display:flex;align-items:center;justify-content:center;
  z-index:300;
  backdrop-filter:blur(2px);
}
.lb{
  background:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E"),
    linear-gradient(160deg,#221808,#160f06,#1e1608);
  border:2px solid #6a4010;
  border-radius:4px;
  padding:28px 32px;min-width:285px;max-width:365px;
  text-align:center;
  box-shadow:
    0 0 60px rgba(0,0,0,.9),
    0 0 30px rgba(139,90,20,.2),
    inset 0 1px 0 rgba(200,150,30,.1);
  animation:lootReveal .4s cubic-bezier(.34,1.56,.64,1);
}
@keyframes lootReveal{from{transform:scale(.85) translateY(20px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}
.ltl{
  font-family:'Cinzel',serif;font-size:11px;letter-spacing:3px;
  color:#7a5020;margin-bottom:14px;text-transform:uppercase;
}
.ltl::before,.ltl::after{content:'── ';color:#4a3010}
.lin{font-family:'Cinzel',serif;font-size:17px;margin-bottom:6px;letter-spacing:.5px}
.lii{font-size:36px;margin-bottom:10px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.6));animation:itemBob 2s ease-in-out infinite}
@keyframes itemBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
.lst{font-size:12px;color:#7a6040;margin-bottom:8px;line-height:1.7}
.la{display:flex;gap:8px;justify-content:center;margin-top:16px;flex-wrap:wrap}

.svr{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.svi{font-size:11px;color:#5a4020;margin-top:3px}

@keyframes fr{
  0%{box-shadow:inset 0 0 0 0 transparent}
  30%{box-shadow:inset 0 0 30px 5px rgba(200,40,20,.25)}
  100%{box-shadow:inset 0 0 0 0 transparent}
}
@keyframes fg{
  0%{box-shadow:inset 0 0 0 0 transparent}
  30%{box-shadow:inset 0 0 30px 5px rgba(220,170,20,.2)}
  100%{box-shadow:inset 0 0 0 0 transparent}
}
@keyframes fgg{
  0%{box-shadow:inset 0 0 0 0 transparent}
  30%{box-shadow:inset 0 0 20px 3px rgba(40,180,40,.15)}
  100%{box-shadow:inset 0 0 0 0 transparent}
}
.ha{animation:fg .4s ease}.ea{animation:fr .4s ease}.ma{animation:fgg .4s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
@keyframes enhanceGlow{0%{box-shadow:0 0 0 transparent}50%{box-shadow:0 0 20px #4caf5088}100%{box-shadow:0 0 0 transparent}}
@keyframes enhanceFail{0%{box-shadow:0 0 0 transparent}50%{box-shadow:0 0 20px #c8404088}100%{box-shadow:0 0 0 transparent}}
.enhance-success{animation:enhanceGlow .6s ease}
.enhance-fail{animation:enhanceFail .6s ease}

/* ── Quest System ── */
.quest-tabs{display:flex;gap:6px;margin-bottom:14px;border-bottom:1px solid #2a1a08;padding-bottom:8px}
.quest-cat{display:flex;flex-direction:column;gap:8px}
.quest-card{
  background:linear-gradient(160deg,#1a1208,#120e06);
  border:1px solid #2a1a08;border-radius:5px;
  padding:12px 14px;display:flex;align-items:center;gap:12px;
  transition:border-color .2s;
}
.quest-card.done{border-color:#4caf5066;background:linear-gradient(160deg,#0a1a0a,#081008)}
.quest-card.collect{border-color:#c8961e88;background:linear-gradient(160deg,#1e1808,#120e06);
  animation:questPulse 1.5s infinite}
.quest-card.locked{opacity:0.5}
.quest-icon{font-size:22px;flex-shrink:0}
.quest-body{flex:1;min-width:0}
.quest-title{font-family:'Cinzel',serif;font-size:12px;color:#c8961e;margin-bottom:2px;letter-spacing:.5px}
.quest-desc{font-size:11px;color:#6a5030;margin-bottom:5px}
.quest-progress{height:4px;background:#1a1208;border-radius:2px;overflow:hidden;margin-bottom:4px}
.quest-pbar{height:100%;border-radius:2px;transition:width .4s}
.quest-ptext{font-size:10px;color:#5a4020}
.quest-rewards{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
.quest-reward-badge{
  font-size:10px;padding:2px 6px;border-radius:2px;
  background:rgba(200,150,30,.12);border:1px solid #4a3010;color:#c8961e;
}
.quest-btn{flex-shrink:0}
@keyframes questPulse{0%,100%{box-shadow:0 0 0 transparent}50%{box-shadow:0 0 12px rgba(200,150,30,.4)}}
.quest-notify{
  position:fixed;top:70px;right:16px;z-index:200;
  background:linear-gradient(135deg,#2a1e08,#1a1208);
  border:1px solid #c8961e88;border-radius:6px;
  padding:10px 16px;font-size:12px;color:#f0c040;
  font-family:'Cinzel',serif;letter-spacing:.5px;
  box-shadow:0 4px 20px rgba(0,0,0,.6);
  animation:slideIn .3s ease;
}
@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
.arena-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:16px}
.arena-card{
  background:linear-gradient(160deg,#1e1408,#120e06);
  border:1px solid #3a2a10;border-radius:6px;padding:14px;
  cursor:pointer;transition:all .2s;position:relative;overflow:hidden;
}
.arena-card:hover{border-color:#8b5a14;transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.5)}
.arena-card.weak{border-color:#4caf5044}
.arena-card.normal{border-color:#4a9fd444}
.arena-card.strong{border-color:#e0702044}
.arena-card .ac-name{font-family:'Cinzel',serif;font-size:12px;color:#c8961e;margin-bottom:4px;letter-spacing:.5px}
.arena-card .ac-lvl{font-size:11px;color:#6a5030;margin-bottom:6px}
.arena-card .ac-stats{font-size:11px;color:#8a7050;line-height:1.8}
.arena-card .ac-tier{
  position:absolute;top:8px;right:8px;
  font-size:9px;font-family:'Cinzel',serif;letter-spacing:.5px;
  padding:2px 6px;border-radius:2px;
}
.arena-card.weak  .ac-tier{color:#4caf50;background:rgba(76,175,80,.12);border:1px solid #4caf5044}
.arena-card.normal .ac-tier{color:#4a9fd4;background:rgba(74,159,212,.12);border:1px solid #4a9fd444}
.arena-card.strong .ac-tier{color:#e07020;background:rgba(224,112,32,.12);border:1px solid #e0702044}
.arena-injury{
  background:linear-gradient(135deg,#2a0a0a,#180606);
  border:1px solid #6a1010;border-radius:6px;
  padding:20px;text-align:center;margin-bottom:16px;
}
.arena-refresh-bar{
  display:flex;align-items:center;justify-content:space-between;
  background:#120e06;border:1px solid #2a1a08;border-radius:5px;
  padding:8px 14px;margin-bottom:12px;font-size:12px;
}
@keyframes arenaVictory{0%{box-shadow:0 0 0 transparent}50%{box-shadow:0 0 30px #c8961e88}100%{box-shadow:0 0 0 transparent}}
@keyframes arenaDefeat{0%{box-shadow:0 0 0 transparent}50%{box-shadow:0 0 30px #c8404088}100%{box-shadow:0 0 0 transparent}}

.blood-div{
  height:2px;
  background:linear-gradient(90deg,transparent,#6a1010,#c03020,#6a1010,transparent);
  margin:10px 0;
  position:relative;
}
.blood-div::before,.blood-div::after{
  content:'✦';
  position:absolute;top:50%;transform:translateY(-50%);
  color:#8a1a1a;font-size:10px;
}
.blood-div::before{left:calc(50% - 30px)}
.blood-div::after{left:calc(50% + 18px)}
`;

function AffixLines({ affixes }) {
  if (!affixes||!affixes.length) return null;
  return (
    <div className="iaf">
      {affixes.map((a,i) => (
        <div key={i} className={`al${a.special?" as":""}`}>
          {a.stat
            ? `${a.tag}: +${a.rolledVal} ${a.stat==="attack"?"攻擊":a.stat==="defense"?"防禦":a.stat==="hp"?"HP":"速度"}`
            : `${a.tag}: ${a.rolledVal}${
                a.special==="crit"?"% 爆擊率":a.special==="lifesteal"?"% 吸血":
                a.special==="thorns"?" 荊棘反傷":a.special==="regen"?" 每回合回復":
                a.special==="pierce"?"% 穿透":a.special==="vampiric"?"% 吸魂":
                a.special==="reflect"?" 反射傷害":" 低血狂怒"}`}
        </div>
      ))}
    </div>
  );
}

function ItemCard({ item, onEquip, onUse }) {
  const rar = getRarity(item.rarity);
  const rc = rar.color;
  const glow = rar.glow;
  const isNormal = item.rarity === "normal" || !item.rarity;
  const cat = item.cat ? WEAPON_CATEGORIES[item.cat] : null;
  const slotDef = EQUIP_SLOTS.find(s=>s.id===item.slot);
  return (
    <div className="ii" style={{
      borderColor: isNormal ? "#2e1e0a" : rc+"88",
      boxShadow: glow ? `${glow}, inset 0 0 20px rgba(0,0,0,0.3)` : "none",
      background: isNormal
        ? "linear-gradient(160deg,#1a1208,#120e06)"
        : `linear-gradient(160deg, ${rc}0a 0%, #120e06 60%)`,
    }}>
      <div className="iii" style={{filter:`drop-shadow(0 2px 4px ${rc}66)`}}>{item.icon}</div>
      {!isNormal && (
        <div className="rb" style={{
          color: rc,
          borderColor: rc+"66",
          background: `${rc}15`,
          textShadow: glow ? `0 0 8px ${rc}` : "none",
        }}>{rar.label}</div>
      )}
      <div className="iin" style={{
        color: rc,
        textShadow: glow && !isNormal ? `0 0 10px ${rc}88` : "none",
      }}>{item.name}</div>
      {item.itemLevel>0 && (
        <div style={{fontSize:9,color:"#6a5028",marginBottom:2}}>
          Lv.{item.itemLevel} · ×{Math.pow(1.25,Math.floor(item.itemLevel/10)).toFixed(2)}倍
        </div>
      )}
      {cat && <div className="icat">{cat.icon} {cat.label}</div>}
      {!cat && slotDef && <div className="icat">{slotDef.icon} {slotDef.label}</div>}
      <div className="iis">
        {item.attack>0  && <div style={{color:item.attack>50?"#f5c040":item.attack>25?"#e8a030":"#5a4020"}}>攻擊 +{item.attack}</div>}
        {item.defense>0 && <div style={{color:item.defense>40?"#80c0f0":item.defense>20?"#4a9fd4":"#5a4020"}}>防禦 +{item.defense}</div>}
        {item.hp>0      && <div style={{color:item.hp>80?"#f06060":item.hp>40?"#c84040":"#5a4020"}}>HP +{item.hp}</div>}
        {item.speed>0   && <div style={{color:"#5a9050"}}>速度 +{item.speed}</div>}
        {item.heal      && <div style={{color:"#50a860"}}>回復 {item.heal} HP</div>}
      </div>
      {cat && <div className="icat" style={{color:"#d08030",fontSize:10}}>{cat.traitDesc}</div>}
      <AffixLines affixes={item.affixes} />
      <div style={{marginTop:7,display:"flex",flexDirection:"column",gap:4}}>
        {onEquip&&<button className="btn btp" style={{width:"100%",fontSize:10}} onClick={onEquip}>裝備</button>}
        {onUse  &&<button className="btn btm" style={{width:"100%",fontSize:10}} onClick={onUse}>使用</button>}
      </div>
    </div>
  );
}

function HpBar({ cur, max, color="#c83030", thin }) {
  return (
    <div className="bw">
      <div className="bl"><span>HP</span><span>{cur}/{max}</span></div>
      <div className="bt" style={thin?{height:6}:{}}><div className="bf" style={{width:`${Math.round(Math.max(0,cur)/max*100)}%`,background:`linear-gradient(90deg,${color}99,${color})`}}/></div>
    </div>
  );
}

function ReplayLog({ lines, cursor }) {
  const ref = useRef(null);
  const visible = lines.slice(0, cursor);
  useEffect(()=>{ if(ref.current) ref.current.scrollTop=ref.current.scrollHeight; },[cursor]);
  const COLOR = {
    hit:"#d4a030", enemy:"#c84040", win:"#50c870", lose:"#c84040",
    heal:"#50c890", merc:"#6aaa6a", loot:"#c878e0", info:"#8a7050",
    title:"#e8c050", sep:"#3a2a10",
  };
  return (
    <div className="blog" ref={ref} style={{height:280,fontFamily:"'Crimson Text',serif"}}>
      {visible.map((line,i)=>{
        const isLast=i===visible.length-1;
        const c=COLOR[line.type]||"#a08060";
        const isSep=line.type==="sep";
        return (
          <div key={i} style={{
            color:isSep?"#2a1a08":c,
            fontStyle:line.type==="info"||line.type==="sep"?"italic":"normal",
            fontFamily:line.type==="title"||line.type==="win"||line.type==="lose"?"'Cinzel',serif":"inherit",
            fontSize:line.type==="title"?"13px":"12px",
            letterSpacing:line.type==="title"?1:0,
            borderBottom:isSep?"1px solid #2a1a08":"none",
            margin:isSep?"6px 0":"0",
            padding:isSep?"0":"1px 0",
            opacity:isLast?1:0.9,
            animation:isLast?"fadeIn .15s ease":"none",
          }}>{line.txt}</div>
        );
      })}
    </div>
  );
}

function BattleLog({ log }) {
  const ref = useRef(null);
  useEffect(()=>{ if(ref.current) ref.current.scrollTop=ref.current.scrollHeight; },[log]);
  return (
    <div className="blog" ref={ref}>
      {log.map((line,i)=>{
        const txt=typeof line==="string"?line:line.txt;
        return (
          <div key={i} className={
            txt.includes("你攻擊")||txt.includes("爆擊")?"lh":
            txt.includes("🗡")?"lm":
            txt.includes("攻擊了")&&!txt.includes("你攻擊")?"le":
            (txt.includes("擊敗")||txt.includes("等級"))?"lw":
            (txt.includes("被擊敗")||txt.includes("陣亡"))?"ll":""
          }>{txt}</div>
        );
      })}
    </div>
  );
}

function LootPopup({ item, onEquip, onTake, onDiscard }) {
  const lr = getRarity(item.rarity);
  const isMercScroll = item.type === "merc_scroll";
  return (
    <div className="lp">
      <div className="lb" style={{
        borderColor: lr.color+"99",
        boxShadow: `0 0 60px rgba(0,0,0,.9), ${lr.glow||"0 0 20px rgba(139,90,20,.2)"}`,
      }}>
        <div className="ltl">{isMercScroll ? "📜 傭兵契約捲軸" : "✨ 戰利品掉落 ✨"}</div>
        <div className="lii" style={{filter:`drop-shadow(0 4px 12px ${lr.color}88)`}}>{item.icon}</div>
        <div className="lin" style={{color:lr.color, textShadow:lr.glow?`0 0 12px ${lr.color}`:"none"}}>{item.name}</div>
        <div className="rb" style={{color:lr.color, borderColor:lr.color+"66", background:`${lr.color}18`}}>{lr.label}</div>
        {item.cat && (
          <div style={{fontSize:11,color:"#d08030",margin:"5px 0"}}>
            {item.cat&&WEAPON_CATEGORIES[item.cat]?WEAPON_CATEGORIES[item.cat].icon:""} {item.cat&&WEAPON_CATEGORIES[item.cat]?WEAPON_CATEGORIES[item.cat].label:""} · {item.cat&&WEAPON_CATEGORIES[item.cat]?WEAPON_CATEGORIES[item.cat].traitDesc:""}
          </div>
        )}
        <div className="lst">
          {item.attack>0  && <div>攻擊 {isMercScroll?"":"+"}{item.attack}</div>}
          {item.defense>0 && <div>防禦 {isMercScroll?"":"+"}{item.defense}</div>}
          {item.hp>0      && <div>HP {isMercScroll?"":"+"}{item.hp}</div>}
          {item.speed>0   && <div>速度 +{item.speed}</div>}
          {item.heal>0    && <div style={{color:"#50c890"}}>每回合回復 {item.heal}HP</div>}
          {item.itemLevel && <div style={{color:"#5a4020",fontSize:11}}>物品等級 {item.itemLevel}</div>}
        </div>
        <AffixLines affixes={item.affixes}/>
        <div className="la">
          {isMercScroll ? (
            <>
              <button className="btn btp" onClick={onTake}>📜 收入背包</button>
              <button className="btn btd" onClick={onDiscard}>🗑 丟棄</button>
            </>
          ) : (
            <>
              <button className="btn btp" onClick={onEquip}>⚔ 裝備</button>
              <button className="btn btm" onClick={onTake}>🎒 背包</button>
              <button className="btn btd" onClick={onDiscard}>🗑 丟棄</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


// ── QuestTab component ────────────────────────────────────────────────────
function QuestTab({ player, inventory, questState, onCollect }: {
  player: RuntimePlayer;
  inventory: RuntimeItem[];
  questState: RuntimeQuestState;
  onCollect: (questId: string) => void;
}) {
  const [catTab, setCatTab] = useState("daily");
  const statsWithInv = {...player, _inv: inventory};

  const cats = [
    {id:"daily",   label:"📅 每日", color:"#4caf50"},
    {id:"weekly",  label:"📆 每週", color:"#4a9fd4"},
    {id:"achieve", label:"🏆 成就", color:"#e07020"},
  ];

  const questsInCat = Object.entries(QUEST_DEFS).filter(([,d])=>d.cat===catTab);

  // Count completable quests for badge
  const completable = Object.entries(QUEST_DEFS).filter(([id,])=>
    isQuestDone(id, statsWithInv, questState)
  ).length;

  return (
    <div>
      <div className="stl">
        📋 任務
        {completable>0&&(
          <span style={{marginLeft:8,background:"#c84040",color:"#fff",borderRadius:"10px",
            padding:"1px 7px",fontSize:11,fontFamily:"sans-serif"}}>
            {completable}
          </span>
        )}
      </div>

      {/* Category tabs */}
      <div className="quest-tabs">
        {cats.map(cat=>{
          const catCompletable = Object.entries(QUEST_DEFS)
            .filter(([id,d])=>d.cat===cat.id&&isQuestDone(id,statsWithInv,questState))
            .length;
          return(
            <button key={cat.id}
              className={`btn${catTab===cat.id?" btp":" btm"}`}
              style={{fontSize:11,padding:"6px 14px",position:"relative"}}
              onClick={()=>setCatTab(cat.id)}>
              {cat.label}
              {catCompletable>0&&(
                <span style={{marginLeft:5,background:"#c84040",color:"#fff",
                  borderRadius:"8px",padding:"0 5px",fontSize:10}}>
                  {catCompletable}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Reset info */}
      {catTab==="daily"&&(
        <div style={{fontSize:11,color:"#4a3820",marginBottom:10,fontStyle:"italic"}}>
          每日任務在午夜重置（{questState.dailyDate}）
        </div>
      )}
      {catTab==="weekly"&&(
        <div style={{fontSize:11,color:"#4a3820",marginBottom:10,fontStyle:"italic"}}>
          每週任務在週一重置（{questState.weeklyDate}）
        </div>
      )}
      {catTab==="achieve"&&(
        <div style={{fontSize:11,color:"#4a3820",marginBottom:10,fontStyle:"italic"}}>
          成就任務永不重置，完成後即鎖定
        </div>
      )}

      {/* Quest list */}
      <div className="quest-cat">
        {questsInCat.map(([id, def])=>{
          const collected = questState.progress[id]&&questState.progress[id].collected;
          const done      = !collected && isQuestDone(id, statsWithInv, questState);
          const progress  = getQuestProgress(id, statsWithInv, questState);
          const pct       = Math.min(100, Math.round(progress/def.target*100));
          const barColor  = done?"#4caf50":pct>50?"#c8961e":"#4a9fd4";

          return(
            <div key={id} className={`quest-card${collected?" done":done?" collect":""}`}>
              <div className="quest-icon">{def.icon}</div>
              <div className="quest-body">
                <div className="quest-title">{def.title}</div>
                <div className="quest-desc">{def.desc}</div>
                {/* Progress bar */}
                {!collected&&(
                  <>
                    <div className="quest-progress">
                      <div className="quest-pbar" style={{width:`${pct}%`,background:barColor}}/>
                    </div>
                    <div className="quest-ptext">
                      {done
                        ? "✅ 已完成，可領取！"
                        : `${Math.min(progress, def.target)} / ${def.target}`}
                    </div>
                  </>
                )}
                {collected&&(
                  <div className="quest-ptext" style={{color:"#4caf50"}}>✓ 已領取</div>
                )}
                {/* Rewards */}
                <div className="quest-rewards">
                  {def.rewards.map((r,i)=>(
                    <span key={i} className="quest-reward-badge">{r.label}</span>
                  ))}
                </div>
              </div>
              {/* Collect button */}
              <div className="quest-btn">
                {!collected&&done&&(
                  <button className="btn btp" style={{fontSize:10,padding:"6px 12px",whiteSpace:"nowrap"}}
                    onClick={()=>onCollect(id)}>
                    領取！
                  </button>
                )}
                {collected&&(
                  <div style={{fontSize:18}}>✅</div>
                )}
                {!collected&&!done&&(
                  <div style={{fontSize:11,color:"#4a3020",textAlign:"center"}}>
                    {pct}%
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ArenaTab component ────────────────────────────────────────────────────
function ArenaTab({ player, arenaOpponents, arenaInjuredUntil, arenaRefreshes, onRefresh, onFight, onInit }: {
  player: RuntimePlayer;
  arenaOpponents: RuntimeArenaOpponent[];
  arenaInjuredUntil: number;
  arenaRefreshes: number;
  onRefresh: (free: boolean) => void;
  onFight: (opponent: RuntimeArenaOpponent) => void;
  onInit: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  // Tick every second for injury countdown
  useEffect(()=>{
    if(now >= arenaInjuredUntil) return;
    const t = setTimeout(()=>setNow(Date.now()), 1000);
    return ()=>clearTimeout(t);
  }, [now, arenaInjuredUntil]);

  const injured = now < arenaInjuredUntil;
  const remaining = Math.max(0, arenaInjuredUntil - now);
  const injuredMins = Math.floor(remaining / 60000);
  const injuredSecs = Math.floor((remaining % 60000) / 1000);

  return (
    <div>
      <div className="stl">🏟 競技場 <span style={{color:"#6a5030",fontSize:13}}>— 挑戰對手掠奪金幣</span></div>
      <div style={{fontSize:12,color:"#5a4020",marginBottom:14,fontStyle:"italic",lineHeight:1.8}}>
        挑戰隨機對手，勝利可掠奪對方金幣（10-25%）。<br/>
        <span style={{color:"#c84040"}}>敗北則受傷休息 30 分鐘，且損失金幣。</span>
      </div>

      {/* Injury banner */}
      {injured&&(
        <div className="arena-injury">
          <div style={{fontSize:28,marginBottom:8}}>🛌</div>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:14,color:"#c84040",marginBottom:6}}>正在養傷中</div>
          <div style={{fontSize:13,color:"#8a4030",marginBottom:12}}>上次競技場落敗，需要休息才能再次出戰</div>
          <div style={{fontFamily:"'Cinzel Decorative',serif",fontSize:22,color:"#c84040"}}>
            {String(injuredMins).padStart(2,"0")}:{String(injuredSecs).padStart(2,"0")}
          </div>
          <div style={{fontSize:11,color:"#6a3020",marginTop:4}}>剩餘休息時間</div>
        </div>
      )}

      {/* Refresh bar */}
      <div className="arena-refresh-bar">
        <div style={{color:"#8a7050"}}>
          今日免費刷新：<span style={{color:"#c8961e",fontFamily:"'Cinzel',serif"}}>{arenaRefreshes}</span>/5 次剩餘
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="btn btp" style={{fontSize:10,padding:"5px 12px"}}
            onClick={()=>onRefresh(true)}
            disabled={arenaRefreshes<=0}>
            🔄 免費刷新
          </button>
          <button className="btn btm" style={{fontSize:10,padding:"5px 12px"}}
            onClick={()=>onRefresh(false)}>
            🪙 花費 {50+player.level*10} 刷新
          </button>
        </div>
      </div>

      {/* Empty state */}
      {arenaOpponents.length===0&&!injured&&(
        <div style={{textAlign:"center",padding:"30px",color:"#5a4020",fontStyle:"italic"}}>
          <div style={{fontSize:32,marginBottom:10}}>🏟</div>
          點擊「免費刷新」開始尋找對手
          <div style={{marginTop:12}}>
            <button className="btn btp" style={{fontSize:11}} onClick={()=>onRefresh(true)} disabled={arenaRefreshes<=0}>
              🔄 尋找對手
            </button>
          </div>
        </div>
      )}

      {/* Opponents grid */}
      <div className="arena-grid">
        {arenaOpponents.map(opp=>{
          const tierLabel = opp.tier==="weak"?"較弱":opp.tier==="strong"?"較強":"相當";
          const tierColor = opp.tier==="weak"?"#4caf50":opp.tier==="strong"?"#e07020":"#4a9fd4";
          const plunderEst = Math.floor(opp.goldCarried * 0.175);
          const canFight = !injured;
          return(
            <div key={opp.id} className={`arena-card ${opp.tier}`}
              style={{opacity:canFight?1:0.5,cursor:canFight?"pointer":"not-allowed"}}
              onClick={()=>canFight&&onFight(opp)}>
              <div className="ac-tier">{tierLabel}</div>
              <div style={{fontSize:28,marginBottom:6,filter:`drop-shadow(0 2px 8px ${tierColor}66)`}}>
                {opp.tier==="strong"?"😤":opp.tier==="weak"?"😰":"😐"}
              </div>
              <div className="ac-name">{opp.name}</div>
              <div className="ac-lvl">Lv.{opp.level} · {opp.wins}勝 {opp.losses}敗</div>
              <div className="ac-stats">
                <div><span style={{color:"#c8781e"}}>攻 {opp.attack}</span> · <span style={{color:"#4a9fd4"}}>防 {opp.defense}</span></div>
                <div><span style={{color:"#c84040"}}>HP {opp.maxHp}</span></div>
                <div style={{color:"#f0c040",marginTop:4}}>💰 攜帶 ~{opp.goldCarried} 金</div>
                <div style={{color:"#4caf50",fontSize:10}}>預估掠奪 ~{plunderEst} 金</div>
              </div>
              {/* Equipped gear icons */}
              <div style={{marginTop:8,display:"flex",gap:3,flexWrap:"wrap",minHeight:22}}>
                {Object.entries(opp.equipment).map(([slot,eq])=>{
                  const item = eq as any;
                  if(!item) return null;
                  const r=getRarity(item.rarity);
                  return(
                    <span key={slot} title={item.name}
                      style={{fontSize:13,filter:`drop-shadow(0 1px 3px ${r.color}88)`}}>
                      {item.icon}
                    </span>
                  );
                })}
              </div>
              <button className="btn btp" style={{width:"100%",marginTop:10,fontSize:11}}
                disabled={!canFight}
                onClick={e=>{e.stopPropagation();canFight&&onFight(opp);}}>
                {canFight?"⚔ 挑戰！":"🛌 休息中"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Rules */}
      <div style={{marginTop:16,padding:"10px 14px",background:"#0e0a06",border:"1px solid #2a1a08",borderRadius:5,fontSize:11,color:"#4a3820",lineHeight:1.9}}>
        <div style={{color:"#6a5030",fontFamily:"'Cinzel',serif",marginBottom:4}}>競技場規則</div>
        🟢 <span style={{color:"#4caf50"}}>較弱</span> — 容易擊敗，掠奪金幣較少<br/>
        🔵 <span style={{color:"#4a9fd4"}}>相當</span> — 勝負各半，掠奪金幣適中<br/>
        🟠 <span style={{color:"#e07020"}}>較強</span> — 難以擊敗，掠奪金幣豐厚<br/>
        每天 5 次免費刷新，或花費金幣額外刷新。敗北休息 30 分鐘。
      </div>
    </div>
  );
}

function App() {
  const [player, setPlayer] = useState<RuntimePlayer>(() => loadGameState().player);

  const [inventory, setInventory] = useState<RuntimeItem[]>(() => loadGameState().inventory);

  const [tab, setTab] = useState("dungeon");
  const [replay, setReplay] = useState<RuntimeReplay | null>(null);
  const replayTimerRef = useRef<number | null>(null);
  const [lootDrop, setLootDrop] = useState(null);
  const [selectedScrolls, setSelectedScrolls] = useState([]);
  const [saveMsg, setSaveMsg] = useState("");
  const [shopFilter, setShopFilter] = useState("all");
  const [invFilter, setInvFilter] = useState("all");
  const [shopItems, setShopItems] = useState(()=>Array.from({length:8},(_,i)=>genShopItem(1,["weapon","offhand","armor","helmet","gloves","boots","ring","amulet"][i])));
  const [auctionItems, setAuctionItems] = useState(()=>Array.from({length:4},()=>genAuctionItem(1)));
  const [shopTab, setShopTab] = useState("buy");
  const [bidInput, setBidInput] = useState({});
  const [enhanceTarget, setEnhanceTarget] = useState(null);
  const [enhanceLog, setEnhanceLog] = useState([]);
  const [enhanceAnim, setEnhanceAnim] = useState(null);
  // ── Arena state ──────────────────────────────────────────────────────────
  const [arenaOpponents, setArenaOpponents] = useState<RuntimeArenaOpponent[]>([]);
  const [arenaInjuredUntil, setArenaInjuredUntil] = useState(0); // timestamp ms
  const [arenaRefreshes, setArenaRefreshes] = useState(5); // free refreshes per day
  const [arenaLastDate, setArenaLastDate] = useState("");
  // ── Quest state ───────────────────────────────────────────────────────────
  const [questState, setQuestState] = useState<RuntimeQuestState>(()=>initQuestState());
  const [questNotify, setQuestNotify] = useState(null); // {msg} toast notification // YYYY-MM-DD

  const save = useCallback(() => {
    saveGameState({ player, inventory });
    setSaveMsg("存檔成功！"); setTimeout(()=>setSaveMsg(""),2000);
  }, [player,inventory]);

  const reset = () => {
    if(!confirm("確定重置？"))return;
    clearGameState();
    setPlayer({ ...INITIAL_PLAYER, equipment: { ...INITIAL_EQUIPMENT } });
    setInventory([]); setReplay(null); setSelectedScrolls([]);
  };

  const tAtk=cAtk(player), tDef=cDef(player), tMhp=cMhp(player), tSpd=cSpd(player);
  const pSpec=gSpec(player);
  const wCat=getWeaponCat(player);

  function lvUp(np,expG,goldG,log){
    np.gold+=goldG;
    let exp=np.exp+expG,lv=np.level,en=np.expNeeded,mhp=np.maxHp;
    while(exp>=en){exp-=en;lv++;en=Math.floor(en*1.4);mhp+=15;np.attack+=2;np.defense+=1;log.push({txt:`🌟 等級提升！Lv.${lv}！`,type:"win"});}
    np.exp=exp;np.expNeeded=en;np.level=lv;np.maxHp=mhp;
    np.hp=Math.min(np.hp+20,cMhp(np));
    return np;
  }

  function fightMonster(enemy, np, pAtk, pDef, pMhp, specials, wc, log, bleedRef) {
    let round=0, firstRound=true, bleed=bleedRef.val;
    let totalDmgDealt=0,totalDmgTaken=0,crits=0,stuns=0;
    while(np.hp>0&&enemy.hp>0&&round<80){
      round++;
      if(bleed>0){
        const bd=bleed*3;
        const resist=enemy.trait==="undead"&&Math.random()<0.3;
        enemy.hp=Math.max(0,enemy.hp-(resist?0:bd));
        log.push({txt:resist?`💀 ${enemy.name}抵抗流血！`:`🩸 流血${bd}傷害(${bleed}層)`,type:resist?"info":"hit"});
      }
      if(enemy.hp<=0) break;
      let rawDef=enemy.defense;
      if((wc&&wc.trait)==="armorbreak") rawDef=Math.floor(rawDef*0.8);
      if(enemy.trait==="phase") rawDef=Math.floor(rawDef*0.75);
      let dmgMult=1;
      if((wc&&wc.trait)==="swift"&&firstRound){dmgMult=1.5;log.push({txt:`⚡ 先制一擊！×1.5`,type:"hit"});}
      let dmg=Math.max(1,Math.floor((pAtk-rawDef+Math.floor(Math.random()*5)-2)*dmgMult));
      const{healed,extra,isCrit}=applySpec(specials,dmg,enemy);
      const{finalDmg,log:tlog,newBleed,stunned}=applyWeaponTrait(wc,dmg+extra,enemy,firstRound,bleed);
      tlog.forEach(t=>log.push({txt:t,type:"hit"}));
      if(isCrit){log.push({txt:`💥 爆擊！`,type:"hit"});crits++;}
      if(stunned) stuns++;
      bleed=newBleed||bleed;
      let actualDmg=finalDmg;
      if(enemy.trait==="dodge"&&Math.random()<0.20){actualDmg=0;log.push({txt:`${enemy.icon}${enemy.name}閃避！`,type:"enemy"});}
      if(enemy.trait==="armor") actualDmg=Math.floor(actualDmg*0.6);
      if(enemy.trait==="dragonArmor") actualDmg=Math.floor(actualDmg*0.65);
      if(enemy.trait==="divine"&&enemy.shielded){actualDmg=0;enemy.shielded=false;log.push({txt:`🛡 神力護盾抵擋攻擊！`,type:"enemy"});}
      enemy.hp=Math.max(0,enemy.hp-actualDmg);
      totalDmgDealt+=actualDmg;
      if(actualDmg>0) log.push({txt:`回合${round}: 你→${enemy.icon}${enemy.name} ${actualDmg}${isCrit?"💥":""}`,type:"hit"});
      if(healed>0){np.hp=Math.min(np.hp+healed,pMhp);log.push({txt:`🩸 吸血+${healed}HP`,type:"heal"});}
      const regen=specials.filter(s=>s.type==="regen"||s.type==="vampiric").reduce((a,x)=>a+x.val,0);
      if(regen>0&&np.hp>0){np.hp=Math.min(np.hp+regen,pMhp);log.push({txt:`💚 回復+${regen}HP`,type:"heal"});}
      if(enemy.hp<=0) break;
      if(!stunned){
        let eDmg=Math.max(1,enemy.attack-pDef+Math.floor(Math.random()*4)-2);
        if(enemy.trait==="fire"){enemy.burnStacks=(enemy.burnStacks||0)+1;np.hp=Math.max(0,np.hp-enemy.burnStacks*2);log.push({txt:`🔥 燒傷${enemy.burnStacks*2}`,type:"enemy"});}
        if(enemy.trait==="voidRip") eDmg=Math.max(1,enemy.attack+Math.floor(Math.random()*4));
        if(enemy.trait==="charge"&&round===1){eDmg=Math.floor(eDmg*1.3);log.push({txt:`💥 ${enemy.name}憤怒衝鋒！`,type:"enemy"});}
        if(enemy.trait==="inferno"&&round%3===0){eDmg=Math.floor(eDmg*2);log.push({txt:`🔥 ${enemy.name}全力一擊！`,type:"enemy"});}
        if(enemy.trait==="collapse"&&round%5===0){eDmg+=15;log.push({txt:`🪨 岩石崩落+15`,type:"enemy"});}
        if(enemy.trait==="dragonRage"&&enemy.hp<enemy.maxHp*0.3){eDmg=Math.floor(eDmg*1.6);log.push({txt:`😡 古龍暴怒！×1.6`,type:"enemy"});}
        if(enemy.trait==="stonewall"){enemy.hp=Math.min(enemy.maxHp,enemy.hp+5);log.push({txt:`💚 ${enemy.name}回復5HP`,type:"enemy"});}
        if(enemy.trait==="soulSuck"){const s=Math.floor(eDmg*0.05);enemy.hp=Math.min(enemy.maxHp,enemy.hp+s);}
        const thorns=specials.filter(s=>s.type==="thorns").reduce((a,x)=>a+x.val,0);
        const reflect=specials.filter(s=>s.type==="reflect").reduce((a,x)=>a+x.val,0);
        if(thorns>0){enemy.hp=Math.max(0,enemy.hp-thorns);log.push({txt:`🌵 荊棘反傷${thorns}`,type:"hit"});}
        if(reflect>0){enemy.hp=Math.max(0,enemy.hp-reflect);log.push({txt:`🔮 盾反${reflect}`,type:"hit"});}
        np.hp=Math.max(0,np.hp-eDmg);
        totalDmgTaken+=eDmg;
        log.push({txt:`${enemy.icon}${enemy.name}→你 ${eDmg}傷害`,type:"enemy"});
      }
      firstRound=false;
    }
    bleedRef.val=bleed;
    return{np,won:enemy.hp<=0,crits,stuns,totalDmgDealt,totalDmgTaken};
  }

  function simulateExpedition(expedition, initPlayer) {
    let np={...initPlayer};
    const pAtk=cAtk(np),pDef=cDef(np),pMhp=cMhp(np);
    const specials=gSpec(np),wc=getWeaponCat(np);
    const log=[],drops=[],bleedRef={val:0};
    log.push({txt:`🗺 探險：${expedition.name}`,type:"title"});
    log.push({txt:`"${expedition.desc}"`,type:"info"});
    if(wc) log.push({txt:`🗡 ${wc.label} — ${wc.traitDesc}`,type:"info"});
    const enemy=buildEnemy(expedition.monster,np.level,1.0);
    log.push({txt:`━━ ${enemy.icon}${enemy.name} ｜ HP:${enemy.maxHp} 攻:${enemy.attack} 防:${enemy.defense} ━━`,type:"sep"});
    log.push({txt:`📜 ${enemy.lore}`,type:"info"});
    log.push({txt:`⚡ 特性：${enemy.traitDesc}`,type:"info"});
    const r=fightMonster(enemy,np,pAtk,pDef,pMhp,specials,wc,log,bleedRef);
    np=r.np;
    if(r.won){
      const expG=Math.floor(enemy.expReward*expedition.expMult);
      const goldG=Math.floor(enemy.goldReward*expedition.goldMult);
      np=lvUp(np,expG,goldG,log);
      log.push({txt:`✅ 擊敗${enemy.name}！+${expG}EXP +${goldG}金`,type:"win"});
      if(Math.random()<0.30+expedition.lootBonus){const d=genLoot(np.level,expedition.lootBonus);drops.push(d);log.push({txt:`✨ 掉落：${d.rarityLabel}【${d.name}】`,type:"loot"});}
      if(Math.random()<0.08+expedition.lootBonus*0.5){const s=genMercScroll(np.level);drops.push(s);log.push({txt:`📜 傭兵契約捲軸：${s.rarityLabel}【${s.name}】`,type:"loot"});}
    } else {
      log.push({txt:`💀 被${enemy.name}擊敗！`,type:"lose"});
      np.gold=Math.max(50, np.gold-Math.min(300,Math.floor(np.gold*0.08)));
      np.hp=Math.floor(cMhp(np)*0.3);
    }
    log.push({txt:`─────────────────`,type:"sep"});
    log.push({txt:`📊 ${r.won?"勝利":"落敗"} · 造成${r.totalDmgDealt} · 承受${r.totalDmgTaken}`,type:r.won?"win":"lose"});
    return{log,finalPlayer:np,drops,won:r.won};
  }

  function simulateRun(dungeon, tier, initPlayer){
    let np={...initPlayer};
    const pAtk=cAtk(np),pDef=cDef(np),pMhp=cMhp(np);
    const specials=gSpec(np),wc=getWeaponCat(np);
    const log=[],drops=[],bleedRef={val:0};
    let totalKills=0,totalDmgDealt=0,totalDmgTaken=0,totalCrits=0;
    log.push({txt:`⚔️ 進入 ${dungeon.name}【${tier.label}】`,type:"title"});
    log.push({txt:`"${dungeon.lore}"`,type:"info"});
    if(wc) log.push({txt:`🗡 ${wc.label} — ${wc.traitDesc}`,type:"info"});
    for(const wave of dungeon.waves){
      if(np.hp<=0) break;
      log.push({txt:`━━ ${wave.label} — ${wave.desc} ━━`,type:"sep"});
      for(const mKey of wave.monsters){
        if(np.hp<=0) break;
        const enemy=buildEnemy(mKey,np.level,tier.mult);
        log.push({txt:`${enemy.icon}${enemy.name} 出現！(HP:${enemy.maxHp} 攻:${enemy.attack} ⚡${enemy.traitDesc})`,type:"info"});
        const r=fightMonster(enemy,np,pAtk,pDef,pMhp,specials,wc,log,bleedRef);
        np=r.np;totalDmgDealt+=r.totalDmgDealt;totalDmgTaken+=r.totalDmgTaken;totalCrits+=r.crits;
        if(r.won){
          totalKills++;
          const expG=Math.floor(enemy.expReward*tier.expMult);
          const goldG=Math.floor(enemy.goldReward*tier.goldMult);
          np=lvUp(np,expG,goldG,log);
          log.push({txt:`✅ 擊敗${enemy.name}！+${expG}EXP +${goldG}金`,type:"win"});
          if(Math.random()<0.20+tier.lootBonus*0.5){const d=genLoot(np.level,tier.lootBonus);drops.push(d);log.push({txt:`✨ 掉落：${d.rarityLabel}【${d.name}】`,type:"loot"});}
        } else {
          log.push({txt:`💀 在第${totalKills+1}怪陣亡！`,type:"lose"}); break;
        }
      }
      if(np.hp>0) np.hp=Math.min(pMhp,np.hp+Math.floor(pMhp*0.12));
    }
    if(np.hp>0&&dungeon.boss){
      log.push({txt:`━━━━━━━━━━━━━━━━━━`,type:"sep"});
      log.push({txt:`🔥 ${dungeon.bossIntro}`,type:"title"});
      const boss=buildEnemy(dungeon.boss,np.level,tier.mult,true);
      log.push({txt:`${boss.icon}${boss.name} ｜ HP:${boss.maxHp} 攻:${boss.attack} 防:${boss.defense}`,type:"info"});
      log.push({txt:`👹 Boss特性：${boss.traitDesc}`,type:"info"});
      const r=fightMonster(boss,np,pAtk,pDef,pMhp,specials,wc,log,bleedRef);
      np=r.np;totalDmgDealt+=r.totalDmgDealt;totalDmgTaken+=r.totalDmgTaken;totalCrits+=r.crits;
      if(r.won){
        totalKills++;
        const expG=Math.floor(boss.expReward*tier.expMult);
        const goldG=Math.floor(boss.goldReward*tier.goldMult);
        np=lvUp(np,expG,goldG,log);
        log.push({txt:`👑 擊敗Boss ${boss.name}！+${expG}EXP +${goldG}金`,type:"win"});
        if(Math.random()<0.60+tier.lootBonus){const d=genLoot(np.level,tier.lootBonus+0.1);drops.push(d);log.push({txt:`✨ Boss掉落：${d.rarityLabel}【${d.name}】`,type:"loot"});}
        if(Math.random()<0.25+tier.lootBonus){const s=genMercScroll(np.level);drops.push(s);log.push({txt:`📜 Boss掉落契約捲軸：${s.rarityLabel}【${s.name}】`,type:"loot"});}
      } else {
        log.push({txt:`💀 敗於Boss ${boss.name}！`,type:"lose"});
      }
    }
    const won=np.hp>0;
    if(!won){np.gold=Math.max(50,np.gold-Math.min(300,Math.floor(np.gold*0.1)));np.hp=Math.floor(cMhp(np)*0.3);}
    const totalMonsters=dungeon.waves.flatMap(w=>w.monsters).length+1;
    log.push({txt:`─────────────────`,type:"sep"});
    log.push({txt:`📊 戰鬥結算`,type:"title"});
    log.push({txt:`${won?"🏆 副本完成！":"💀 副本失敗"} · 擊殺${totalKills}/${totalMonsters}`,type:won?"win":"lose"});
    log.push({txt:`⚔ 造成${totalDmgDealt} · 承受${totalDmgTaken} · 爆擊${totalCrits}次 · 掉落${drops.length}件`,type:"info"});
    return{log,finalPlayer:np,drops,won};
  }

  function simulateMercRun(dungeonId, initPlayer, mercs){
    const dungeon=MERC_DUNGEONS.find(d=>d.id===dungeonId)||MERC_DUNGEONS[0];
    let np={...initPlayer};
    const pAtk=cAtk(np),pDef=cDef(np),pMhp=cMhp(np);
    const specials=gSpec(np);
    const nm=mercs.map(m=>({...m,curHp:m.hp,alive:true}));
    const log=[],drops=[];
    let totalDmgDealt=0,totalDmgTaken=0;

    log.push({txt:`🏴 傭兵副本：${dungeon.icon}${dungeon.label}`,type:"title"});
    log.push({txt:`"${dungeon.lore}"`,type:"info"});
    log.push({txt:`📢 傭兵：${nm.map(m=>m.name).join("、")}`,type:"info"});

    for(let wi=0;wi<dungeon.waves.length;wi++){
      const wave=dungeon.waves[wi];
      if(np.hp<=0) break;
      log.push({txt:`━━ 第${wi+1}波 — ${wave.desc} ━━`,type:"sep"});
      for(const mKey of wave.enemies){
        if(np.hp<=0) break;
        const mData=MONSTERS[mKey];
        let enemy;
        if(mData){
          enemy=buildEnemy(mKey, np.level+dungeon.lvBonus, wave.mult||1.0);
        } else {
          const fallbackKey=Object.keys(MONSTERS)[Math.floor(Math.random()*6)];
          enemy=buildEnemy(fallbackKey, np.level+dungeon.lvBonus, wave.mult||1.0);
          enemy.name=mKey;
        }
        log.push({txt:`${enemy.icon}${enemy.name} 出現！HP:${enemy.maxHp} 攻:${enemy.attack} ⚡${enemy.traitDesc}`,type:"info"});

        let round=0;
        while(np.hp>0&&enemy.hp>0&&round<60){
          round++;
          let dmg=Math.max(1,pAtk-enemy.defense+Math.floor(Math.random()*5)-2);
          const{healed,extra,isCrit}=applySpec(specials,dmg,enemy);
          dmg+=extra; if(isCrit)log.push({txt:`💥 爆擊！`,type:"hit"});
          if(enemy.trait==="dodge"&&Math.random()<0.18){log.push({txt:`${enemy.name}閃避！`,type:"enemy"});}
          else{
            const blocked=enemy.trait==="armor"?Math.floor(dmg*0.4):enemy.trait==="dragonArmor"?Math.floor(dmg*0.35):0;
            dmg=Math.max(1,dmg-blocked);
            enemy.hp=Math.max(0,enemy.hp-dmg);
            totalDmgDealt+=dmg;
            log.push({txt:`回合${round}: 你→${enemy.icon}${enemy.name} ${dmg}`,type:"hit"});
          }
          if(healed>0){np.hp=Math.min(np.hp+healed,pMhp);log.push({txt:`🩸 吸血+${healed}`,type:"heal"});}

          for(const m of nm){
            if(!m.alive||enemy.hp<=0)continue;
            const md=Math.max(1,m.attack-enemy.defense+Math.floor(Math.random()*3));
            enemy.hp=Math.max(0,enemy.hp-md);
            totalDmgDealt+=md;
            log.push({txt:`${m.icon}${m.name}→${enemy.name} ${md}`,type:"merc"});
          }
          if(enemy.hp<=0) break;

          const alive=nm.filter(m=>m.alive);
          const tanks=alive.filter(m=>m.defense>=8);
          const targets=tanks.length?tanks:alive;
          if(targets.length){
            const t=targets[Math.floor(Math.random()*targets.length)];
            const ed=Math.max(1,enemy.attack-t.defense+Math.floor(Math.random()*3));
            t.curHp=Math.max(0,t.curHp-ed); totalDmgTaken+=ed;
            log.push({txt:`${enemy.name}→${t.name} ${ed}傷害`,type:"enemy"});
            if(t.curHp<=0){t.alive=false;log.push({txt:`💀 ${t.name}陣亡！`,type:"lose"});}
          } else {
            const ed=Math.max(1,enemy.attack-pDef+Math.floor(Math.random()*4)-2);
            np.hp=Math.max(0,np.hp-ed); totalDmgTaken+=ed;
            log.push({txt:`${enemy.name}→你 ${ed}傷害`,type:"enemy"});
          }
          const healerMerc=nm.find(m=>m.alive&&(m.heal>0||m.name.includes("治癒")));
          if(healerMerc){const ha=healerMerc.heal||8;np.hp=Math.min(np.hp+ha,pMhp);log.push({txt:`💚${healerMerc.name}回復${ha}HP`,type:"heal"});}
          if(enemy.trait==="fire"){enemy.burnStacks=(enemy.burnStacks||0)+1;const bd=enemy.burnStacks*2;np.hp=Math.max(0,np.hp-bd);log.push({txt:`🔥 燒傷${bd}`,type:"enemy"});}
        }

        if(np.hp>0&&enemy.hp<=0){
          const expG=Math.floor(enemy.expReward*((dungeon.reward&&dungeon.reward.expMult)||1.2));
          const goldG=Math.floor(enemy.goldReward*((dungeon.reward&&dungeon.reward.goldMult)||1.5));
          np=lvUp(np,expG,goldG,log);
          log.push({txt:`✅ 擊敗${enemy.name}！+${expG}EXP +${goldG}金`,type:"win"});
        } else if(np.hp<=0){
          log.push({txt:`💀 你陣亡！`,type:"lose"});
        }
      }
      if(np.hp>0) np.hp=Math.min(pMhp,np.hp+Math.floor(pMhp*0.15));
    }

    if(np.hp>0&&dungeon.boss){
      const bd=dungeon.boss;
      const bossEnemy={
        name:bd.name, icon:bd.icon, trait:bd.trait, traitDesc:"",
        hp:Math.floor((np.level*8+12)*bd.hpM*1.5*((dungeon.reward&&dungeon.reward.goldMult)||1)),
        maxHp:Math.floor((np.level*8+12)*bd.hpM*1.5*((dungeon.reward&&dungeon.reward.goldMult)||1)),
        attack:Math.floor((np.level*2.6+4)*bd.atkM*1.2),
        defense:Math.floor((np.level*1.3+2)*bd.defM*1.1),
        expReward:Math.floor(np.level*40*((dungeon.reward&&dungeon.reward.expMult)||1)),
        goldReward:Math.floor(np.level*20*((dungeon.reward&&dungeon.reward.goldMult)||1)),
        shielded:false,burnStacks:0,regenVal:0,isBoss:true,
      };
      log.push({txt:`━━━━━━━━━━━━━━━━━━`,type:"sep"});
      log.push({txt:`👑 副本首領：${bd.icon}${bd.name} 登場！`,type:"title"});
      log.push({txt:`HP:${bossEnemy.maxHp} 攻:${bossEnemy.attack} 防:${bossEnemy.defense}`,type:"info"});
      const bleedRef={val:0};
      const r=fightMonster(bossEnemy,np,pAtk,pDef,pMhp,specials,wCat,log,bleedRef);
      np=r.np; totalDmgDealt+=r.totalDmgDealt;
      if(r.won){
        np=lvUp(np,bossEnemy.expReward,bossEnemy.goldReward,log);
        log.push({txt:`👑 擊敗首領${bd.name}！+${bossEnemy.expReward}EXP`,type:"win"});
        const scrollBonus=(dungeon.reward&&dungeon.reward.scrollBonus)||0.3;
        if(Math.random()<scrollBonus){
          const s=genMercScroll(np.level);drops.push(s);
          log.push({txt:`📜 首領掉落契約捲軸：${s.rarityLabel}【${s.name}】`,type:"loot"});
        }
        if(Math.random()<0.40){const d=genLoot(np.level,0.20);drops.push(d);log.push({txt:`✨ 掉落：${d.rarityLabel}【${d.name}】`,type:"loot"});}
      } else {
        log.push({txt:`💀 敗於首領${bd.name}！`,type:"lose"});
      }
    }

    const won=np.hp>0;
    if(!won){np.gold=Math.max(50, np.gold-Math.min(300,Math.floor(np.gold*0.08)));np.hp=Math.floor(cMhp(np)*0.3);}
    log.push({txt:`─────────────────`,type:"sep"});
    log.push({txt:`📊 ${won?"勝利":"落敗"} · 造成${totalDmgDealt} · 承受${totalDmgTaken} · 掉落${drops.length}件`,type:won?"win":"lose"});
    return{log,finalPlayer:np,drops,won};
  }

  // ── Simulate Arena PvP ────────────────────────────────────────────────────
  function simulateArenaBattle(pl, opponent) {
    const pAtk = cAtk(pl);
    const pDef = cDef(pl);
    const pMhp = cMhp(pl);
    const specials = gSpec(pl);
    const wc = getWeaponCat(pl);
    const oWc = WEAPON_CATEGORIES[opponent.wcKey];
    const pSpd = cSpd(pl);
    const oSpd = Math.floor((3 + opponent.level*0.5) * (opponent.tier==="strong"?1.2:1));
    const log = [];
    const bleedRef = {val:0};

    log.push({txt:`⚔️ 競技場對決！`,type:"title"});
    log.push({txt:`你 (Lv.${pl.level} 攻${pAtk} 防${pDef}) vs ${opponent.name} (Lv.${opponent.level} 攻${opponent.attack} 防${opponent.defense})`,type:"info"});
    if(wc)  log.push({txt:`你的武器：${wc.label} — ${wc.traitDesc}`,type:"info"});
    if(oWc) log.push({txt:`對手武器：${oWc.label} — ${oWc.traitDesc}`,type:"info"});
    log.push({txt:`━━━━━━━━━━━━━━━━━━`,type:"sep"});
    if(pSpd>=oSpd||(wc&&wc.trait==="firstblood"))
      log.push({txt:`⚡ 你先手！（速度 ${pSpd} vs ${oSpd}）`,type:"hit"});
    else
      log.push({txt:`⚡ 對手先手！（速度 ${oSpd} vs ${pSpd}）`,type:"enemy"});

    const fakeEnemy = {
      name:opponent.name, icon:"🏟",
      hp:opponent.maxHp, maxHp:opponent.maxHp,
      attack:opponent.attack, defense:opponent.defense,
      trait:oWc?oWc.trait:"balanced", traitDesc:oWc?oWc.traitDesc:"",
      isBoss:false, burnStacks:0, shielded:false, regenVal:0,
      expReward:0, goldReward:0,
    };

    const result = fightMonster(fakeEnemy, {...pl}, pAtk, pDef, pMhp, specials, wc, log, bleedRef);
    const won = result.won;
    let goldPlundered = 0;

    if(won) {
      goldPlundered = Math.floor(opponent.goldCarried * (0.10 + Math.random()*0.15));
      log.push({txt:`━━━━━━━━━━━━━━━━━━`,type:"sep"});
      log.push({txt:`🏆 勝利！擊敗 ${opponent.name}！`,type:"win"});
      log.push({txt:`💰 掠奪金幣 ${goldPlundered}（對手攜帶 ${opponent.goldCarried}）`,type:"win"});
    } else {
      log.push({txt:`━━━━━━━━━━━━━━━━━━`,type:"sep"});
      log.push({txt:`💀 落敗！被 ${opponent.name} 擊倒！`,type:"lose"});
      log.push({txt:`🛌 你需要休息 30 分鐘才能再戰`,type:"lose"});
    }
    log.push({txt:`─────────────────`,type:"sep"});
    log.push({txt:`📊 造成 ${result.totalDmgDealt} · 承受 ${result.totalDmgTaken} · 爆擊 ${result.crits} 次`,type:"info"});
    return {log, finalPlayer:result.np, won, goldPlundered};
  }

  const startBattle=(dungeon,tier)=>{
    const result=simulateRun(dungeon,tier,{...player});
    const fp = result.finalPlayer;
    // Track quest stats
    const killCount = dungeon.waves.flatMap(w=>w.monsters).length + (dungeon.boss?1:0);
    const bossKill  = result.won ? 1 : 0;
    fp.totalKills     = (fp.totalKills||0) + (result.won ? killCount : Math.floor(killCount*0.5));
    fp.totalBossKills = (fp.totalBossKills||0) + bossKill;
    fp.totalDungeons  = (fp.totalDungeons||0) + (result.won ? 1 : 0);
    fp.totalGoldEarned= (fp.totalGoldEarned||0) + Math.max(0, fp.gold - player.gold);
    fp.highestLevel   = Math.max(fp.highestLevel||1, fp.level);
    setPlayer(fp);
    setReplay({lines:result.log, cursor:0, drops:result.drops, dungeon, tier, won:result.won, pending:false, isExpedition:false});
    setTab("battle");
    updateQuestProgress(fp, inventory);
  };

  const startExpedition=(expedition)=>{
    const result=simulateExpedition(expedition,{...player});
    const fp = result.finalPlayer;
    fp.totalKills       = (fp.totalKills||0) + (result.won ? 1 : 0);
    fp.totalExpeditions = (fp.totalExpeditions||0) + (result.won ? 1 : 0);
    fp.totalGoldEarned  = (fp.totalGoldEarned||0) + Math.max(0, fp.gold - player.gold);
    fp.highestLevel     = Math.max(fp.highestLevel||1, fp.level);
    setPlayer(fp);
    setReplay({lines:result.log, cursor:0, drops:result.drops, won:result.won, expedition, isExpedition:true});
    setTab("battle");
    updateQuestProgress(fp, inventory);
  };

  useEffect(()=>{
    if(!replay||replay.cursor>=replay.lines.length) return;
    const delay = (replay.lines[replay.cursor]&&replay.lines[replay.cursor].type==="sep")?60:
                  (replay.lines[replay.cursor]&&replay.lines[replay.cursor].type==="title")?100:30;
    replayTimerRef.current=setTimeout(()=>{
      setReplay(r=>r?{...r,cursor:r.cursor+1}:null);
    },delay);
    return()=>clearTimeout(replayTimerRef.current);
  },[replay]);

  useEffect(()=>{
    if(!replay||replay.cursor<replay.lines.length) return;
    if(replay.drops&&replay.drops.length>0&&!lootDrop){
      setLootDrop({...replay.drops[0], _remaining: replay.drops.slice(1)});
    }
  },[(replay&&replay.cursor)]);

  const takeLoot=()=>{
    const remaining=(lootDrop&&lootDrop._remaining)||[];
    setInventory(inv=>[...inv,{...lootDrop,_remaining:undefined}]);
    setLootDrop(remaining.length>0?{...remaining[0],_remaining:remaining.slice(1)}:null);
  };
  const discardLoot=()=>{
    const remaining=(lootDrop&&lootDrop._remaining)||[];
    setLootDrop(remaining.length>0?{...remaining[0],_remaining:remaining.slice(1)}:null);
  };
  const equipLootNow=()=>{
    const item={...lootDrop,_remaining:undefined};
    const remaining=(lootDrop&&lootDrop._remaining)||[];
    const old=player.equipment[item.slot];
    setPlayer(p=>({...p,equipment:{...p.equipment,[item.slot]:item}}));
    if(old)setInventory(inv=>[...inv,{...old,uid:Date.now()}]);
    setLootDrop(remaining.length>0?{...remaining[0],_remaining:remaining.slice(1)}:null);
  };

  const mercScrollsInInv = inventory.filter(i=>i.type==="merc_scroll");
  const selectedScrollObjs = selectedScrolls.map(uid=>inventory.find(i=>i.uid===uid)).filter(Boolean);

  const startMercBattle=(dungeonId)=>{
    const dungeon=MERC_DUNGEONS.find(d=>d.id===dungeonId)||MERC_DUNGEONS[0];
    if(player.level<dungeon.minLv){alert(`需要 Lv.${dungeon.minLv}！`);return;}
    if(!selectedScrolls.length){alert("請先從背包選擇傭兵契約捲軸！");return;}
    const usedUids=new Set(selectedScrolls);
    setInventory(inv=>inv.filter(i=>!usedUids.has(i.uid)));
    const mercs=selectedScrollObjs.map(s=>({...s,curHp:s.hp,alive:true}));
    const np={...player};
    const result=simulateMercRun(dungeonId,np,mercs);
    const fp=result.finalPlayer;
    fp.totalMercRuns=(fp.totalMercRuns||0)+(result.won?1:0);
    fp.highestLevel=Math.max(fp.highestLevel||1,fp.level);
    setPlayer(fp);
    setSelectedScrolls([]);
    setReplay({lines:result.log,cursor:0,drops:result.drops,won:result.won,isMerc:true,mercDungeonId:dungeonId});
    setTab("battle");
    updateQuestProgress(fp,inventory);
  };

  const usePotion=()=>{
    const idx=inventory.findIndex(i=>i.type==="potion"); if(idx===-1)return;
    const p=inventory[idx]; const ni=[...inventory]; ni.splice(idx,1);
    setPlayer(pl=>({...pl,hp:Math.min(pl.hp+p.heal,cMhp(pl))})); setInventory(ni);
  };

  const buyItem=item=>{
    if(player.gold<item.cost)return;
    setPlayer(p=>({...p,gold:p.gold-item.cost}));
    const {cost:_c,auctionId:_a,currentBid:_b,myBid:_m,bidCount:_bc,endsIn:_e,sold:_s,...clean}=item;
    setInventory(inv=>[...inv,{...clean,uid:Date.now()+Math.random(),specials:clean.specials||[],affixes:clean.affixes||[]}]);
  };
  const sellItem=uid=>{
    const item=inventory.find(i=>i.uid===uid); if(!item)return;
    const price=calcSellPrice(item);
    setPlayer(p=>({...p,gold:p.gold+price}));
    setInventory(inv=>inv.filter(i=>i.uid!==uid));
  };
  const sortInventory=()=>{
    const order=["weapon","offhand","armor","helmet","gloves","boots","ring","amulet","merc_scroll","potion"];
    const rarOrder=["mythic","legendary","rare","magic","normal"];
    setInventory(inv=>[...inv].sort((a,b)=>{
      const si=order.indexOf(a.type||a.slot)-order.indexOf(b.type||b.slot);
      if(si!==0)return si;
      return rarOrder.indexOf(a.rarity)-rarOrder.indexOf(b.rarity);
    }));
  };
  const sellJunk=()=>{
    const equippedUids=new Set(Object.values(player.equipment).filter(Boolean).map(e=>e.uid));
    const junk=inventory.filter(i=>i.rarity==="normal"&&!equippedUids.has(i.uid)&&i.type!=="potion");
    const total=junk.reduce((s,i)=>s+calcSellPrice(i),0);
    if(!junk.length){alert("沒有普通品質裝備可賣");return;}
    setPlayer(p=>({...p,gold:p.gold+total}));
    setInventory(inv=>inv.filter(i=>!junk.find(j=>j.uid===i.uid)));
    alert(`賣出 ${junk.length} 件普通裝備，獲得 ${total} 金幣`);
  };
  const refreshShop=()=>{
    const cost=Math.floor(player.level*5+20);
    if(player.gold<cost){alert(`刷新需要 ${cost} 金幣`);return;}
    setPlayer(p=>({...p,gold:p.gold-cost}));
    setShopItems(Array.from({length:8},()=>genShopItem(player.level)));
  };
  const doEnhance = (uid) => {
    // Look in inventory AND equipped slots
    const fromInv = inventory.find(i=>i.uid===uid);
    const equippedSlot = Object.entries(player.equipment).find(([,eq])=>eq&&eq.uid===uid);
    const item = fromInv || (equippedSlot&&equippedSlot[1]);
    const isEquippedItem = !fromInv && !!equippedSlot;

    if(!item) return;
    const curLv = item.enhLv || 0;
    if(curLv >= 10) { setEnhanceLog(l=>[`⚠️ 已達最高強化等級 +10`,...l]); return; }
    const lvData = ENHANCE_LEVELS[curLv];
    const cost = enhanceCost(item);
    if(player.gold < cost) { setEnhanceLog(l=>[`💰 金幣不足（需要 ${cost}）`,...l]); return; }

    setPlayer(p=>({...p, gold: p.gold - cost}));

    const success = Math.random() < lvData.rate;
    if(success) {
      const newLv = curLv + 1;
      const baseAttack  = item.baseAttack  || (item.attack||0);
      const baseDefense = item.baseDefense || (item.defense||0);
      const baseHp      = item.baseHp      || (item.hp||0);
      const baseSpeed   = item.baseSpeed   || (item.speed||0);
      const enhanced = {
        ...item, enhLv: newLv,
        baseAttack, baseDefense, baseHp, baseSpeed,
        ...applyEnhanceBonus({...item,enhLv:newLv,baseAttack,baseDefense,baseHp,baseSpeed})
      };
      // Update wherever the item lives
      if(isEquippedItem) {
        const slot = equippedSlot[0];
        setPlayer(p=>({...p, equipment:{...p.equipment,[slot]:enhanced}}));
      } else {
        setInventory(inv=>inv.map(i=>i.uid===uid?enhanced:i));
        // Also update if same item happens to be equipped (shouldn't happen, but safe)
        Object.entries(player.equipment).forEach(([slot,eq])=>{
          if(eq&&eq.uid===uid) setPlayer(p=>({...p,equipment:{...p.equipment,[slot]:enhanced}}));
        });
      }
      setEnhanceAnim("success");
      setEnhanceLog(l=>[`✨ 強化成功！${item.name} → +${newLv}！費用 ${cost} 金幣`,...l]);
      setPlayer(p=>{
        const np2={...p,totalEnhances:(p.totalEnhances||0)+1};
        updateQuestProgress(np2,inventory);
        return np2;
      });
    } else {
      const newLv = curLv <= 3 ? curLv : curLv - 1;
      const degraded = newLv === curLv
        ? item
        : applyEnhanceBonus({...item, enhLv:newLv,
            baseAttack:(item.baseAttack||(item.attack||0)),
            baseDefense:(item.baseDefense||(item.defense||0)),
            baseHp:(item.baseHp||(item.hp||0)),
            baseSpeed:(item.baseSpeed||(item.speed||0)),
          });
      if(newLv !== curLv) {
        if(isEquippedItem) {
          const slot = equippedSlot[0];
          setPlayer(p=>({...p, equipment:{...p.equipment,[slot]:{...degraded,enhLv:newLv}}}));
        } else {
          setInventory(inv=>inv.map(i=>i.uid===uid?{...degraded,enhLv:newLv}:i));
          Object.entries(player.equipment).forEach(([slot,eq])=>{
            if(eq&&eq.uid===uid) setPlayer(p=>({...p,equipment:{...p.equipment,[slot]:{...degraded,enhLv:newLv}}}));
          });
        }
      }
      setEnhanceAnim("fail");
      setEnhanceLog(l=>[
        newLv < curLv
          ? `💔 強化失敗！+${curLv} → +${newLv}（降級）費用 ${cost} 金幣`
          : `💔 強化失敗！+${curLv} 維持不變。費用 ${cost} 金幣`,
        ...l
      ]);
    }
    setTimeout(()=>setEnhanceAnim(null), 700);
  };

  const doTrain = (statId) => {
    const current = player[statId] || 0;
    const cost = trainCost(player.level, current);
    if(player.gold < cost) return;
    if(player.gold - cost < 50) { alert(`訓練費用 ${cost}，會讓金幣低於 50，請先賺更多金幣！`); return; }
    const isMhp = (TRAIN_STATS.find(s=>s.id===statId)&&TRAIN_STATS.find(s=>s.id===statId).hpStat);
    setPlayer(p=>{
      const np={...p, gold:p.gold-cost, [statId]:(p[statId]||0)+1, totalTrains:(p.totalTrains||0)+1};
      if(isMhp) np.hp=Math.min(np.hp+3, cMhp(np));
      updateQuestProgress(np, inventory);
      return np;
    });
  };

  // ── Arena handlers ──────────────────────────────────────────────────────
  const initArena = () => {
    const today = new Date().toISOString().slice(0,10);
    // Reset free refreshes on new day
    if(arenaLastDate !== today) {
      setArenaLastDate(today);
      setArenaRefreshes(5);
    }
    setArenaOpponents(Array.from({length:4}, ()=>genArenaOpponent(player.level)));
  };

  // ── Quest handlers ────────────────────────────────────────────────────────
  // Reset daily/weekly quests if date has changed
  const checkQuestReset = (qs) => {
    const today = new Date().toISOString().slice(0,10);
    const week  = getWeekKey();
    let newQs   = {...qs, progress:{...qs.progress}};
    let changed = false;
    if(qs.dailyDate !== today) {
      // Reset daily quest bases to current player values
      Object.keys(QUEST_DEFS).forEach(id=>{
        if(QUEST_DEFS[id].cat==="daily") {
          newQs.progress[id] = { collected:false, baseVal: player[QUEST_DEFS[id].field]||0 };
        }
      });
      newQs.dailyDate = today;
      changed = true;
    }
    if(qs.weeklyDate !== week) {
      Object.keys(QUEST_DEFS).forEach(id=>{
        if(QUEST_DEFS[id].cat==="weekly") {
          newQs.progress[id] = { collected:false, baseVal: player[QUEST_DEFS[id].field]||0 };
        }
      });
      newQs.weeklyDate = week;
      changed = true;
    }
    return changed ? newQs : qs;
  };

  // Collect quest reward
  const collectQuest = (questId) => {
    const def = QUEST_DEFS[questId];
    if(!def) return;
    const statsWithInv = {...player, _inv: inventory};
    if(!isQuestDone(questId, statsWithInv, questState)) return;

    // Apply rewards
    let np = {...player};
    const drops = [];
    def.rewards.forEach(r => {
      if(r.type==="gold")   { np.gold += r.value; }
      if(r.type==="exp")    { const log=[]; np=lvUp(np, r.value, 0, log); }
      if(r.type==="item")   { const d=genLoot(np.level, r.rarity==="mythic"?0.6:r.rarity==="legendary"?0.4:r.rarity==="rare"?0.2:0.1); drops.push(d); }
      if(r.type==="scroll") { const s=genMercScroll(np.level, r.rarity); drops.push(s); }
    });
    setPlayer(np);
    if(drops.length>0) setInventory(inv=>[...inv,...drops]);

    // Mark as collected
    setQuestState(qs=>({
      ...qs,
      progress:{...qs.progress, [questId]:{...(qs.progress[questId]||{}), collected:true}}
    }));

    // Toast notification
    const rewardText = def.rewards.map(r=>r.label).join("、");
    setQuestNotify(`✅ 任務完成：${def.title}\n獎勵：${rewardText}`);
    setTimeout(()=>setQuestNotify(null), 3000);
  };

  // Update quest progress whenever player stats change — check for newly completable quests
  const updateQuestProgress = (updatedPlayer, updatedInventory) => {
    const statsWithInv = {...updatedPlayer, _inv: updatedInventory||inventory};
    const newQs = checkQuestReset(questState);
    // Check if any quests became completable — show notification
    Object.keys(QUEST_DEFS).forEach(id=>{
      if(!(newQs.progress[id]&&newQs.progress[id].collected)) {
        if(isQuestDone(id, statsWithInv, newQs)) {
          // Only notify once per quest
        }
      }
    });
    if(newQs !== questState) setQuestState(newQs);
  };

  const arenaRefresh = (free) => {
    if(free) {
      if(arenaRefreshes <= 0) return;
      setArenaRefreshes(r=>r-1);
    } else {
      const cost = 50 + player.level * 10;
      if(player.gold < cost) { alert(`刷新需要 ${cost} 金幣！`); return; }
      setPlayer(p=>({...p, gold:p.gold-cost}));
    }
    setArenaOpponents(Array.from({length:4}, ()=>genArenaOpponent(player.level)));
  };

  const startArenaBattle = (opponent) => {
    const now = Date.now();
    if(now < arenaInjuredUntil) return;
    const result = simulateArenaBattle(player, opponent);
    const np = {...result.finalPlayer};
    if(result.won) {
      np.gold = np.gold + result.goldPlundered;
      np.totalArenaWins  = (np.totalArenaWins||0) + 1;
      np.totalGoldEarned = (np.totalGoldEarned||0) + result.goldPlundered;
      setArenaOpponents(ops=>ops.filter(o=>o.id!==opponent.id));
    } else {
      setArenaInjuredUntil(now + 30*60*1000);
      np.hp   = Math.floor(cMhp(np)*0.2);
      np.gold = Math.max(50, np.gold - Math.min(200, Math.floor(np.gold*0.08)));
    }
    np.highestLevel = Math.max(np.highestLevel||1, np.level);
    setPlayer(np);
    setReplay({lines:result.log, cursor:0, drops:[], won:result.won, isArena:true, opponent});
    setTab("battle");
    updateQuestProgress(np, inventory);
  };

  const refreshAuction = () => {
    setAuctionItems(Array.from({length:4},()=>genAuctionItem(player.level)));
  };
  const placeBid=(auctionId,amount)=>{
    if(!amount||amount<=0)return;
    setAuctionItems(items=>items.map(it=>{
      if(it.auctionId!==auctionId)return it;
      const minBid=it.currentBid+Math.max(5,Math.floor(it.currentBid*0.1));
      if(amount<minBid){alert(`最低加價為 ${minBid} 金幣`);return it;}
      if(player.gold<amount){alert("金幣不足！");return it;}
      setPlayer(p=>({...p,gold:p.gold-amount+(it.myBid||0)}));
      return {...it,currentBid:amount,myBid:amount,bidCount:it.bidCount+1};
    }));
  };
  const claimAuction=(auctionId)=>{
    const it=auctionItems.find(a=>a.auctionId===auctionId);
    if(!it||!it.myBid)return;
    const {cost:_c,auctionId:_a,currentBid:_b,myBid:_m,bidCount:_bc,endsIn:_e,sold:_s,...clean}=it;
    setInventory(inv=>[...inv,{...clean,uid:Date.now()+Math.random()}]);
    setAuctionItems(items=>items.filter(a=>a.auctionId!==auctionId));
    refreshAuction();
  };

  const equipItem=item=>{
    const old=player.equipment[item.slot];
    setPlayer(p=>({...p,equipment:{...p.equipment,[item.slot]:item}}));
    setInventory(inv=>{const n=inv.filter(i=>i.uid!==item.uid);if(old)n.push({...old,uid:Date.now()});return n;});
  };
  const unequip=slot=>{
    const item=player.equipment[slot]; if(!item)return;
    setInventory(inv=>[...inv,{...item,uid:Date.now()}]);
    setPlayer(p=>({...p,equipment:{...p.equipment,[slot]:null}}));
  };

  const SLOT_FILTERS = [
    {id:"all",label:"全部"},{id:"weapon",label:"武器"},{id:"offhand",label:"副手"},
    {id:"armor",label:"胸甲"},{id:"helmet",label:"頭盔"},{id:"gloves",label:"手套"},
    {id:"boots",label:"靴子"},{id:"ring",label:"戒指"},{id:"amulet",label:"護符"},
    {id:"potion",label:"藥水"},{id:"merc_scroll",label:"📜傭兵"},
  ];

  const filteredShop = shopFilter==="all"?shopItems:shopItems.filter(i=>i.slot===shopFilter||i.type===shopFilter);
  const filteredInv  = invFilter==="all"?inventory:inventory.filter(i=>i.slot===invFilter||i.type===invFilter);
  const potions=inventory.filter(i=>i.type==="potion").length;
  const hpPct=Math.round((player.hp/tMhp)*100);
  const expPct=Math.round((player.exp/player.expNeeded)*100);

  return (
    <>
      <style>{css}</style>
      <div className="gw">
        <header className="gh">
          <div className="gt">⚔ GLADIUS</div>
          <div className="gd">🪙 {player.gold}</div>
        </header>
        <div className="ml">
          {/* ── Sidebar ── */}
          <aside className="sb">
            <div className="pn">
              <div className="ph">角色</div>
              <div className="pb">
                <div className="pname">{player.name}</div>
                <div className="bw">
                  <div className="bl"><span>生命</span><span>{player.hp}/{tMhp}</span></div>
                  <div className="bt"><div className="bf hf" style={{width:`${hpPct}%`}}/></div>
                </div>
                <div className="bw">
                  <div className="bl"><span>Lv.{player.level}</span><span>{player.exp}/{player.expNeeded}</span></div>
                  <div className="bt"><div className="bf ef" style={{width:`${expPct}%`}}/></div>
                </div>
                <div style={{marginTop:8}}>
                  {[
                    ["攻擊", tAtk, player.trainedAtk||0],
                    ["防禦", tDef, player.trainedDef||0],
                    ["速度", tSpd, player.trainedSpd||0],
                  ].map(([k,v,trained])=>(
                    <div className="sr" key={k}>
                      <span className="sl">{k}</span>
                      <span className="sv">
                        {v}
                        {trained>0&&<span style={{fontSize:10,color:"#4caf50",marginLeft:3}}>+{trained}訓</span>}
                      </span>
                    </div>
                  ))}
                  <div className="sr">
                    <span className="sl">最大HP</span>
                    <span className="sv">
                      {tMhp}
                      {(player.trainedHp||0)>0&&<span style={{fontSize:10,color:"#c84040",marginLeft:3}}>+{(player.trainedHp||0)*3}訓</span>}
                    </span>
                  </div>
                </div>
                {wCat&&<div className="weapon-trait">{wCat.icon} {wCat.label}：{wCat.traitDesc}</div>}
              </div>
            </div>

            <div className="pn">
              <div className="ph">裝備（點擊卸下）</div>
              <div className="pb" style={{padding:"8px 10px"}}>
                {EQUIP_SLOTS.map(s=>{
                  const eq=player.equipment[s.id];
                  const rar=eq?getRarity(eq.rarity):null;
                  const rc=rar?rar.color:"#2a1808";
                  const glow=(rar&&rar.glow)||"";
                  const cat=(eq&&eq.cat)?WEAPON_CATEGORIES[eq.cat]:null;
                  return(
                    <div key={s.id}
                      onClick={()=>unequip(s.id)}
                      title={eq?"點擊卸下":s.label+"（空）"}
                      style={{
                        display:"flex", alignItems:"flex-start", gap:6,
                        padding:"5px 7px", marginBottom:4,
                        background: eq ? `${rc}0d` : "rgba(0,0,0,0.2)",
                        border: `1px solid ${eq ? rc+"66" : "#1e1208"}`,
                        borderRadius:3,
                        cursor: eq ? "pointer" : "default",
                        boxShadow: eq && glow ? glow : "none",
                        transition:"all .2s",
                      }}>
                      <span style={{fontSize:13,flexShrink:0,marginTop:1}}>{s.icon}</span>
                      <div style={{minWidth:0,flex:1}}>
                        <div style={{fontSize:9,color:"#4a3020",fontFamily:"'Cinzel',serif",letterSpacing:.5,lineHeight:1}}>{s.label}</div>
                        {eq ? <>
                          <div style={{
                            fontSize:11, color:rc, lineHeight:1.3, marginTop:1,
                            textShadow: glow ? `0 0 6px ${rc}88` : "none",
                            fontFamily:"'Cinzel',serif", letterSpacing:.3,
                          }}>{eq.name}</div>
                          <div style={{fontSize:10,color:"#6a5030",marginTop:2,display:"flex",gap:6,flexWrap:"wrap"}}>
                            {eq.attack>0 && <span style={{color:"#c8781e"}}>攻+{eq.attack}</span>}
                            {eq.defense>0 && <span style={{color:"#4a9fd4"}}>防+{eq.defense}</span>}
                            {eq.hp>0 && <span style={{color:"#c84040"}}>HP+{eq.hp}</span>}
                            {eq.speed>0 && <span style={{color:"#4caf50"}}>速+{eq.speed}</span>}
                            {cat && <span style={{color:"#d08030"}}>{cat.icon}{cat.label}</span>}
                            {eq.itemLevel && <span style={{color:"#5a4020"}}>Lv{eq.itemLevel}</span>}
                          </div>
                          {eq.affixes && eq.affixes.length > 0 && (
                            <div style={{marginTop:2,display:"flex",gap:3,flexWrap:"wrap"}}>
                              {eq.affixes.map((a,i)=>(
                                <span key={i} style={{fontSize:9,color:a.special?"#c870d0":"#6aaa6a",background:"rgba(0,0,0,0.3)",padding:"0 3px",borderRadius:2}}>
                                  {a.tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </> : <div style={{fontSize:10,color:"#2a1808",fontStyle:"italic"}}>空槽</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pn">
              <div className="ph">存檔</div>
              <div className="pb">
                <div className="svr">
                  <button className="btn btp" onClick={save}>💾 存檔</button>
                  <button className="btn btm" onClick={reset}>🔄 重置</button>
                </div>
                {saveMsg&&<div className="svi">{saveMsg}</div>}
              </div>
            </div>
          </aside>

          {/* ── Main ── */}
          <main>
            <div className="nt">
              {[["dungeon","地下城"],["arena","🏟 競技場"],["quest","📋 任務"],["shop","商店"],["inventory","背包"],["train","⚒ 鍛造"]].map(([id,lbl])=>{
                const isQuest = id==="quest";
                const statsWithInv2 = {...player, _inv:inventory};
                const qDone = isQuest ? Object.keys(QUEST_DEFS).filter(qid=>isQuestDone(qid,statsWithInv2,questState)).length : 0;
                return(
                  <button key={id} className={`nb${tab===id?" active":""}`}
                    style={{position:"relative"}}
                    onClick={()=>{setTab(id);if(id==="arena"&&arenaOpponents.length===0)initArena();}}>
                    {lbl}
                    {isQuest&&qDone>0&&(
                      <span style={{position:"absolute",top:4,right:4,background:"#c84040",color:"#fff",
                        borderRadius:"8px",padding:"0 4px",fontSize:9,lineHeight:"14px",fontFamily:"sans-serif"}}>
                        {qDone}
                      </span>
                    )}
                  </button>
                );
              })}
              {replay&&<button className={`nb${tab==="battle"?" active":""}`} onClick={()=>setTab("battle")}>{replay.won?"🏆":"⚔"} 報告</button>}
            </div>

            <div className="ca">

              {/* ── DUNGEON TAB ── */}
              {tab==="dungeon"&&(
                <div>
                  <div className="sub">🗺 探險 — 單怪快速戰鬥</div>
                  <div style={{fontSize:12,color:"#5a4020",marginBottom:10,fontStyle:"italic"}}>
                    挑戰單一怪物，風險低、速度快，是練等與賺金的好選擇。
                  </div>
                  <div className="dr" style={{gridTemplateColumns:"repeat(auto-fill,minmax(135px,1fr))"}}>
                    {EXPEDITIONS.map(exp=>{
                      const m=MONSTERS[exp.monster];
                      const lk=player.level<exp.minLv;
                      return(
                        <div key={exp.id} className={`dc${lk?" lk":""}`} onClick={()=>!lk&&startExpedition(exp)}
                          style={{borderColor:lk?"#2a1808":"#3a2a10"}}>
                          <div className="di">{(m&&m.icon)||exp.icon}</div>
                          <div className="dn" style={{fontSize:11}}>{exp.name}</div>
                          <div style={{fontSize:10,color:"#8a6a30",marginBottom:3,fontStyle:"italic"}}>{(m&&m.name)}</div>
                          <div style={{fontSize:10,color:"#c8781e",marginBottom:4}}>{(m&&m.traitDesc)}</div>
                          <div className="drq">Lv.{exp.minLv}{lk?" 🔒":""}</div>
                          <div className="drw">EXP×{exp.expMult} 金×{exp.goldMult}{exp.lootBonus>0&&<span style={{color:"#4caf50"}}> +{Math.round(exp.lootBonus*100)}%</span>}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="sub" style={{marginTop:24}}>⚔️ 副本 — 多波怪物＋Boss</div>
                  <div style={{fontSize:12,color:"#5a4020",marginBottom:10,fontStyle:"italic"}}>
                    挑戰完整副本：三波怪物加上強力Boss，掉落更豐厚。
                  </div>
                  {DUNGEONS.map(d=>(
                    <div className="dz" key={d.id}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                        <span style={{fontSize:18}}>{d.icon}</span>
                        <div>
                          <div style={{fontFamily:"'Cinzel',serif",fontSize:13,color:"#c8961e",letterSpacing:1}}>{d.name} <span style={{fontSize:10,color:"#5a4020"}}>Lv.{d.minLv}+</span></div>
                          <div style={{fontSize:11,color:"#6a5030",fontStyle:"italic"}}>{d.lore}</div>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
                        {d.waves.map((w,wi)=>(
                          <div key={wi} style={{fontSize:10,color:"#5a4030",background:"rgba(0,0,0,0.3)",border:"1px solid #2a1a08",borderRadius:3,padding:"2px 6px"}}>
                            {w.monsters.map(k=>(MONSTERS[k]?MONSTERS[k].icon:"?")).join("")} {w.label.replace("第","").replace("波","")}波
                          </div>
                        ))}
                        <div style={{fontSize:10,color:"#c84040",background:"rgba(100,0,0,0.2)",border:"1px solid #4a1010",borderRadius:3,padding:"2px 6px"}}>
                          👑 {(MONSTERS[d.boss]?MONSTERS[d.boss].icon:"👑")}{(MONSTERS[d.boss]?MONSTERS[d.boss].name:"Boss")}
                        </div>
                      </div>
                      <div className="dr">
                        {DUNGEON_TIERS.map(t=>{
                          const req=d.minLv+t.minLvOffset; const lk=player.level<req;
                          return(
                            <div key={t.id} className={`dc${lk?" lk":""}`} onClick={()=>!lk&&startBattle(d,t)}>
                              <div className="di">{d.icon}</div>
                              <div className="dtl" style={{color:t.color}}>{t.label}</div>
                              <div className="dn" style={{fontSize:11,color:t.color}}>{d.name}</div>
                              <div className="drq">Lv.{req}{lk?" 🔒":""}</div>
                              <div className="drw">EXP×{t.expMult} 金×{t.goldMult}{t.lootBonus>0&&<span style={{color:"#d4b84a"}}> +{Math.round(t.lootBonus*100)}%</span>}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  <div className="dz">
                    <div className="sub">🏴 傭兵副本 — 契約捲軸系統</div>
                    <div style={{marginBottom:10,padding:"8px 12px",background:"#120e06",border:"1px solid #2a1a08",borderRadius:5,fontSize:12,color:"#6a5030",lineHeight:1.7}}>
                      從探險和副本中掉落<span style={{color:"#e07020"}}>傭兵契約捲軸</span>，在背包中選取後出發。<br/>
                      捲軸稀有度越高，傭兵越強，詞條加成越多。捲軸使用後消耗。
                    </div>

                    {mercScrollsInInv.length===0 ? (
                      <div style={{padding:"12px",background:"rgba(0,0,0,0.3)",border:"1px solid #2a1a08",borderRadius:4,fontSize:12,color:"#4a3020",textAlign:"center",marginBottom:10}}>
                        背包中沒有傭兵契約捲軸<br/>
                        <span style={{fontSize:11,color:"#3a2818"}}>探險和副本Boss有機率掉落</span>
                        <div style={{marginTop:8}}>
                          <button className="btn btm" style={{fontSize:10}} onClick={()=>{
                            const s=genMercScroll(player.level);
                            setInventory(inv=>[...inv,s]);
                          }}>🎲 購買隨機捲軸（免費測試）</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{marginBottom:10}}>
                        <div style={{fontSize:11,color:"#6a5030",marginBottom:6,fontFamily:"'Cinzel',serif"}}>選擇傭兵（點擊勾選）：</div>
                        <div className="mg" style={{gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))"}}>
                          {mercScrollsInInv.map(scroll=>{
                            const sel=selectedScrolls.includes(scroll.uid);
                            const gr=getRarity(scroll.rarity);
                            return(
                              <div key={scroll.uid}
                                style={{
                                  background:`linear-gradient(160deg,${gr.color}12,#0e0a06)`,
                                  border:`1px solid ${sel?gr.color:gr.color+"44"}`,
                                  boxShadow:sel&&gr.glow?gr.glow:"none",
                                  borderRadius:5,padding:"10px",textAlign:"center",
                                  cursor:"pointer",transition:"all .2s",
                                }}
                                onClick={()=>setSelectedScrolls(p=>p.includes(scroll.uid)?p.filter(x=>x!==scroll.uid):[...p,scroll.uid])}>
                                <div style={{fontSize:22,filter:`drop-shadow(0 2px 6px ${gr.color}88)`}}>{scroll.icon}</div>
                                <div style={{fontSize:9,color:gr.color,fontFamily:"'Cinzel',serif",borderColor:gr.color+"55",border:"1px solid",borderRadius:2,padding:"1px 4px",display:"inline-block",margin:"3px 0"}}>{gr.label}</div>
                                <div style={{fontSize:11,color:gr.color,fontFamily:"'Cinzel',serif",letterSpacing:.3,textShadow:gr.glow?`0 0 8px ${gr.color}`:"none"}}>{scroll.name}</div>
                                <div style={{fontSize:10,color:"#5a4020",marginTop:3,lineHeight:1.5}}>
                                  攻{scroll.attack} 防{scroll.defense} HP{scroll.hp}
                                  {scroll.heal>0&&<span style={{color:"#50c890"}}> 回{scroll.heal}</span>}
                                </div>
                                {scroll.affixes && scroll.affixes.length > 0 && <div style={{display:"flex",gap:2,justifyContent:"center",flexWrap:"wrap",marginTop:3}}>
                                  {scroll.affixes.map((a,i)=><span key={i} style={{fontSize:9,color:a.special?"#c870d0":"#6aaa6a",background:"rgba(0,0,0,0.4)",padding:"0 3px",borderRadius:2}}>{a.tag}</span>)}
                                </div>}
                                <div style={{fontSize:10,color:sel?gr.color:"#4a3020",marginTop:4,fontFamily:"'Cinzel',serif"}}>{sel?"✓ 已選":scroll.desc}</div>
                              </div>
                            );
                          })}
                        </div>
                        {selectedScrolls.length>0&&<div style={{margin:"8px 0",padding:"6px 12px",background:"#1a1208",border:"1px solid #3a2a10",borderRadius:5,fontSize:12,color:"#c8a848"}}>
                          已選 {selectedScrolls.length} 名傭兵 · 出發後捲軸將被消耗
                        </div>}
                      </div>
                    )}

                    <div className="dr" style={{gridTemplateColumns:"repeat(auto-fill,minmax(165px,1fr))"}}>
                      {MERC_DUNGEONS.map((d)=>{
                        const lk=player.level<d.minLv;
                        const tierColors=["#8a9070","#4caf50","#4a9fd4","#9c50d4","#e07020"];
                        const tc=tierColors[MERC_DUNGEONS.indexOf(d)]||"#8a9070";
                        return(
                          <div key={d.id} className={`dc${lk?" lk":""}`} onClick={()=>!lk&&startMercBattle(d.id)}
                            style={{borderColor:lk?"#2a1808":tc+"66",background:lk?"linear-gradient(135deg,#1a1208,#141008)":`linear-gradient(135deg,${tc}0a,#141008)`}}>
                            <div className="di">{d.icon}</div>
                            <div className="dtl" style={{color:tc}}>{d.label}</div>
                            <div className="dn" style={{fontSize:11,color:tc}}>{d.lore.slice(0,20)}…</div>
                            <div style={{fontSize:11,margin:"4px 0",letterSpacing:1}}>
                              {d.waves.map((w,wi)=>(
                                <span key={wi} style={{marginRight:3,opacity:0.7}}>
                                  {w.enemies.map(k=>(MONSTERS[k]?MONSTERS[k].icon:"👹")).join("")}
                                </span>
                              ))}
                              <span style={{color:"#c84040",marginLeft:2}}>{d.boss && d.boss.icon}Boss</span>
                            </div>
                            <div className="drq">Lv.{d.minLv}{lk?" 🔒":""}</div>
                            <div className="drw">EXP×{d.reward.expMult} 金×{d.reward.goldMult}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ── TRAIN & ENHANCE TAB ── */}
              {tab==="train"&&(
                <div>
                  <div className="stl">訓練場 <span style={{color:"#6a5030",fontSize:13}}>— 永久提升屬性</span></div>
                  <div style={{padding:"8px 12px",background:"#120e06",border:"1px solid #2a1a08",borderRadius:5,fontSize:12,color:"#6a5030",marginBottom:16,lineHeight:1.7}}>
                    花費金幣永久提升基礎屬性。費用隨等級與已訓練次數增加。<br/>
                    <span style={{color:"#c8961e"}}>保護機制：訓練不會讓金幣低於 50。</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:24}}>
                    {TRAIN_STATS.map(stat=>{
                      const current=player[stat.id]||0;
                      const cost=trainCost(player.level,current);
                      const canAfford=player.gold-cost>=50;
                      const effect=stat.hpStat?`每次+3最大HP（已訓${current}次，+${current*3}HP）`:`每次+1${stat.label}（已訓${current}次）`;
                      return(
                        <div key={stat.id} style={{
                          background:`linear-gradient(160deg,${stat.color}0a,#141008)`,
                          border:`1px solid ${stat.color}44`,
                          borderRadius:6,padding:"14px",
                        }}>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                            <span style={{fontSize:22}}>{stat.icon}</span>
                            <div>
                              <div style={{fontFamily:"'Cinzel',serif",fontSize:13,color:stat.color}}>{stat.label}</div>
                              <div style={{fontSize:11,color:"#5a4020"}}>{stat.desc}</div>
                            </div>
                          </div>
                          <div style={{fontSize:12,color:"#7a6040",marginBottom:4}}>{effect}</div>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                            <div style={{fontFamily:"'Cinzel',serif",fontSize:14,color:stat.color}}>
                              {stat.hpStat?`${player.maxHp+(current*3)}`:`${player[stat.id.replace("trained","").toLowerCase()]+(current||0)}`}
                              <span style={{fontSize:10,color:"#5a4020",marginLeft:4}}>（基礎+{current}訓練）</span>
                            </div>
                            <div style={{fontSize:12,color:canAfford?"#f0c040":"#c84040"}}>🪙{cost}</div>
                          </div>
                          <div style={{height:4,background:"#1a1208",borderRadius:2,marginBottom:8,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${Math.min(100,current*2)}%`,background:stat.color,borderRadius:2,transition:"width .4s"}}/>
                          </div>
                          <button className="btn btp" style={{width:"100%",fontSize:11}}
                            onClick={()=>doTrain(stat.id)}
                            disabled={!canAfford}>
                            {canAfford?`訓練 (-🪙${cost})`:`金幣不足（需 ${cost}，保留50）`}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="sub">⚒ 裝備強化 — 提升裝備屬性</div>
                  <div style={{padding:"8px 12px",background:"#120e06",border:"1px solid #2a1a08",borderRadius:5,fontSize:12,color:"#6a5030",marginBottom:12,lineHeight:1.7}}>
                    選擇裝備強化，最高 <span style={{color:"#e07020"}}>+10</span>。<br/>
                    +1~+3 失敗維持原級，+4以上失敗降一級（不追加扣費）。<br/>
                    <span style={{color:"#4caf50"}}>金幣只在嘗試時扣除，失敗不會雙重懲罰。</span>
                  </div>

                  <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:14}}>
                    {ENHANCE_LEVELS.map(l=>(
                      <div key={l.lv} style={{
                        textAlign:"center",padding:"4px 6px",
                        background:`rgba(200,150,30,${l.rate*0.15})`,
                        border:`1px solid rgba(200,150,30,${l.rate*0.4})`,
                        borderRadius:3,minWidth:50,
                      }}>
                        <div style={{fontFamily:"'Cinzel',serif",fontSize:10,color:"#c8961e"}}>+{l.lv}</div>
                        <div style={{fontSize:9,color:"#6a5030"}}>{Math.round(l.rate*100)}%</div>
                        <div style={{fontSize:9,color:"#4caf50"}}>+{Math.round(l.bonus*100)}%</div>
                      </div>
                    ))}
                  </div>

                  {enhanceLog.length>0&&(
                    <div style={{background:"#0a0806",border:"1px solid #2a1a08",borderRadius:4,padding:"8px 10px",marginBottom:12,maxHeight:100,overflowY:"auto"}}>
                      {enhanceLog.slice(0,8).map((l,i)=>(
                        <div key={i} style={{fontSize:11,color:l.includes("成功")?"#4caf50":l.includes("失敗")?"#c84040":l.includes("最高")?"#e07020":"#8a7050",marginBottom:2}}>{l}</div>
                      ))}
                    </div>
                  )}

                  <div style={{fontSize:11,color:"#6a5030",marginBottom:8,fontFamily:"'Cinzel',serif",letterSpacing:1}}>選擇要強化的裝備：</div>
                  <div className="ig">
                    {[
                      ...Object.values(player.equipment).filter(Boolean),
                      ...inventory.filter(i=>i.slot&&i.slot!=="merc_scroll"&&i.type!=="potion"),
                    ].map(item=>{
                      const rar=getRarity(item.rarity);
                      const curLv=item.enhLv||0;
                      const isMax=curLv>=10;
                      const lvData=ENHANCE_LEVELS[curLv];
                      const cost=enhanceCost(item);
                      const canAfford=player.gold>=cost&&!isMax;
                      const isSelected=enhanceTarget===item.uid;
                      const isEquipped=Object.values(player.equipment).some(e=>(e&&e.uid)===item.uid);
                      const enhColor=curLv>=7?"#e07020":curLv>=4?"#9c50d4":curLv>=1?"#4caf50":"#5a4020";
                      return(
                        <div key={item.uid} className="ii"
                          onClick={()=>setEnhanceTarget(isSelected?null:item.uid)}
                          style={{
                            borderColor:isSelected?"#c8961e":rar.color+(curLv>0?"88":"33"),
                            background:isSelected?"linear-gradient(160deg,#2a1e08,#1a1208)":`linear-gradient(160deg,${rar.color}08,#120e06)`,
                            cursor:"pointer",
                            boxShadow:isSelected?"0 0 16px rgba(200,150,30,.3)":rar.glow||"none",
                          }}>
                          <div className="iii" style={{filter:`drop-shadow(0 2px 4px ${rar.color}66)`}}>{item.icon}</div>
                          {curLv>0&&(
                            <div style={{fontFamily:"'Cinzel',serif",fontSize:11,color:enhColor,marginBottom:3,textShadow:`0 0 8px ${enhColor}`}}>
                              +{curLv}{isMax?" MAX":""}
                            </div>
                          )}
                          {rar.id!=="normal"&&<div className="rb" style={{color:rar.color,borderColor:rar.color+"55",background:`${rar.color}15`}}>{rar.label}</div>}
                          <div className="iin" style={{color:rar.color}}>{item.name}</div>
                          {isEquipped&&<div style={{fontSize:9,color:"#c8781e",marginBottom:2}}>⚔ 已裝備</div>}
                          <div className="iis">
                            {item.attack>0&&<div style={{color:"#c8781e"}}>攻+{item.attack}</div>}
                            {item.defense>0&&<div style={{color:"#4a9fd4"}}>防+{item.defense}</div>}
                            {item.hp>0&&<div style={{color:"#c84040"}}>HP+{item.hp}</div>}
                          </div>
                          {!isMax&&lvData&&(
                            <div style={{fontSize:10,color:"#5a4020",margin:"4px 0",lineHeight:1.5}}>
                              下一級：成功率 {Math.round(lvData.rate*100)}%<br/>
                              費用 🪙{cost}
                            </div>
                          )}
                          {isSelected&&!isMax&&(
                            <button className="btn btp"
                              style={{width:"100%",fontSize:10,
                                animation:enhanceAnim==="success"?"none":enhanceAnim==="fail"?"shake .3s":"none",
                                background:enhanceAnim==="success"?"linear-gradient(135deg,#1a6a1a,#1a4a1a)":
                                           enhanceAnim==="fail"?"linear-gradient(135deg,#6a1a1a,#4a0e0e)":""
                              }}
                              disabled={!canAfford}
                              onClick={e=>{e.stopPropagation();doEnhance(item.uid);}}>
                              {canAfford?`⚒ 強化 +${curLv}→+${curLv+1}`:`金幣不足 (需${cost})`}
                            </button>
                          )}
                          {isMax&&<div style={{fontSize:10,color:"#e07020",fontFamily:"'Cinzel',serif"}}>✦ 已達最高 +10</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── ARENA TAB ── */}
              {tab==="arena"&&<ArenaTab
                player={player}
                arenaOpponents={arenaOpponents}
                arenaInjuredUntil={arenaInjuredUntil}
                arenaRefreshes={arenaRefreshes}
                onRefresh={arenaRefresh}
                onFight={startArenaBattle}
                onInit={initArena}
              />}

              {/* ── QUEST TAB ── */}
              {tab==="quest"&&<QuestTab
                player={player}
                inventory={inventory}
                questState={checkQuestReset(questState)}
                onCollect={collectQuest}
              />}

              {/* ── BATTLE REPLAY ── */}
              {tab==="battle"&&(
                <div className="ba">
                  {replay ? (
                    <>
                      <div className="btl">
                        {replay.isArena
                          ? `🏟 競技場 · ${(replay.opponent&&replay.opponent.name)||"對手"}`
                          : replay.isExpedition
                          ? `🗺 ${(replay.expedition&&replay.expedition.name)}`
                          : replay.isMerc
                            ? `🏴 ${(MERC_DUNGEONS.find(d=>d.id===replay.mercDungeonId)&&MERC_DUNGEONS.find(d=>d.id===replay.mercDungeonId).label)||"傭兵副本"}`
                          : replay.dungeon?`${replay.dungeon.icon} ${replay.dungeon.name}`:"⚔"}
                        {!replay.isExpedition&&!replay.isMerc&&!replay.isArena&&` · ${(replay.tier&&replay.tier.label)}`}
                      </div>

                      <div style={{marginBottom:12}}>
                        <div style={{fontSize:10,color:"#5a4020",fontFamily:"'Cinzel',serif",letterSpacing:1,marginBottom:4,textAlign:"center"}}>
                          {replay.cursor<replay.lines.length?"戰鬥回放中...":"— 戰鬥結束 —"}
                        </div>
                        <div className="bt" style={{height:5}}>
                          <div className="bf" style={{
                            width:`${Math.round(replay.cursor/replay.lines.length*100)}%`,
                            background:replay.won?"linear-gradient(90deg,#1a5a1a,#40a040)":"linear-gradient(90deg,#5a1a1a,#a04040)"
                          }}/>
                        </div>
                      </div>

                      <ReplayLog lines={replay.lines} cursor={replay.cursor}/>

                      <div className="bact" style={{marginTop:12}}>
                        {replay.cursor<replay.lines.length?(
                          <button className="btn btm" onClick={()=>setReplay(r=>r?{...r,cursor:r.lines.length}:null)}>
                            ⏩ 跳過
                          </button>
                        ):(
                          <>
                            <button className="btn btp" onClick={()=>replay.isArena?setTab("arena"):replay.isExpedition?startExpedition(replay.expedition):replay.isMerc?startMercBattle(replay.mercDungeonId):startBattle(replay.dungeon,replay.tier)}>
                              {replay.isArena?"🏟 返回競技場":"⚔ 再次出征"}
                            </button>
                            <button className="btn btm" onClick={()=>{setReplay(null);setTab("dungeon");}}>
                              ↩ 返回
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  ):(
                    <div style={{textAlign:"center",color:"#5a4020",fontFamily:"'Cinzel',serif",fontSize:13,marginTop:40}}>
                      選擇副本出發！
                    </div>
                  )}
                </div>
              )}

              {/* ── SHOP ── */}
              {tab==="shop"&&(
                <div>
                  <div className="stl">
                    商店 <span style={{color:"#6a5030",fontSize:13}}>— 🪙 {player.gold}</span>
                  </div>

                  <div style={{display:"flex",gap:6,marginBottom:14,borderBottom:"1px solid #3a2a10",paddingBottom:8}}>
                    {[["buy","🏪 購買"],["auction","🔨 競標"],["sell","💰 賣出"]].map(([id,lbl])=>(
                      <button key={id} className={`btn${shopTab===id?" btp":" btm"}`} style={{fontSize:11,padding:"7px 14px"}} onClick={()=>setShopTab(id)}>{lbl}</button>
                    ))}
                  </div>

                  {/* ── BUY TAB ── */}
                  {shopTab==="buy"&&(
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                        <div style={{fontSize:12,color:"#6a5030"}}>商品已依你的等級(Lv.{player.level})生成</div>
                        <button className="btn btm" style={{fontSize:10,padding:"5px 12px"}} onClick={refreshShop}>
                          🔄 刷新 (-🪙{Math.floor(player.level*5+20)})
                        </button>
                      </div>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10}}>
                        {["all","weapon","offhand","armor","helmet","gloves","boots","ring","amulet"].map(f=>(
                          <div key={f} className={`wcat-btn${shopFilter===f?" active":""}`} onClick={()=>setShopFilter(f)}
                            style={{fontSize:10,padding:"3px 8px"}}>
                            {f==="all"?"全部":(EQUIP_SLOTS.find(s=>s.id===f)?EQUIP_SLOTS.find(s=>s.id===f).label:f)}
                          </div>
                        ))}
                      </div>
                      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
                        {[{name:"小型回復藥",icon:"🧪",heal:30,cost:25},{name:"大型回復藥",icon:"⚗️",heal:80,cost:60}].map((p,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px",background:"#1a1208",border:"1px solid #3a2a10",borderRadius:4,fontSize:12}}>
                            <span>{p.icon}</span>
                            <span style={{color:"#c8a848"}}>{p.name}</span>
                            <span style={{color:"#50a860"}}>+{p.heal}HP</span>
                            <span style={{color:"#f0c040"}}>🪙{p.cost}</span>
                            <button className="btn btp" style={{fontSize:10,padding:"4px 10px"}} disabled={player.gold<p.cost}
                              onClick={()=>buyItem({...p,type:"potion",uid:Date.now()+Math.random(),specials:[],affixes:[]})}>買</button>
                          </div>
                        ))}
                      </div>
                      <div className="sg">
                        {filteredShop.map((item,idx)=>{
                          const rar=getRarity(item.rarity);
                          const cat=item.cat?WEAPON_CATEGORIES[item.cat]:null;
                          return(
                            <div key={idx} className="si" style={{borderColor:rar.color+"55",background:`linear-gradient(160deg,${rar.color}08,#141008)`,boxShadow:rar.glow||"none"}}>
                              <div className="sii" style={{filter:`drop-shadow(0 2px 5px ${rar.color}66)`}}>{item.icon}</div>
                              <div className="rb" style={{color:rar.color,borderColor:rar.color+"55",background:`${rar.color}15`}}>{rar.label}</div>
                              <div className="sin" style={{color:rar.color}}>{item.name}</div>
                              {cat&&<div className="sit">{cat.icon} {cat.label} · {cat.traitDesc}</div>}
                              <div className="sis">
                                {item.attack>0&&<div style={{color:"#c8781e"}}>攻+{item.attack}</div>}
                                {item.defense>0&&<div style={{color:"#4a9fd4"}}>防+{item.defense}</div>}
                                {item.hp>0&&<div style={{color:"#c84040"}}>HP+{item.hp}</div>}
                                {item.speed>0&&<div style={{color:"#4caf50"}}>速+{item.speed}</div>}
                                {item.itemLevel>0&&<div style={{color:"#5a4020",fontSize:10}}>Lv{item.itemLevel}</div>}
                              </div>
                              {item.affixes && item.affixes.length > 0 && <div className="iaf" style={{marginBottom:6}}>
                                {item.affixes.map((a,i)=><div key={i} className={`al${a.special?" as":""}`}>
                                  {a.stat?`${a.tag}:+${a.rolledVal}`:a.special==="crit"?`${a.tag}:${a.rolledVal}%爆擊`:a.special==="lifesteal"?`${a.tag}:${a.rolledVal}%吸血`:a.tag}
                                </div>)}
                              </div>}
                              <div className="sic">🪙 {item.cost}</div>
                              <button className="btn btp" style={{width:"100%",fontSize:10}} onClick={()=>buyItem(item)} disabled={player.gold<item.cost}>購買</button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── AUCTION TAB ── */}
                  {shopTab==="auction"&&(
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                        <div style={{fontSize:12,color:"#6a5030"}}>競標高品質裝備，出價最高者得標</div>
                        <button className="btn btm" style={{fontSize:10,padding:"5px 12px"}} onClick={refreshAuction}>🔄 刷新競標</button>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:12}}>
                        {auctionItems.filter(a=>!a.sold).map(it=>{
                          const rar=getRarity(it.rarity);
                          const cat=it.cat?WEAPON_CATEGORIES[it.cat]:null;
                          const myBid=bidInput[it.auctionId]||"";
                          const minNext=it.currentBid+Math.max(5,Math.floor(it.currentBid*0.1));
                          const iWon=it.myBid>0&&it.myBid===it.currentBid;
                          return(
                            <div key={it.auctionId} style={{
                              background:`linear-gradient(160deg,${rar.color}08,#141008)`,
                              border:`1px solid ${rar.color}66`,
                              borderRadius:6, padding:"14px",
                              boxShadow:rar.glow||"none",
                            }}>
                              <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                                <div style={{fontSize:30,filter:`drop-shadow(0 2px 8px ${rar.color}88)`}}>{it.icon}</div>
                                <div style={{flex:1}}>
                                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                                    <div className="rb" style={{color:rar.color,borderColor:rar.color+"55",background:`${rar.color}15`}}>{rar.label}</div>
                                    <div style={{fontFamily:"'Cinzel',serif",fontSize:13,color:rar.color}}>{it.name}</div>
                                    {cat&&<div style={{fontSize:10,color:"#c8781e"}}>{cat.icon}{cat.label}</div>}
                                  </div>
                                  <div style={{fontSize:11,color:"#6a5030",display:"flex",gap:8,flexWrap:"wrap",marginBottom:4}}>
                                    {it.attack>0&&<span style={{color:"#c8781e"}}>攻+{it.attack}</span>}
                                    {it.defense>0&&<span style={{color:"#4a9fd4"}}>防+{it.defense}</span>}
                                    {it.hp>0&&<span style={{color:"#c84040"}}>HP+{it.hp}</span>}
                                    {it.speed>0&&<span style={{color:"#4caf50"}}>速+{it.speed}</span>}
                                    {it.itemLevel>0&&<span style={{color:"#5a4020"}}>Lv{it.itemLevel}</span>}
                                  </div>
                                  {it.affixes && it.affixes.length > 0 && <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6}}>
                                    {it.affixes.map((a,i)=><span key={i} style={{fontSize:9,color:a.special?"#c870d0":"#6aaa6a",background:"rgba(0,0,0,0.3)",padding:"0 4px",borderRadius:2}}>{a.tag}</span>)}
                                  </div>}
                                  <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                                    <div style={{fontSize:12,color:"#f0c040",fontFamily:"'Cinzel',serif"}}>
                                      目前出價：🪙{it.currentBid} <span style={{fontSize:10,color:"#6a5030"}}>({it.bidCount}人競標)</span>
                                    </div>
                                    {iWon&&<div style={{fontSize:11,color:"#4caf50"}}>✓ 目前最高出價</div>}
                                  </div>
                                </div>
                              </div>
                              <div style={{display:"flex",gap:8,marginTop:10,alignItems:"center",flexWrap:"wrap"}}>
                                <div style={{fontSize:11,color:"#5a4020"}}>最低加價 🪙{minNext}</div>
                                <input
                                  type="number" min={minNext} placeholder={minNext}
                                  value={myBid}
                                  onChange={e=>setBidInput(b=>({...b,[it.auctionId]:parseInt(e.target.value)||""}))}
                                  style={{width:90,background:"#0e0a05",border:"1px solid #4a3010",borderRadius:3,color:"#f0c040",padding:"5px 8px",fontSize:12,fontFamily:"'Cinzel',serif"}}
                                />
                                <button className="btn btp" style={{fontSize:10,padding:"6px 12px"}} onClick={()=>{placeBid(it.auctionId,myBid);setBidInput(b=>({...b,[it.auctionId]:""}));}} disabled={!myBid||myBid<minNext||player.gold<myBid}>出價</button>
                                {iWon&&<button className="btn btm" style={{fontSize:10,padding:"6px 12px"}} onClick={()=>claimAuction(it.auctionId)}>🎁 領取</button>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── SELL TAB ── */}
                  {shopTab==="sell"&&(
                    <div>
                      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
                        <div style={{fontSize:12,color:"#6a5030",flex:1}}>出售背包中的裝備，回收金幣</div>
                        <button className="btn btm" style={{fontSize:10,padding:"6px 12px"}} onClick={sortInventory}>📂 整理背包</button>
                        <button className="btn btd" style={{fontSize:10,padding:"6px 12px"}} onClick={sellJunk}>🗑 賣掉所有普通品</button>
                      </div>
                      {inventory.filter(i=>i.type!=="potion").length===0&&<div style={{color:"#4a3a20",fontStyle:"italic"}}>背包中沒有可出售的裝備</div>}
                      <div className="ig">
                        {inventory.filter(i=>i.type!=="potion").map(item=>{
                          const rar=getRarity(item.rarity);
                          const price=calcSellPrice(item);
                          if(item.type==="merc_scroll"){
                            return(
                              <div key={item.uid} className="ii" style={{borderColor:rar.color+"55",background:`linear-gradient(160deg,${rar.color}08,#120e06)`}}>
                                <div style={{fontSize:20}}>📜</div>
                                <div className="rb" style={{color:rar.color,borderColor:rar.color+"55",background:`${rar.color}15`}}>{rar.label}</div>
                                <div className="iin" style={{color:rar.color}}>{item.name}</div>
                                <div className="iis">攻{item.attack} 防{item.defense} HP{item.hp}</div>
                                <div style={{color:"#f0c040",fontSize:12,margin:"6px 0"}}>售價 🪙{price}</div>
                                <button className="btn btd" style={{width:"100%",fontSize:10}} onClick={()=>sellItem(item.uid)}>出售</button>
                              </div>
                            );
                          }
                          return(
                            <div key={item.uid} className="ii" style={{borderColor:rar.color+"55",background:`linear-gradient(160deg,${rar.color}08,#120e06)`}}>
                              <div className="iii">{item.icon}</div>
                              {rar.id!=="normal"&&<div className="rb" style={{color:rar.color,borderColor:rar.color+"55",background:`${rar.color}15`}}>{rar.label}</div>}
                              <div className="iin" style={{color:rar.color}}>{item.name}</div>
                              <div className="iis">
                                {item.attack>0&&<div>攻+{item.attack}</div>}
                                {item.defense>0&&<div>防+{item.defense}</div>}
                                {item.hp>0&&<div>HP+{item.hp}</div>}
                              </div>
                              <AffixLines affixes={item.affixes}/>
                              <div style={{color:"#f0c040",fontSize:12,margin:"6px 0"}}>售價 🪙{price}</div>
                              <div style={{display:"flex",gap:4}}>
                                <button className="btn btp" style={{flex:1,fontSize:9,padding:"5px"}} onClick={()=>equipItem(item)}>裝備</button>
                                <button className="btn btd" style={{flex:1,fontSize:9,padding:"5px"}} onClick={()=>sellItem(item.uid)}>出售</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── INVENTORY ── */}
              {tab==="inventory"&&(
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap"}}>
                    <div className="stl" style={{margin:0,border:"none",padding:0,flex:1}}>背包 <span style={{color:"#6a5030",fontSize:13}}>— {inventory.length} 件</span></div>
                    <button className="btn btm" style={{fontSize:10,padding:"5px 10px"}} onClick={sortInventory}>📂 整理</button>
                    <button className="btn btd" style={{fontSize:10,padding:"5px 10px"}} onClick={sellJunk}>🗑 賣普通品</button>
                  </div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
                    {SLOT_FILTERS.map(f=>(
                      <div key={f.id} className={`wcat-btn${invFilter===f.id?" active":""}`} onClick={()=>setInvFilter(f.id)}>{f.label}</div>
                    ))}
                  </div>
                  {filteredInv.length===0&&<div style={{color:"#4a3a20",fontStyle:"italic"}}>（空）</div>}
                  <div className="ig">
                    {filteredInv.map(item=>{
                      if(item.type==="potion") return(
                        <div key={item.uid} className="ii">
                          <div className="iii">{item.icon}</div>
                          <div className="iin">{item.name}</div>
                          <div className="iis" style={{color:"#50a860"}}>回復 {item.heal}HP</div>
                          <div style={{color:"#f0c040",fontSize:11,marginBottom:4}}>售 🪙{calcSellPrice(item)}</div>
                          <div style={{display:"flex",gap:4}}>
                            <button className="btn btm" style={{flex:1,fontSize:9,padding:"5px"}} onClick={()=>{setPlayer(p=>({...p,hp:Math.min(p.hp+item.heal,cMhp(p))}));setInventory(inv=>inv.filter(i=>i.uid!==item.uid));}}>使用</button>
                            <button className="btn btd" style={{flex:1,fontSize:9,padding:"5px"}} onClick={()=>sellItem(item.uid)}>賣出</button>
                          </div>
                        </div>
                      );
                      if(item.type==="merc_scroll") {
                        const gr=getRarity(item.rarity);
                        return(
                          <div key={item.uid} className="ii" style={{borderColor:gr.color+"66",background:`linear-gradient(160deg,${gr.color}10,#120e06)`,boxShadow:gr.glow||"none"}}>
                            <div style={{fontSize:22,filter:`drop-shadow(0 2px 6px ${gr.color}88)`}}>📜</div>
                            <div className="rb" style={{color:gr.color,borderColor:gr.color+"55",background:`${gr.color}15`}}>{gr.label}</div>
                            <div className="iin" style={{color:gr.color,textShadow:gr.glow?`0 0 8px ${gr.color}`:"none"}}>{item.name}</div>
                            <div style={{fontSize:20,margin:"4px 0"}}>{item.icon}</div>
                            <div className="iis">
                              <div style={{color:"#c8781e"}}>攻擊 {item.attack}</div>
                              <div style={{color:"#4a9fd4"}}>防禦 {item.defense}</div>
                              <div style={{color:"#c84040"}}>HP {item.hp}</div>
                              {item.heal>0&&<div style={{color:"#50c890"}}>回復 {item.heal}/回</div>}
                            </div>
                            {item.affixes && item.affixes.length > 0 && <div className="iaf">
                              {item.affixes.map((a,i)=>(
                                <div key={i} className={`al${a.special?" as":""}`}>
                                  {a.stat?`${a.tag}:+${a.rolledVal}`:a.special==="all"?`${a.tag}:全屬+${Math.round(a.rolledVal*100)}%`:a.special==="first"?`${a.tag}:先攻×${1+a.rolledVal}`:""}
                                </div>
                              ))}
                            </div>}
                            <div style={{fontSize:10,color:"#5a4828",fontStyle:"italic",margin:"4px 0"}}>{item.desc}</div>
                            <div style={{color:"#f0c040",fontSize:11,marginBottom:4}}>售 🪙{calcSellPrice(item)}</div>
                            <div style={{display:"flex",flexDirection:"column",gap:4}}>
                              <button className="btn btp" style={{width:"100%",fontSize:10}} onClick={()=>{
                                setSelectedScrolls(p=>p.includes(item.uid)?p.filter(x=>x!==item.uid):[...p,item.uid]);
                                setTab("dungeon");
                              }}>
                                {selectedScrolls.includes(item.uid)?"✓ 已選（去副本）":"選入傭兵隊"}
                              </button>
                              <button className="btn btd" style={{width:"100%",fontSize:10}} onClick={()=>sellItem(item.uid)}>出售</button>
                            </div>
                          </div>
                        );
                      }
                      // Regular equipment
                      const rar=getRarity(item.rarity);
                      const price=calcSellPrice(item);
                      return(
                        <div key={item.uid} className="ii" style={{borderColor:rar.color+(rar.id==="normal"?"33":"77"),background:rar.id==="normal"?"linear-gradient(160deg,#1a1208,#120e06)":`linear-gradient(160deg,${rar.color}0a,#120e06)`,boxShadow:rar.glow||"none"}}>
                          <div className="iii" style={{filter:`drop-shadow(0 2px 4px ${rar.color}66)`}}>{item.icon}</div>
                          {rar.id!=="normal"&&<div className="rb" style={{color:rar.color,borderColor:rar.color+"55",background:`${rar.color}15`}}>{rar.label}</div>}
                          <div className="iin" style={{color:rar.color}}>{item.name}</div>
                          {item.itemLevel>0&&<div style={{fontSize:9,color:"#5a4020",marginBottom:2}}>Lv.{item.itemLevel}</div>}
                          <div className="iis">
                            {item.attack>0&&<div style={{color:item.attack>50?"#f5c040":item.attack>25?"#c8781e":"#5a4020"}}>攻+{item.attack}</div>}
                            {item.defense>0&&<div style={{color:item.defense>40?"#80c0f0":item.defense>20?"#4a9fd4":"#5a4020"}}>防+{item.defense}</div>}
                            {item.hp>0&&<div style={{color:item.hp>80?"#f06060":item.hp>40?"#c84040":"#5a4020"}}>HP+{item.hp}</div>}
                            {item.speed>0&&<div style={{color:"#5a9050"}}>速+{item.speed}</div>}
                          </div>
                          {item.cat&&<div style={{fontSize:10,color:"#d08030",marginBottom:3}}>{item.cat&&WEAPON_CATEGORIES[item.cat]?WEAPON_CATEGORIES[item.cat].icon:""}{item.cat&&WEAPON_CATEGORIES[item.cat]?WEAPON_CATEGORIES[item.cat].label:""} · {item.cat&&WEAPON_CATEGORIES[item.cat]?WEAPON_CATEGORIES[item.cat].traitDesc:""}</div>}
                          <AffixLines affixes={item.affixes}/>
                          <div style={{color:"#f0c040",fontSize:11,margin:"5px 0"}}>售 🪙{price}</div>
                          <div style={{display:"flex",gap:4}}>
                            <button className="btn btp" style={{flex:1,fontSize:9,padding:"5px"}} onClick={()=>equipItem(item)}>裝備</button>
                            <button className="btn btd" style={{flex:1,fontSize:9,padding:"5px"}} onClick={()=>sellItem(item.uid)}>出售</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          </main>
        </div>

        {/* Quest completion notification */}
        {questNotify&&(
          <div className="quest-notify">
            {questNotify.split("\n").map((line,i)=>(
              <div key={i} style={{marginBottom:i===0?4:0}}>{line}</div>
            ))}
          </div>
        )}

        {/* Loot Popup */}
        {lootDrop&&<LootPopup
          item={lootDrop}
          onEquip={equipLootNow}
          onTake={takeLoot}
          onDiscard={discardLoot}
        />}
      </div>
    </>
  );
}

export default function LegacyGame() {
  return <App />;
}
  
