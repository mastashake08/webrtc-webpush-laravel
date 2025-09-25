<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePage } from '@inertiajs/vue3'
import axios from 'axios'

// Props
interface Props {
  excludeCurrentUser?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  excludeCurrentUser: true,
})

// Emits
const emit = defineEmits<{
  userSelected: [user: any]
  callInitiated: [userId: number, callType: string]
}>()

// State
const users = ref<any[]>([])
const selectedUser = ref<any>(null)
const searchQuery = ref('')
const isLoading = ref(false)
const callType = ref<'video' | 'audio' | 'data'>('video')

// Get current user
const page = usePage()
const currentUser = computed(() => page.props.auth?.user)

// Filtered users based on search
const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value

  const query = searchQuery.value.toLowerCase()
  return users.value.filter(user => 
    user.name.toLowerCase().includes(query) ||
    user.email.toLowerCase().includes(query)
  )
})

// Fetch users from API
const fetchUsers = async () => {
  isLoading.value = true
  
  try {
    const response = await axios.get('/api/users')
    users.value = response.data.users || response.data
    
    // Exclude current user if specified
    if (props.excludeCurrentUser && currentUser.value) {
      users.value = users.value.filter(user => user.id !== currentUser.value.id)
    }
  } catch (error) {
    console.error('Error fetching users:', error)
    // Fallback: create mock users for demo
    users.value = [
      { id: 2, name: 'John Doe', email: 'john@example.com', avatar: null },
      { id: 3, name: 'Jane Smith', email: 'jane@example.com', avatar: null },
      { id: 4, name: 'Bob Johnson', email: 'bob@example.com', avatar: null },
    ].filter(user => !currentUser.value || user.id !== currentUser.value.id)
  } finally {
    isLoading.value = false
  }
}

// Select user
const selectUser = (user: any) => {
  selectedUser.value = user
  emit('userSelected', user)
}

// Initiate call
const initiateCall = () => {
  console.log('🎯 UserSelector: initiateCall() called')
  console.log('👤 UserSelector: selectedUser:', selectedUser.value)
  console.log('📞 UserSelector: callType:', callType.value)
  
  if (!selectedUser.value) {
    console.error('❌ UserSelector: No user selected for call')
    return
  }
  
  console.log('🚀 UserSelector: Emitting callInitiated event:', selectedUser.value.id, callType.value)
  emit('callInitiated', selectedUser.value.id, callType.value)
}

// Clear selection
const clearSelection = () => {
  selectedUser.value = null
  searchQuery.value = ''
}

// Get user avatar URL or initials
const getUserAvatar = (user: any) => {
  if (user.avatar) {
    return user.avatar
  }
  
  // Generate initials
  const names = user.name.split(' ')
  const initials = names.length >= 2 
    ? `${names[0][0]}${names[1][0]}`
    : names[0][0]
  
  return initials.toUpperCase()
}

// Get user status (mock for now)
const getUserStatus = (user: any) => {
  // In a real app, this would come from presence/activity data
  const statuses = ['online', 'away', 'offline']
  return statuses[user.id % 3]
}

// Get status color
const getStatusColor = (status: string) => {
  switch (status) {
    case 'online': return 'bg-green-400'
    case 'away': return 'bg-yellow-400'
    case 'offline': return 'bg-gray-400'
    default: return 'bg-gray-400'
  }
}

// Lifecycle
onMounted(() => {
  fetchUsers()
})

// Expose methods
defineExpose({
  clearSelection,
  fetchUsers
})
</script>

<template>
  <div class="user-selector">
    <!-- Selected User Display -->
    <div v-if="selectedUser" class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="relative">
            <div v-if="selectedUser.avatar" class="w-10 h-10 rounded-full overflow-hidden">
              <img :src="selectedUser.avatar" :alt="selectedUser.name" class="w-full h-full object-cover">
            </div>
            <div v-else class="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
              {{ getUserAvatar(selectedUser) }}
            </div>
            <div :class="[
              'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white dark:ring-gray-800',
              getStatusColor(getUserStatus(selectedUser))
            ]"></div>
          </div>
          <div>
            <p class="font-medium text-gray-900 dark:text-white">{{ selectedUser.name }}</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ selectedUser.email }}</p>
          </div>
        </div>
        <button
          @click="clearSelection"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      
      <!-- Call Type Selection -->
      <div class="mt-4">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Call Type
        </label>
        <div class="flex space-x-2">
          <button
            v-for="type in ['video', 'audio', 'data']"
            :key="type"
            @click="callType = type as 'video' | 'audio' | 'data'"
            :class="[
              'px-3 py-2 text-sm rounded-md transition-colors capitalize',
              callType === type
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            ]"
          >
            {{ type }}
          </button>
        </div>
      </div>

      <!-- Call Button -->
      <button
        @click="initiateCall"
        class="mt-4 w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md transition-colors flex items-center justify-center"
      >
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
        </svg>
        Start {{ callType }} Call
      </button>
    </div>

    <!-- User List -->
    <div v-else class="bg-white dark:bg-gray-800 rounded-lg shadow">
      <!-- Header -->
      <div class="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          Select User to Call
        </h3>
        
        <!-- Search -->
        <div class="mt-3 relative">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search users..."
            class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
        </div>
      </div>

      <!-- User List -->
      <div class="max-h-96 overflow-y-auto">
        <div v-if="isLoading" class="p-4 text-center text-gray-500 dark:text-gray-400">
          Loading users...
        </div>
        
        <div v-else-if="filteredUsers.length === 0" class="p-4 text-center text-gray-500 dark:text-gray-400">
          {{ searchQuery ? 'No users found' : 'No users available' }}
        </div>
        
        <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
          <button
            v-for="user in filteredUsers"
            :key="user.id"
            @click="selectUser(user)"
            class="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center space-x-3"
          >
            <div class="relative flex-shrink-0">
              <div v-if="user.avatar" class="w-10 h-10 rounded-full overflow-hidden">
                <img :src="user.avatar" :alt="user.name" class="w-full h-full object-cover">
              </div>
              <div v-else class="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                {{ getUserAvatar(user) }}
              </div>
              <div :class="[
                'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white dark:ring-gray-800',
                getStatusColor(getUserStatus(user))
              ]"></div>
            </div>
            
            <div class="flex-1 min-w-0">
              <p class="font-medium text-gray-900 dark:text-white truncate">
                {{ user.name }}
              </p>
              <p class="text-sm text-gray-500 dark:text-gray-400 truncate">
                {{ user.email }}
              </p>
            </div>
            
            <div class="flex-shrink-0">
              <span :class="[
                'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize',
                getUserStatus(user) === 'online' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                getUserStatus(user) === 'away' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
              ]">
                {{ getUserStatus(user) }}
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>