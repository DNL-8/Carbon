import { INITIAL_WORKOUTS, calculateCoinsForWorkout, calculateProportionalXp, calculateSessionPrBonus, calculateGearBonusSummary, evaluateExercisePrUpdate, getBossForWorkout, parseExercisePrescription, calculateWorkoutBossState } from '../src/utils/rpgLogic.ts'

const cases = []
for (const workout of INITIAL_WORKOUTS) {
  for (let n = 1; n <= workout.exercises.length; n++) {
    for (const elapsed of [0, 600, 3600]) {
      const sets = workout.exercises.slice(0, n).flatMap(exercise => Array.from({length: 3}, (_, i) => ({exerciseId: exercise.id, reps: 8 + i, weightKg: 10.25 + i})))
      const bonuses = calculateGearBonusSummary()
      const totalSets = workout.exercises.reduce((sum, e) => sum + parseExercisePrescription(e.prescription).setsCount, 0)
      const completedSets = workout.exercises.slice(0,n).reduce((sum,e) => sum + Math.min(3,parseExercisePrescription(e.prescription).setsCount),0)
      const defeated = calculateWorkoutBossState(getBossForWorkout(workout).maxHp,n,workout.exercises.length,elapsed,workout.durationMinutes*60,bonuses.bossDamageBonusPercent,{completedSets,totalSets}).bossDefeated
      const {prXpBonus, prCoinsBonus} = calculateSessionPrBonus(n)
      cases.push({workout, sets, elapsed, bonuses, prs:n, expected: {
        earnedXp: calculateProportionalXp(workout.baseXp,n,workout.exercises.length,bonuses.xpBonusPercent)+prXpBonus,
        earnedCoins: calculateCoinsForWorkout(workout.baseXp,n,workout.exercises.length,defeated,bonuses.coinBonusPercent)+prCoinsBonus,
        bossDefeated:defeated,
      }})
    }
  }
}
const records = []
for (const weight of [0, 0.15, 2.55, 10.25, 50.05, 500, 2000]) {
  for (const reps of [1, 10, 30, 500]) {
    const sets = [{weightKg:weight,reps,completed:true,setIndex:1}]
    for(const prev of [null,{bestWeightKg:50,bestReps:10,bestVolumeKg:500,estimated1RmKg:65}]){
      const e = evaluateExercisePrUpdate(sets,prev)
      records.push({sets,prev,expected:[e.hasPr,{bestWeightKg:e.nextBestWeightKg,bestReps:e.nextBestReps,bestVolumeKg:e.nextBestVolumeKg,estimated1RmKg:e.nextEstimated1RmKg}]})
    }
  }
}
console.log(JSON.stringify({cases,records}))
