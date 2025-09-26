import { ref, reactive, computed } from 'vue'
import { 
  UserAgent,
  UserAgentOptions,
  Registerer,
  RegistererState,
  Inviter,
  Invitation,
  SessionState,
  Web,
  LogLevel
} from 'sip.js'

// SIP Connection Configuration Interface  
interface SipConfig {
  uri: string // SIP URI (e.g., 'sip:user@domain.com')
  authorizationUsername?: string
  authorizationPassword?: string
  displayName?: string
  registrarServer: string // Twilio SIP domain or other SIP registrar
  websocketServer: string // WebSocket server URL
  logLevel?: 'error' | 'warn' | 'info' | 'debug'
  stunServers?: string[]
  turnServers?: Array<{
    urls: string
    username?: string
    credential?: string
  }>
}

// Default Twilio configuration template
const defaultTwilioConfig: Partial<SipConfig> = {
  registrarServer: 'your-twilio-domain.pstn.twilio.com',
  websocketServer: 'wss://your-twilio-domain.pstn.twilio.com/ws',
  logLevel: 'info',
  stunServers: [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302'
  ]
}

// Storage key for SIP configuration
const SIP_CONFIG_STORAGE_KEY = 'webrtc_sip_config'

// SIP.js UserAgent and Registerer implementation
export function useSipConnection() {
  // Reactive state
  const isRegistered = ref(false)
  const isConnecting = ref(false)
  const connectionError = ref<string | null>(null)
  const registrationStatus = ref<string>('disconnected')
  
  // SIP configuration
  const sipConfig = ref<SipConfig | null>(null)
  
  // Call state
  const callState = reactive({
    isInCall: false,
    isOutgoing: false,
    isIncoming: false,
    remoteUri: '',
    callDuration: 0,
    isHeld: false,
    isMuted: false,
    currentSession: null as Inviter | Invitation | null
  })

  // SIP.js objects
  const userAgent = ref<UserAgent | null>(null)
  const registerer = ref<Registerer | null>(null)

  // Computed properties
  const isConfigured = computed(() => {
    return sipConfig.value && 
           sipConfig.value.uri && 
           sipConfig.value.registrarServer && 
           sipConfig.value.websocketServer
  })

  const canMakeCall = computed(() => {
    return isRegistered.value && !callState.isInCall
  })

  // Load configuration from localStorage
  const loadStoredConfig = (): SipConfig | null => {
    try {
      const stored = localStorage.getItem(SIP_CONFIG_STORAGE_KEY)
      if (stored) {
        const config = JSON.parse(stored)
        console.log('📞 SIP: Loaded stored configuration')
        return config
      }
    } catch (error) {
      console.error('❌ SIP: Error loading stored config:', error)
    }
    return null
  }

  // Save configuration to localStorage
  const saveConfig = (config: SipConfig) => {
    try {
      localStorage.setItem(SIP_CONFIG_STORAGE_KEY, JSON.stringify(config))
      sipConfig.value = config
      console.log('💾 SIP: Configuration saved to localStorage')
    } catch (error) {
      console.error('❌ SIP: Error saving config:', error)
    }
  }

  // Clear stored configuration
  const clearStoredConfig = () => {
    try {
      localStorage.removeItem(SIP_CONFIG_STORAGE_KEY)
      sipConfig.value = null
      console.log('🗑️ SIP: Stored configuration cleared')
    } catch (error) {
      console.error('❌ SIP: Error clearing stored config:', error)
    }
  }

  // Initialize SIP configuration
  const initializeConfig = (config: SipConfig) => {
    sipConfig.value = config
    console.log('🔧 SIP: Configuration initialized:', {
      uri: config.uri,
      registrarServer: config.registrarServer,
      hasCredentials: !!(config.authorizationUsername && config.authorizationPassword)
    })
  }

  // Connect to WebSocket and initialize UserAgent
  const connect = async (): Promise<boolean> => {
    if (!sipConfig.value) {
      connectionError.value = 'No SIP configuration available'
      return false
    }

    try {
      isConnecting.value = true
      connectionError.value = null
      registrationStatus.value = 'connecting'

      console.log('🔗 SIP: Creating UserAgent...')
      
      // Create UserAgent options
      const userAgentOptions: UserAgentOptions = {
        uri: UserAgent.makeURI(sipConfig.value.uri),
        transportOptions: {
          server: sipConfig.value.websocketServer,
          connectionTimeout: 30
        },
        authorizationUsername: sipConfig.value.authorizationUsername,
        authorizationPassword: sipConfig.value.authorizationPassword,
        displayName: sipConfig.value.displayName,
        logBuiltinEnabled: true,
        logLevel: (sipConfig.value.logLevel as any) || 'info',
        delegate: {
          onConnect: () => {
            console.log('✅ SIP: UserAgent connected')
            registrationStatus.value = 'connected'
            isConnecting.value = false
          },
          onDisconnect: (error?: Error) => {
            console.log('🔌 SIP: UserAgent disconnected', error)
            registrationStatus.value = 'disconnected'
            isRegistered.value = false
            if (error) {
              connectionError.value = error.message
            }
          },
          onInvite: (invitation: Invitation) => {
            console.log('� SIP: Incoming call from:', invitation.remoteIdentity.displayName || invitation.remoteIdentity.uri)
            handleIncomingCall(invitation)
          }
        }
      }

      // Add STUN/TURN servers if provided
      if (sipConfig.value.stunServers || sipConfig.value.turnServers) {
        userAgentOptions.sessionDescriptionHandlerFactoryOptions = {
          peerConnectionConfiguration: {
            iceServers: [
              ...(sipConfig.value.stunServers?.map(server => ({ urls: server })) || []),
              ...(sipConfig.value.turnServers || [])
            ]
          }
        }
      }

      userAgent.value = new UserAgent(userAgentOptions)

      // Start the UserAgent
      await userAgent.value.start()
      
      return true

    } catch (error: any) {
      console.error('❌ SIP: Connection failed:', error)
      connectionError.value = error.message
      registrationStatus.value = 'error'
      isConnecting.value = false
      return false
    }
  }

  // Handle incoming calls
  const handleIncomingCall = (invitation: Invitation) => {
    callState.isIncoming = true
    callState.remoteUri = invitation.remoteIdentity.uri.toString()
    callState.currentSession = invitation

    // Set up session state change handler
    invitation.stateChange.addListener((state: SessionState) => {
      console.log('� SIP: Incoming call state changed to:', state)
      switch (state) {
        case SessionState.Established:
          callState.isInCall = true
          callState.isIncoming = false
          startCallTimer()
          break
        case SessionState.Terminated:
          resetCallState()
          break
      }
    })
  }

  // Register SIP endpoint
  const register = async (config?: SipConfig): Promise<boolean> => {
    if (config) {
      sipConfig.value = config
    } else if (!sipConfig.value) {
      const stored = loadStoredConfig()
      if (stored) {
        sipConfig.value = stored
      } else {
        throw new Error('No SIP configuration provided')
      }
    }

    if (!sipConfig.value) {
      throw new Error('SIP configuration is required')
    }

    try {
      // First connect and create UserAgent
      const connected = await connect()
      if (!connected || !userAgent.value) {
        return false
      }

      // Create registerer
      console.log('📋 SIP: Creating registerer...')
      registerer.value = new Registerer(userAgent.value as any)

      // Set up registerer state change listener
      registerer.value.stateChange.addListener((state: RegistererState) => {
        console.log('📋 SIP: Registerer state changed to:', state)
        switch (state) {
          case RegistererState.Registered:
            isRegistered.value = true
            registrationStatus.value = 'registered'
            console.log('✅ SIP: Registration successful')
            break
          case RegistererState.Unregistered:
            isRegistered.value = false
            registrationStatus.value = 'disconnected'
            console.log('📋 SIP: Unregistered')
            break
          case RegistererState.Initial:
            registrationStatus.value = 'connecting'
            break
          case RegistererState.Terminated:
            isRegistered.value = false
            registrationStatus.value = 'error'
            connectionError.value = 'Registration terminated'
            break
        }
      })

      // Start registration
      await registerer.value.register()
      
      return true

    } catch (error: any) {
      console.error('❌ SIP: Registration failed:', error)
      connectionError.value = error.message
      registrationStatus.value = 'error'
      isRegistered.value = false
      return false
    }
  }

  // Unregister
  const unregister = async (): Promise<void> => {
    try {
      if (registerer.value && isRegistered.value) {
        console.log('📋 SIP: Unregistering...')
        await registerer.value.unregister()
      }

      if (userAgent.value) {
        await userAgent.value.stop()
        userAgent.value = null
      }

      registerer.value = null
      isRegistered.value = false
      registrationStatus.value = 'disconnected'
      console.log('✅ SIP: Unregistered successfully')

    } catch (error: any) {
      console.error('❌ SIP: Unregistration error:', error)
      connectionError.value = error.message
    }
  }

  // Make SIP call using SIP.js Inviter
  const makeCall = async (targetUri: string): Promise<boolean> => {
    if (!isRegistered.value || !userAgent.value) {
      throw new Error('Not registered to SIP server')
    }

    try {
      console.log('📞 SIP: Initiating call to:', targetUri)
      
      // Create the target URI
      const target = UserAgent.makeURI(targetUri)
      if (!target) {
        throw new Error('Invalid target URI')
      }

      // Create inviter
      const inviter = new Inviter(userAgent.value as any, target, {
        sessionDescriptionHandlerOptions: {
          constraints: {
            audio: true,
            video: false // Set to true if you want video calls
          }
        }
      })

      // Set up session state change handler
      inviter.stateChange.addListener((state: SessionState) => {
        console.log('📞 SIP: Outgoing call state changed to:', state)
        switch (state) {
          case SessionState.Establishing:
            callState.isInCall = true
            callState.isOutgoing = true
            callState.remoteUri = targetUri
            callState.currentSession = inviter
            break
          case SessionState.Established:
            startCallTimer()
            break
          case SessionState.Terminated:
            resetCallState()
            break
        }
      })

      // Send the invite
      await inviter.invite()
      
      return true

    } catch (error: any) {
      console.error('❌ SIP: Call failed:', error)
      resetCallState()
      throw error
    }
  }

  // Answer incoming call
  const answerCall = async (): Promise<void> => {
    if (!callState.isIncoming || !callState.currentSession) {
      throw new Error('No incoming call to answer')
    }

    try {
      console.log('✅ SIP: Answering call')
      
      const invitation = callState.currentSession as Invitation
      await invitation.accept({
        sessionDescriptionHandlerOptions: {
          constraints: {
            audio: true,
            video: false // Set to true if you want video calls
          }
        }
      })

    } catch (error: any) {
      console.error('❌ SIP: Error answering call:', error)
      throw error
    }
  }

  // End call
  const endCall = async (): Promise<void> => {
    if (!callState.isInCall || !callState.currentSession) {
      return
    }

    try {
      console.log('📞 SIP: Ending call')
      
      const session = callState.currentSession
      
      // End the session based on its type
      if (session instanceof Inviter) {
        // Outgoing call - cancel or bye
        switch (session.state) {
          case SessionState.Initial:
          case SessionState.Establishing:
            await session.cancel()
            break
          case SessionState.Established:
            await session.bye()
            break
        }
      } else if (session instanceof Invitation) {
        // Incoming call - reject or bye
        switch (session.state) {
          case SessionState.Initial:
            await session.reject()
            break
          case SessionState.Established:
            await session.bye()
            break
        }
      }

    } catch (error: any) {
      console.error('❌ SIP: Error ending call:', error)
      resetCallState()
      throw error
    }
  }

  // Call timer
  let callTimer: number | null = null
  
  const startCallTimer = () => {
    if (callTimer) {
      clearInterval(callTimer)
    }
    
    callState.callDuration = 0
    callTimer = window.setInterval(() => {
      callState.callDuration++
    }, 1000)
  }

  // Reset call state
  const resetCallState = () => {
    callState.isInCall = false
    callState.isOutgoing = false
    callState.isIncoming = false
    callState.remoteUri = ''
    callState.callDuration = 0
    callState.isHeld = false
    callState.isMuted = false
    
    if (callTimer) {
      clearInterval(callTimer)
      callTimer = null
    }
  }

  // Get Twilio configuration template
  const getTwilioConfigTemplate = (): SipConfig => ({
    ...defaultTwilioConfig as SipConfig,
    uri: 'sip:username@your-twilio-domain.pstn.twilio.com',
    authorizationUsername: '',
    authorizationPassword: '',
    displayName: 'Your Name'
  })

  // Mute/unmute audio
  const toggleMute = async (): Promise<void> => {
    if (!callState.currentSession || !callState.isInCall) {
      return
    }

    try {
      const session = callState.currentSession
      
      // Get the session description handler
      const sessionDescriptionHandler = (session as any).sessionDescriptionHandler
      
      if (sessionDescriptionHandler && sessionDescriptionHandler.peerConnection) {
        const senders = sessionDescriptionHandler.peerConnection.getSenders()
        const audioSender = senders.find((sender: any) => sender.track && sender.track.kind === 'audio')
        
        if (audioSender && audioSender.track) {
          audioSender.track.enabled = !audioSender.track.enabled
          callState.isMuted = !audioSender.track.enabled
          console.log('🔇 SIP: Audio', callState.isMuted ? 'muted' : 'unmuted')
        }
      }
    } catch (error: any) {
      console.error('❌ SIP: Error toggling mute:', error)
    }
  }

  // Hold/unhold call
  const toggleHold = async (): Promise<void> => {
    if (!callState.currentSession || !callState.isInCall) {
      return
    }

    try {
      const session = callState.currentSession as any
      
      if (callState.isHeld) {
        // Unhold
        if (session.unhold) {
          await session.unhold()
          callState.isHeld = false
          console.log('▶️ SIP: Call resumed')
        }
      } else {
        // Hold
        if (session.hold) {
          await session.hold()
          callState.isHeld = true
          console.log('⏸️ SIP: Call on hold')
        }
      }
    } catch (error: any) {
      console.error('❌ SIP: Error toggling hold:', error)
    }
  }

  // Initialize with stored config if available
  const storedConfig = loadStoredConfig()
  if (storedConfig) {
    sipConfig.value = storedConfig
  }

  return {
    // State
    isRegistered,
    isConnecting,
    connectionError,
    registrationStatus,
    sipConfig,
    callState,
    
    // Computed
    isConfigured,
    canMakeCall,
    
    // Methods
    initializeConfig,
    register,
    unregister,
    makeCall,
    answerCall,
    endCall,
    toggleMute,
    toggleHold,
    saveConfig,
    clearStoredConfig,
    loadStoredConfig,
    getTwilioConfigTemplate,
    connect
  }
}