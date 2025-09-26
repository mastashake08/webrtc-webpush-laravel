<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import axios from 'axios'
import WebRTCCall from './WebRTCCall.vue'
import UserSelector from './UserSelector.vue'
import PushNotificationManager from './PushNotificationManager.vue'

// Refs
const webrtcCall = ref<InstanceType<typeof WebRTCCall>>()

// State
const activeCall = ref<any>(null)
const incomingCall = ref<any>(null)
const notifications = ref<any[]>([])
const showCallInterface = ref(false)
const showUserSelector = ref(false)
const showIncomingCallModal = ref(false)

// SDP Debug State
const showSdpDebugger = ref(false)
const offerSdp = ref('')
const answerSdp = ref('')
const sdpParseResult = ref<any>(null)
const sdpError = ref('')

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
  
  // Fetch initial notifications from database
  await fetchNotifications()
}

// Handle messages from service worker
const handleServiceWorkerMessage = async (event: MessageEvent) => {
  console.log('🎯 Dashboard received SW message:', event.data)
  
  if (event.data) {
    switch (event.data.type) {
      case 'PUSH_RECEIVED':
        console.log('📨 Dashboard: Handling general push notification')
        handlePushNotification(event.data.payload)
        break
        
      case 'WEBRTC_INCOMING_CALL':
        console.log('📞 Dashboard: Handling incoming WebRTC call directly')
        handleIncomingCall(event.data.data)
        break
        
      case 'WEBRTC_ICE_CANDIDATE':
        console.log('🧊 Dashboard: Handling ICE candidate directly')
        handleIceCandidate(event.data.data)
        break
        
      case 'NOTIFICATION_ACCEPT_CALL':
        console.log('📞 Dashboard: Handling notification call acceptance')
        await handleNotificationAcceptCall(event.data.data)
        break
        
      case 'NOTIFICATION_DECLINE_CALL':
        console.log('📞 Dashboard: Handling notification call decline')
        handleNotificationDeclineCall(event.data.data)
        break
        
      default:
        console.log('🤷 Dashboard: Unknown message type:', event.data.type)
    }
  }
}

// Fetch notifications from database
const fetchNotifications = async () => {
  try {
    console.log('📨 Dashboard: Fetching notifications from database...')
    
    const response = await axios.get('/api/notifications')
    
    if (response.data.success) {
      notifications.value = response.data.notifications || []
      console.log('📨 Dashboard: Loaded', notifications.value.length, 'notifications from database')
    } else {
      console.error('❌ Dashboard: Failed to fetch notifications:', response.data.message)
    }
  } catch (error: any) {
    console.error('❌ Dashboard: Error fetching notifications:', error)
    if (error.response) {
      console.error('❌ Dashboard: API Error:', error.response.data)
    }
  }
}
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
  console.log('📨 Dashboard: Handling push notification:', payload)
  
  if (!payload) {
    console.error('❌ Dashboard: No payload provided for push notification!')
    return
  }
  
  // Add to local notifications array for immediate display
  notifications.value.unshift({
    id: Date.now(),
    type: (payload.data && payload.data.type) || 'general',
    data: payload,
    created_at: new Date(),
    read_at: null,
    time_ago: 'just now'
  })
  
  // Refresh from database to get proper formatting and ensure consistency
  fetchNotifications()

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
  } else {
    console.log('📨 Dashboard: Push notification has no data property')
  }
}

// Handle incoming WebRTC call
const handleIncomingCall = async (data: any) => {
  console.log('📞 Dashboard: Incoming WebRTC call data:', data)
  
  // Validate required data
  if (!data) {
    console.error('❌ Dashboard: No data provided for incoming call!')
    return
  }
  
  console.log('📞 Dashboard: Session ID:', data.session_id)
  console.log('📞 Dashboard: Caller info:', {
    caller_id: data.caller_id,
    caller_name: data.caller_name,
    call_type: data.call_type
  })
  
  if (!data.session_id) {
    console.error('❌ Dashboard: No session ID in incoming call!')
    return
  }

  try {
    // Fetch SDP data from database using session ID
    console.log('📞 Dashboard: Fetching SDP data for session:', data.session_id)

    const response = await axios.get(`/api/webrtc/session/${data.session_id}`)

    if (!response.data.success) {
      console.error('❌ Dashboard: Failed to fetch SDP data:', response.data.message)
      return
    }
    
    const sessionData = response.data.session
    console.log('📞 Dashboard: Retrieved SDP data:', sessionData)
    
    // Validate session data
    if (!sessionData) {
      console.error('❌ Dashboard: No session data returned from API!')
      return
    }
    
    incomingCall.value = {
      caller_id: sessionData.caller_id || data.caller_id,
      caller_name: sessionData.caller_name || data.caller_name || 'Unknown Caller',
      call_id: sessionData.call_id || data.call_id || `call_${Date.now()}`,
      call_type: sessionData.call_type || data.call_type || 'video',
      sdp: sessionData.sdp,
      timestamp: sessionData.timestamp || new Date().toISOString(),
      session_id: sessionData.id || data.session_id
    }
    
    showCallInterface.value = true
    console.log('📞 Dashboard: Incoming call state set, showing call interface')
    
    // Show the incoming call modal for foreground users
    showIncomingCallModal.value = true
    
  } catch (error: any) {
    console.error('❌ Dashboard: Error fetching SDP data:', error)
    if (error.response) {
      console.error('❌ Dashboard: API Error:', error.response.data)
    }
  }
}

// Handle call answer
const handleCallAnswer = (data: any) => {
  console.log('Received call answer:', data)
  
  if (!data) {
    console.error('❌ Dashboard: No data provided for call answer!')
    return
  }
  
  if (activeCall.value && activeCall.value.call_id === data.call_id) {
    // Pass the answer to the WebRTC component using ref
    const webrtcCallComponent = webrtcCall.value
    if (webrtcCallComponent && webrtcCallComponent.handleRemoteAnswer) {
      webrtcCallComponent.handleRemoteAnswer(data.sdp)
    } else {
      console.error('❌ Dashboard: WebRTCCall component not found or handleRemoteAnswer method missing')
    }
  }
}

// Handle ICE candidate
const handleIceCandidate = (data: any) => {
  console.log('Received ICE candidate:', data)
  
  if (!data) {
    console.error('❌ Dashboard: No data provided for ICE candidate!')
    return
  }
  
  if (activeCall.value && activeCall.value.call_id === data.call_id) {
    // Pass the ICE candidate to the WebRTC component using ref
    const webrtcCallComponent = webrtcCall.value
    if (webrtcCallComponent && webrtcCallComponent.handleRemoteIceCandidate) {
      webrtcCallComponent.handleRemoteIceCandidate(data.ice_candidate)
    } else {
      console.error('❌ Dashboard: WebRTCCall component not found or handleRemoteIceCandidate method missing')
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
  console.log('🚀 WebRTCDashboard: Starting call to user:', userId, 'type:', callType)
  
  activeCall.value = {
    target_user_id: userId,
    call_type: callType,
    call_id: `call_${Date.now()}`,
    status: 'outgoing'
  }
  
  showCallInterface.value = true
  showUserSelector.value = false
  
  console.log('📱 WebRTCDashboard: Call interface shown, activeCall:', activeCall.value)
  
  // Start the actual WebRTC call after the component is rendered
  nextTick(() => {
    console.log('⏭️ WebRTCDashboard: nextTick called, looking for webrtcCall component')
    const webrtcCallComponent = webrtcCall.value
    if (webrtcCallComponent && webrtcCallComponent.startCall) {
      console.log('✅ WebRTCDashboard: Found WebRTCCall component, calling startCall()')
      webrtcCallComponent.startCall()
    } else {
      console.error('❌ WebRTCDashboard: WebRTCCall component not found or startCall method missing', {
        component: webrtcCallComponent,
        hasStartCall: webrtcCallComponent?.startCall
      })
    }
  })
}

// Accept incoming call
const acceptCall = () => {
  if (!incomingCall.value) return
  
  console.log('📞 Dashboard: Accepting call:', incomingCall.value.call_id)
  console.log('📞 Dashboard: Call data:', incomingCall.value)
  
  // Store the call data before clearing it
  const callData = { ...incomingCall.value }
  
  // Set the active call state for the WebRTCCall component
  activeCall.value = {
    caller_user_id: callData.caller_id,
    call_id: callData.call_id,
    call_type: callData.call_type,
    status: 'incoming_accepted',
    sdp: callData.sdp, // Include the SDP data
    session_id: callData.session_id
  }
  
  // Clear incoming call modal but keep call interface active
  showIncomingCallModal.value = false
  
  // Trigger the accept call in the WebRTCCall component with the stored data
  nextTick(() => {
    const webrtcCallComponent = webrtcCall.value
    if (webrtcCallComponent && webrtcCallComponent.acceptIncomingCall) {
      console.log('✅ Dashboard: Found WebRTCCall component, calling acceptIncomingCall() with data:', callData)
      webrtcCallComponent.acceptIncomingCall(callData)
    } else {
      console.error('❌ Dashboard: WebRTCCall component not found or acceptIncomingCall method missing', {
        component: webrtcCallComponent,
        hasAcceptMethod: webrtcCallComponent?.acceptIncomingCall
      })
    }
  })
  
  // Clear incoming call after passing to component
  incomingCall.value = null
}

// Decline incoming call  
const declineCall = () => {
  if (!incomingCall.value) return
  
  console.log('Declining call:', incomingCall.value.call_id)
  
  showIncomingCallModal.value = false
  incomingCall.value = null
  showCallInterface.value = false
}

// Handle notification accept call from service worker
const handleNotificationAcceptCall = async (data: any) => {
  console.log('📞 Dashboard: Handling notification accept call:', data)
  
  if (!data.session_id && !data.call_id) {
    console.error('❌ Dashboard: Missing session_id or call_id in notification accept data')
    return
  }
  
  try {
    // Fetch the actual session data from the server
    const sessionId = data.session_id || data.call_id
    const response = await axios.get(`/api/webrtc/session/${sessionId}`)
    
    if (response.data.success && response.data.session) {
      const sessionData = response.data.session
      console.log('📞 Dashboard: Retrieved session data:', sessionData)
      
      // Set up the call with complete data from server
      incomingCall.value = {
        call_id: sessionData.id,
        session_id: sessionData.id,
        caller_id: sessionData.caller_user_id,
        caller_name: data.caller_name || sessionData.caller_name || 'Unknown Caller',
        call_type: sessionData.call_type || 'audio_video',
        status: 'incoming',
        sdp: sessionData.offer_sdp, // Include the actual SDP data
        created_at: sessionData.created_at
      }
      
      console.log('📞 Dashboard: Set up incoming call with session data:', incomingCall.value)
      
      // Show the call interface
      showCallInterface.value = true
      
      // Accept the call immediately
      await nextTick()
      acceptCall()
      
    } else {
      console.error('❌ Dashboard: Failed to retrieve session data:', response.data)
      
      // Fallback: create basic call structure
      incomingCall.value = {
        call_id: data.call_id || data.session_id,
        session_id: data.session_id,
        caller_id: data.caller_id,
        caller_name: data.caller_name || 'Unknown Caller',
        call_type: data.call_type || 'audio_video',
        status: 'incoming'
      }
      
      console.log('📞 Dashboard: Using fallback call data:', incomingCall.value)
      showCallInterface.value = true
      await nextTick()
      acceptCall()
    }
    
  } catch (error) {
    console.error('❌ Dashboard: Error fetching session data:', error)
    
    // Fallback: create basic call structure
    incomingCall.value = {
      call_id: data.call_id || data.session_id,
      session_id: data.session_id,
      caller_id: data.caller_id,
      caller_name: data.caller_name || 'Unknown Caller',
      call_type: data.call_type || 'audio_video',
      status: 'incoming'
    }
    
    console.log('📞 Dashboard: Using fallback call data after error:', incomingCall.value)
    showCallInterface.value = true
    await nextTick()
    acceptCall()
  }
}

// Handle notification decline call from service worker
const handleNotificationDeclineCall = (data: any) => {
  console.log('📞 Dashboard: Handling notification decline call:', data)
  
  // Clear any existing call states
  if (incomingCall.value?.session_id === data.session_id || 
      incomingCall.value?.call_id === data.call_id) {
    incomingCall.value = null
  }
  
  showIncomingCallModal.value = false
  showCallInterface.value = false
}

// End active call
const endCall = (reason: string = 'ended') => {
  console.log('🔚 WebRTCDashboard: Ending call with reason:', reason)
  
  // Clear all call states
  activeCall.value = null
  incomingCall.value = null
  showCallInterface.value = false
  showIncomingCallModal.value = false
  
  // Reset user selector state if needed
  showUserSelector.value = false
  
  console.log('🔚 WebRTCDashboard: Call ended, states cleared')
}

// Get notification icon based on type
const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'webrtc_send_sdp':
      return '📞'
    case 'webrtc_receive_sdp':
      return '✅'
    case 'webrtc_ice_candidate':
      return '🧊'
    case 'webrtc_call_ended':
      return '📵'
    default:
      return '🔔'
  }
}

// Get notification title from different notification formats
const getNotificationTitle = (notification: any) => {
  if (!notification) return 'Notification'
  
  // Database notification format
  if (notification.data && notification.data.title) {
    return notification.data.title
  }
  if (notification.data && notification.data.message) {
    return notification.data.message.split('.')[0] // Use first sentence as title
  }
  
  // Push notification format
  if (notification.title) {
    return notification.title
  }
  
  // Fallback based on type
  const type = notification.type || (notification.data && notification.data.type) || 'default'
  switch (type) {
    case 'webrtc_send_sdp':
      return 'Incoming Call'
    case 'webrtc_receive_sdp':
      return 'Call Answered'
    case 'webrtc_call_ended':
      return 'Call Ended'
    default:
      return 'Notification'
  }
}

// Get notification message from different notification formats
const getNotificationMessage = (notification: any) => {
  if (!notification) return 'You have a new notification'
  
  // Database notification format
  if (notification.data && notification.data.message) {
    return notification.data.message
  }
  
  // Push notification format
  if (notification.body) {
    return notification.body
  }
  if (notification.message) {
    return notification.message
  }
  
  // Fallback based on type and data
  const type = notification.type || (notification.data && notification.data.type) || 'default'
  const data = notification.data || {}
  
  switch (type) {
    case 'webrtc_send_sdp':
      return `${data.caller_name || 'Someone'} is calling you`
    case 'webrtc_receive_sdp':
      return `${data.responder_name || 'Someone'} answered your call`
    case 'webrtc_call_ended':
      return 'Call has ended'
    default:
      return 'You have a new notification'
  }
}

// Format notification time
const formatNotificationTime = (timestamp: Date | string | null | undefined) => {
  if (!timestamp) return 'just now'
  
  try {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'just now'
    }
    
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  } catch (error) {
    console.error('Error formatting notification time:', error)
    return 'just now'
  }
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

// SDP Debug Functions
const validateAndParseSdp = (sdpString: string, type: 'offer' | 'answer') => {
  try {
    sdpError.value = ''
    
    if (!sdpString.trim()) {
      throw new Error(`${type} SDP cannot be empty`)
    }

    // Try to parse as JSON first (database format)
    let sdpData
    try {
      sdpData = JSON.parse(sdpString)
    } catch {
      // If not JSON, assume it's raw SDP string
      sdpData = {
        type: type,
        sdp: sdpString
      }
    }

    // Validate structure
    if (!sdpData.type || !sdpData.sdp) {
      throw new Error(`Invalid SDP structure: missing 'type' or 'sdp' properties`)
    }

    if (!['offer', 'answer'].includes(sdpData.type)) {
      throw new Error(`Invalid SDP type: ${sdpData.type}. Expected 'offer' or 'answer'`)
    }

    // Basic SDP content validation
    if (!sdpData.sdp.includes('v=0') || !sdpData.sdp.includes('o=')) {
      throw new Error('Invalid SDP content: missing required session description fields')
    }

    return {
      valid: true,
      parsed: sdpData,
      analysis: {
        type: sdpData.type,
        hasAudio: sdpData.sdp.includes('m=audio'),
        hasVideo: sdpData.sdp.includes('m=video'),
        hasDataChannel: sdpData.sdp.includes('m=application'),
        iceUfrag: sdpData.sdp.match(/a=ice-ufrag:([^\r\n]+)/)?.[1] || 'N/A',
        icePwd: sdpData.sdp.match(/a=ice-pwd:([^\r\n]+)/)?.[1] || 'N/A',
        fingerprint: sdpData.sdp.match(/a=fingerprint:([^\r\n]+)/)?.[1] || 'N/A',
        sdpSize: sdpData.sdp.length
      }
    }
  } catch (error: any) {
    sdpError.value = error.message
    return {
      valid: false,
      error: error.message
    }
  }
}

const analyzeSdpPair = () => {
  sdpParseResult.value = null
  sdpError.value = ''

  if (!offerSdp.value.trim() && !answerSdp.value.trim()) {
    sdpError.value = 'Please provide at least one SDP (offer or answer)'
    return
  }

  const results: any = {
    timestamp: new Date().toISOString(),
    analysis: {}
  }

  if (offerSdp.value.trim()) {
    results.offer = validateAndParseSdp(offerSdp.value, 'offer')
  }

  if (answerSdp.value.trim()) {
    results.answer = validateAndParseSdp(answerSdp.value, 'answer')
  }

  // Cross-validation if both are provided
  if (results.offer?.valid && results.answer?.valid) {
    results.compatibility = {
      iceCredentialsMatch: results.offer.analysis.iceUfrag === results.answer.analysis.iceUfrag,
      mediaTypesMatch: {
        audio: results.offer.analysis.hasAudio === results.answer.analysis.hasAudio,
        video: results.offer.analysis.hasVideo === results.answer.analysis.hasVideo
      }
    }
  }

  sdpParseResult.value = results
}

const copyToClipboard = async (text: string, type: string) => {
  try {
    await navigator.clipboard.writeText(text)
    console.log(`📋 ${type} copied to clipboard`)
    // You could add a toast notification here
  } catch (error) {
    console.error(`Failed to copy ${type}:`, error)
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = text
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
  }
}

const pasteFromClipboard = async (target: 'offer' | 'answer') => {
  try {
    const text = await navigator.clipboard.readText()
    if (target === 'offer') {
      offerSdp.value = text
    } else {
      answerSdp.value = text
    }
    console.log(`📋 Pasted content to ${target} SDP`)
  } catch (error) {
    console.error('Failed to paste from clipboard:', error)
  }
}

const clearSdpDebugger = () => {
  offerSdp.value = ''
  answerSdp.value = ''
  sdpParseResult.value = null
  sdpError.value = ''
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

        <!-- SDP Debugger -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
              SDP Debugger
            </h2>
            <button
              @click="showSdpDebugger = !showSdpDebugger"
              class="flex items-center px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-sm transition-colors"
            >
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="showSdpDebugger ? 'M9 5l7 7-7 7' : 'M19 9l-7 7-7-7'"></path>
              </svg>
              {{ showSdpDebugger ? 'Hide' : 'Show' }}
            </button>
          </div>

          <div v-if="showSdpDebugger" class="space-y-6">
            <!-- SDP Input Section -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Offer SDP -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Offer SDP
                  </label>
                  <div class="flex gap-1">
                    <button
                      @click="pasteFromClipboard('offer')"
                      class="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-800 dark:text-blue-200 rounded"
                      title="Paste from clipboard"
                    >
                      Paste
                    </button>
                    <button
                      @click="copyToClipboard(offerSdp, 'Offer SDP')"
                      :disabled="!offerSdp"
                      class="text-xs px-2 py-1 bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 text-green-800 dark:text-green-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Copy to clipboard"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <textarea
                  v-model="offerSdp"
                  placeholder="Paste offer SDP here (JSON format or raw SDP)..."
                  class="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono resize-y focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                ></textarea>
              </div>

              <!-- Answer SDP -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Answer SDP
                  </label>
                  <div class="flex gap-1">
                    <button
                      @click="pasteFromClipboard('answer')"
                      class="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-800 dark:text-blue-200 rounded"
                      title="Paste from clipboard"
                    >
                      Paste
                    </button>
                    <button
                      @click="copyToClipboard(answerSdp, 'Answer SDP')"
                      :disabled="!answerSdp"
                      class="text-xs px-2 py-1 bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 text-green-800 dark:text-green-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Copy to clipboard"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <textarea
                  v-model="answerSdp"
                  placeholder="Paste answer SDP here (JSON format or raw SDP)..."
                  class="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono resize-y focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                ></textarea>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex flex-wrap gap-3">
              <button
                @click="analyzeSdpPair"
                :disabled="!offerSdp.trim() && !answerSdp.trim()"
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-md transition-colors disabled:cursor-not-allowed"
              >
                <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                Analyze SDPs
              </button>
              <button
                @click="clearSdpDebugger"
                class="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md transition-colors"
              >
                <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
                Clear All
              </button>
            </div>

            <!-- Error Display -->
            <div v-if="sdpError" class="p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-md">
              <div class="flex items-start">
                <svg class="w-5 h-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <div>
                  <h4 class="text-sm font-medium text-red-800 dark:text-red-200">Error</h4>
                  <p class="text-sm text-red-700 dark:text-red-300 mt-1">{{ sdpError }}</p>
                </div>
              </div>
            </div>

            <!-- Results Display -->
            <div v-if="sdpParseResult" class="space-y-4">
              <div class="border-t pt-4">
                <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3">Analysis Results</h3>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <!-- Offer Analysis -->
                  <div v-if="sdpParseResult.offer" class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                    <h4 class="font-medium text-gray-900 dark:text-white mb-2 flex items-center">
                      <div :class="sdpParseResult.offer.valid ? 'w-2 h-2 bg-green-400 rounded-full mr-2' : 'w-2 h-2 bg-red-400 rounded-full mr-2'"></div>
                      Offer SDP
                    </h4>
                    <div v-if="sdpParseResult.offer.valid" class="space-y-2 text-sm">
                      <div class="flex justify-between">
                        <span class="text-gray-600 dark:text-gray-400">Type:</span>
                        <span class="text-gray-900 dark:text-white">{{ sdpParseResult.offer.analysis.type }}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-gray-600 dark:text-gray-400">Audio:</span>
                        <span :class="sdpParseResult.offer.analysis.hasAudio ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                          {{ sdpParseResult.offer.analysis.hasAudio ? 'Yes' : 'No' }}
                        </span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-gray-600 dark:text-gray-400">Video:</span>
                        <span :class="sdpParseResult.offer.analysis.hasVideo ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                          {{ sdpParseResult.offer.analysis.hasVideo ? 'Yes' : 'No' }}
                        </span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-gray-600 dark:text-gray-400">Size:</span>
                        <span class="text-gray-900 dark:text-white">{{ sdpParseResult.offer.analysis.sdpSize }} bytes</span>
                      </div>
                      <div class="mt-3 pt-2 border-t">
                        <div class="text-xs text-gray-500 dark:text-gray-400 break-all">
                          <div><strong>ICE ufrag:</strong> {{ sdpParseResult.offer.analysis.iceUfrag }}</div>
                          <div class="mt-1"><strong>Fingerprint:</strong> {{ sdpParseResult.offer.analysis.fingerprint }}</div>
                        </div>
                      </div>
                    </div>
                    <div v-else class="text-sm text-red-600 dark:text-red-400">
                      {{ sdpParseResult.offer.error }}
                    </div>
                  </div>

                  <!-- Answer Analysis -->
                  <div v-if="sdpParseResult.answer" class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                    <h4 class="font-medium text-gray-900 dark:text-white mb-2 flex items-center">
                      <div :class="sdpParseResult.answer.valid ? 'w-2 h-2 bg-green-400 rounded-full mr-2' : 'w-2 h-2 bg-red-400 rounded-full mr-2'"></div>
                      Answer SDP
                    </h4>
                    <div v-if="sdpParseResult.answer.valid" class="space-y-2 text-sm">
                      <div class="flex justify-between">
                        <span class="text-gray-600 dark:text-gray-400">Type:</span>
                        <span class="text-gray-900 dark:text-white">{{ sdpParseResult.answer.analysis.type }}</span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-gray-600 dark:text-gray-400">Audio:</span>
                        <span :class="sdpParseResult.answer.analysis.hasAudio ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                          {{ sdpParseResult.answer.analysis.hasAudio ? 'Yes' : 'No' }}
                        </span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-gray-600 dark:text-gray-400">Video:</span>
                        <span :class="sdpParseResult.answer.analysis.hasVideo ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                          {{ sdpParseResult.answer.analysis.hasVideo ? 'Yes' : 'No' }}
                        </span>
                      </div>
                      <div class="flex justify-between">
                        <span class="text-gray-600 dark:text-gray-400">Size:</span>
                        <span class="text-gray-900 dark:text-white">{{ sdpParseResult.answer.analysis.sdpSize }} bytes</span>
                      </div>
                      <div class="mt-3 pt-2 border-t">
                        <div class="text-xs text-gray-500 dark:text-gray-400 break-all">
                          <div><strong>ICE ufrag:</strong> {{ sdpParseResult.answer.analysis.iceUfrag }}</div>
                          <div class="mt-1"><strong>Fingerprint:</strong> {{ sdpParseResult.answer.analysis.fingerprint }}</div>
                        </div>
                      </div>
                    </div>
                    <div v-else class="text-sm text-red-600 dark:text-red-400">
                      {{ sdpParseResult.answer.error }}
                    </div>
                  </div>
                </div>

                <!-- Compatibility Check -->
                <div v-if="sdpParseResult.compatibility" class="mt-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h4 class="font-medium text-blue-900 dark:text-blue-200 mb-2">Compatibility Analysis</h4>
                  <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                      <span class="text-blue-700 dark:text-blue-300">Audio Support:</span>
                      <span :class="sdpParseResult.compatibility.mediaTypesMatch.audio ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                        {{ sdpParseResult.compatibility.mediaTypesMatch.audio ? 'Compatible' : 'Mismatch' }}
                      </span>
                    </div>
                    <div class="flex justify-between">
                      <span class="text-blue-700 dark:text-blue-300">Video Support:</span>
                      <span :class="sdpParseResult.compatibility.mediaTypesMatch.video ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                        {{ sdpParseResult.compatibility.mediaTypesMatch.video ? 'Compatible' : 'Mismatch' }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
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
                      {{ getNotificationIcon(notification.type || notification.data?.type || 'default') }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="font-medium text-gray-900 dark:text-white">
                        {{ getNotificationTitle(notification) }}
                      </p>
                      <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {{ getNotificationMessage(notification) }}
                      </p>
                      <p class="text-xs text-gray-500 dark:text-gray-500 mt-2">
                        {{ notification.time_ago || formatNotificationTime(notification.created_at || notification.timestamp) }}
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
    
    <!-- Incoming Call Modal -->
    <div 
      v-if="showIncomingCallModal && incomingCall" 
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div class="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
        <div class="text-center">
          <div class="mb-4">
            <div class="w-20 h-20 mx-auto bg-blue-500 rounded-full flex items-center justify-center mb-2">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-gray-900 mb-1">Incoming Call</h3>
            <p class="text-gray-600">{{ incomingCall.caller_name || 'Unknown Caller' }}</p>
          </div>
          
          <div class="flex gap-4 justify-center">
            <button
              @click="declineCall"
              class="px-6 py-3 bg-red-500 text-white rounded-full hover:bg-red-600 flex items-center gap-2"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
              Decline
            </button>
            
            <button
              @click="acceptCall"
              class="px-6 py-3 bg-green-500 text-white rounded-full hover:bg-green-600 flex items-center gap-2"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
              </svg>
              Accept
            </button>
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