<template>
  <div class="sip-dialer">
    <!-- SIP Status Bar -->
    <div class="mb-4 p-3 rounded-lg" :class="sipStatusClass">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <div class="w-2 h-2 rounded-full" :class="sipIndicatorClass"></div>
          <span class="text-sm font-medium">{{ sipStatusText }}</span>
        </div>
        <sip-configuration 
          @registered="onSipRegistered"
          @unregistered="onSipUnregistered"
        />
      </div>
    </div>

    <!-- Dialer Interface -->
    <div v-if="!callState.isInCall" class="dialer-interface">
      <!-- Phone Number Input -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Phone Number or SIP URI
        </label>
        <div class="flex space-x-2">
          <input 
            v-model="phoneNumber"
            type="text"
            placeholder="+1234567890 or sip:user@domain.com"
            class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            @keyup.enter="handleCall"
          />
          <button
            @click="handleCall"
            :disabled="!canMakeCall || !phoneNumber.trim()"
            class="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
          >
            📞 Call
          </button>
        </div>
      </div>

      <!-- Quick Dial Pad -->
      <div class="dial-pad grid grid-cols-3 gap-2 mb-4">
        <button
          v-for="digit in dialPadDigits"
          :key="digit.number"
          @click="addDigit(digit.number)"
          class="aspect-square bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg flex flex-col items-center justify-center text-lg font-semibold transition-colors"
        >
          <span>{{ digit.number }}</span>
          <span class="text-xs text-gray-500 dark:text-gray-400">{{ digit.letters }}</span>
        </button>
        
        <!-- Special buttons -->
        <button
          @click="addDigit('*')"
          class="aspect-square bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg flex items-center justify-center text-lg font-semibold transition-colors"
        >
          *
        </button>
        <button
          @click="addDigit('0')"
          class="aspect-square bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg flex flex-col items-center justify-center text-lg font-semibold transition-colors"
        >
          <span>0</span>
          <span class="text-xs text-gray-500 dark:text-gray-400">+</span>
        </button>
        <button
          @click="addDigit('#')"
          class="aspect-square bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg flex items-center justify-center text-lg font-semibold transition-colors"
        >
          #
        </button>
      </div>

      <!-- Action Buttons -->
      <div class="flex space-x-2">
        <button
          @click="clearNumber"
          class="flex-1 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
        >
          🗑️ Clear
        </button>
        <button
          @click="addDigit('+')"
          class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
        >
          + Country Code
        </button>
      </div>
    </div>

    <!-- Active Call Interface -->
    <div v-else class="call-interface">
      <!-- Call Info -->
      <div class="text-center mb-6">
        <div class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {{ callState.isOutgoing ? 'Calling' : 'Incoming Call' }}
        </div>
        <div class="text-lg text-gray-600 dark:text-gray-400">
          {{ formatPhoneNumber(callState.remoteUri) }}
        </div>
        <div v-if="callState.isInCall && !callState.isOutgoing" class="text-sm text-green-600 dark:text-green-400 mt-2">
          Call Duration: {{ formatDuration(callState.callDuration) }}
        </div>
      </div>

      <!-- Call Status -->
      <div class="text-center mb-6">
        <div class="inline-flex items-center px-3 py-1 rounded-full text-sm" :class="callStatusClass">
          {{ callStatusText }}
        </div>
      </div>

      <!-- Call Controls -->
      <div class="flex justify-center space-x-4">
        <!-- Mute Button -->
        <button
          @click="toggleMute"
          :class="[
            'p-4 rounded-full transition-colors',
            callState.isMuted 
              ? 'bg-red-600 hover:bg-red-700 text-white' 
              : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
          ]"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path v-if="!callState.isMuted" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        </button>

        <!-- Answer Button (for incoming calls) -->
        <button
          v-if="callState.isIncoming"
          @click="handleAnswerCall"
          class="p-4 bg-green-600 hover:bg-green-700 text-white rounded-full transition-colors"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </button>

        <!-- End Call Button -->
        <button
          @click="handleEndCall"
          class="p-4 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 3l18 18" />
          </svg>
        </button>

        <!-- Hold Button -->
        <button
          @click="toggleHold"
          :class="[
            'p-4 rounded-full transition-colors',
            callState.isHeld 
              ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
              : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
          ]"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Recent Calls (optional) -->
    <div v-if="!callState.isInCall && recentCalls.length > 0" class="mt-6">
      <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recent Calls</h3>
      <div class="space-y-2">
        <div 
          v-for="call in recentCalls" 
          :key="call.id"
          class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
        >
          <div class="flex items-center space-x-3">
            <div class="text-sm">{{ formatPhoneNumber(call.number) }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">{{ call.time }}</div>
          </div>
          <button
            @click="callNumber(call.number)"
            class="p-1 text-green-600 hover:text-green-700"
            :disabled="!canMakeCall"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSipConnection } from '../composables/useSipConnection'
import SipConfiguration from './SipConfiguration.vue'

// Props & Emits
const emit = defineEmits<{
  callStarted: [number: string]
  callEnded: [number: string]
  callAnswered: [number: string]
}>()

// SIP composable
const {
  isRegistered,
  isConnecting,
  registrationStatus,
  callState,
  canMakeCall,
  makeCall,
  answerCall,
  endCall
} = useSipConnection()

// Component state
const phoneNumber = ref('')
const recentCalls = ref<Array<{ id: string, number: string, time: string }>>([])

// Dial pad configuration
const dialPadDigits = [
  { number: '1', letters: '' },
  { number: '2', letters: 'ABC' },
  { number: '3', letters: 'DEF' },
  { number: '4', letters: 'GHI' },
  { number: '5', letters: 'JKL' },
  { number: '6', letters: 'MNO' },
  { number: '7', letters: 'PQRS' },
  { number: '8', letters: 'TUV' },
  { number: '9', letters: 'WXYZ' }
]

// Computed properties
const sipStatusClass = computed(() => {
  switch (registrationStatus.value) {
    case 'registered':
      return 'bg-green-100 dark:bg-green-900 border border-green-200 dark:border-green-800'
    case 'connecting':
      return 'bg-yellow-100 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-800'
    case 'error':
      return 'bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-800'
    default:
      return 'bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
  }
})

const sipIndicatorClass = computed(() => {
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

const sipStatusText = computed(() => {
  switch (registrationStatus.value) {
    case 'registered':
      return 'SIP Registered - Ready to call'
    case 'connecting':
      return 'Connecting to SIP server...'
    case 'error':
      return 'SIP connection error'
    default:
      return 'SIP not configured'
  }
})

const callStatusClass = computed(() => {
  if (callState.isInCall) {
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  } else if (callState.isOutgoing) {
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
  } else if (callState.isIncoming) {
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
  }
  return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
})

const callStatusText = computed(() => {
  if (callState.isInCall) {
    return 'Connected'
  } else if (callState.isOutgoing) {
    return 'Calling...'
  } else if (callState.isIncoming) {
    return 'Incoming Call'
  }
  return 'Idle'
})

// Methods
const addDigit = (digit: string) => {
  phoneNumber.value += digit
}

const clearNumber = () => {
  phoneNumber.value = ''
}

const formatPhoneNumber = (number: string): string => {
  // Basic phone number formatting
  if (number.startsWith('sip:')) {
    return number
  }
  
  // Remove non-digit characters for formatting
  const digits = number.replace(/\D/g, '')
  
  // Format US phone numbers
  if (digits.length === 10) {
    return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.substring(1, 4)}) ${digits.substring(4, 7)}-${digits.substring(7)}`
  }
  
  return number
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const callNumber = (number: string) => {
  phoneNumber.value = number
  handleCall()
}

const handleCall = async () => {
  if (!phoneNumber.value.trim() || !canMakeCall.value) {
    return
  }

  try {
    let targetUri = phoneNumber.value.trim()
    
    // Convert phone number to SIP URI if needed
    if (!targetUri.startsWith('sip:')) {
      // For Twilio, you might need to format as sip:+1234567890@your-domain.pstn.twilio.com
      // This is a basic example - adjust based on your Twilio configuration
      const digits = targetUri.replace(/\D/g, '')
      if (digits.length >= 10) {
        targetUri = `sip:+${digits}@your-domain.pstn.twilio.com`
      } else {
        throw new Error('Invalid phone number format')
      }
    }

    console.log('📞 SIP Dialer: Making call to:', targetUri)
    await makeCall(targetUri)
    
    // Add to recent calls
    addToRecentCalls(phoneNumber.value)
    
    emit('callStarted', phoneNumber.value)
    
  } catch (error: any) {
    console.error('❌ SIP Dialer: Call failed:', error)
    alert(`Call failed: ${error.message}`)
  }
}

const handleAnswerCall = async () => {
  try {
    await answerCall()
    emit('callAnswered', callState.remoteUri)
  } catch (error: any) {
    console.error('❌ SIP Dialer: Answer failed:', error)
  }
}

const handleEndCall = async () => {
  try {
    const number = callState.remoteUri
    await endCall()
    emit('callEnded', number)
  } catch (error: any) {
    console.error('❌ SIP Dialer: End call failed:', error)
  }
}

const toggleMute = () => {
  callState.isMuted = !callState.isMuted
  console.log('🔇 SIP Dialer:', callState.isMuted ? 'Muted' : 'Unmuted')
  // In a real implementation, you'd mute/unmute the audio stream
}

const toggleHold = () => {
  callState.isHeld = !callState.isHeld
  console.log('⏸️ SIP Dialer:', callState.isHeld ? 'On Hold' : 'Off Hold')
  // In a real implementation, you'd put the call on hold
}

const addToRecentCalls = (number: string) => {
  const call = {
    id: Date.now().toString(),
    number,
    time: new Date().toLocaleTimeString()
  }
  
  recentCalls.value.unshift(call)
  
  // Keep only last 5 calls
  if (recentCalls.value.length > 5) {
    recentCalls.value = recentCalls.value.slice(0, 5)
  }
  
  // Save to localStorage
  try {
    localStorage.setItem('sip_recent_calls', JSON.stringify(recentCalls.value))
  } catch (error) {
    console.error('Failed to save recent calls:', error)
  }
}

const loadRecentCalls = () => {
  try {
    const stored = localStorage.getItem('sip_recent_calls')
    if (stored) {
      recentCalls.value = JSON.parse(stored)
    }
  } catch (error) {
    console.error('Failed to load recent calls:', error)
  }
}

// Event handlers
const onSipRegistered = () => {
  console.log('✅ SIP Dialer: SIP registered successfully')
}

const onSipUnregistered = () => {
  console.log('📞 SIP Dialer: SIP unregistered')
}

// Lifecycle
onMounted(() => {
  loadRecentCalls()
})
</script>

<style scoped>
.dial-pad button {
  min-height: 60px;
}

.call-interface {
  padding: 2rem 0;
}

@media (max-width: 640px) {
  .dial-pad {
    gap: 0.5rem;
  }
  
  .dial-pad button {
    min-height: 50px;
  }
}
</style>