import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const { equipment } = JSON.parse(readFileSync(new URL('../backend/app/data/equipment.json', import.meta.url), 'utf8'))
const p = JSON.parse(readFileSync(new URL('../backend/app/data/progression.json', import.meta.url), 'utf8'))
const thresholds = { rank_cacador: p.HUNTER_RANK_TIERS.map(r => p.LEVEL_THRESHOLDS.find(x => x.level === r.minLevel).minXp), reino_murim: p.MURIM_XP_CURVE_POINTS.map(r => r.startXp) }
// Conservative: no equipment bonuses, PRs, steps, weight, or weekly volume.
// Complete normal sessions, workout_today and weekly_workouts_3 only.
const simulate = (items,thresholds,daysPerWeek,baseXp,days=730)=>{
 const milestones=Object.entries(thresholds).flatMap(([track,levels])=>levels.map((xp,i)=>({track,tier:i+1,xp}))).sort((a,b)=>a.xp-b.xp||a.track.localeCompare(b.track));
 let xp=0,coins=0,earned=0,spent=0,sessions=0,weekSessions=0,claims=0,maxDelay=0;const owned=new Set(items.filter(x=>x.acquisition==="starter").map(x=>x.id)),queue=[],seen=new Set();let lastRewardDay=null,allOptionsDay=null;
 const claimAndBuy=(day)=>{
  for(const m of milestones){const key=m.track+":"+m.tier;if(xp<m.xp||seen.has(key))continue;seen.add(key);
   const reward=items.find(x=>x.acquisition==="reward"&&x.requirement.tipo===m.track&&x.requirement.valor===m.tier);if(!reward)throw Error("Missing reward "+key);owned.add(reward.id);claims++;if(claims===15)lastRewardDay=day;
   const alternatives=items.filter(x=>x.acquisition==="purchase"&&x.requirement.tipo===m.track&&x.requirement.valor===m.tier).sort((a,b)=>a.priceCoins-b.priceCoins||a.id.localeCompare(b.id));if(alternatives.length)queue.push({item:alternatives[0],day});
  }
  while(queue.length&&coins>=queue[0].item.priceCoins){const {item,day:unlock}=queue.shift();coins-=item.priceCoins;spent+=item.priceCoins;owned.add(item.id);maxDelay=Math.max(maxDelay,day-unlock);}
  if(claims===15&&!queue.length&&allOptionsDay===null)allOptionsDay=day;
 };
 claimAndBuy(0);const first28={};
 for(let day=1;day<=days;day++){const weekday=(day-1)%7;if(weekday===0)weekSessions=0;
  // Fixed four or five training days, at least two rest days per week.
  if((daysPerWeek===4?[0,2,4,5]:[0,1,3,4,5]).includes(weekday)){sessions++;weekSessions++;const pay=Math.round(baseXp*.28)+25+25;coins+=pay;earned+=pay;xp+=baseXp+30;if(weekSessions===3){coins+=40;earned+=40;xp+=60;}}
  claimAndBuy(day);
  if(day===28)Object.assign(first28,{xp,earned,spent,balance:coins,sessions});
 }
 return {daysPerWeek,baseXp,first28,daysToAllRewards:lastRewardDay,daysToOnePurchasePerMilestone:allOptionsDay,maxPurchaseDelayDays:maxDelay,owned:owned.size,pending:queue.length,earned,spent,balance:coins,claims,sessions};
}
const cases = [simulate(equipment, thresholds, 4, 120), simulate(equipment, thresholds, 5, 120), simulate(equipment, thresholds, 4, 220), simulate(equipment, thresholds, 5, 220)]
for (const result of cases) {
  assert.equal(result.claims, 15)
  assert.equal(result.owned, 32)
  assert.equal(result.pending, 0)
  assert.ok(result.balance >= 0)
  assert.ok(result.maxPurchaseDelayDays <= 28)
}
console.log(JSON.stringify(cases, null, 2))
