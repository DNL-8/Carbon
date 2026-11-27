<script setup lang="ts">
defineProps<{ uid: string, items: { zone: string, d: string, striationD?: string, glow: string, stroke: string, highlight: string, halo: number, fillOpacity: number, striationOpacity: number, selected: boolean }[] }>()
</script>
<template>
  <g pointer-events="none">
    <g v-for="(m, idx) in items" :key="idx">
      <path v-if="m.halo > .02" :d="m.d" :fill="m.glow" :opacity="m.halo" :filter="`url(#heat-glow-${uid})`" />
      <path :d="m.d" :fill="`url(#heat-zone-${m.zone}-${uid})`" :stroke="m.selected ? '#FAFAFA' : m.stroke" :stroke-width="m.selected ? 1.1 : .7" :opacity="m.fillOpacity" />
      <path v-if="m.striationD" :d="m.striationD" fill="none" :stroke="m.highlight" stroke-width=".55" stroke-linecap="round" :opacity="m.striationOpacity" />
    </g>
  </g>
</template>
