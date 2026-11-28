import { EQUIPMENT_CATALOG } from '../../src/utils/equipmentCatalog.ts'

// Original Carbon vector silhouettes, shared by cards and future avatar layers.
export const equipmentShapes = {
  "hood": [
    "M20 64 18 38Q20 10 48 8Q76 10 78 38L76 64 61 83H35Z",
    "M28 43Q48 25 68 43L64 65H32Z",
    "M25 70 36 81M71 70 60 81"
  ],
  "band": [
    "M13 35Q48 25 83 35L81 51Q48 43 15 51Z M72 48 88 60 76 62 79 73 60 49Z",
    "M41 34 48 30 55 34 53 43 43 43Z",
    "M18 42 36 38M60 38 78 42"
  ],
  "visor": [
    "M12 31 26 23H70L84 31 80 54 68 64H28L16 54Z",
    "M21 37 31 32H65L75 37 71 50H25Z",
    "M17 29 12 23M79 29 84 23M34 55H62"
  ],
  "lens": [
    "M20 24H76L82 48 74 69H22L14 48Z",
    "M48 45a17 17 0 1 0 34 0a17 17 0 1 0 -34 0Z",
    "M23 38H42M23 48H37M65 36V54"
  ],
  "diadem": [
    "M14 60 20 32 34 42 48 14 62 42 76 32 82 60 67 69H29Z",
    "M38 47 48 29 58 47 48 61Z",
    "M24 55 36 58M60 58 72 55"
  ],
  "helm": [
    "M17 29 33 12H63L79 29 86 46 77 76 62 84H34L19 76 10 46Z",
    "M20 43 32 36H64L76 43 70 57H26Z",
    "M23 63 34 72M73 63 62 72M48 15V31"
  ],
  "horn": [
    "M20 32 9 8 31 20 40 28H56L65 20 87 8 76 32 83 58 69 82H27L13 58Z",
    "M24 43 40 50 48 42 56 50 72 43 67 60H29Z",
    "M30 67 40 75M66 67 56 75"
  ],
  "mask": [
    "M20 24 48 12 76 24 82 45 70 71 48 87 26 71 14 45Z",
    "M24 42 41 37 45 49 32 55Z M72 42 55 37 51 49 64 55Z",
    "M48 20V35M42 63 48 73 54 63"
  ],
  "crown": [
    "M15 64 11 24 32 39 48 9 64 39 85 24 81 64 68 73H28Z",
    "M38 50 48 34 58 50 48 60Z",
    "M24 63H72M18 31 28 43M78 31 68 43"
  ],
  "halo": [
    "M48 8 81 25 90 48 81 71 48 88 15 71 6 48 15 25Z M48 23 24 36 20 48 24 60 48 73 72 60 76 48 72 36Z",
    "M48 34 62 48 48 62 34 48Z",
    "M48 10V20M10 48H20M76 48H86M48 76V86"
  ],
  "tunic": [
    "M29 17 42 12 48 22 54 12 67 17 88 33 74 51 65 44 70 86H26L31 44 22 51 8 33Z",
    "M37 21 48 37 59 21 54 53H42Z",
    "M30 63H66M33 73H63"
  ],
  "robe": [
    "M28 15 39 10 48 22 57 10 68 15 90 40 71 54 65 45 79 88 49 79 17 88 31 45 25 54 6 40Z",
    "M39 15 63 41 34 68 29 60 52 38 31 21Z",
    "M28 70H68M48 78V88"
  ],
  "vest": [
    "M29 13 39 10 48 21 57 10 67 13 76 28 69 48 73 85H23L27 48 20 28Z",
    "M31 30H65V57H31Z M37 64H59V76H37Z",
    "M48 24V83M24 42H32M64 42H72"
  ],
  "plate": [
    "M14 25 32 12H64L82 25 91 43 73 54 67 84H29L23 54 5 43Z",
    "M28 28 48 21 68 28 64 54 48 66 32 54Z",
    "M28 70H68M17 32 27 40M79 32 69 40"
  ],
  "exo": [
    "M7 29 30 10H66L89 29 94 47 73 57 68 87H28L23 57 2 47Z",
    "M31 27 48 18 65 27 69 49 48 66 27 49Z M39 72H57V82H39Z",
    "M13 37H27M69 37H83M48 22V57"
  ],
  "coat": [
    "M28 14 40 10 48 22 56 10 68 14 87 32 76 57 64 48 78 90 52 81 48 61 44 81 18 90 32 48 20 57 9 32Z",
    "M40 16 48 35 56 16 66 37 48 51 30 37Z",
    "M48 51V61M28 69 43 65M68 69 53 65"
  ],
  "cloak": [
    "M30 11Q48 18 66 11L82 87 48 79 14 87Z",
    "M30 17 48 28 66 17 58 34H38Z",
    "M30 34 24 77M66 34 72 77M48 31V72"
  ],
  "coatTail": [
    "M26 10H70L87 86 58 78 48 55 38 78 9 86Z",
    "M30 12 48 33 66 12 59 43H37Z",
    "M23 40 17 74M73 40 79 74"
  ],
  "veil": [
    "M32 10 64 10 82 58 69 89 48 73 27 89 14 58Z",
    "M33 17 48 25 63 17 70 31 48 43 26 31Z",
    "M48 45V69M26 46 37 75M70 46 59 75"
  ],
  "banner": [
    "M24 10H72L78 83 48 72 18 83Z",
    "M30 17H66V30H30Z M36 43 48 34 60 43 48 57Z",
    "M24 66H72M48 57V70"
  ],
  "wings": [
    "M34 18 48 31 62 18 91 9 82 37 94 51 70 56 78 76 53 62 48 85 43 62 18 76 26 56 2 51 14 37 5 9Z",
    "M28 25 48 40 68 25 61 47 48 58 35 47Z",
    "M10 20 35 44M86 20 61 44M16 51 36 50M80 51 60 50"
  ],
  "split": [
    "M30 10H66L91 86 59 72 48 88 37 72 5 86Z",
    "M30 16 48 26 66 16 61 37H35Z",
    "M23 39 14 74M73 39 82 74M48 40V76"
  ],
  "ribbon": [
    "M32 12H64L67 39 84 53 68 91 53 78 67 55 48 43 29 55 43 78 28 91 12 53 29 39Z",
    "M34 16H62V32H34Z",
    "M28 46 17 54M68 46 79 54"
  ],
  "wood": [
    "M42 67V17L48 6 54 17V67H65V75H54V91H42V75H31V67Z",
    "M44 16H52V64H44Z",
    "M42 79H54M42 85H54"
  ],
  "dagger": [
    "M40 63 29 28 48 7 67 28 56 63H70V72H55V90H41V72H26V63Z",
    "M48 17 57 29 48 59 39 29Z",
    "M41 78H55M41 84H55"
  ],
  "sword": [
    "M38 65 38 18 48 4 58 18 58 65 70 60 74 69 56 76V92H40V76L22 69 26 60Z",
    "M48 11 53 23V62H43V23Z",
    "M40 81H56M40 87H56"
  ],
  "sabre": [
    "M39 66Q27 35 55 5L66 12Q49 37 56 66L70 60 74 70 56 76V92H40V76L25 70 29 61Z",
    "M53 17Q39 37 47 60L52 59Q44 37 58 18Z",
    "M40 80H56M40 87H56"
  ],
  "spear": [
    "M43 95V42L30 31 48 4 66 31 53 42V95Z",
    "M48 13 58 30 48 39 38 30Z",
    "M43 49H53M43 57H53"
  ],
  "staff": [
    "M43 95V40L28 26 34 10 48 4 62 10 68 26 53 40V95Z",
    "M48 11 61 23 48 35 35 23Z",
    "M43 50H53M43 83H53"
  ],
  "twin": [
    "M15 65 12 25 30 7 39 29 31 65 42 62 44 70 30 75 28 92H18L18 75 5 70 7 62Z M65 65 57 29 66 7 84 25 81 65 89 62 91 70 78 75 78 92H68L66 75 52 70 54 62Z",
    "M23 26 30 16 32 31 26 59H22Z M73 26 66 16 64 31 70 59H74Z",
    "M18 80H30M66 80H78"
  ],
  "spirit": [
    "M39 66 32 24 48 3 64 24 57 66 72 61 75 71 55 78V92H41V78L21 71 24 61Z",
    "M48 11 57 26 48 63 39 26Z",
    "M18 28 23 20M78 28 73 20M48 81V89"
  ],
  "hammer": [
    "M43 94V39H13L8 27 13 12H83L88 27 83 39H53V94Z",
    "M20 17H76V33H20Z",
    "M30 18V33M66 18V33M43 80H53"
  ],
  "fan": [
    "M43 94V61L8 42 12 22Q48 -2 84 22L88 42 53 61V94Z",
    "M18 27Q48 8 78 27L80 39 48 56 16 39Z",
    "M48 56V18M48 56 29 22M48 56 67 22"
  ]
} as const
export type EquipmentFamily = keyof typeof equipmentShapes

export const equipmentArt = {
  "elmo_couro_novato": {
    "family": "hood",
    "detail": 0
  },
  "elmo_faixa_taiyuan": {
    "family": "band",
    "detail": 1
  },
  "elmo_visor_rank_f": {
    "family": "visor",
    "detail": 2
  },
  "elmo_bandana_novico": {
    "family": "band",
    "detail": 3
  },
  "elmo_mercador_vidente": {
    "family": "lens",
    "detail": 4
  },
  "elmo_tiara_qi_basico": {
    "family": "diadem",
    "detail": 5
  },
  "elmo_capacete_rank_d": {
    "family": "helm",
    "detail": 6
  },
  "elmo_sabio_abissal": {
    "family": "diadem",
    "detail": 7
  },
  "elmo_presa_carmesim": {
    "family": "horn",
    "detail": 8
  },
  "elmo_mascara_pico": {
    "family": "mask",
    "detail": 9
  },
  "elmo_monarca": {
    "family": "crown",
    "detail": 10
  },
  "elmo_coroa_rei_fogo": {
    "family": "diadem",
    "detail": 11
  },
  "elmo_diadema_vida_morte": {
    "family": "halo",
    "detail": 12
  },
  "elmo_v2_visor_de_reconhecimento": {
    "family": "visor",
    "detail": 13
  },
  "elmo_v2_capacete_de_cerco": {
    "family": "helm",
    "detail": 14
  },
  "elmo_v2_mascara_de_carbono": {
    "family": "mask",
    "detail": 15
  },
  "elmo_v2_lente_de_ambar": {
    "family": "lens",
    "detail": 16
  },
  "elmo_v2_diadema_de_circuitos": {
    "family": "diadem",
    "detail": 17
  },
  "elmo_v2_capacete_eclipse": {
    "family": "helm",
    "detail": 18
  },
  "elmo_v2_visor_de_prisma": {
    "family": "visor",
    "detail": 19
  },
  "elmo_v2_mascara_do_horizonte_negro": {
    "family": "mask",
    "detail": 20
  },
  "elmo_v2_faixa_das_folhas": {
    "family": "band",
    "detail": 21
  },
  "elmo_v2_tiara_de_bronze_solar": {
    "family": "diadem",
    "detail": 22
  },
  "elmo_v2_mascara_da_garca_rubra": {
    "family": "mask",
    "detail": 23
  },
  "elmo_v2_coroa_do_patio_celeste": {
    "family": "crown",
    "detail": 24
  },
  "elmo_v2_aureola_de_jade_branco": {
    "family": "halo",
    "detail": 25
  },
  "armadura_tunica_couro": {
    "family": "tunic",
    "detail": 0
  },
  "armadura_dobok_jin": {
    "family": "robe",
    "detail": 1
  },
  "armadura_colete_rank_e": {
    "family": "vest",
    "detail": 2
  },
  "armadura_placa_aco": {
    "family": "plate",
    "detail": 3
  },
  "armadura_traje_2_classe": {
    "family": "robe",
    "detail": 4
  },
  "armadura_guarda_taiyuan": {
    "family": "plate",
    "detail": 5
  },
  "armadura_liga_cacador_c": {
    "family": "plate",
    "detail": 6
  },
  "armadura_couraca_rubra": {
    "family": "plate",
    "detail": 7
  },
  "armadura_manto_alquimista": {
    "family": "robe",
    "detail": 8
  },
  "armadura_manto_pico_supremo": {
    "family": "robe",
    "detail": 9
  },
  "armadura_monarca": {
    "family": "exo",
    "detail": 10
  },
  "armadura_dragao_rank_s": {
    "family": "exo",
    "detail": 11
  },
  "armadura_celestial_vida_morte": {
    "family": "robe",
    "detail": 12
  },
  "armadura_v2_colete_de_patrulha": {
    "family": "vest",
    "detail": 13
  },
  "armadura_v2_couraca_de_ambar": {
    "family": "plate",
    "detail": 14
  },
  "armadura_v2_peitoral_de_cerco": {
    "family": "plate",
    "detail": 15
  },
  "armadura_v2_casaco_de_runas": {
    "family": "coat",
    "detail": 16
  },
  "armadura_v2_armadura_eclipse_de_campo": {
    "family": "plate",
    "detail": 17
  },
  "armadura_v2_exotraje_de_ambar_negro": {
    "family": "exo",
    "detail": 18
  },
  "armadura_v2_dobok_das_folhas": {
    "family": "robe",
    "detail": 19
  },
  "armadura_v2_veste_de_cobre_solar": {
    "family": "robe",
    "detail": 20
  },
  "armadura_v2_tunica_da_rota_de_seda": {
    "family": "tunic",
    "detail": 21
  },
  "armadura_v2_couraca_da_garca_rubra": {
    "family": "plate",
    "detail": 22
  },
  "armadura_v2_veste_do_ceu_de_jade": {
    "family": "robe",
    "detail": 23
  },
  "armadura_v2_traje_do_sol_de_bronze": {
    "family": "robe",
    "detail": 24
  },
  "armadura_v2_manto_de_jade_imortal": {
    "family": "coat",
    "detail": 25
  },
  "capa_pano_simples": {
    "family": "cloak",
    "detail": 0
  },
  "capa_manto_taiyuan": {
    "family": "cloak",
    "detail": 1
  },
  "capa_sobretudo_cacador": {
    "family": "coatTail",
    "detail": 2
  },
  "capa_sabio_astral": {
    "family": "veil",
    "detail": 3
  },
  "capa_estandarte_rank_d": {
    "family": "banner",
    "detail": 4
  },
  "capa_flama_iniciante": {
    "family": "cloak",
    "detail": 5
  },
  "capa_mercador_sombrio": {
    "family": "coatTail",
    "detail": 6
  },
  "capa_asa_carmesim": {
    "family": "wings",
    "detail": 7
  },
  "capa_elite_rank_b": {
    "family": "banner",
    "detail": 8
  },
  "capa_chama_sul": {
    "family": "cloak",
    "detail": 9
  },
  "capa_monarca": {
    "family": "split",
    "detail": 10
  },
  "capa_asas_chama_eterna": {
    "family": "wings",
    "detail": 11
  },
  "capa_veu_espada_invisivel": {
    "family": "veil",
    "detail": 12
  },
  "capa_v2_manto_de_patrulha": {
    "family": "cloak",
    "detail": 13
  },
  "capa_v2_sobretudo_do_explorador": {
    "family": "coatTail",
    "detail": 14
  },
  "capa_v2_estandarte_de_cerco": {
    "family": "banner",
    "detail": 15
  },
  "capa_v2_veu_de_circuitos": {
    "family": "veil",
    "detail": 16
  },
  "capa_v2_manto_eclipse_de_campo": {
    "family": "split",
    "detail": 17
  },
  "capa_v2_capa_de_ambar_negro": {
    "family": "cloak",
    "detail": 18
  },
  "capa_v2_manto_das_folhas": {
    "family": "cloak",
    "detail": 19
  },
  "capa_v2_faixa_de_seda_solar": {
    "family": "ribbon",
    "detail": 20
  },
  "capa_v2_veu_do_mercado_celeste": {
    "family": "veil",
    "detail": 21
  },
  "capa_v2_asas_da_garca_rubra": {
    "family": "wings",
    "detail": 22
  },
  "capa_v2_capa_do_ceu_de_jade": {
    "family": "split",
    "detail": 23
  },
  "capa_v2_asas_do_sol_de_bronze": {
    "family": "wings",
    "detail": 24
  },
  "capa_v2_veu_de_jade_imortal": {
    "family": "veil",
    "detail": 25
  },
  "arma_bastao_treino": {
    "family": "wood",
    "detail": 0
  },
  "arma_faca_incursao_f": {
    "family": "dagger",
    "detail": 1
  },
  "arma_espada_ferro_jin": {
    "family": "sword",
    "detail": 2
  },
  "arma_adaga_mercador": {
    "family": "dagger",
    "detail": 3
  },
  "arma_lanca_1_classe": {
    "family": "spear",
    "detail": 4
  },
  "arma_katana_rank_c": {
    "family": "sabre",
    "detail": 5
  },
  "arma_cajado_abissal": {
    "family": "staff",
    "detail": 6
  },
  "arma_espada_carmesim": {
    "family": "sabre",
    "detail": 7
  },
  "arma_espada_qi_pico": {
    "family": "sword",
    "detail": 8
  },
  "arma_espada_rank_a_taekyung": {
    "family": "sword",
    "detail": 9
  },
  "arma_lanca_rei_fogo": {
    "family": "spear",
    "detail": 10
  },
  "arma_presas_monarca": {
    "family": "twin",
    "detail": 11
  },
  "arma_espada_invisivel": {
    "family": "spirit",
    "detail": 12
  },
  "arma_v2_adaga_de_patrulha": {
    "family": "dagger",
    "detail": 13
  },
  "arma_v2_lamina_do_explorador": {
    "family": "sword",
    "detail": 14
  },
  "arma_v2_martelo_de_cerco": {
    "family": "hammer",
    "detail": 15
  },
  "arma_v2_cajado_de_circuitos": {
    "family": "staff",
    "detail": 16
  },
  "arma_v2_sabre_eclipse": {
    "family": "sabre",
    "detail": 17
  },
  "arma_v2_espada_de_prisma": {
    "family": "sword",
    "detail": 18
  },
  "arma_v2_laminas_gemeas_de_ambar": {
    "family": "twin",
    "detail": 19
  },
  "arma_v2_bastao_das_folhas": {
    "family": "wood",
    "detail": 20
  },
  "arma_v2_lanca_de_cobre_solar": {
    "family": "spear",
    "detail": 21
  },
  "arma_v2_leque_de_seda_dourada": {
    "family": "fan",
    "detail": 22
  },
  "arma_v2_sabre_da_garca_rubra": {
    "family": "sabre",
    "detail": 23
  },
  "arma_v2_espada_do_ceu_de_jade": {
    "family": "sword",
    "detail": 24
  },
  "arma_v2_lamina_de_jade_imortal": {
    "family": "spirit",
    "detail": 25
  }
} satisfies Record<string, { family: EquipmentFamily; detail: number }>
const artById: Record<string, { family: EquipmentFamily; detail: number }> = equipmentArt
const itemsById = new Map(EQUIPMENT_CATALOG.map(item => [item.id, item]))

export function getEquipmentArt(id: string) {
  const item = itemsById.get(id)
  const art = artById[id]
  if (!item || !art) return null
  return { ...art, accent: item.accentHex, trim: item.secondaryHex, rarity: item.rarityKey, tier: item.requirement.valor, track: item.requirement.tipo }
}
