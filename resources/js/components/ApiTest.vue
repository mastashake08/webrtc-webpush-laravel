<template>
  <div class="max-w-2xl mx-auto p-6 space-y-6">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 class="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">API Authentication Test</h2>
      
      <div class="space-y-4">
        <button 
          @click="testPublicEndpoint"
          :disabled="loading"
          class="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {{ loading ? 'Testing...' : 'Test Public Endpoint (No Auth)' }}
        </button>
        
        <button 
          @click="testDebugAuth"
          :disabled="loading"
          class="w-full bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {{ loading ? 'Testing...' : 'Test Debug Auth Endpoint' }}
        </button>
        
        <button 
          @click="testAuthenticatedEndpoint"
          :disabled="loading"
          class="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {{ loading ? 'Testing...' : 'Test Authenticated Endpoint' }}
        </button>
        
        <button 
          @click="testVapidKey"
          :disabled="loading"
          class="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {{ loading ? 'Testing...' : 'Test VAPID Key Endpoint' }}
        </button>
        
        <button 
          @click="testUsers"
          :disabled="loading"
          class="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-300 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          {{ loading ? 'Testing...' : 'Test Users Endpoint' }}
        </button>
        
        <button 
          @click="clearResults"
          :disabled="loading"
          class="w-full bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Clear Results
        </button>
      </div>
      
      <div v-if="lastResponse" class="mt-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
        <h3 class="font-medium mb-2 text-gray-900 dark:text-gray-100">Last Response:</h3>
        <pre class="text-sm overflow-x-auto whitespace-pre-wrap text-gray-800 dark:text-gray-200">{{ JSON.stringify(lastResponse, null, 2) }}</pre>
      </div>
      
      <div v-if="lastError" class="mt-6 p-4 bg-red-100 dark:bg-red-900/20 rounded-lg">
        <h3 class="font-medium mb-2 text-red-800 dark:text-red-200">Last Error:</h3>
        <pre class="text-sm overflow-x-auto whitespace-pre-wrap text-red-700 dark:text-red-300">{{ JSON.stringify(lastError, null, 2) }}</pre>
      </div>
      
      <div v-if="requestInfo" class="mt-6 p-4 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
        <h3 class="font-medium mb-2 text-blue-800 dark:text-blue-200">Request Info:</h3>
        <pre class="text-sm overflow-x-auto whitespace-pre-wrap text-blue-700 dark:text-blue-300">{{ JSON.stringify(requestInfo, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import axios from 'axios'

const lastResponse = ref<any>(null)
const lastError = ref<any>(null)
const requestInfo = ref<any>(null)
const loading = ref(false)

const clearResults = () => {
  lastResponse.value = null
  lastError.value = null
  requestInfo.value = null
}

const makeRequest = async (requestFn: () => Promise<any>, description: string) => {
  clearResults()
  loading.value = true
  
  try {
    console.log(`🧪 Testing: ${description}`)
    const startTime = Date.now()
    const response = await requestFn()
    const endTime = Date.now()
    
    lastResponse.value = response.data
    requestInfo.value = {
      description,
      method: response.config?.method?.toUpperCase(),
      url: response.config?.url,
      status: response.status,
      statusText: response.statusText,
      duration: `${endTime - startTime}ms`,
      headers: response.headers,
      requestHeaders: response.config?.headers
    }
    
    console.log(`✅ ${description} success:`, response.data)
  } catch (error: any) {
    const endTime = Date.now()
    
    lastError.value = {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      config: {
        method: error.config?.method?.toUpperCase(),
        url: error.config?.url,
        headers: error.config?.headers
      }
    }
    
    requestInfo.value = {
      description,
      method: error.config?.method?.toUpperCase(),
      url: error.config?.url,
      status: error.response?.status || 'Network Error',
      statusText: error.response?.statusText || error.message,
      duration: 'Error',
      requestHeaders: error.config?.headers
    }
    
    console.error(`❌ ${description} error:`, error)
  } finally {
    loading.value = false
  }
}

const testPublicEndpoint = () => makeRequest(
  () => axios.get('/api/test-public'),
  'Public Endpoint (No Auth Required)'
)

const testDebugAuth = () => makeRequest(
  () => axios.get('/api/debug-auth'),
  'Debug Auth Endpoint'
)

const testAuthenticatedEndpoint = () => makeRequest(
  () => axios.get('/api/auth-test'),
  'Authenticated Endpoint'
)

const testVapidKey = () => makeRequest(
  () => axios.get('/api/notifications/vapid-key'),
  'VAPID Key Endpoint'
)

const testUsers = () => makeRequest(
  () => axios.get('/api/users'),
  'Users Endpoint'
)
</script>