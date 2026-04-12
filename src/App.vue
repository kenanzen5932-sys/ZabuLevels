<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from './lib/supabase.js'

// State
const loading = ref(true)
const userProfile = ref(null)
const levelInfo = ref(null)
const allLevels = ref([])
const error = ref(null)

// URL'den user_id al
const userId = new URLSearchParams(window.location.search).get('user_id')

// Level grupları (10'ar aralık)
const levelRanges = computed(() => {
  if (!allLevels.value.length) return []
  const ranges = []
  for (let i = 0; i < 10; i++) {
    const start = i * 10 + 1
    const end = Math.min(start + 9, 100)
    const label = `${start}~${end}`
    const levelsInRange = allLevels.value.filter(l => l.level >= start && l.level <= end)
    const icon = levelsInRange[0]?.icon_url || null
    const color = levelsInRange[0]?.color || '#FFB800'
    ranges.push({ start, end, label, icon, color })
  }
  return ranges
})

// Aktif aralık (kullanıcının seviyesine göre)
const activeRangeIndex = computed(() => {
  const lvl = levelInfo.value?.level || 1
  return Math.floor((lvl - 1) / 10)
})

// Progress hesapla
const progressPercent = computed(() => {
  if (!levelInfo.value) return 0
  const current = levelInfo.value.exp || 0
  const currentLvlExp = levelInfo.value.current_level_exp || 0
  const nextLvlExp = levelInfo.value.next_level_exp || 1
  if (nextLvlExp <= currentLvlExp) return 100
  return Math.min(((current - currentLvlExp) / (nextLvlExp - currentLvlExp)) * 100, 100)
})

// Veri çek
async function loadData() {
  if (!userId) {
    error.value = 'Kullanıcı bulunamadı'
    loading.value = false
    return
  }

  try {
    // Flutter'dan token alma (JS Bridge)
    let token = null
    if (window.flutter_inappwebview) {
      const auth = await window.flutter_inappwebview.callHandler('getSupabaseAuth')
      if (auth?.token) {
        token = auth.token
        await supabase.auth.setSession({ access_token: token, refresh_token: '' })
      }
    }

    // Paralel veri çekimi
    const [profileRes, levelRes, allLevelsRes] = await Promise.all([
      supabase.from('profiles').select('username, avatar_url, wealth_level, wealth_exp').eq('id', userId).single(),
      supabase.rpc('get_wealth_level_info', { p_user_id: userId }),
      supabase.rpc('get_all_wealth_levels'),
    ])

    if (profileRes.data) userProfile.value = profileRes.data
    if (levelRes.data) levelInfo.value = levelRes.data
    if (allLevelsRes.data) allLevels.value = allLevelsRes.data

  } catch (e) {
    console.error('Veri yükleme hatası:', e)
    error.value = 'Veriler yüklenemedi'
  }

  loading.value = false
}

function goBack() {
  if (window.flutter_inappwebview) {
    window.flutter_inappwebview.callHandler('H5Message', 'close_h5')
  }
}

function formatNumber(n) {
  if (!n) return '0'
  return n.toLocaleString('tr-TR')
}

onMounted(loadData)
</script>

<template>
  <div class="app">
    <!-- Loading -->
    <div v-if="loading" class="loading-screen">
      <div class="loading-spinner"></div>
      <p>Yükleniyor...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error-screen">
      <p>{{ error }}</p>
    </div>

    <!-- Main Content -->
    <div v-else class="content">
      <!-- Header -->
      <div class="header">
        <button class="back-btn" @click="goBack">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <h1 class="title">Seviye</h1>
        <div class="info-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="white" stroke-width="1.5"/>
            <path d="M12 16V12M12 8H12.01" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
      </div>

      <!-- Avatar -->
      <div class="avatar-section">
        <div class="avatar-ring">
          <img
            v-if="userProfile?.avatar_url"
            :src="userProfile.avatar_url"
            alt="Avatar"
            class="avatar-img"
          />
          <div v-else class="avatar-placeholder">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
        </div>
        <p class="username">{{ userProfile?.username || 'Kullanıcı' }}</p>
      </div>

      <!-- Level Timeline (Yatay kaydırılabilir) -->
      <div class="timeline-section">
        <div class="timeline-curve"></div>
        <div class="timeline-scroll" ref="timelineRef">
          <div
            v-for="(range, idx) in levelRanges"
            :key="idx"
            class="timeline-item"
            :class="{ active: idx === activeRangeIndex, past: idx < activeRangeIndex, future: idx > activeRangeIndex }"
          >
            <span class="range-label">LV({{ range.label }})</span>
            <div class="range-badge" :style="{ background: range.color }">
              <img v-if="range.icon" :src="range.icon" class="range-icon" />
              <span class="range-text">LV.{{ idx === activeRangeIndex ? (levelInfo?.level || 1) : range.start }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Level Info Card -->
      <div class="level-card">
        <div class="level-card-inner">
          <!-- Level Number + EXP -->
          <div class="level-top">
            <div class="level-number">
              <span class="lv-label">Lv.</span>
              <span class="lv-value">{{ levelInfo?.level || 1 }}</span>
            </div>
            <div class="exp-counter">
              {{ formatNumber(levelInfo?.exp) }}/{{ formatNumber(levelInfo?.next_level_exp) }}
            </div>
          </div>

          <!-- Remaining EXP -->
          <div class="remaining">
            <span class="remaining-value">{{ formatNumber(levelInfo?.remaining_exp) }}</span>
            ile seviye atla
          </div>

          <!-- Progress Bar -->
          <div class="progress-bar-container">
            <div class="progress-bar-bg">
              <div
                class="progress-bar-fill"
                :style="{ width: progressPercent + '%' }"
              ></div>
            </div>
            <div
              class="progress-indicator"
              :style="{ left: Math.min(progressPercent, 95) + '%' }"
            ></div>
          </div>
        </div>
      </div>

      <!-- Level Title -->
      <div class="level-title-section" v-if="levelInfo?.title">
        <div class="title-badge">
          <span>🏆</span>
          <span>{{ levelInfo.title }}</span>
        </div>
      </div>

      <!-- EXP info -->
      <div class="exp-info">
        <div class="exp-info-item">
          <span class="exp-info-label">EXP Kazanma</span>
          <span class="exp-info-value">1.000 Coin = 1 EXP</span>
        </div>
        <div class="exp-info-item">
          <span class="exp-info-label">Toplam EXP</span>
          <span class="exp-info-value">{{ formatNumber(levelInfo?.exp) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', sans-serif;
  background: #0A0A1A;
  color: #fff;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}

.app {
  min-height: 100vh;
  background: linear-gradient(180deg, #0A0A1A 0%, #0D1025 40%, #0A0A1A 100%);
}

/* ─── Loading ─── */
.loading-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  gap: 16px;
  color: #888;
}
.loading-spinner {
  width: 32px; height: 32px;
  border: 3px solid #333;
  border-top-color: #FFB800;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.error-screen {
  display: flex; align-items: center; justify-content: center;
  min-height: 100vh; color: #ff4444;
}

/* ─── Header ─── */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 56px 16px 16px;
}
.back-btn, .info-btn {
  background: none; border: none;
  cursor: pointer; padding: 8px;
  opacity: 0.8;
}
.title {
  font-size: 18px; font-weight: 700;
}

/* ─── Avatar ─── */
.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
}
.avatar-ring {
  width: 90px; height: 90px;
  border-radius: 50%;
  border: 3px solid rgba(255, 184, 0, 0.5);
  padding: 3px;
  display: flex; align-items: center; justify-content: center;
}
.avatar-img {
  width: 100%; height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
.avatar-placeholder {
  width: 100%; height: 100%;
  border-radius: 50%;
  background: #222;
  display: flex; align-items: center; justify-content: center;
}
.username {
  margin-top: 12px;
  font-size: 18px; font-weight: 700;
}

/* ─── Timeline ─── */
.timeline-section {
  position: relative;
  padding: 0 0 20px;
}
.timeline-curve {
  position: absolute;
  top: 50%;
  left: 10%; right: 10%;
  height: 2px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 50%;
  transform: translateY(-50%);
}
.timeline-scroll {
  display: flex;
  overflow-x: auto;
  gap: 8px;
  padding: 16px;
  scroll-snap-type: x mandatory;
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.timeline-scroll::-webkit-scrollbar { display: none; }

.timeline-item {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  scroll-snap-align: center;
  opacity: 0.4;
  transform: scale(0.85);
  transition: all 0.3s ease;
}
.timeline-item.active {
  opacity: 1;
  transform: scale(1.1);
}
.timeline-item.past {
  opacity: 0.6;
  transform: scale(0.9);
}
.range-label {
  font-size: 11px;
  color: #888;
  white-space: nowrap;
}
.range-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 14px;
  font-size: 11px;
  font-weight: 800;
  color: #fff;
  white-space: nowrap;
}
.range-icon {
  width: 16px; height: 16px;
  object-fit: contain;
}
.range-text {
  font-size: 11px;
}

/* ─── Level Card ─── */
.level-card {
  padding: 0 16px;
  margin-top: 8px;
}
.level-card-inner {
  background: linear-gradient(135deg, rgba(30,30,50,0.9), rgba(20,20,35,0.95));
  border: 1px solid rgba(255,184,0,0.15);
  border-radius: 16px;
  padding: 20px;
  backdrop-filter: blur(10px);
}
.level-top {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 8px;
}
.level-number {
  display: flex;
  align-items: baseline;
}
.lv-label {
  font-size: 20px;
  font-weight: 600;
  color: #888;
  margin-right: 4px;
}
.lv-value {
  font-size: 48px;
  font-weight: 900;
  line-height: 1;
  background: linear-gradient(135deg, #FFB800, #FF8C00);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.exp-counter {
  font-size: 13px;
  color: #888;
  background: rgba(255,255,255,0.06);
  padding: 4px 12px;
  border-radius: 20px;
  margin-bottom: 8px;
}

.remaining {
  font-size: 14px;
  color: #888;
  margin-bottom: 16px;
}
.remaining-value {
  color: #FFB800;
  font-weight: 700;
}

/* ─── Progress Bar ─── */
.progress-bar-container {
  position: relative;
  height: 20px;
}
.progress-bar-bg {
  width: 100%;
  height: 8px;
  background: rgba(255,255,255,0.08);
  border-radius: 4px;
  overflow: hidden;
  margin-top: 6px;
}
.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #FFB800, #FF6B00);
  border-radius: 4px;
  transition: width 0.8s ease;
}
.progress-indicator {
  position: absolute;
  top: 0;
  width: 16px; height: 16px;
  background: #fff;
  border: 2px solid #FFB800;
  border-radius: 50%;
  transform: translateX(-50%);
  transition: left 0.8s ease;
  box-shadow: 0 0 8px rgba(255,184,0,0.4);
}

/* ─── Level Title ─── */
.level-title-section {
  display: flex;
  justify-content: center;
  padding: 20px 16px 0;
}
.title-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  background: rgba(255,184,0,0.1);
  border: 1px solid rgba(255,184,0,0.2);
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  color: #FFB800;
}

/* ─── EXP Info ─── */
.exp-info {
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.exp-info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255,255,255,0.03);
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.05);
}
.exp-info-label {
  font-size: 13px;
  color: #888;
}
.exp-info-value {
  font-size: 13px;
  color: #FFB800;
  font-weight: 600;
}
</style>
