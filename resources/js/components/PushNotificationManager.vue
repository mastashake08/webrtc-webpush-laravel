<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import axios from 'axios'

// Props
interface Props {
  vapidPublicKey?: string
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  notificationReceived: [notification: any]
  subscriptionChanged: [isSubscribed: boolean]
  error: [error: string]
}>()

// State
const isSubscribed = ref(false)
const isSupported = ref(false)
const isLoading = ref(false)
const permission = ref<NotificationPermission>('default')
const badgeCount = ref(0)

// Get current user
const page = usePage()
const currentUser = computed(() => page.props.auth?.user)

// Service worker registration
let swRegistration: ServiceWorkerRegistration | null = null

// Initialize push notifications
const initializePushNotifications = async () => {
  try {
    // Check for service worker and push support
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('Push messaging is not supported')
      isSupported.value = false
      return
    }

    isSupported.value = true
    permission.value = Notification.permission

    // Register service worker
    swRegistration = await navigator.serviceWorker.register('/sw.js')
    console.log('Service Worker registered with scope:', swRegistration.scope)
    console.log('Service Worker registered successfully')

    // Check current subscription
    await checkSubscriptionStatus()

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage)

    // Get initial badge count
    await fetchBadgeCount()

  } catch (error) {
    console.error('Error initializing push notifications:', error)
    emit('error', 'Failed to initialize push notifications')
  }
}

// Check if user is already subscribed
const checkSubscriptionStatus = async () => {
  if (!swRegistration) return

  try {
    const subscription = await swRegistration.pushManager.getSubscription()
    isSubscribed.value = !!subscription
    emit('subscriptionChanged', isSubscribed.value)
  } catch (error) {
    console.error('Error checking subscription status:', error)
  }
}

// Request notification permission
const requestPermission = async (): Promise<NotificationPermission> => {
  const result = await Notification.requestPermission()
  permission.value = result
  return result
}

// Subscribe to push notifications
const subscribe = async () => {
  if (!swRegistration || !isSupported.value) {
    emit('error', 'Push notifications are not supported')
    return
  }

  isLoading.value = true

  try {
    // Request permission if not granted
    if (permission.value !== 'granted') {
      const result = await requestPermission()
      if (result !== 'granted') {
        throw new Error('Notification permission denied')
      }
    }

    // Get VAPID public key
    const vapidKey = props.vapidPublicKey || await getVapidPublicKey()
    
    if (!vapidKey) {
      throw new Error('VAPID public key not found')
    }

    // Subscribe to push manager
    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource
    })

    // Send subscription to server
    await sendSubscriptionToServer(subscription)

    isSubscribed.value = true
    emit('subscriptionChanged', true)
    console.log('Successfully subscribed to push notifications')

  } catch (error) {
    console.error('Error subscribing to push notifications:', error)
    emit('error', 'Failed to subscribe to push notifications')
  } finally {
    isLoading.value = false
  }
}

// Unsubscribe from push notifications
const unsubscribe = async () => {
  if (!swRegistration) return

  isLoading.value = true

  try {
    const subscription = await swRegistration.pushManager.getSubscription()
    
    if (subscription) {
      // Unsubscribe from push manager
      await subscription.unsubscribe()
      
      // Remove subscription from server
      await removeSubscriptionFromServer(subscription)
    }

    isSubscribed.value = false
    emit('subscriptionChanged', false)
    console.log('Successfully unsubscribed from push notifications')

  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error)
    emit('error', 'Failed to unsubscribe from push notifications')
  } finally {
    isLoading.value = false
  }
}

// Get VAPID public key from server
const getVapidPublicKey = async (): Promise<string | null> => {
  try {
    const response = await axios.get('/api/notifications/vapid-key')
    return response.data.public_key
  } catch (error) {
    console.error('Error getting VAPID public key:', error)
    return null
  }
}

// Send subscription to server
const sendSubscriptionToServer = async (subscription: PushSubscription) => {
  const subscriptionObject = subscription.toJSON()
  
  const response = await axios.post('/api/notifications/subscribe', {
    endpoint: subscriptionObject.endpoint,
    keys: subscriptionObject.keys
  })
}

// Remove subscription from server
const removeSubscriptionFromServer = async (subscription: PushSubscription) => {
  try {
    const subscriptionObject = subscription.toJSON()
    
    const response = await axios.post('/api/notifications/unsubscribe', {
      endpoint: subscriptionObject.endpoint
    })
  } catch (error) {
    console.warn('Failed to remove subscription from server:', error)
  }
}

// Send test notification
const sendTestNotification = async () => {
  if (!isSubscribed.value) {
    emit('error', 'Not subscribed to push notifications')
    return
  }

  try {
    const response = await axios.post('/api/notifications/test')
    console.log('Test notification sent successfully')
  } catch (error) {
    console.error('Error sending test notification:', error)
    emit('error', 'Failed to send test notification')
  }
}

// Clear badge count
const clearBadgeCount = async () => {
  try {
    const response = await axios.post('/api/notifications/clear-badge')
    
    badgeCount.value = 0
    
    // Also clear browser badge if supported
    if ('clearAppBadge' in navigator) {
      await (navigator as any).clearAppBadge()
    }
  } catch (error) {
    console.error('Error clearing badge count:', error)
  }
}

// Fetch current badge count
const fetchBadgeCount = async () => {
  try {
    const response = await axios.get('/api/user/badge-count')
    badgeCount.value = response.data.badge_count || 0
    
    // Update browser badge if supported
    if ('setAppBadge' in navigator && badgeCount.value > 0) {
      await (navigator as any).setAppBadge(badgeCount.value)
    }
  } catch (error) {
    console.error('Error fetching badge count:', error)
  }
}

// Handle messages from service worker
const handleServiceWorkerMessage = (event: MessageEvent) => {
  console.log('Received message from service worker:', event.data)
  
  if (event.data && event.data.type === 'NOTIFICATION_RECEIVED') {
    emit('notificationReceived', event.data.notification)
    
    // Update badge count
    if (event.data.notification.data && event.data.notification.data.badge) {
      badgeCount.value = event.data.notification.data.badge
    }
  }
}

// Utility functions
const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  
  return outputArray
}

// Computed properties
const canSubscribe = computed(() => 
  isSupported.value && !isSubscribed.value && permission.value !== 'denied'
)

const canUnsubscribe = computed(() => 
  isSupported.value && isSubscribed.value
)

const permissionStatus = computed(() => {
  switch (permission.value) {
    case 'granted':
      return { text: 'Granted', class: 'text-green-600 dark:text-green-400' }
    case 'denied':
      return { text: 'Denied', class: 'text-red-600 dark:text-red-400' }
    default:
      return { text: 'Not requested', class: 'text-yellow-600 dark:text-yellow-400' }
  }
})

// Lifecycle
onMounted(() => {
  initializePushNotifications()
})

onUnmounted(() => {
  if (navigator.serviceWorker) {
    navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage)
  }
})

// Expose methods for parent components
defineExpose({
  subscribe,
  unsubscribe,
  sendTestNotification,
  clearBadgeCount,
  fetchBadgeCount,
  requestPermission
})
</script>

<template>
  <div class="push-notification-manager">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          Push Notifications
        </h3>
        <div v-if="badgeCount > 0" class="flex items-center">
          <span class="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
            {{ badgeCount }}
          </span>
          <button
            @click="clearBadgeCount"
            class="ml-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Clear
          </button>
        </div>
      </div>

      <!-- Support Status -->
      <div class="mb-4">
        <div class="flex items-center justify-between text-sm">
          <span class="text-gray-600 dark:text-gray-400">Browser Support:</span>
          <span :class="isSupported ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
            {{ isSupported ? 'Supported' : 'Not Supported' }}
          </span>
        </div>
        <div class="flex items-center justify-between text-sm mt-1">
          <span class="text-gray-600 dark:text-gray-400">Permission:</span>
          <span :class="permissionStatus.class">
            {{ permissionStatus.text }}
          </span>
        </div>
        <div class="flex items-center justify-between text-sm mt-1">
          <span class="text-gray-600 dark:text-gray-400">Status:</span>
          <span :class="isSubscribed ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'">
            {{ isSubscribed ? 'Subscribed' : 'Not Subscribed' }}
          </span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="space-y-3">
        <div v-if="!isSupported" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
          <p class="text-sm text-red-600 dark:text-red-400">
            Push notifications are not supported in this browser.
          </p>
        </div>

        <div v-else-if="permission === 'denied'" class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
          <p class="text-sm text-yellow-600 dark:text-yellow-400">
            Push notifications are blocked. Please enable them in your browser settings.
          </p>
        </div>

        <div v-else class="flex flex-wrap gap-2">
          <button
            v-if="canSubscribe"
            @click="subscribe"
            :disabled="isLoading"
            class="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm rounded-md transition-colors"
          >
            {{ isLoading ? 'Subscribing...' : 'Enable Notifications' }}
          </button>

          <button
            v-if="canUnsubscribe"
            @click="unsubscribe"
            :disabled="isLoading"
            class="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm rounded-md transition-colors"
          >
            {{ isLoading ? 'Unsubscribing...' : 'Disable Notifications' }}
          </button>

          <button
            v-if="isSubscribed"
            @click="sendTestNotification"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
          >
            Test Notification
          </button>
        </div>
      </div>

      <!-- Info -->
      <div class="mt-4 text-xs text-gray-500 dark:text-gray-400">
        <p>Enable notifications to receive WebRTC call alerts and other important updates.</p>
      </div>
    </div>
  </div>
</template>