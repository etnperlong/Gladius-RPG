import { useCallback, useEffect, useRef, useState } from "react";

import "./game.css";

import {
  INITIAL_EQUIPMENT,
  INITIAL_PLAYER,
} from "../game/constants";
import { DUNGEON_TIERS } from "../game/data/dungeonTiers";
import { DUNGEONS } from "../game/data/dungeons";
import { ENHANCE_LEVELS } from "../game/data/enhanceLevels";
import { EQUIP_SLOTS } from "../game/data/equipmentSlots";
import { EXPEDITIONS } from "../game/data/expeditions";
import { MERC_DUNGEONS } from "../game/data/mercenaries";
import { MONSTERS } from "../game/data/monsters";
import { QUEST_DEFS } from "../game/data/quests";
import { TRAIN_STATS } from "../game/data/trainStats";
import { WEAPON_CATEGORIES } from "../game/data/weaponCategories";
import { TRAIN_STAT_DISPLAY_KEYS } from "../game/lib/display";
import { applyEnhanceBonus, calcSellPrice, enhanceCost } from "../game/lib/items";
import { trainCost } from "../game/lib/training";
import { clearGameState, loadGameState, saveGameState } from "../game/persistence";
import {
  applyProgressionRewards,
  cAtk,
  checkQuestReset,
  cDef,
  cMhp,
  cSpd,
  fightMonster,
  genArenaOpponent,
  genAuctionItem,
  genLoot,
  genMercScroll,
  genShopItem,
  gSpec,
  getRarity,
  getQuestProgress,
  getWeekKey,
  getWeaponCat,
  initQuestState,
  isQuestDone,
  simulateArenaBattle,
  simulateExpedition,
  simulateMercRun,
  simulateRun,
} from "../game/systems";
import type {
  RuntimeLogEntry,
} from "../game/types";
import type {
  AnyRecord,
  LegacyArenaOpponent,
  LegacyItem,
  LegacyPlayer,
  LegacyQuestState,
  LegacyReplay,
  LootDrop,
} from "./types";

// ══════════════════════════════════════════════════════════════════════════════
// QUEST SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

// ── Arena section continues below ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// ARENA SYSTEM — PvP opponents, injury timer, gold plunder
// ══════════════════════════════════════════════════════════════════════════════
// Simulate Arena PvP fight (player vs opponent)
// Returns {log, won, goldPlundered}


function AffixLines({ affixes }: { affixes: any[] }) {
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

function ItemCard({ item, onEquip, onUse }: { item: any; onEquip?: any; onUse?: any }) {
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

function HpBar({ cur, max, color="#c83030", thin }: { cur: any; max: any; color?: string; thin?: any }) {
  return (
    <div className="bw">
      <div className="bl"><span>HP</span><span>{cur}/{max}</span></div>
      <div className="bt" style={thin?{height:6}:{}}><div className="bf" style={{width:`${Math.round(Math.max(0,cur)/max*100)}%`,background:`linear-gradient(90deg,${color}99,${color})`}}/></div>
    </div>
  );
}

function ReplayLog({ lines, cursor }: { lines: RuntimeLogEntry[]; cursor: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const visible = lines.slice(0, cursor);
  useEffect(()=>{ if(ref.current) ref.current.scrollTop=ref.current.scrollHeight; },[cursor]);
  const COLOR: AnyRecord = {
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

function BattleLog({ log }: { log: RuntimeLogEntry[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
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

function LootPopup({ item, onEquip, onTake, onDiscard }: { item: any; onEquip: () => void; onTake: () => void; onDiscard: () => void }) {
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
  player: LegacyPlayer;
  inventory: LegacyItem[];
  questState: LegacyQuestState;
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
                  {def.rewards.map((r: any,i: any)=>(
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
  player: LegacyPlayer;
  arenaOpponents: LegacyArenaOpponent[];
  arenaInjuredUntil: number;
  arenaRefreshes: number;
  onRefresh: (free: boolean) => void;
  onFight: (opponent: LegacyArenaOpponent) => void;
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
  const [player, setPlayer] = useState<LegacyPlayer>(() => loadGameState().player as LegacyPlayer);

  const [inventory, setInventory] = useState<LegacyItem[]>(() => loadGameState().inventory as LegacyItem[]);

  const [tab, setTab] = useState("dungeon");
  const [replay, setReplay] = useState<LegacyReplay | null>(null);
  const replayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lootDrop, setLootDrop] = useState<LootDrop | null>(null);
  const [selectedScrolls, setSelectedScrolls] = useState<any[]>([]);
  const [saveMsg, setSaveMsg] = useState("");
  const [shopFilter, setShopFilter] = useState("all");
  const [invFilter, setInvFilter] = useState("all");
  const [shopItems, setShopItems] = useState<any[]>(()=>Array.from({length:8},(_,i)=>genShopItem(1,["weapon","offhand","armor","helmet","gloves","boots","ring","amulet"][i])));
  const [auctionItems, setAuctionItems] = useState<any[]>(()=>Array.from({length:4},()=>genAuctionItem(1)));
  const [shopTab, setShopTab] = useState("buy");
  const [bidInput, setBidInput] = useState<AnyRecord>({});
  const [enhanceTarget, setEnhanceTarget] = useState<any>(null);
  const [enhanceLog, setEnhanceLog] = useState<string[]>([]);
  const [enhanceAnim, setEnhanceAnim] = useState<string | null>(null);
  // ── Arena state ──────────────────────────────────────────────────────────
  const [arenaOpponents, setArenaOpponents] = useState<LegacyArenaOpponent[]>([]);
  const [arenaInjuredUntil, setArenaInjuredUntil] = useState(0); // timestamp ms
  const [arenaRefreshes, setArenaRefreshes] = useState(5); // free refreshes per day
  const [arenaLastDate, setArenaLastDate] = useState("");
  // ── Quest state ───────────────────────────────────────────────────────────
  const [questState, setQuestState] = useState<LegacyQuestState>(()=>initQuestState());
  const [questNotify, setQuestNotify] = useState<string | null>(null); // {msg} toast notification // YYYY-MM-DD

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

  function lvUp(np: any, expG: any, goldG: any, log: any) {
    const withGold = { ...np, gold: (np.gold || 0) + goldG };
    const prevLevel = withGold.level;
    const { player: next } = applyProgressionRewards(withGold, { exp: expG, gold: 0 });
    for (let lv = prevLevel + 1; lv <= next.level; lv++) {
      log.push({ txt: `🌟 等級提升！Lv.${lv}！`, type: "win" });
    }
    return next;
  }

  const startBattle=(dungeon: any,tier: any)=>{
    const result=simulateRun(dungeon,tier,{...player},{ lvUp, genLoot, genMercScroll });
    const fp = result.finalPlayer;
    // Track quest stats
    const killCount = dungeon.waves.flatMap((w: any)=>w.monsters).length + (dungeon.boss?1:0);
    const bossKill  = result.won ? 1 : 0;
    fp.totalKills     = (fp.totalKills||0) + (result.won ? killCount : Math.floor(killCount*0.5));
    fp.totalBossKills = (fp.totalBossKills||0) + bossKill;
    fp.totalDungeons  = (fp.totalDungeons||0) + (result.won ? 1 : 0);
    fp.totalGoldEarned= (fp.totalGoldEarned||0) + Math.max(0, fp.gold - player.gold);
    fp.highestLevel   = Math.max(fp.highestLevel||1, fp.level);
    setPlayer(fp);
    setReplay({lines:result.log, cursor:0, drops:result.drops as LegacyItem[], dungeon, tier, won:result.won, pending:false, isExpedition:false} as LegacyReplay);
    setTab("battle");
    updateQuestProgress(fp, inventory);
  };

  const startExpedition=(expedition: any)=>{
    const result=simulateExpedition(expedition,{...player},{ lvUp, genLoot, genMercScroll });
    const fp = result.finalPlayer;
    fp.totalKills       = (fp.totalKills||0) + (result.won ? 1 : 0);
    fp.totalExpeditions = (fp.totalExpeditions||0) + (result.won ? 1 : 0);
    fp.totalGoldEarned  = (fp.totalGoldEarned||0) + Math.max(0, fp.gold - player.gold);
    fp.highestLevel     = Math.max(fp.highestLevel||1, fp.level);
    setPlayer(fp);
    setReplay({lines:result.log, cursor:0, drops:result.drops as LegacyItem[], won:result.won, expedition, isExpedition:true} as LegacyReplay);
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
    return()=>{ if(replayTimerRef.current) clearTimeout(replayTimerRef.current); };
  },[replay]);

  useEffect(()=>{
    if(!replay||replay.cursor<replay.lines.length) return;
    if(replay.drops&&replay.drops.length>0&&!lootDrop){
      setLootDrop({...replay.drops[0], _remaining: replay.drops.slice(1)} as LootDrop);
    }
  },[(replay&&replay.cursor)]);

  const takeLoot=()=>{
    const remaining=(lootDrop&&lootDrop._remaining)||[];
    if(!lootDrop) return;
    setInventory(inv=>[...inv,{...lootDrop,_remaining:undefined}]);
    setLootDrop(remaining.length>0?({...remaining[0],_remaining:remaining.slice(1)} as LootDrop):null);
  };
  const discardLoot=()=>{
    const remaining=(lootDrop&&lootDrop._remaining)||[];
    setLootDrop(remaining.length>0?({...remaining[0],_remaining:remaining.slice(1)} as LootDrop):null);
  };
  const equipLootNow=()=>{
    if(!lootDrop) return;
    const item={...lootDrop,_remaining:undefined};
    const remaining=(lootDrop&&lootDrop._remaining)||[];
    const old=player.equipment[item.slot];
    setPlayer(p=>({...p,equipment:{...p.equipment,[item.slot]:item}}));
    if(old)setInventory(inv=>[...inv,{...old,uid:Date.now()}]);
    setLootDrop(remaining.length>0?({...remaining[0],_remaining:remaining.slice(1)} as LootDrop):null);
  };

  const mercScrollsInInv = inventory.filter(i=>i.type==="merc_scroll");
  const selectedScrollObjs = selectedScrolls.map(uid=>inventory.find(i=>i.uid===uid)).filter(Boolean);

  const startMercBattle=(dungeonId: any)=>{
    const dungeon=MERC_DUNGEONS.find(d=>d.id===dungeonId)||MERC_DUNGEONS[0];
    if(player.level<dungeon.minLv){alert(`需要 Lv.${dungeon.minLv}！`);return;}
    if(!selectedScrolls.length){alert("請先從背包選擇傭兵契約捲軸！");return;}
    const usedUids=new Set(selectedScrolls);
    setInventory(inv=>inv.filter(i=>!usedUids.has(i.uid)));
    const mercs=selectedScrollObjs.map((s:any)=>({...s,curHp:s.hp,alive:true}));
    const np={...player};
    const result=simulateMercRun(dungeonId,np,mercs,{ lvUp, genLoot, genMercScroll, mercDungeons: MERC_DUNGEONS });
    const fp=result.finalPlayer;
    fp.totalMercRuns=(fp.totalMercRuns||0)+(result.won?1:0);
    fp.highestLevel=Math.max(fp.highestLevel||1,fp.level);
    setPlayer(fp);
    setSelectedScrolls([]);
    setReplay({lines:result.log,cursor:0,drops:result.drops as LegacyItem[],won:result.won,isMerc:true,mercDungeonId:dungeonId} as LegacyReplay);
    setTab("battle");
    updateQuestProgress(fp,inventory);
  };

  const usePotion=()=>{
    const idx=inventory.findIndex(i=>i.type==="potion"); if(idx===-1)return;
    const p=inventory[idx]; const ni=[...inventory]; ni.splice(idx,1);
    setPlayer(pl=>({...pl,hp:Math.min(pl.hp + (p.heal || 0), cMhp(pl))})); setInventory(ni);
  };

  const buyItem=(item: any)=>{
    if(player.gold<item.cost)return;
    setPlayer(p=>({...p,gold:p.gold-item.cost}));
    const {cost:_c,auctionId:_a,currentBid:_b,myBid:_m,bidCount:_bc,endsIn:_e,sold:_s,...clean}=item;
    setInventory(inv=>[...inv,{...clean,uid:Date.now()+Math.random(),specials:clean.specials||[],affixes:clean.affixes||[]}]);
  };
  const sellItem=(uid: any)=>{
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
  const doEnhance = (uid: any) => {
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

  const doTrain = (statId: any) => {
    const current = player[statId] || 0;
    const cost = trainCost(player.level, current);
    if(player.gold < cost) return;
    if(player.gold - cost < 50) { alert(`訓練費用 ${cost}，會讓金幣低於 50，請先賺更多金幣！`); return; }
    const trainStat = TRAIN_STATS.find(s=>s.id===statId);
    const isMhp = trainStat && trainStat.hpStat;
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
    setArenaOpponents(Array.from({length:4}, ()=>genArenaOpponent(player.level)) as LegacyArenaOpponent[]);
  };

  // Collect quest reward
  const collectQuest = (questId: any) => {
    const def = QUEST_DEFS[questId];
    if(!def) return;
    const statsWithInv = {...player, _inv: inventory};
    if(!isQuestDone(questId, statsWithInv, questState)) return;

    // Apply rewards
    let np = {...player};
    const drops: any[] = [];
    def.rewards.forEach((r: any) => {
      if(r.type==="gold")   { np.gold += r.value; }
      if(r.type==="exp")    { const log: any[]=[]; np=lvUp(np, r.value, 0, log); }
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
    const rewardText = def.rewards.map((r: any)=>r.label).join("、");
    setQuestNotify(`✅ 任務完成：${def.title}\n獎勵：${rewardText}`);
    setTimeout(()=>setQuestNotify(null), 3000);
  };

  // Update quest progress whenever player stats change — check for newly completable quests
  const updateQuestProgress = (updatedPlayer: any, updatedInventory: any) => {
    const statsWithInv = {...updatedPlayer, _inv: updatedInventory||inventory};
    const newQs = checkQuestReset(questState, updatedPlayer);
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

  const arenaRefresh = (free: any) => {
    if(free) {
      if(arenaRefreshes <= 0) return;
      setArenaRefreshes(r=>r-1);
    } else {
      const cost = 50 + player.level * 10;
      if(player.gold < cost) { alert(`刷新需要 ${cost} 金幣！`); return; }
      setPlayer(p=>({...p, gold:p.gold-cost}));
    }
    setArenaOpponents(Array.from({length:4}, ()=>genArenaOpponent(player.level)) as LegacyArenaOpponent[]);
  };

  const startArenaBattle = (opponent: any) => {
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
    setReplay({lines:result.log, cursor:0, drops:[], won:result.won, isArena:true, opponent} as LegacyReplay);
    setTab("battle");
    updateQuestProgress(np, inventory);
  };

  const refreshAuction = () => {
    setAuctionItems(Array.from({length:4},()=>genAuctionItem(player.level)));
  };
  const placeBid=(auctionId: any,amount: any)=>{
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
  const claimAuction=(auctionId: any)=>{
    const it=auctionItems.find(a=>a.auctionId===auctionId);
    if(!it||!it.myBid)return;
    const {cost:_c,auctionId:_a,currentBid:_b,myBid:_m,bidCount:_bc,endsIn:_e,sold:_s,...clean}=it;
    setInventory(inv=>[...inv,{...clean,uid:Date.now()+Math.random()}]);
    setAuctionItems(items=>items.filter(a=>a.auctionId!==auctionId));
    refreshAuction();
  };

  const equipItem=(item: any)=>{
    const old=player.equipment[item.slot];
    setPlayer(p=>({...p,equipment:{...p.equipment,[item.slot]:item}}));
    setInventory(inv=>{const n=inv.filter(i=>i.uid!==item.uid);if(old)n.push({...old,uid:Date.now()});return n;});
  };
  const unequip=(slot: any)=>{
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
                              {eq.affixes.map((a: any,i: any)=>(
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
                        {d.waves.map((w: any,wi: any)=>(
                          <div key={wi} style={{fontSize:10,color:"#5a4030",background:"rgba(0,0,0,0.3)",border:"1px solid #2a1a08",borderRadius:3,padding:"2px 6px"}}>
                            {w.monsters.map((k: any)=>(MONSTERS[k]?MONSTERS[k].icon:"?")).join("")} {w.label.replace("第","").replace("波","")}波
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
                              {d.waves.map((w: any,wi: any)=>(
                                <span key={wi} style={{marginRight:3,opacity:0.7}}>
                                  {w.enemies.map((k: any)=>(MONSTERS[k]?MONSTERS[k].icon:"👹")).join("")}
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
                      const displayKey=TRAIN_STAT_DISPLAY_KEYS[stat.id];
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
                              {stat.hpStat?`${player.maxHp+(current*3)}`:`${(player[displayKey]||0)+(current||0)}`}
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
                questState={checkQuestReset(questState, player)}
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
                            ? `🏴 ${MERC_DUNGEONS.find((d)=>d.id===replay.mercDungeonId)?.label||"傭兵副本"}`
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
                        {["all","weapon","offhand","armor","helmet","gloves","boots","ring","amulet"].map(f=>{
                          const slotDef = EQUIP_SLOTS.find(s=>s.id===f);
                          return (
                            <div key={f} className={`wcat-btn${shopFilter===f?" active":""}`} onClick={()=>setShopFilter(f)}
                              style={{fontSize:10,padding:"3px 8px"}}>
                              {f==="all"?"全部":(slotDef ? slotDef.label : f)}
                            </div>
                          );
                        })}
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
                                {item.affixes.map((a: any,i: any)=><div key={i} className={`al${a.special?" as":""}`}>
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
                                    {it.affixes.map((a: any,i: any)=><span key={i} style={{fontSize:9,color:a.special?"#c870d0":"#6aaa6a",background:"rgba(0,0,0,0.3)",padding:"0 4px",borderRadius:2}}>{a.tag}</span>)}
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
                              {item.affixes.map((a: any,i: any)=>(
                                <div key={i} className={`al${a.special?" as":""}`}>
                                  {a.stat?`${a.tag}:+${a.rolledVal || 0}`:a.special==="all"?`${a.tag}:全屬+${Math.round((a.rolledVal || 0)*100)}%`:a.special==="first"?`${a.tag}:先攻×${1+(a.rolledVal || 0)}`:""}
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
