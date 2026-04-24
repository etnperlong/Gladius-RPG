import "./game.css";

import { BattleLog } from "../components/BattleLog";
import { HpBar } from "../components/HpBar";
import { ItemCard } from "../components/ItemCard";
import { LootPopup } from "../components/LootPopup";
import { ReplayLog } from "../components/ReplayLog";
import { ArenaTab } from "../features/arena/ArenaTab";
import { DungeonTab } from "../features/dungeon/DungeonTab";
import { QuestTab } from "../features/quests/QuestTab";
import { TrainTab } from "../features/train/TrainTab";
import { WEAPON_CATEGORIES } from "../game/data/weaponCategories";
import {
  getRarity,
} from "../game/systems";
import { useGameState } from "../game/useGameState";

// ══════════════════════════════════════════════════════════════════════════════
// QUEST SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

// ── Arena section continues below ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// ARENA SYSTEM — PvP opponents, injury timer, gold plunder
// ══════════════════════════════════════════════════════════════════════════════
// Simulate Arena PvP fight (player vs opponent)
// Returns {log, won, goldPlundered}


function App() {
  const state = useGameState();
  const {
    arenaInjuredUntil,
    arenaOpponents,
    arenaRefresh,
    arenaRefreshes,
    auctionDisplayItems,
    collectQuest,
    discardLoot,
    addFreeMercScroll,
    dungeonSections,
    equipmentSidebarItems,
    enhanceAnim,
    enhanceLog,
    equipItem,
    equipLootNow,
    expeditionCards,
    expPct,
    filteredInv,
    filteredShop,
    closeReplay,
    handleTabSelect,
    initArena,
    invFilter,
    inventory,
    inventoryFilterOptions,
    inventoryItems,
    hasSellableInventory,
    lootDrop,
    mercDungeonCards,
    mercSelectionCards,
    mercScrollsInInv,
    navTabs,
    openBattleReport,
    player,
    potionShopItems,
    questNotify,
    refreshShopCost,
    renderedQuestState,
    refreshAuction,
    refreshShop,
    replay,
    replaySummary,
    reset,
    restartReplayBattle,
    save,
    saveMsg,
    selectedScrolls,
    sellListItems,
    sellJunk,
    shopDisplayItems,
    shopTab,
    shopFilterOptions,
    shopTabOptions,
    sortInventory,
    skipReplay,
    startArenaBattle,
    tAtk,
    tDef,
    trainingCards,
    tMhp,
    tSpd,
    tab,
    takeLoot,
    unequip,
    wCat,
    enhanceItems,
  } = state;

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
                <HpBar cur={player.hp} max={tMhp} />
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
                {equipmentSidebarItems.map(({ category, equippedItem, onUnequip, rarityColor, slot, style, textShadow, title })=>{
                  return(
                    <div key={slot.id}
                      onClick={onUnequip}
                      title={title}
                      style={style}>
                      <span style={{fontSize:13,flexShrink:0,marginTop:1}}>{slot.icon}</span>
                      <div style={{minWidth:0,flex:1}}>
                        <div style={{fontSize:9,color:"#4a3020",fontFamily:"'Cinzel',serif",letterSpacing:.5,lineHeight:1}}>{slot.label}</div>
                        {equippedItem ? <>
                          <div style={{
                            fontSize:11, color:rarityColor, lineHeight:1.3, marginTop:1,
                            textShadow,
                            fontFamily:"'Cinzel',serif", letterSpacing:.3,
                          }}>{equippedItem.name}</div>
                          <div style={{fontSize:10,color:"#6a5030",marginTop:2,display:"flex",gap:6,flexWrap:"wrap"}}>
                            {equippedItem.attack>0 && <span style={{color:"#c8781e"}}>攻+{equippedItem.attack}</span>}
                            {equippedItem.defense>0 && <span style={{color:"#4a9fd4"}}>防+{equippedItem.defense}</span>}
                            {equippedItem.hp>0 && <span style={{color:"#c84040"}}>HP+{equippedItem.hp}</span>}
                            {equippedItem.speed>0 && <span style={{color:"#4caf50"}}>速+{equippedItem.speed}</span>}
                            {category && <span style={{color:"#d08030"}}>{category.icon}{category.label}</span>}
                            {equippedItem.itemLevel && <span style={{color:"#5a4020"}}>Lv{equippedItem.itemLevel}</span>}
                          </div>
                          {equippedItem.affixes && equippedItem.affixes.length > 0 && (
                            <div style={{marginTop:2,display:"flex",gap:3,flexWrap:"wrap"}}>
                              {equippedItem.affixes.map((a: any,i: any)=>(
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
              {navTabs.map(({ id, label, badgeCount, onSelect })=>{
                return(
                  <button key={id} className={`nb${tab===id?" active":""}`}
                    style={{position:"relative"}}
                    onClick={onSelect}>
                    {label}
                    {badgeCount>0&&(
                      <span style={{position:"absolute",top:4,right:4,background:"#c84040",color:"#fff",
                        borderRadius:"8px",padding:"0 4px",fontSize:9,lineHeight:"14px",fontFamily:"sans-serif"}}>
                        {badgeCount}
                      </span>
                    )}
                  </button>
                );
              })}
              {replay&&<button className={`nb${tab==="battle"?" active":""}`} onClick={openBattleReport}>{replay.won?"🏆":"⚔"} 報告</button>}
            </div>

            <div className="ca">

              {/* ── DUNGEON TAB ── */}
              {tab==="dungeon"&&(
                <DungeonTab
                  expeditionCards={expeditionCards}
                  dungeonSections={dungeonSections}
                  mercScrollsInInv={mercScrollsInInv}
                  mercSelectionCards={mercSelectionCards}
                  selectedScrolls={selectedScrolls}
                  mercDungeonCards={mercDungeonCards}
                  onAddFreeMercScroll={addFreeMercScroll}
                />
              )}

              {/* ── TRAIN & ENHANCE TAB ── */}
              {tab === "train" && (
                <TrainTab
                  trainingCards={trainingCards}
                  enhanceLog={enhanceLog}
                  enhanceItems={enhanceItems}
                  enhanceAnim={enhanceAnim}
                />
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
                questState={renderedQuestState}
                onCollect={collectQuest}
              />}

              {/* ── BATTLE REPLAY ── */}
              {tab==="battle"&&(
                <div className="ba">
                  {replay ? (
                    <>
                      <div className="btl">{replaySummary?.title}</div>

                      <div style={{marginBottom:12}}>
                        <div style={{fontSize:10,color:"#5a4020",fontFamily:"'Cinzel',serif",letterSpacing:1,marginBottom:4,textAlign:"center"}}>
                          {replaySummary?.statusText}
                        </div>
                        <div className="bt" style={{height:5}}>
                          <div className="bf" style={{
                            width:replaySummary?.progressWidth,
                            background:replaySummary?.progressBackground
                          }}/>
                        </div>
                      </div>

                      <ReplayLog lines={replay.lines} cursor={replay.cursor}/>

                      {replaySummary?.showBattleSummary && (
                        <div style={{marginTop:12}}>
                          <div style={{fontSize:10,color:"#5a4020",fontFamily:"'Cinzel',serif",letterSpacing:1,marginBottom:4,textAlign:"center"}}>
                            戰鬥摘要
                          </div>
                          <BattleLog log={replay.lines}/>
                        </div>
                      )}

                      <div className="bact" style={{marginTop:12}}>
                        {replay.cursor<replay.lines.length?(
                          <button className="btn btm" onClick={skipReplay}>
                            ⏩ 跳過
                          </button>
                        ):(
                          <>
                            <button className="btn btp" onClick={restartReplayBattle}>
                              {replaySummary?.actionLabel}
                            </button>
                            <button className="btn btm" onClick={closeReplay}>
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
                    {shopTabOptions.map(({ id, isActive, label, onSelect })=>(
                      <button key={id} className={`btn${isActive?" btp":" btm"}`} style={{fontSize:11,padding:"7px 14px"}} onClick={onSelect}>{label}</button>
                    ))}
                  </div>

                  {/* ── BUY TAB ── */}
                  {shopTab==="buy"&&(
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                        <div style={{fontSize:12,color:"#6a5030"}}>商品已依你的等級(Lv.{player.level})生成</div>
                        <button className="btn btm" style={{fontSize:10,padding:"5px 12px"}} onClick={refreshShop}>
                          🔄 刷新 (-🪙{refreshShopCost})
                        </button>
                      </div>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10}}>
                        {shopFilterOptions.map((filter)=>{
                          return (
                            <div key={filter.id} className={`wcat-btn${filter.isActive?" active":""}`} onClick={filter.onSelect}
                              style={{fontSize:10,padding:"3px 8px"}}>
                              {filter.label}
                            </div>
                          );
                        })}
                      </div>
                      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
                        {potionShopItems.map((p)=>(
                          <div key={p.name} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 12px",background:"#1a1208",border:"1px solid #3a2a10",borderRadius:4,fontSize:12}}>
                            <span>{p.icon}</span>
                            <span style={{color:"#c8a848"}}>{p.name}</span>
                            <span style={{color:"#50a860"}}>+{p.heal}HP</span>
                            <span style={{color:"#f0c040"}}>🪙{p.cost}</span>
                            <button className="btn btp" style={{fontSize:10,padding:"4px 10px"}} disabled={!p.canAfford}
                              onClick={p.onBuy}>買</button>
                          </div>
                        ))}
                      </div>
                      <div className="sg">
                        {shopDisplayItems.map(({ cat, item, onBuy, rarity },idx)=>{
                          return(
                            <div key={idx} className="si" style={{borderColor:rarity.color+"55",background:`linear-gradient(160deg,${rarity.color}08,#141008)`,boxShadow:rarity.glow||"none"}}>
                              <div className="sii" style={{filter:`drop-shadow(0 2px 5px ${rarity.color}66)`}}>{item.icon}</div>
                              <div className="rb" style={{color:rarity.color,borderColor:rarity.color+"55",background:`${rarity.color}15`}}>{rarity.label}</div>
                              <div className="sin" style={{color:rarity.color}}>{item.name}</div>
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
                              <button className="btn btp" style={{width:"100%",fontSize:10}} onClick={onBuy} disabled={player.gold<item.cost}>購買</button>
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
                        {auctionDisplayItems.map(({ cat, iWon, it, minNext, myBid, onBidInputChange, onClaim, onSubmitBid, rar })=>{
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
                                  onChange={onBidInputChange}
                                  style={{width:90,background:"#0e0a05",border:"1px solid #4a3010",borderRadius:3,color:"#f0c040",padding:"5px 8px",fontSize:12,fontFamily:"'Cinzel',serif"}}
                                />
                                <button className="btn btp" style={{fontSize:10,padding:"6px 12px"}} onClick={onSubmitBid} disabled={!myBid||myBid<minNext||player.gold<myBid}>出價</button>
                                {iWon&&<button className="btn btm" style={{fontSize:10,padding:"6px 12px"}} onClick={onClaim}>🎁 領取</button>}
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
                      {!hasSellableInventory&&<div style={{color:"#4a3a20",fontStyle:"italic"}}>背包中沒有可出售的裝備</div>}
                      <div className="ig">
                        {sellListItems.map(({ item, onEquip, onSelect, onSell, price, rarity, selectLabel })=>{
                          if(item.type==="merc_scroll"){
                            return(
                              <div key={item.uid} className="ii" style={{borderColor:rarity.color+"55",background:`linear-gradient(160deg,${rarity.color}08,#120e06)`}}>
                                <div style={{fontSize:20}}>📜</div>
                                <div className="rb" style={{color:rarity.color,borderColor:rarity.color+"55",background:`${rarity.color}15`}}>{rarity.label}</div>
                                <div className="iin" style={{color:rarity.color}}>{item.name}</div>
                                <div className="iis">攻{item.attack} 防{item.defense} HP{item.hp}</div>
                                <div style={{color:"#f0c040",fontSize:12,margin:"6px 0"}}>售價 🪙{price}</div>
                                {onSelect&&<button className="btn btp" style={{width:"100%",fontSize:10,marginBottom:4}} onClick={onSelect}>{selectLabel}</button>}
                                <button className="btn btd" style={{width:"100%",fontSize:10}} onClick={onSell}>出售</button>
                              </div>
                            );
                          }
                          return(
                            <ItemCard
                              key={item.uid}
                              item={item}
                              onEquip={onEquip}
                              footer={(
                                <>
                                  <div style={{color:"#f0c040",fontSize:12,margin:"2px 0 0"}}>售價 🪙{price}</div>
                                  <button className="btn btd" style={{width:"100%",fontSize:10}} onClick={onSell}>出售</button>
                                </>
                              )}
                            />
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
                    {inventoryFilterOptions.map(f=>(
                      <div key={f.id} className={`wcat-btn${f.isActive?" active":""}`} onClick={f.onSelect}>{f.label}</div>
                    ))}
                  </div>
                  {filteredInv.length===0&&<div style={{color:"#4a3a20",fontStyle:"italic"}}>（空）</div>}
                  <div className="ig">
                    {inventoryItems.map(({ item, onEquip, onSelectMerc, onSell, onUse, price, rarity, selectLabel })=>{
                      if(item.type==="potion") return(
                        <div key={item.uid} className="ii">
                          <div className="iii">{item.icon}</div>
                          <div className="iin">{item.name}</div>
                          <div className="iis" style={{color:"#50a860"}}>回復 {item.heal}HP</div>
                          <div style={{color:"#f0c040",fontSize:11,marginBottom:4}}>售 🪙{price}</div>
                          <div style={{display:"flex",gap:4}}>
                            <button className="btn btm" style={{flex:1,fontSize:9,padding:"5px"}} onClick={onUse}>使用</button>
                            <button className="btn btd" style={{flex:1,fontSize:9,padding:"5px"}} onClick={onSell}>賣出</button>
                          </div>
                        </div>
                      );
                      if(item.type==="merc_scroll") {
                        return(
                          <div key={item.uid} className="ii" style={{borderColor:rarity.color+"66",background:`linear-gradient(160deg,${rarity.color}10,#120e06)`,boxShadow:rarity.glow||"none"}}>
                            <div style={{fontSize:22,filter:`drop-shadow(0 2px 6px ${rarity.color}88)`}}>📜</div>
                            <div className="rb" style={{color:rarity.color,borderColor:rarity.color+"55",background:`${rarity.color}15`}}>{rarity.label}</div>
                            <div className="iin" style={{color:rarity.color,textShadow:rarity.glow?`0 0 8px ${rarity.color}`:"none"}}>{item.name}</div>
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
                             <div style={{color:"#f0c040",fontSize:11,marginBottom:4}}>售 🪙{price}</div>
                             <div style={{display:"flex",flexDirection:"column",gap:4}}>
                               <button className="btn btp" style={{width:"100%",fontSize:10}} onClick={onSelectMerc}>
                                 {selectLabel}
                               </button>
                               <button className="btn btd" style={{width:"100%",fontSize:10}} onClick={onSell}>出售</button>
                             </div>
                          </div>
                        );
                      }
                      return(
                        <ItemCard
                          key={item.uid}
                          item={item}
                          onEquip={onEquip}
                          footer={(
                            <>
                              <div style={{color:"#f0c040",fontSize:11,margin:"1px 0 0"}}>售 🪙{price}</div>
                              <button className="btn btd" style={{width:"100%",fontSize:10}} onClick={onSell}>出售</button>
                            </>
                          )}
                        />
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
