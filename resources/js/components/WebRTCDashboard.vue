<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import WebRTCCall from './WebRTCCall.vue'
import PushNotificationManager from './PushNotificationManager.vue'
import UserSelector from './UserSelector.vue'

// State
const activeCall = ref<any>(null)
const incomingCall = ref<any>(null)
const notifications = ref<any[]>([])
const showCallInterface = ref(false)
const showUserSelector = ref(false)

// Service worker for handling push notifications
let serviceWorker: ServiceWorker | null = null

// Initialize WebRTC dashboard
const initializeWebRTCDashboard = async () => {
  // Register service worker message handler
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage)
    
    // Get existing service worker
    const registration = await navigator.serviceWorker.getRegistration()
    if (registration && registration.active) {
      serviceWorker = registration.active
    }
  }

  // Listen for browser notifications (when app is in foreground)
  window.addEventListener('push', handlePushEvent)
}

// Handle messages from service worker
const handleServiceWorkerMessage = (event: MessageEvent) => {
  console.log('Dashboard received SW message:', event.data)
  
  if (event.data && event.data.type === 'PUSH_RECEIVED') {
    handlePushNotification(event.data.payload)
  }
}

// Handle push events when app is active
const handlePushEvent = (event: any) => {
  console.log('Dashboard received push event:', event)
  
  if (event.data) {
    try {
      const data = event.data.json()
      handlePushNotification(data)
    } catch (error) {
      console.error('Error parsing push data:', error)
    }
  }
}

// Handle incoming push notification
const handlePushNotification = (payload: any) => {
  console.log('Handling push notification:', payload)
  
  // Add to notifications list
  notifications.value.unshift({
    id: Date.now(),
    ...payload,
    timestamp: new Date()
  })

  // Handle different notification types
  if (payload.data) {
    switch (payload.data.type) {
      case 'webrtc_send_sdp':
        // Incoming WebRTC call
        handleIncomingCall(payload.data)
        break
        
      case 'webrtc_receive_sdp':
        // WebRTC call answer
        handleCallAnswer(payload.data)
        break
        
      case 'webrtc_ice_candidate':
        // ICE candidate
        handleIceCandidate(payload.data)
        break
        
      case 'webrtc_call_ended':
        // Call ended
        handleCallEnded(payload.data)
        break
        
      default:
        console.log('Unknown notification type:', payload.data.type)
    }
  }
}

// Handle incoming WebRTC call
const handleIncomingCall = (data: any) => {
  console.log('Incoming WebRTC call:', data)
  
  incomingCall.value = {
    caller_id: data.caller_id,
    caller_name: data.caller_name,
    call_id: data.call_id,
    call_type: data.call_type,
    sdp: data.sdp,
    timestamp: data.timestamp
  }
  
  showCallInterface.value = true
}

// Handle call answer
const handleCallAnswer = (data: any) => {
  console.log('Received call answer:', data)
  
  if (activeCall.value && activeCall.value.call_id === data.call_id) {
    // Pass the answer to the WebRTC component
    const callComponent = document.querySelector('.webrtc-call-component') as any
    if (callComponent && callComponent.handleRemoteAnswer) {
      callComponent.handleRemoteAnswer(data.sdp)
    }
  }
}

// Handle ICE candidate
const handleIceCandidate = (data: any) => {
  console.log('Received ICE candidate:', data)
  
  if (activeCall.value && activeCall.value.call_id === data.call_id) {
    // Pass the ICE candidate to the WebRTC component
    const callComponent = document.querySelector('.webrtc-call-component') as any
    if (callComponent && callComponent.handleRemoteIceCandidate) {
      callComponent.handleRemoteIceCandidate(data.ice_candidate)
    }
  }
}

// Handle call ended
const handleCallEnded = (data: any) => {
  console.log('Call ended:', data)
  
  if (activeCall.value && activeCall.value.call_id === data.call_id) {
    endCall(data.reason || 'ended')
  }
}

// Start new call
const startCall = (userId: number, callType: string) => {
  console.log('Starting call to user:', userId, 'type:', callType)
  
  activeCall.value = {
    target_user_id: userId,
    call_type: callType,
    call_id: `call_${Date.now()}`,
    status: 'outgoing'
  }
  
  showCallInterface.value = true
  showUserSelector.value = false
}

// Accept incoming call
const acceptCall = () => {
  if (!incomingCall.value) return
  
  console.log('Accepting call:', incomingCall.value.call_id)
  
  activeCall.value = {
    caller_user_id: incomingCall.value.caller_id,
    call_id: incomingCall.value.call_id,
    call_type: incomingCall.value.call_type,
    status: 'incoming_accepted'
  }
  
  // Clear incoming call state
  incomingCall.value = null
}

// Decline incoming call  
const declineCall = () => {
  if (!incomingCall.value) return
  
  console.log('Declining call:', incomingCall.value.call_id)
  
  incomingCall.value = null
  showCallInterface.value = false
}

// End active call
const endCall = (reason: string = 'ended') => {
  console.log('Ending call:', reason)
  
  activeCall.value = null
  incomingCall.value = null
  showCallInterface.value = false
}

// Clear notification
const clearNotification = (notificationId: number) => {
  const index = notifications.value.findIndex((n: any) => n.id === notificationId)
  if (index > -1) {
    notifications.value.splice(index, 1)
  }
}

// Clear all notifications
const clearAllNotifications = () => {
  notifications.value = []
}

// Format notification time
const formatNotificationTime = (timestamp: Date) => {
  const now = new Date()
  const diff = now.getTime() - timestamp.getTime()
  
  if (diff < 60000) { // Less than 1 minute
    return 'Just now'
  } else if (diff < 3600000) { // Less than 1 hour
    return `${Math.floor(diff / 60000)}m ago`
  } else if (diff < 86400000) { // Less than 1 day
    return `${Math.floor(diff / 3600000)}h ago`
  } else {
    return timestamp.toLocaleDateString()
  }
}

// Get notification icon
const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'webrtc_send_sdp':
      return '📹'
    case 'webrtc_receive_sdp':
      return '📞'
    case 'webrtc_ice_candidate':
      return '🔗'
    case 'webrtc_call_ended':
      return '📴'
    default:
      return '🔔'
  }
}

// Lifecycle
onMounted(() => {
  initializeWebRTCDashboard()
})

onUnmounted(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage)
  }
  window.removeEventListener('push', handlePushEvent)
})
</script>

<template>
  <div class="webrtc-dashboard">
    <!-- WebRTC Call Interface -->
    <WebRTCCall
      v-if="showCallInterface"
      ref="webrtcCall"
      class="webrtc-call-component"
      :target-user-id="activeCall?.target_user_id"
      :call-type="activeCall?.call_type || 'video'"
      :incoming-call="incomingCall"
      @call-started="(callId: string) => console.log('Call started:', callId)"
      @call-ended="endCall"
      @call-accepted="acceptCall"
      @call-declined="declineCall"
      @error="(error: any) => console.error('WebRTC Error:', error)"
    />

    <!-- Main Dashboard Content -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Left Column: Call Controls -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Quick Actions -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            WebRTC Calling
          </h2>
          
          <div class="flex flex-wrap gap-3">
            <button
              @click="showUserSelector = !showUserSelector"
              class="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            >
              <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
              </svg>
              {{ showUserSelector ? 'Hide' : 'Start Call' }}
            </button>
            
            <div class="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <div class="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
              WebRTC Ready
            </div>
          </div>
          
          <!-- User Selector -->
          <div v-if="showUserSelector" class="mt-6">
            <UserSelector
              @user-selected="(user: any) => console.log('User selected:', user)"
              @call-initiated="startCall"
            />
          </div>
        </div>

        <!-- Push Notification Manager -->
        <PushNotificationManager
          @notification-received="handlePushNotification"
          @subscription-changed="(isSubscribed: boolean) => console.log('Subscription changed:', isSubscribed)"
          @error="(error: any) => console.error('Push notification error:', error)"
        />
      </div>

      <!-- Right Column: Notifications & Activity -->
      <div class="space-y-6">
        <!-- Recent Notifications -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div class="p-4 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                Recent Activity
              </h3>
              <button
                v-if="notifications.length > 0"
                @click="clearAllNotifications"
                class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Clear All
              </button>
            </div>
          </div>
          
          <div class="max-h-96 overflow-y-auto">
            <div v-if="notifications.length === 0" class="p-4 text-center text-gray-500 dark:text-gray-400">
              No recent notifications
            </div>
            
            <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
              <div
                v-for="notification in notifications"
                :key="notification.id"
                class="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div class="flex items-start justify-between">
                  <div class="flex items-start space-x-3">
                    <div class="text-2xl">
                      {{ getNotificationIcon(notification.data?.type || 'default') }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="font-medium text-gray-900 dark:text-white">
                        {{ notification.title }}
                      </p>
                      <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {{ notification.body }}
                      </p>
                      <p class="text-xs text-gray-500 dark:text-gray-500 mt-2">
                        {{ formatNotificationTime(notification.timestamp) }}
                      </p>
                    </div>
                  </div>
                  <button
                    @click="clearNotification(notification.id)"
                    class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Call History (Mock) -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recent Calls
          </h3>
          
          <div class="space-y-3">
            <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm">
                  JD
                </div>
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">John Doe</p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">Video call • 2m ago</p>
                </div>
              </div>
              <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            
            <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
              <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm">
                  JS
                </div>
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">Jane Smith</p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">Audio call • 1h ago</p>
                </div>
              </div>
              <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.webrtc-dashboard {
  min-height: 100vh;
}
</style>