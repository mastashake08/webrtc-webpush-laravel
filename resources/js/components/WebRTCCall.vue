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
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
}

// Helper function to parse SDP data from database storage
const parseSdpData = (rawSdp: any, context: string = 'SDP'): RTCSessionDescriptionInit => {
  console.log(`📞 WebRTCCall: Parsing ${context} data:`, rawSdp)
  
  let sdpData
  try {
    if (typeof rawSdp === 'string') {
      // If it's a JSON string, parse it
      sdpData = JSON.parse(rawSdp)
    } else if (typeof rawSdp === 'object' && rawSdp !== null) {
      // If it's already an object, use it directly
      sdpData = rawSdp
    } else {
      throw new Error(`Invalid ${context} format: expected string or object`)
    }
    
    // Validate SDP structure
    if (!sdpData.type || !sdpData.sdp) {
      throw new Error(`${context} missing required 'type' or 'sdp' properties`)
    }
    
    // Validate SDP type
    if (!['offer', 'answer'].includes(sdpData.type)) {
      throw new Error(`${context} has invalid type: ${sdpData.type}`)
    }
    
    console.log(`✅ WebRTCCall: Successfully parsed ${context}:`, {
      type: sdpData.type,
      sdpLength: sdpData.sdp.length,
      ...sdpData
    })
    
    return sdpData
    
  } catch (error: any) {
    console.error(`❌ WebRTCCall: Error parsing ${context}:`, error.message)
    console.error(`❌ WebRTCCall: Raw ${context} data:`, rawSdp)
    throw new Error(`Failed to parse ${context}: ${error.message}`)
  }
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
    console.log('📹 WebRTCCall: Received remote track:', event)
    remoteStream = event.streams[0]
    console.log('📹 WebRTCCall: Remote stream:', remoteStream)
    
    if (remoteVideo.value) {
      console.log('📹 WebRTCCall: Setting remote video srcObject')
      remoteVideo.value.srcObject = remoteStream
      
      // Try to play remote video
      remoteVideo.value.play().catch(error => {
        console.warn('📹 WebRTCCall: Remote video play failed:', error)
      })
    } else {
      console.warn('📹 WebRTCCall: remoteVideo ref not available yet')
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
    console.log('📹 WebRTCCall: Requesting user media with constraints:', constraints)
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    localStream = stream
    console.log('📹 WebRTCCall: Got user media stream:', stream)
    
    // Ensure the video element is updated
    if (localVideo.value) {
      console.log('📹 WebRTCCall: Setting local video srcObject')
      localVideo.value.srcObject = stream
      
      // Force play the video
      try {
        await localVideo.value.play()
        console.log('📹 WebRTCCall: Local video playing successfully')
      } catch (playError) {
        console.warn('📹 WebRTCCall: Video play failed (this is often normal):', playError)
      }
    } else {
      console.warn('📹 WebRTCCall: localVideo ref not available yet')
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
  debugCurrentState()
  
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
    isCallActive.value = true // Set this early to show local video
    connectionStatus.value = 'connecting'
    
    // Generate a unique call ID for outgoing calls
    if (!callId.value) {
      callId.value = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      console.log('📞 WebRTCCall: Generated call ID:', callId.value)
    }
    
    console.log('📞 WebRTCCall: After setting call states...')
    debugCurrentState()
    
    // Get user media FIRST
    console.log('📹 WebRTCCall: Getting user media...')
    await getUserMedia()
    console.log('📹 WebRTCCall: User media obtained successfully')
    
    // Initialize peer connection
    initializePeerConnection()
    
    // Add local stream to peer connection
    if (localStream && peerConnection) {
      console.log('📞 WebRTCCall: Adding tracks to peer connection')
      localStream.getTracks().forEach(track => {
        console.log('📞 WebRTCCall: Adding track:', track.kind)
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
      
      // 🔧 DEBUG: Log the full request being sent
      console.log('🔧 DEBUG: Full API request payload:', {
        target_user_id: props.targetUserId,
        sdp: offer,
        call_type: props.callType
      })
      
      // Send offer via API
      const response = await axios.post('/api/webrtc/send-offer', {
        target_user_id: props.targetUserId,
        sdp: offer,
        call_type: props.callType
      })
      
      console.log('✅ WebRTCCall: Call offer sent successfully:', response.data)
      console.log('🔧 DEBUG: Response status:', response.status)
      console.log('🔧 DEBUG: Response headers:', response.headers)
      
      startCallTimer()
      emit('callStarted', callId.value)
    }
    
  } catch (error: any) {
    console.error('❌ WebRTCCall: Error starting call:', error)
    
    // 🔧 DEBUG: Enhanced error logging
    if (error.response) {
      console.error('🔧 DEBUG: API Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers
      })
    } else if (error.request) {
      console.error('🔧 DEBUG: Network Error - No response received:', error.request)
    } else {
      console.error('🔧 DEBUG: Request setup error:', error.message)
    }
    
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
      console.log('📞 WebRTCCall: Setting remote description from props...')
      
      try {
        const sdpOffer = JSON.parse(props.incomingCall.sdp)
        console.log('📞 WebRTCCall: Setting remote description with parsed SDP:', sdpOffer)
        await peerConnection.setRemoteDescription(sdpOffer)
      } catch (error: any) {
        console.error('❌ WebRTCCall: Failed to set remote description from props:', error)
        throw error
      }
      
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

// Accept incoming call with explicit data (called from dashboard)
const acceptIncomingCall = async (callData: any) => {
  console.log('📞 WebRTCCall: acceptIncomingCall called with data:', callData)
  
  if (!callData) {
    console.error('❌ WebRTCCall: No call data provided to acceptIncomingCall')
    return
  }
  
  try {
    console.log('📞 WebRTCCall: Starting acceptIncomingCall process...')
    debugCurrentState()
    
    isIncomingCall.value = false
    isCallActive.value = true
    connectionStatus.value = 'connecting'
    callId.value = callData.call_id
    callerName.value = callData.caller_name || 'Unknown'
    
    console.log('📞 WebRTCCall: Getting user media for answer...')
    // Get user media
    await getUserMedia()
    
    console.log('📞 WebRTCCall: After getUserMedia...')
    debugCurrentState()
    
    // Initialize peer connection
    initializePeerConnection()
    
    // Add local stream to peer connection
    if (localStream && peerConnection) {
      console.log('📞 WebRTCCall: Adding local tracks to peer connection')
      localStream.getTracks().forEach(track => {
        console.log('📞 WebRTCCall: Adding track:', track.kind)
        peerConnection!.addTrack(track, localStream!)
      })
    }
    
    // Set remote description (the offer)
    if (peerConnection && callData.sdp) {
      console.log('📞 WebRTCCall: Setting remote description and creating answer...')
      
      try {
        console.log(callData.sdp)
        const sdpOffer = parseSdpData(callData.sdp, 'incoming call offer')
        const remoteDesc = new RTCSessionDescription(sdpOffer)
        await peerConnection.setRemoteDescription(remoteDesc)
      } catch (error: any) {
        console.error('❌ WebRTCCall: Failed to set remote description:', error)
        throw error
      }
      
      // Create answer
      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)
      
      console.log('📞 WebRTCCall: Sending answer via API...', {
        caller_user_id: callData.caller_id,
        call_id: callData.call_id,
        session_id: callData.session_id
      })
      
      // Send answer via API
      console.log('📞 WebRTCCall: Preparing to send answer via API...', {
        caller_user_id: callData.caller_id,
        call_id: callData.call_id,
        session_id: callData.session_id,
        answer_type: answer.type,
        answer_sdp_length: answer.sdp?.length || 0
      })
      
      const response = await axios.post('/api/webrtc/send-answer', {
        caller_user_id: callData.caller_id,
        call_id: callData.call_id,
        sdp: answer,
        call_type: callData.call_type,
        session_id: callData.session_id
      })
      
      console.log('✅ WebRTCCall: Answer sent successfully:', response.data)
      
      if (!response.data.success) {
        throw new Error(`API response not successful: ${response.data.message || 'Unknown error'}`)
      }
      
      console.log('📞 WebRTCCall: After sending answer...')
      debugCurrentState()
      
      startCallTimer()
      emit('callAccepted', callData.call_id)
    }
    
  } catch (error: any) {
    console.error('❌ WebRTCCall: Error accepting call:', error)
    if (error.response) {
      console.error('❌ WebRTCCall: API Error:', error.response.data)
    }
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
  console.log('🧊 WebRTCCall: sendIceCandidate called')
  console.log('🧊 WebRTCCall: targetUserId:', props.targetUserId)
  console.log('🧊 WebRTCCall: callId:', callId.value)
  console.log('🧊 WebRTCCall: candidate:', candidate)
  
  if (!props.targetUserId) {
    console.error('❌ WebRTCCall: No target user for ICE candidate')
    return
  }
  
  if (!callId.value) {
    console.error('❌ WebRTCCall: No call ID for ICE candidate')
    return
  }
  
  try {
    const payload = {
      target_user_id: props.targetUserId,
      call_id: callId.value,
      ice_candidate: {
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex
      }
    }
    
    console.log('📡 WebRTCCall: Sending ICE candidate with payload:', payload)
    
    await axios.post('/api/webrtc/send-ice-candidate', payload)
    
    console.log('✅ WebRTCCall: ICE candidate sent successfully')
    
  } catch (error) {
    console.error('❌ WebRTCCall: Error sending ICE candidate:', error)
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
      console.log('📞 WebRTCCall: Handling remote answer...')
      
      const sdpAnswer = parseSdpData(answerData, 'remote answer')
      const remoteDesc = new RTCSessionDescription(sdpAnswer)
      await peerConnection.setRemoteDescription(remoteDesc)
      
      isCallActive.value = true
      isOutgoingCall.value = false
      console.log('✅ WebRTCCall: Remote answer set successfully')
      
    } catch (error: any) {
      console.error('❌ WebRTCCall: Error setting remote answer:', error)
      emit('error', 'Failed to process call answer')
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
const showLocalVideo = computed(() => {
  const shouldShow = props.callType === 'video' && localStream !== null && (isCallActive.value || isOutgoingCall.value)
  console.log('📹 WebRTCCall: showLocalVideo computed:', {
    callType: props.callType,
    hasLocalStream: localStream !== null,
    isCallActive: isCallActive.value,
    isOutgoingCall: isOutgoingCall.value,
    shouldShow
  })
  return shouldShow
})

const showRemoteVideo = computed(() => {
  const shouldShow = props.callType === 'video' && remoteStream !== null
  console.log('📹 WebRTCCall: showRemoteVideo computed:', {
    callType: props.callType,
    hasRemoteStream: remoteStream !== null,
    shouldShow
  })
  return shouldShow
})

// Watch for remote stream changes and update video element  
watch(() => remoteStream, (newStream) => {
  console.log('📹 WebRTCCall: Remote stream changed:', newStream)
  if (newStream && remoteVideo.value) {
    console.log('📹 WebRTCCall: Updating remote video element with new stream')
    remoteVideo.value.srcObject = newStream
    remoteVideo.value.play().catch(error => {
      console.warn('📹 WebRTCCall: Remote video play failed:', error)
    })
  }
})

// Watch for remote video element becoming available
watch(() => remoteVideo.value, (videoElement) => {
  console.log('📹 WebRTCCall: Remote video element changed:', videoElement)
  if (videoElement && remoteStream) {
    console.log('📹 WebRTCCall: Setting existing remote stream on new video element')
    videoElement.srcObject = remoteStream
    videoElement.play().catch(error => {
      console.warn('📹 WebRTCCall: Remote video play failed:', error)
    })
  }
})

// Helper function to debug current state
const debugCurrentState = () => {
  console.log('🔧 WebRTCCall: Current State Debug:', {
    callId: callId.value,
    callerName: callerName.value,
    isCallActive: isCallActive.value,
    isIncomingCall: isIncomingCall.value,
    isOutgoingCall: isOutgoingCall.value,
    isVideoEnabled: isVideoEnabled.value,
    isAudioEnabled: isAudioEnabled.value,
    connectionStatus: connectionStatus.value,
    hasLocalStream: localStream !== null,
    hasRemoteStream: remoteStream !== null,
    hasLocalVideo: localVideo.value !== undefined,
    hasRemoteVideo: remoteVideo.value !== undefined,
    localVideoSrc: localVideo.value?.srcObject ? 'set' : 'null',
    remoteVideoSrc: remoteVideo.value?.srcObject ? 'set' : 'null',
    showLocalVideo: showLocalVideo.value,
    showRemoteVideo: showRemoteVideo.value,
    hasPeerConnection: peerConnection !== null,
    peerConnectionState: peerConnection?.connectionState || 'none'
  })
}

// Watch for local stream changes and update video element
watch(() => localStream, (newStream) => {
  console.log('📹 WebRTCCall: Local stream changed:', newStream)
  if (newStream && localVideo.value) {
    console.log('📹 WebRTCCall: Updating local video element with new stream')
    localVideo.value.srcObject = newStream
    localVideo.value.play().catch(error => {
      console.warn('📹 WebRTCCall: Video play failed:', error)
    })
  }
})

// Watch for video element becoming available
watch(() => localVideo.value, (videoElement) => {
  console.log('📹 WebRTCCall: Local video element changed:', videoElement)
  if (videoElement && localStream) {
    console.log('📹 WebRTCCall: Setting stream on newly available video element')
    videoElement.srcObject = localStream
    videoElement.play().catch(error => {
      console.warn('📹 WebRTCCall: Video play failed:', error)
    })
  }
})

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
  acceptIncomingCall,
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