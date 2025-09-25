<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import axios from 'axios'

// Props
interface Props {
  targetUserId?: number
  callType?: 'video' | 'audio' | 'data'
  incomingCall?: any
}

const props = withDefaults(defineProps<Props>(), {
  callType: 'video',
})

// Emits
const emit = defineEmits<{
  callStarted: [callId: string]
  callEnded: [reason: string]
  callAccepted: [callId: string]
  callDeclined: [callId: string]
  error: [error: string]
}>()

// Refs
const localVideo = ref<HTMLVideoElement>()
const remoteVideo = ref<HTMLVideoElement>()
const isCallActive = ref(false)
const isIncomingCall = ref(false)
const isOutgoingCall = ref(false)
const callId = ref<string>('')
const callerName = ref<string>('')
const isVideoEnabled = ref(true)
const isAudioEnabled = ref(true)
const callDuration = ref(0)
const connectionStatus = ref<'connecting' | 'connected' | 'disconnected' | 'failed'>('disconnected')

// WebRTC objects
let localStream: MediaStream | null = null
let remoteStream: MediaStream | null = null
let peerConnection: RTCPeerConnection | null = null
let callTimer: number | null = null

// Get current user
const page = usePage()
const currentUser = computed(() => page.props.auth?.user)

// WebRTC configuration
const rtcConfiguration: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
}

// Initialize WebRTC
const initializePeerConnection = () => {
  peerConnection = new RTCPeerConnection(rtcConfiguration)
  
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && props.targetUserId) {
      sendIceCandidate(event.candidate)
    }
  }
  
  peerConnection.ontrack = (event) => {
    remoteStream = event.streams[0]
    if (remoteVideo.value) {
      remoteVideo.value.srcObject = remoteStream
    }
  }
  
  peerConnection.onconnectionstatechange = () => {
    if (peerConnection) {
      connectionStatus.value = peerConnection.connectionState as any
      
      if (peerConnection.connectionState === 'connected') {
        console.log('WebRTC connection established')
      } else if (peerConnection.connectionState === 'failed') {
        endCall('error')
      }
    }
  }
}

// Get user media
const getUserMedia = async (): Promise<MediaStream> => {
  const constraints: MediaStreamConstraints = {
    video: props.callType === 'video',
    audio: props.callType === 'video' || props.callType === 'audio'
  }
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    localStream = stream
    
    if (localVideo.value) {
      localVideo.value.srcObject = stream
    }
    
    return stream
  } catch (error) {
    console.error('Error getting user media:', error)
    emit('error', 'Failed to access camera/microphone')
    throw error
  }
}

// Send call offer
const startCall = async () => {
  console.log('📞 WebRTCCall: startCall() method called')
  console.log('📞 WebRTCCall: targetUserId:', props.targetUserId)
  console.log('📞 WebRTCCall: callType:', props.callType)
  
  if (!props.targetUserId) {
    console.error('❌ WebRTCCall: No target user specified')
    emit('error', 'No target user specified')
    return
  }
  
  try {
    console.log('🔄 WebRTCCall: Setting outgoing call state')
    isOutgoingCall.value = true
    connectionStatus.value = 'connecting'
    
    // Get user media
    await getUserMedia()
    
    // Initialize peer connection
    initializePeerConnection()
    
    // Add local stream to peer connection
    if (localStream && peerConnection) {
      localStream.getTracks().forEach(track => {
        peerConnection!.addTrack(track, localStream!)
      })
    }
    
    // Create offer
    if (peerConnection) {
      console.log('🎯 WebRTCCall: Creating WebRTC offer...')
      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)
      
      console.log('📡 WebRTCCall: Sending offer to API...', {
        target_user_id: props.targetUserId,
        call_type: props.callType,
        sdp_type: offer.type
      })
      
      // Send offer via API
      const response = await axios.post('/api/webrtc/send-offer', {
        target_user_id: props.targetUserId,
        sdp: offer,
        call_type: props.callType
      })
      
      console.log('✅ WebRTCCall: Call offer sent successfully:', response.data)
      
      startCallTimer()
      emit('callStarted', callId.value)
    }
    
  } catch (error) {
    console.error('Error starting call:', error)
    emit('error', 'Failed to start call')
    cleanup()
  }
}

// Accept incoming call
const acceptCall = async () => {
  if (!props.incomingCall) {
    return
  }
  
  try {
    isIncomingCall.value = false
    isCallActive.value = true
    connectionStatus.value = 'connecting'
    
    // Get user media
    await getUserMedia()
    
    // Initialize peer connection
    initializePeerConnection()
    
    // Add local stream to peer connection
    if (localStream && peerConnection) {
      localStream.getTracks().forEach(track => {
        peerConnection!.addTrack(track, localStream!)
      })
    }
    
    // Set remote description (the offer)
    if (peerConnection && props.incomingCall.sdp) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(props.incomingCall.sdp))
      
      // Create answer
      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)
      
      // Send answer via API
      const response = await axios.post('/api/webrtc/send-answer', {
        caller_user_id: props.incomingCall.caller_id,
        call_id: props.incomingCall.call_id,
        sdp: answer,
        call_type: props.callType
      })
      
      startCallTimer()
      emit('callAccepted', props.incomingCall.call_id)
    }
    
  } catch (error) {
    console.error('Error accepting call:', error)
    emit('error', 'Failed to accept call')
    cleanup()
  }
}

// Decline incoming call
const declineCall = async () => {
  if (!props.incomingCall) {
    return
  }
  
  try {
    await axios.post('/api/webrtc/end-call', {
      target_user_id: props.incomingCall.caller_id,
      call_id: props.incomingCall.call_id,
      reason: 'declined'
    })
    
    emit('callDeclined', props.incomingCall.call_id)
    cleanup()
    
  } catch (error) {
    console.error('Error declining call:', error)
    cleanup()
  }
}

// End call
const endCall = async (reason: string = 'ended') => {
  console.log('📞 WebRTCCall: endCall() called with reason:', reason)
  
  if (!isCallActive.value && !isOutgoingCall.value) {
    console.log('📞 WebRTCCall: No active call to end')
    return
  }
  
  try {
    if (props.targetUserId) {
      console.log('📡 WebRTCCall: Sending end-call API request...')
      await axios.post('/api/webrtc/end-call', {
        target_user_id: props.targetUserId,
        call_id: callId.value,
        reason
      })
      console.log('✅ WebRTCCall: End-call API request successful')
    }
    
    console.log('📞 WebRTCCall: Emitting callEnded event and cleaning up...')
    emit('callEnded', reason)
    cleanup()
    
  } catch (error) {
    console.error('❌ WebRTCCall: Error ending call:', error)
    cleanup()
  }
}

// Send ICE candidate
const sendIceCandidate = async (candidate: RTCIceCandidate) => {
  if (!props.targetUserId) {
    return
  }
  
  try {
    await axios.post('/api/webrtc/send-ice-candidate', {
      target_user_id: props.targetUserId,
      call_id: callId.value,
      ice_candidate: {
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex
      }
    })
    
  } catch (error) {
    console.error('Error sending ICE candidate:', error)
  }
}

// Handle remote ICE candidate
const handleRemoteIceCandidate = async (candidateData: any) => {
  if (peerConnection && candidateData) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidateData))
    } catch (error) {
      console.error('Error adding ICE candidate:', error)
    }
  }
}

// Handle remote SDP answer
const handleRemoteAnswer = async (answerData: any) => {
  if (peerConnection && answerData) {
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answerData))
      isCallActive.value = true
      isOutgoingCall.value = false
    } catch (error) {
      console.error('Error setting remote description:', error)
    }
  }
}

// Toggle video
const toggleVideo = () => {
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
      isVideoEnabled.value = videoTrack.enabled
    }
  }
}

// Toggle audio
const toggleAudio = () => {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      isAudioEnabled.value = audioTrack.enabled
    }
  }
}

// Start call timer
const startCallTimer = () => {
  callTimer = window.setInterval(() => {
    callDuration.value++
  }, 1000)
}

// Format call duration
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Cleanup function
const cleanup = () => {
  isCallActive.value = false
  isIncomingCall.value = false
  isOutgoingCall.value = false
  connectionStatus.value = 'disconnected'
  
  if (callTimer) {
    clearInterval(callTimer)
    callTimer = null
  }
  
  callDuration.value = 0
  
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop())
    localStream = null
  }
  
  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop())
    remoteStream = null
  }
  
  if (peerConnection) {
    peerConnection.close()
    peerConnection = null
  }
  
  if (localVideo.value) {
    localVideo.value.srcObject = null
  }
  
  if (remoteVideo.value) {
    remoteVideo.value.srcObject = null
  }
}

// Computed properties
const showLocalVideo = computed(() => props.callType === 'video' && localStream)
const showRemoteVideo = computed(() => props.callType === 'video' && remoteStream)

// Watch for incoming call changes
watch(() => props.incomingCall, (newCall: any) => {
  if (newCall) {
    isIncomingCall.value = true
    callerName.value = newCall.caller_name || 'Unknown'
    callId.value = newCall.call_id || ''
  }
}, { immediate: true })

// Lifecycle
onMounted(() => {
  // Check if WebRTC is supported
  if (!navigator.mediaDevices || !window.RTCPeerConnection) {
    emit('error', 'WebRTC is not supported in this browser')
  }
})

onUnmounted(() => {
  cleanup()
})

// Expose methods for parent components
defineExpose({
  startCall,
  acceptCall,
  declineCall,
  endCall,
  toggleVideo,
  toggleAudio,
  handleRemoteIceCandidate,
  handleRemoteAnswer
})
</script>

<template>
  <div class="webrtc-component">
    <!-- Incoming Call Modal -->
    <div
      v-if="isIncomingCall"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    >
      <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
        <div class="text-center">
          <div class="mb-4">
            <div class="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full mx-auto flex items-center justify-center mb-3">
              <svg class="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              Incoming {{ callType }} call
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {{ callerName }} is calling you
            </p>
          </div>
          
          <div class="flex space-x-3">
            <button
              @click="declineCall"
              class="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors"
            >
              Decline
            </button>
            <button
              @click="acceptCall"
              class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Call Interface -->
    <div v-if="isCallActive || isOutgoingCall" class="call-interface">
      <!-- Video containers -->
      <div class="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
        <!-- Remote video (main) -->
        <video
          v-if="showRemoteVideo"
          ref="remoteVideo"
          autoplay
          playsinline
          class="w-full h-full object-cover"
        />
        
        <!-- Local video (picture-in-picture) -->
        <div
          v-if="showLocalVideo"
          class="absolute top-4 right-4 w-32 h-24 bg-gray-800 rounded-lg overflow-hidden border-2 border-white shadow-lg"
        >
          <video
            ref="localVideo"
            autoplay
            playsinline
            muted
            class="w-full h-full object-cover"
          />
        </div>
        
        <!-- Call info overlay -->
        <div class="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-3 py-2 rounded-lg">
          <div class="text-sm">
            <div>{{ isOutgoingCall ? 'Calling...' : callerName || 'In Call' }}</div>
            <div v-if="isCallActive" class="text-xs opacity-75">
              {{ formatDuration(callDuration) }}
            </div>
            <div class="text-xs opacity-75 capitalize">
              {{ connectionStatus }}
            </div>
          </div>
        </div>
        
        <!-- Call controls -->
        <div class="absolute bottom-6 left-1/2 transform -translate-x-1/2">
          <div class="flex items-center space-x-4">
            <!-- Toggle Video -->
            <button
              v-if="callType === 'video'"
              @click="toggleVideo"
              :class="[
                'p-3 rounded-full transition-colors',
                isVideoEnabled 
                  ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                  : 'bg-red-600 hover:bg-red-700 text-white'
              ]"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path v-if="isVideoEnabled" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728"></path>
              </svg>
            </button>
            
            <!-- Toggle Audio -->
            <button
              @click="toggleAudio"
              :class="[
                'p-3 rounded-full transition-colors',
                isAudioEnabled 
                  ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                  : 'bg-red-600 hover:bg-red-700 text-white'
              ]"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path v-if="isAudioEnabled" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"></path>
              </svg>
            </button>
            
            <!-- End Call -->
            <button
              @click="() => endCall()"
              class="p-3 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 3l18 18"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.call-interface {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  background: black;
}

@media (max-width: 640px) {
  .call-interface .absolute.bottom-6 {
    bottom: 2rem;
  }
  
  .call-interface .absolute.top-4.right-4 {
    width: 6rem;
    height: 4.5rem;
    top: 1rem;
    right: 1rem;
  }
}</style>