<script setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue'
import { supabase } from './lib/supabase.js'

// State
const loading = ref(true)
const userProfile = ref(null)
const levelInfo = ref(null)
const allLevels = ref([])
const error = ref(null)
const timelineItemRefs = ref([])
const showInfoPopup = ref(false)
const showRewardsPopup = ref(false)
const selectedRewardsLevel = ref(null)
const rewardsByLevel = ref({})

// Auth (Artık URL'den DEĞİL, Flutter Bridge'den geliyor)
let userId = null

// Progress hesapla
const progressPercent = computed(() => {
  if (!levelInfo.value) return 0
  const current = levelInfo.value.exp || 0
  const currentLvlExp = levelInfo.value.current_level_exp || 0
  const nextLvlExp = levelInfo.value.next_level_exp || 1
  if (nextLvlExp <= currentLvlExp) return 100
  return Math.min(((current - currentLvlExp) / (nextLvlExp - currentLvlExp)) * 100, 100)
})

const activeLevelIndex = computed(() => {
  const lvl = levelInfo.value?.level || 1
  return allLevels.value.findIndex(l => l.level === lvl)
})

// Auto-scroll watch
watch([activeLevelIndex, timelineItemRefs], async () => {
  await nextTick()
  if (activeLevelIndex.value >= 0 && timelineItemRefs.value[activeLevelIndex.value]) {
    timelineItemRefs.value[activeLevelIndex.value].scrollIntoView({
      behavior: 'auto',
      inline: 'start',
      block: 'nearest'
    })
  }
}, { immediate: true, deep: true })

// Veri çek
async function loadData() {
  // Güvenlik Kilidi: Sadece Flutter InAppWebView içinden çalışabilir
  if (!window.flutter_inappwebview) {
    error.value = '🔒 Güvenlik İhlali: Lütfen bu etkinliği/sayfayı Zabu Uygulaması içinden açın.'
    loading.value = false
    return
  }

  try {
    // Flutter JS Bridge'den güvenli token ve UUID al
    const auth = await window.flutter_inappwebview.callHandler('getSupabaseAuth')
    
    if (auth && auth.uuid) {
      userId = auth.uuid
      if (auth.token) {
        await supabase.auth.setSession({ access_token: auth.token, refresh_token: auth.token })
      }
    } else {
      error.value = 'Oturum bilgileri alınamadı. Lütfen uygulamaya tekrar giriş yapın.'
      loading.value = false
      return
    }

    // Paralel veri çekimi
    const [profileRes, levelRes, allLevelsRes, rewardsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('username, avatar_url, wealth_level, wealth_exp')
        .eq('id', userId)
        .single(),
      supabase.rpc('get_wealth_level_info', { p_user_id: userId }),
      supabase.from('wealth_levels').select('*').order('level'),
      supabase.from('wealth_level_rewards').select('*, store_items(name, thumbnail_url)'),
    ])

    if (profileRes.error) console.error('Profil hatası:', JSON.stringify(profileRes.error))
    if (levelRes.error) console.error('Level hatası:', JSON.stringify(levelRes.error))
    if (allLevelsRes.error) console.error('AllLevels hatası:', JSON.stringify(allLevelsRes.error))

    if (profileRes.data) userProfile.value = profileRes.data
    if (levelRes.data) levelInfo.value = levelRes.data
    if (allLevelsRes.data) allLevels.value = allLevelsRes.data
    
    if (rewardsRes.data) {
      const map = {}
      rewardsRes.data.forEach(r => {
        if (!map[r.level]) map[r.level] = []
        map[r.level].push(r)
      })
      
      for (const lvl in map) {
        map[lvl].sort((a, b) => {
          if (a.reward_type === 'coin' && b.reward_type !== 'coin') return -1;
          if (a.reward_type !== 'coin' && b.reward_type === 'coin') return 1;
          return 0;
        });
      }
      
      rewardsByLevel.value = map
    }

  } catch (e) {
    console.error('Veri yükleme hatası:', e)
    error.value = 'Veriler yüklenemedi: ' + e.message
  }

  loading.value = false
}

function goBack() {
  if (window.flutter_inappwebview) {
    window.flutter_inappwebview.callHandler('H5Message', 'close_h5')
  } else {
    window.history.back()
  }
}

function formatNumber(n) {
  if (!n && n !== 0) return '0'
  return Number(n).toLocaleString('tr-TR')
}

function getRangeColor(lvl) {
  const colors = ['#8B8B8B','#4FC3F7','#66BB6A','#FFA726','#EF5350','#AB47BC','#EC407A','#FFD54F','#FF7043','#E040FB']
  const idx = Math.min(Math.floor((lvl - 1) / 10), 9)
  return colors[idx]
}

function openRewards(lvl) {
  if (rewardsByLevel.value[lvl] && rewardsByLevel.value[lvl].length > 0) {
    selectedRewardsLevel.value = lvl
    showRewardsPopup.value = true
  }
}

onMounted(loadData)
</script>

<template>
  <div class="app">
    <!-- Loading (Flutter native overlay bekletiliyor, burada içi boş bırakıldı) -->
    <div v-if="loading"></div>

    <!-- Error -->
    <div v-else-if="error" class="error-screen">
      <p>😕 {{ error }}</p>
    </div>

    <!-- Main Content -->
    <div v-else class="content">

      <!-- Header -->
      <div class="header">
        <button class="back-btn" @click="goBack">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="#1A1A2E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <h1 class="title">Seviye</h1>
        <button class="info-btn" @click="showInfoPopup = true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#1A1A2E" stroke-width="2"/>
            <path d="M12 16v-4" stroke="#1A1A2E" stroke-width="2" stroke-linecap="round"/>
            <circle cx="12" cy="8" r="1.5" fill="#1A1A2E"/>
          </svg>
        </button>
      </div>

      <!-- Popup Overlay (Nasıl Kazanılır) -->
      <div class="overlay" :class="{ active: showInfoPopup }" @click="showInfoPopup = false">
        <div class="bottom-sheet" :class="{ active: showInfoPopup }" @click.stop>
          <div class="sheet-header">
            <h3>Nasıl Seviye Atlarım?</h3>
            <button class="close-sheet" @click="showInfoPopup = false">✕</button>
          </div>
          <div class="sheet-body">
            <div class="info-card" style="margin: 0; box-shadow: none; border: 1px solid #F0F0F5;">
              <div class="info-icon">🎁</div>
              <div class="info-content">
                <div class="info-title">EXP Nasıl Kazanılır?</div>
                <div class="info-desc">Odada <strong>500 Coin</strong> harcayarak <strong>1 EXP</strong> kazan. Seviye atladıkça odadaki rozetlerin de gelişir!</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Popup Overlay (Ödüller) -->
      <div class="overlay" :class="{ active: showRewardsPopup }" @click="showRewardsPopup = false">
        <div class="bottom-sheet" :class="{ active: showRewardsPopup }" @click.stop>
          <div class="sheet-header">
            <h3>Seviye {{ selectedRewardsLevel }} Ödülleri</h3>
            <button class="close-sheet" @click="showRewardsPopup = false">✕</button>
          </div>
          <div class="sheet-body">
            <p style="font-size: 13px; color: #666; margin-bottom: 16px; text-align: center;">Bu seviyeye ulaştığında aşağıdaki ödüller çantana (veya cüzdanına) otomatik olarak eklenir!</p>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div v-for="r in rewardsByLevel[selectedRewardsLevel]" :key="r.id" style="display: flex; align-items: center; gap: 16px; background: #f9f9f9; border: 1px solid #eaeaea; border-radius: 12px; padding: 12px 16px;">
                <!-- Ikon -->
                <div style="width: 48px; height: 48px; flex-shrink: 0; display: flex; justify-content: center; align-items: center;">
                  <template v-if="r.reward_type === 'coin'">
                    <div style="font-size: 32px; display: flex; justify-content: center; align-items: center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">
                      💰
                    </div>
                  </template>
                  <template v-else>
                    <img :src="r.store_items?.thumbnail_url" style="width: 100%; height: 100%; object-fit: contain;" />
                  </template>
                </div>
                <!-- Detay -->
                <div style="display: flex; flex-direction: column;">
                  <span style="font-weight: 700; color: #1A1A2E; font-size: 15px;">
                    {{ r.reward_type === 'coin' ? formatNumber(r.coin_amount) + ' Coin' : r.store_items?.name }}
                  </span>
                  <span v-if="r.reward_type === 'item'" style="color: #888; font-size: 12px; margin-top: 2px;">
                    Kullanım Süresi: {{ r.duration_days }} Gün
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Avatar + Kullanıcı -->
      <div class="avatar-section" style="padding-top: 36px; padding-bottom: 24px;">
        <div class="avatar-ring">
          <img
            v-if="userProfile?.avatar_url"
            :src="userProfile.avatar_url"
            alt="Avatar"
            class="avatar-img"
          />
          <div v-else class="avatar-placeholder">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="#ccc">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
        </div>
        <p class="username" style="margin-top: 16px;">{{ userProfile?.username || 'Kullanıcı' }}</p>
      </div>

      <!-- Level Timeline -->
      <div class="timeline-section" v-if="allLevels.length">
        <div class="timeline-scroll">
          <div
            v-for="(lvlItem, idx) in allLevels"
            :key="lvlItem.level"
            class="timeline-item"
            :class="{ active: idx === activeLevelIndex, past: idx < activeLevelIndex }"
            ref="timelineItemRefs"
          >
            <div class="level-icon-wrapper" style="position: relative;">
              <img v-if="lvlItem.icon_url" :src="lvlItem.icon_url" class="range-icon-large" @error="(e) => e.target.style.display='none'" />
              <div v-else class="range-badge" :style="{ background: lvlItem.color || '#FFB800' }">
                <span class="range-text">LV.{{ lvlItem.level }}</span>
              </div>
            </div>
            <span class="range-label-real" style="margin-top: 8px; font-size: 11px; color: #555; font-weight: 600;">Lv.{{ lvlItem.level }}</span>
            <div 
              v-if="rewardsByLevel[lvlItem.level]?.length > 0" 
              class="gift-icon-bounce"
              @click="openRewards(lvlItem.level)"
            >
              🎁
            </div>
          </div>
        </div>
      </div>

      <!-- Level Info Card -->
      <div class="level-card">
        <!-- Level Number + EXP -->
        <div class="level-top">
          <div class="level-number">
            <span class="lv-label">Lv.</span>
            <span class="lv-value" :style="{ color: getRangeColor(levelInfo?.level || 1) }">{{ levelInfo?.level || 1 }}</span>
          </div>
          <div class="exp-counter">
            {{ formatNumber(levelInfo?.exp) }} / {{ formatNumber(levelInfo?.next_level_exp) }} EXP
          </div>
        </div>

        <!-- Remaining -->
        <div class="remaining">
          <span class="remaining-value">{{ formatNumber(levelInfo?.remaining_exp) }} EXP</span> ile seviye atlarsın
        </div>

        <!-- Progress Bar -->
        <div class="progress-bar-bg">
          <div
            class="progress-bar-fill"
            :style="{ width: progressPercent + '%', background: `linear-gradient(90deg, ${getRangeColor(levelInfo?.level || 1)}, ${getRangeColor(levelInfo?.level || 1)}aa)` }"
          ></div>
        </div>
      </div>

      <!-- EXP Kazanma Bilgisi -->
      <div class="info-section">
        <div class="info-card">
          <div class="info-icon">🎁</div>
          <div class="info-content">
            <div class="info-title">EXP Nasıl Kazanılır?</div>
            <div class="info-desc">Odada <strong>500 Coin</strong> harcayarak <strong>1 EXP</strong> kazan</div>
          </div>
        </div>

        <div class="stats-row">
          <div class="stat-box">
            <div class="stat-value">{{ formatNumber(levelInfo?.exp) }}</div>
            <div class="stat-label">Toplam EXP</div>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-box">
            <div class="stat-value">{{ levelInfo?.level || 1 }}</div>
            <div class="stat-label">Mevcut Seviye</div>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-box">
            <div class="stat-value">{{ levelInfo?.remaining_exp ? formatNumber(levelInfo.remaining_exp) : '—' }}</div>
            <div class="stat-label">Kalan EXP</div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Inter', sans-serif;
  background: #F8F8FC;
  color: #1A1A2E;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}

.app {
  min-height: 100vh;
  background: #F8F8FC;
}

.error-screen {
  display: flex; align-items: center; justify-content: center;
  min-height: 100vh; color: #ff4444; text-align: center; padding: 32px;
}

/* Header */
.header {
  display: flex; align-items: center;
  justify-content: space-between;
  padding: 52px 16px 12px;
  background: #fff;
  border-bottom: 1px solid #F0F0F5;
}
.back-btn {
  background: #F5F5FA; border: none;
  cursor: pointer; padding: 8px; border-radius: 50%;
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
}
.title {
  font-size: 17px; font-weight: 700; color: #1A1A2E;
}
.info-btn {
  background: transparent; border: none; cursor: pointer;
  width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
}

/* Info Popup / Bottom Sheet */
.overlay {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(0,0,0,0.4); z-index: 100;
  opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
}
.overlay.active { opacity: 1; pointer-events: auto; }

.bottom-sheet {
  position: absolute; bottom: 0; left: 0; width: 100%;
  background: #fff; border-radius: 24px 24px 0 0;
  padding: 24px 20px 32px; transform: translateY(100%);
  transition: transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.1);
  box-shadow: 0 -4px 16px rgba(0,0,0,0.05);
  max-height: 85vh;
  display: flex; flex-direction: column;
}
.bottom-sheet.active { transform: translateY(0); }

.sheet-header {
  flex-shrink: 0;
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;
}
.sheet-header h3 { font-size: 18px; font-weight: 800; color: #1A1A2E; }
.close-sheet {
  background: #F0F0F5; border: none; width: 32px; height: 32px;
  border-radius: 50%; font-weight: bold; color: #666; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.sheet-body { 
  overflow-y: auto; flex: 1; padding-bottom: 10px;
  padding-right: 4px;
}

/* Avatar */
.avatar-section {
  display: flex; flex-direction: column;
  align-items: center;
  background: #fff;
}
.avatar-ring {
  width: 100px; height: 100px;
  border-radius: 50%;
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
  background: #F0F0F5;
  display: flex; align-items: center; justify-content: center;
}
.username {
  font-size: 18px; font-weight: 700; color: #1A1A2E;
}

/* Timeline */
.timeline-section {
  background: #fff;
  padding: 16px 0;
  overflow: hidden;
}
.timeline-scroll {
  display: flex; overflow-x: auto;
  gap: 12px; padding: 20px 16px; align-items: flex-end;
  -ms-overflow-style: none; scrollbar-width: none;
}
.timeline-scroll::-webkit-scrollbar { display: none; }
.timeline-item {
  flex: 0 0 auto;
  display: flex; flex-direction: column;
  align-items: center; justify-content: flex-end;
  transform: scale(0.85); transform-origin: center bottom;
  transition: all 0.3s ease;
  min-width: 48px;
  scroll-margin-left: 20px;
}
.timeline-item > .level-icon-wrapper,
.timeline-item > .range-label-real {
  opacity: 0.35;
  transition: all 0.3s ease;
}
.timeline-item.past > .level-icon-wrapper, 
.timeline-item.past > .range-label-real { opacity: 0.55; }
.timeline-item.active > .level-icon-wrapper,
.timeline-item.active > .range-label-real { opacity: 1; }

.timeline-item.past { transform: scale(0.9); }
.timeline-item.active { transform: scale(1.15); }
.level-icon-wrapper {
  display: flex; align-items: center; justify-content: center;
  height: 54px;
}
.range-icon-large { width: 54px; height: 54px; object-fit: contain; }
.range-badge {
  display: flex; align-items: center; justify-content: center;
  padding: 4px 10px; border-radius: 14px;
  font-size: 11px; font-weight: 800; color: #fff;
  white-space: nowrap;
}

/* Level Card */
.level-card {
  margin: 12px 16px;
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}
.level-top {
  display: flex; align-items: flex-end;
  justify-content: space-between; margin-bottom: 8px;
}
.level-number { display: flex; align-items: baseline; }
.lv-label { font-size: 18px; font-weight: 500; color: #999; margin-right: 2px; }
.lv-value {
  font-size: 56px; font-weight: 900; line-height: 1;
  color: #6C63FF;
  transition: color 0.3s ease;
}
.exp-counter {
  font-size: 12px; color: #999;
  background: #F5F5FA; padding: 4px 10px;
  border-radius: 20px; margin-bottom: 4px;
}
.remaining { font-size: 13px; color: #888; margin-bottom: 14px; }
.remaining-value { font-weight: 700; color: #1A1A2E; }

.progress-bar-bg {
  width: 100%; height: 10px;
  background: #F0F0F5; border-radius: 5px; overflow: hidden;
}
.progress-bar-fill {
  height: 100%; border-radius: 5px;
  background: linear-gradient(90deg, #6C63FF, #9C8FFF);
  transition: width 0.8s ease;
}

/* Info Section */
.info-section {
  margin: 0 16px 32px;
  display: flex; flex-direction: column; gap: 10px;
}
.info-card {
  background: #fff; border-radius: 14px;
  padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  display: flex; align-items: center; gap: 12px;
}
.info-icon { font-size: 28px; }
.info-title { font-size: 13px; font-weight: 700; color: #1A1A2E; margin-bottom: 3px; }
.info-desc { font-size: 12px; color: #888; line-height: 1.5; }
.info-desc strong { color: #6C63FF; }

.stats-row {
  background: #fff; border-radius: 14px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  display: flex; align-items: center;
}
.stat-box {
  flex: 1; padding: 16px 4px;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  overflow: hidden;
}
.stat-value {
  font-size: 16px; font-weight: 800; color: #1A1A2E; /* reduced from 18 */
  width: 100%; text-align: center;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.stat-label { font-size: 10.5px; color: #999; margin-top: 3px; white-space: nowrap;}
.stat-divider {
  width: 1px; height: 36px; background: #F0F0F5;
}

/* Gift Box for Timeline */
.gift-icon-bounce {
  font-size: 18px;
  cursor: pointer;
  margin-top: 8px; /* moved slightly down */
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
}
</style>
