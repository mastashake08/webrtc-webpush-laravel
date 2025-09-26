<template>
  <div class="sip-config-modal">
    <!-- Modal Overlay -->
    <div 
      v-if="showModal" 
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="closeModal"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
            SIP Configuration
          </h2>
          <button 
            @click="closeModal"
            class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <!-- Registration Status -->
        <div class="mb-4 p-3 rounded-lg" :class="statusBadgeClass">
          <div class="flex items-center space-x-2">
            <div class="flex-shrink-0">
              <div class="w-2 h-2 rounded-full" :class="statusIndicatorClass"></div>
            </div>
            <span class="text-sm font-medium" :class="statusTextClass">
              {{ statusMessage }}
            </span>
          </div>
          <div v-if="connectionError" class="text-xs mt-1 text-red-600 dark:text-red-400">
            {{ connectionError }}
          </div>
        </div>

        <!-- Configuration Form -->
        <form @submit.prevent="handleSave">
          <!-- SIP URI -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              SIP URI *
            </label>
            <input 
              v-model="form.uri"
              type="text"
              placeholder="sip:username@your-domain.pstn.twilio.com"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              required
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Your Twilio SIP URI or custom SIP endpoint
            </p>
          </div>

          <!-- Display Name -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Display Name
            </label>
            <input 
              v-model="form.displayName"
              type="text"
              placeholder="Your Name"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <!-- Authorization Username -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Username
            </label>
            <input 
              v-model="form.authorizationUsername"
              type="text"
              placeholder="SIP username"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <!-- Authorization Password -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password
            </label>
            <input 
              v-model="form.authorizationPassword"
              type="password"
              placeholder="SIP password"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <!-- Registrar Server -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Registrar Server *
            </label>
            <input 
              v-model="form.registrarServer"
              type="text"
              placeholder="your-domain.pstn.twilio.com"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <!-- WebSocket Server -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              WebSocket Server *
            </label>
            <input 
              v-model="form.websocketServer"
              type="text"
              placeholder="wss://your-domain.pstn.twilio.com/ws"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <!-- Actions -->
          <div class="flex space-x-3">
            <!-- Test & Register Button -->
            <button
              type="button"
              @click="handleTestAndRegister"
              :disabled="isConnecting || !isFormValid"
              class="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
            >
              {{ isConnecting ? 'Connecting...' : isRegistered ? 'Re-register' : 'Test & Register' }}
            </button>

            <!-- Save Button -->
            <button
              type="submit"
              :disabled="!isFormValid"
              class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
            >
              Save Config
            </button>
          </div>

          <!-- Additional Actions -->
          <div class="flex justify-between mt-3">
            <!-- Load Twilio Template -->
            <button
              type="button"
              @click="loadTwilioTemplate"
              class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              📋 Load Twilio Template
            </button>

            <!-- Clear Config -->
            <button
              type="button"
              @click="clearConfiguration"
              class="text-sm text-red-600 dark:text-red-400 hover:underline"
              v-if="hasStoredConfig"
            >
              🗑️ Clear Saved Config
            </button>
          </div>
        </form>

        <!-- Disconnect Button -->
        <div v-if="isRegistered" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          <button
            @click="handleDisconnect"
            class="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            Disconnect & Unregister
          </button>
        </div>
      </div>
    </div>

    <!-- Trigger Button -->
    <button
      @click="openModal"
      class="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
      </svg>
      <span>SIP Config</span>
      <div v-if="isRegistered" class="w-2 h-2 bg-green-400 rounded-full"></div>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useSipConnection } from '../composables/useSipConnection'

// Props & Emits
const emit = defineEmits<{
  registered: []
  unregistered: []
  configSaved: []
}>()

// SIP composable
const {
  isRegistered,
  isConnecting,
  connectionError,
  registrationStatus,
  sipConfig,
  register,
  unregister,
  saveConfig,
  clearStoredConfig,
  loadStoredConfig,
  getTwilioConfigTemplate
} = useSipConnection()

// Component state
const showModal = ref(false)

// Form data
const form = reactive({
  uri: '',
  displayName: '',
  authorizationUsername: '',
  authorizationPassword: '',
  registrarServer: '',
  websocketServer: '',
  logLevel: 'info' as const
})

// Computed properties
const isFormValid = computed(() => {
  return form.uri && form.registrarServer && form.websocketServer
})

const hasStoredConfig = computed(() => {
  return sipConfig.value !== null
})

const statusMessage = computed(() => {
  switch (registrationStatus.value) {
    case 'disconnected':
      return 'Not connected'
    case 'connecting':
      return 'Connecting...'
    case 'connected':
      return 'Connected to server'
    case 'registered':
      return 'Registered and ready'
    case 'unregistered':
      return 'Unregistered'
    case 'error':
      return 'Connection error'
    default:
      return 'Unknown status'
  }
})

const statusBadgeClass = computed(() => {
  switch (registrationStatus.value) {
    case 'registered':
      return 'bg-green-100 dark:bg-green-900'
    case 'connecting':
      return 'bg-yellow-100 dark:bg-yellow-900'
    case 'error':
      return 'bg-red-100 dark:bg-red-900'
    default:
      return 'bg-gray-100 dark:bg-gray-700'
  }
})

const statusIndicatorClass = computed(() => {
  switch (registrationStatus.value) {
    case 'registered':
      return 'bg-green-500'
    case 'connecting':
      return 'bg-yellow-500 animate-pulse'
    case 'error':
      return 'bg-red-500'
    default:
      return 'bg-gray-400'
  }
})

const statusTextClass = computed(() => {
  switch (registrationStatus.value) {
    case 'registered':
      return 'text-green-800 dark:text-green-200'
    case 'connecting':
      return 'text-yellow-800 dark:text-yellow-200'
    case 'error':
      return 'text-red-800 dark:text-red-200'
    default:
      return 'text-gray-700 dark:text-gray-300'
  }
})

// Methods
const openModal = () => {
  showModal.value = true
  loadCurrentConfig()
}

const closeModal = () => {
  showModal.value = false
}

const loadCurrentConfig = () => {
  if (sipConfig.value) {
    form.uri = sipConfig.value.uri || ''
    form.displayName = sipConfig.value.displayName || ''
    form.authorizationUsername = sipConfig.value.authorizationUsername || ''
    form.authorizationPassword = sipConfig.value.authorizationPassword || ''
    form.registrarServer = sipConfig.value.registrarServer || ''
    form.websocketServer = sipConfig.value.websocketServer || ''
  }
}

const loadTwilioTemplate = () => {
  const template = getTwilioConfigTemplate()
  form.uri = template.uri
  form.displayName = template.displayName || ''
  form.authorizationUsername = template.authorizationUsername || ''
  form.authorizationPassword = template.authorizationPassword || ''
  form.registrarServer = template.registrarServer
  form.websocketServer = template.websocketServer
}

const handleSave = () => {
  if (!isFormValid.value) {
    return
  }

  const config = {
    uri: form.uri,
    displayName: form.displayName,
    authorizationUsername: form.authorizationUsername,
    authorizationPassword: form.authorizationPassword,
    registrarServer: form.registrarServer,
    websocketServer: form.websocketServer,
    logLevel: form.logLevel,
    stunServers: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302'
    ]
  }

  saveConfig(config)
  emit('configSaved')
  
  console.log('💾 SIP Config: Configuration saved successfully')
  // Could show a toast notification here
}

const handleTestAndRegister = async () => {
  if (!isFormValid.value) {
    return
  }

  try {
    const config = {
      uri: form.uri,
      displayName: form.displayName,
      authorizationUsername: form.authorizationUsername,
      authorizationPassword: form.authorizationPassword,
      registrarServer: form.registrarServer,
      websocketServer: form.websocketServer,
      logLevel: form.logLevel,
      stunServers: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302'
      ]
    }

    const success = await register(config)
    
    if (success) {
      console.log('✅ SIP Config: Registration successful')
      emit('registered')
      // Auto-save on successful registration
      saveConfig(config)
    } else {
      console.error('❌ SIP Config: Registration failed')
    }
  } catch (error: any) {
    console.error('❌ SIP Config: Registration error:', error)
  }
}

const handleDisconnect = async () => {
  try {
    await unregister()
    emit('unregistered')
    console.log('📞 SIP Config: Disconnected successfully')
  } catch (error: any) {
    console.error('❌ SIP Config: Disconnect error:', error)
  }
}

const clearConfiguration = () => {
  clearStoredConfig()
  
  // Reset form
  form.uri = ''
  form.displayName = ''
  form.authorizationUsername = ''
  form.authorizationPassword = ''
  form.registrarServer = ''
  form.websocketServer = ''
  
  console.log('🗑️ SIP Config: Configuration cleared')
}

// Lifecycle
onMounted(() => {
  loadCurrentConfig()
})
</script>

<style scoped>
/* Additional styles if needed */
</style>