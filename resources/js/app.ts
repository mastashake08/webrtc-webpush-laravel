import '../css/app.css';

import { createInertiaApp } from '@inertiajs/vue3';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import type { DefineComponent } from 'vue';
import { createApp, h } from 'vue';
import { initializeTheme } from './composables/useAppearance';
import axios from 'axios';

const appName = import.meta.env.VITE_APP_NAME || 'WebRTC Push';

// Configure CSRF token for all requests
const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
if (token) {
    // Set default headers for fetch requests used by Inertia
    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
        const headers = new Headers(init?.headers);
        if (!headers.has('X-CSRF-TOKEN')) {
            headers.set('X-CSRF-TOKEN', token);
        }
        return originalFetch(input, { ...init, headers });
    };
    
    // Configure axios defaults for Sanctum
    axios.defaults.baseURL = window.location.origin;
    axios.defaults.headers.common['X-CSRF-TOKEN'] = token;
    axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
    axios.defaults.headers.common['Accept'] = 'application/json';
    axios.defaults.headers.common['Content-Type'] = 'application/json';
    
    // Enable credentials for Sanctum (this is crucial!)
    axios.defaults.withCredentials = true;
    
    // Add request interceptor to ensure CSRF sanctum initialization
    axios.interceptors.request.use(
        async (config) => {
            // For Sanctum, we need to hit the /sanctum/csrf-cookie endpoint first
            // if we don't have a valid session cookie
            const sanctumToken = document.cookie
                .split('; ')
                .find(row => row.startsWith('XSRF-TOKEN='));
            
            if (!sanctumToken && config.url !== '/sanctum/csrf-cookie') {
                try {
                    await axios.get('/sanctum/csrf-cookie');
                    // Update CSRF token after getting new cookie
                    const newToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
                    if (newToken) {
                        axios.defaults.headers.common['X-CSRF-TOKEN'] = newToken;
                        config.headers['X-CSRF-TOKEN'] = newToken;
                    }
                } catch (error) {
                    console.warn('Failed to initialize Sanctum CSRF cookie:', error);
                }
            }
            
            return config;
        },
        (error) => Promise.reject(error)
    );
    
    // Add response interceptor to handle authentication errors
    axios.interceptors.response.use(
        response => response,
        async (error) => {
            if (error.response?.status === 419) {
                // CSRF token mismatch - get new token and retry
                console.warn('CSRF token mismatch, refreshing token...');
                try {
                    await axios.get('/sanctum/csrf-cookie');
                    const newToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
                    if (newToken) {
                        axios.defaults.headers.common['X-CSRF-TOKEN'] = newToken;
                    }
                    // Retry the original request
                    return axios.request(error.config);
                } catch (retryError) {
                    console.error('Failed to refresh CSRF token:', retryError);
                    window.location.reload();
                }
            } else if (error.response?.status === 401) {
                // Unauthorized - try to refresh Sanctum session
                console.warn('Unauthorized request, attempting to refresh Sanctum session...');
                try {
                    await axios.get('/sanctum/csrf-cookie');
                    // Don't automatically retry for 401s, let the user handle it
                    console.log('Sanctum session refreshed, but still unauthorized. User may need to log in again.');
                } catch (refreshError) {
                    console.error('Failed to refresh Sanctum session:', refreshError);
                }
            }
            return Promise.reject(error);
        }
    );
    
    // Initialize Sanctum on page load
    const initializeSanctum = async () => {
        try {
            console.log('🔐 Initializing Sanctum...');
            await axios.get('/sanctum/csrf-cookie');
            console.log('✅ Sanctum initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Sanctum:', error);
        }
    };
    
    // Initialize Sanctum when the page loads
    window.addEventListener('load', initializeSanctum);
    
    // Debug function for testing API calls in console
    (window as any).testApi = {
        async initSanctum() {
            await initializeSanctum();
        },
        async debugAuth() {
            try {
                const response = await axios.get('/api/debug-auth');
                console.log('✅ Debug auth success:', response.data);
                return response.data;
            } catch (error: any) {
                console.error('❌ Debug auth failed:', {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data,
                    headers: error.response?.headers
                });
                throw error;
            }
        },
        async testPublic() {
            try {
                const response = await axios.get('/api/test-public');
                console.log('✅ Public test success:', response.data);
                return response.data;
            } catch (error: any) {
                console.error('❌ Public test failed:', error);
                throw error;
            }
        },
        async testAuthRequired() {
            try {
                
                const response = await axios.get('/api/auth-test');
                console.log('✅ Auth required test success:', response.data);
                return response.data;
            } catch (error: any) {
                console.error('❌ Auth required test failed:', {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data
                });
                throw error;
            }
        }
    };
    
    console.log('🧪 API test functions available: window.testApi.debugAuth(), window.testApi.testPublic(), window.testApi.testAuthRequired()');
}

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    resolve: (name) => resolvePageComponent(`./pages/${name}.vue`, import.meta.glob<DefineComponent>('./pages/**/*.vue')),
    setup({ el, App, props, plugin }) {
        createApp({ render: () => h(App, props) })
            .use(plugin)
            .mount(el);
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on page load...
initializeTheme();

// Register Service Worker for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New content is available, notify user
                                console.log('New content is available; please refresh.');
                                
                                // You could show a notification to the user here
                                if (confirm('New version available! Refresh to update?')) {
                                    window.location.reload();
                                }
                            }
                        });
                    }
                });
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Handle PWA display mode
const updateDisplayMode = () => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
        document.documentElement.classList.add('pwa-standalone');
    } else {
        document.documentElement.classList.remove('pwa-standalone');
    }
};

// Set initial display mode
updateDisplayMode();

// Listen for display mode changes
if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', updateDisplayMode);
    } else {
        // Fallback for older browsers
        mediaQuery.addListener(updateDisplayMode);
    }
}