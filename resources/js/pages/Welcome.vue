<script setup lang="ts">
import { dashboard, login, register } from '@/routes';
import { Head, Link } from '@inertiajs/vue3';
</script>

<template>
    <Head title="Welcome">
        <link rel="preconnect" href="https://rsms.me/" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
    </Head>
    <div
        class="flex min-h-screen flex-col items-center bg-[#FDFDFC] p-6 text-[#1b1b18] lg:justify-center lg:p-8 dark:bg-[#0a0a0a]"
    >
        <header
            class="mb-6 w-full max-w-[335px] text-sm not-has-[nav]:hidden lg:max-w-4xl"
        >
            <nav class="flex items-center justify-end gap-4">
                <Link
                    v-if="$page.props.auth.user"
                    :href="dashboard()"
                    class="inline-block rounded-sm border border-[#19140035] px-5 py-1.5 text-sm leading-normal text-[#1b1b18] hover:border-[#1915014a] dark:border-[#3E3E3A] dark:text-[#EDEDEC] dark:hover:border-[#62605b]"
                >
                    Dashboard
                </Link>
                <template v-else>
                    <Link
                        :href="login()"
                        class="inline-block rounded-sm border border-transparent px-5 py-1.5 text-sm leading-normal text-[#1b1b18] hover:border-[#19140035] dark:text-[#EDEDEC] dark:hover:border-[#3E3E3A]"
                    >
                        Log in
                    </Link>
                    <Link
                        :href="register()"
                        class="inline-block rounded-sm border border-[#19140035] px-5 py-1.5 text-sm leading-normal text-[#1b1b18] hover:border-[#1915014a] dark:border-[#3E3E3A] dark:text-[#EDEDEC] dark:hover:border-[#62605b]"
                    >
                        Register
                    </Link>
                </template>
            </nav>
        </header>
        <div
            class="flex w-full items-center justify-center opacity-100 transition-opacity duration-750 lg:grow starting:opacity-0"
        >
            <main
                class="flex w-full max-w-[335px] flex-col-reverse overflow-hidden rounded-lg lg:max-w-4xl lg:flex-row"
            >
                <div
                    class="flex-1 rounded-br-lg rounded-bl-lg bg-white p-6 pb-12 text-[13px] leading-[20px] shadow-[inset_0px_0px_0px_1px_rgba(26,26,0,0.16)] lg:rounded-tl-lg lg:rounded-br-none lg:p-20 dark:bg-[#161615] dark:text-[#EDEDEC] dark:shadow-[inset_0px_0px_0px_1px_#fffaed2d]"
                >
                    <h1 class="mb-1 font-medium">Welcome to WebRTC Push</h1>
                    <p class="mb-2 text-[#706f6c] dark:text-[#A1A09A]">
                        Connect with anyone, anywhere through peer-to-peer video calls. <br />
                        Experience real-time communication with push notifications.
                    </p>
                    <ul class="mb-4 flex flex-col lg:mb-6">
                        <li
                            class="relative flex items-center gap-4 py-2 before:absolute before:top-1/2 before:bottom-0 before:left-[0.4rem] before:border-l before:border-[#e3e3e0] dark:before:border-[#3E3E3A]"
                        >
                            <span
                                class="relative bg-white py-1 dark:bg-[#161615]"
                            >
                                <span
                                    class="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[#e3e3e0] bg-[#FDFDFC] shadow-[0px_0px_1px_0px_rgba(0,0,0,0.03),0px_1px_2px_0px_rgba(0,0,0,0.06)] dark:border-[#3E3E3A] dark:bg-[#161615]"
                                >
                                    <span
                                        class="h-1.5 w-1.5 rounded-full bg-[#dbdbd7] dark:bg-[#3E3E3A]"
                                    />
                                </span>
                            </span>
                            <span>
                                Start making
                                <a
                                    href="#"
                                    onclick="alert('Please log in to access video calls')"
                                    class="ml-1 inline-flex items-center space-x-1 font-medium text-[#f53003] underline underline-offset-4 dark:text-[#FF4433]"
                                >
                                    <span>Video Calls</span>
                                    <svg
                                        width="{10}"
                                        height="{11}"
                                        viewBox="0 0 10 11"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="h-2.5 w-2.5"
                                    >
                                        <path
                                            d="M7.70833 6.95834V2.79167H3.54167M2.5 8L7.5 3.00001"
                                            stroke="currentColor"
                                            stroke-linecap="square"
                                        />
                                    </svg>
                                </a>
                            </span>
                        </li>
                        <li
                            class="relative flex items-center gap-4 py-2 before:absolute before:top-0 before:bottom-1/2 before:left-[0.4rem] before:border-l before:border-[#e3e3e0] dark:before:border-[#3E3E3A]"
                        >
                            <span
                                class="relative bg-white py-1 dark:bg-[#161615]"
                            >
                                <span
                                    class="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[#e3e3e0] bg-[#FDFDFC] shadow-[0px_0px_1px_0px_rgba(0,0,0,0.03),0px_1px_2px_0px_rgba(0,0,0,0.06)] dark:border-[#3E3E3A] dark:bg-[#161615]"
                                >
                                    <span
                                        class="h-1.5 w-1.5 rounded-full bg-[#dbdbd7] dark:bg-[#3E3E3A]"
                                    />
                                </span>
                            </span>
                            <span>
                                Receive instant
                                <a
                                    href="#"
                                    onclick="alert('Enable notifications in your dashboard')"
                                    class="ml-1 inline-flex items-center space-x-1 font-medium text-[#f53003] underline underline-offset-4 dark:text-[#FF4433]"
                                >
                                    <span>Push Notifications</span>
                                    <svg
                                        width="{10}"
                                        height="{11}"
                                        viewBox="0 0 10 11"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                        class="h-2.5 w-2.5"
                                    >
                                        <path
                                            d="M7.70833 6.95834V2.79167H3.54167M2.5 8L7.5 3.00001"
                                            stroke="currentColor"
                                            stroke-linecap="square"
                                        />
                                    </svg>
                                </a>
                            </span>
                        </li>
                    </ul>
                    <ul class="flex gap-3 text-sm leading-normal">
                        <li>
                            <Link
                                :href="$page.props.auth.user ? dashboard() : register()"
                                class="inline-block rounded-sm border border-black bg-[#1b1b18] px-5 py-1.5 text-sm leading-normal text-white hover:border-black hover:bg-black dark:border-[#eeeeec] dark:bg-[#eeeeec] dark:text-[#1C1C1A] dark:hover:border-white dark:hover:bg-white"
                            >
                                {{ $page.props.auth.user ? 'Go to Dashboard' : 'Get Started' }}
                            </Link>
                        </li>
                    </ul>
                </div>
                
                <!-- Right side with favicon logo -->
                <div
                    class="relative -mb-px aspect-335/376 w-full shrink-0 overflow-hidden rounded-t-lg bg-gradient-to-br from-blue-50 to-indigo-100 lg:mb-0 lg:-ml-px lg:aspect-auto lg:w-[438px] lg:rounded-t-none lg:rounded-r-lg dark:from-gray-900 dark:to-gray-800 flex items-center justify-center"
                >
                    <!-- Main Favicon Logo -->
                    <div class="flex flex-col items-center justify-center p-8 space-y-6">
                        <div class="w-32 h-32 lg:w-40 lg:h-40 opacity-100 transition-all duration-750 transform starting:scale-90 starting:opacity-0">
                            <svg
                                class="w-full h-full text-indigo-600 dark:text-indigo-400"
                                viewBox="0 0 800 800"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path 
                                    class="stroke-current" 
                                    stroke-linecap="round" 
                                    stroke-width="50" 
                                    fill="none"
                                    d="m450 66.67c0 0 77.78 7.07 176.78 106.06 98.99 99 106.06 176.78 106.06 176.78"
                                />
                                <path 
                                    class="stroke-current" 
                                    stroke-linecap="round" 
                                    stroke-width="50" 
                                    fill="none"
                                    d="m473.57 184.52c0 0 33 9.43 82.49 58.93 49.5 49.49 58.93 82.49 58.93 82.49"
                                />
                                <path 
                                    class="fill-current" 
                                    d="m521.48 518.12l15.19-15.98-36.26-34.43-15.18 15.98zm15.18-15.98c12.85-13.53 32.87-16.57 49.96-6.73l24.94-43.34c-36.61-21.07-82.03-15.03-111.15 15.63zm49.96-6.73l63.68 36.66 24.94-43.33-63.68-36.66zm63.68 36.66c27.36 15.75 32.72 54.49 12.29 75.99l36.26 34.44c43.49-45.8 30.83-122.44-23.6-153.77zm12.29 76l-47.36 49.85 36.26 34.44 47.35-49.86zm-47.35 49.86c-9.3 9.79-19.03 15.04-28.49 15.97l4.91 49.76c24.9-2.46 45.05-15.74 59.83-31.3zm-28.49 15.97c-47.83 4.73-172.64 0.7-308.12-141.93l-36.25 34.43c147.65 155.45 288.49 163.26 349.28 157.26zm-308.11-141.93c-129.21-136.03-150.88-250.77-153.58-301.1l-49.93 2.68c3.31 61.64 29.48 187.81 167.25 332.85zm-153.58-301.1c-0.71-13.31 5.09-26.64 16.13-38.26l-36.25-34.44c-17.86 18.81-31.44 44.93-29.8 75.38zm199.42 79.87l9.56-10.07-36.25-34.43-9.56 10.06zm17.07-135.38l-42.04-59.45-40.82 28.87 42.03 59.44zm-42.03-59.44c-33.79-47.79-101.39-55.85-142.27-12.82l36.26 34.43c17.42-18.35 48.11-16.9 65.18 7.25zm-142.26-12.82l-52.32 55.09 36.25 34.43 52.32-55.08zm-34.19 72.3l-18.13-17.22zm183.29 118.13c-18.12-17.21-18.14-17.19-18.17-17.17q-0.02 0.02-0.04 0.05-0.05 0.05-0.1 0.11-0.1 0.1-0.21 0.22-0.21 0.23-0.44 0.5-0.47 0.54-1.02 1.23-1.11 1.39-2.43 3.42c-1.74 2.73-3.64 6.32-5.24 10.82-3.25 9.15-5.03 21.27-2.81 36.41 4.36 29.73 23.84 69.72 74.75 123.32l36.25-34.43c-47.58-50.1-59.3-80.96-61.53-96.14-1.07-7.33 0.02-11.19 0.45-12.4 0.24-0.68 0.4-0.87 0.24-0.63q-0.1 0.18-0.47 0.66-0.19 0.24-0.46 0.55-0.14 0.16-0.3 0.33q-0.08 0.09-0.16 0.18q-0.04 0.05-0.09 0.09q-0.03 0.03-0.04 0.05c-0.03 0.03-0.05 0.05-18.18-17.17zm44.29 158.91c50.76 53.45 89.1 74.46 118.35 79.21 15.01 2.43 27.16 0.49 36.36-3.14 4.5-1.77 8.05-3.86 10.72-5.75 1.34-0.95 2.45-1.84 3.34-2.63q0.67-0.59 1.19-1.09 0.26-0.25 0.48-0.47q0.11-0.11 0.21-0.22q0.05-0.05 0.1-0.1q0.03-0.03 0.04-0.05c0.03-0.02 0.05-0.05-18.08-17.26-18.12-17.22-18.1-17.24-18.08-17.27q0.02-0.02 0.05-0.05 0.04-0.04 0.09-0.09 0.09-0.09 0.17-0.17 0.17-0.17 0.32-0.32 0.3-0.29 0.54-0.5 0.48-0.41 0.71-0.56c0.31-0.23 0.28-0.15-0.15 0.02-0.64 0.25-3.67 1.32-9.99 0.29-13.42-2.18-42.38-14.02-90.12-64.28zm248.45 21.33l-12.47 21.67zm81.63 151.53l18.13 17.22zm-91.51 73.49l2.45 24.88zm-328.7-149.6l18.13-17.21zm73.53-248.52c32.25-33.96 34.54-87.1 7.51-125.32l-40.82 28.87c14.07 19.9 11.91 46.38-2.94 62.01zm-12.9-110.88l20.41-14.43zm-145.76-69.49l18.13 17.22zm193.38 314.91l18.13-17.22zm134.59 65.71l-18.13-17.21zm-224.25-370.59l-20.41 14.43zm-179.01 101.88l-24.97 1.34zm533.28 442.94l-18.13-17.22zm-317.45-391.7l18.12 17.22zm346.86 226.96l-12.47 21.67zm-144.23-25.48l18.12 17.22z"
                                />
                            </svg>
                        </div>
                        
                        <!-- WebRTC Text Logo -->
                        <div class="text-center opacity-100 transition-all duration-750 delay-200 starting:translate-y-4 starting:opacity-0">
                            <h2 class="text-2xl lg:text-3xl font-bold text-indigo-900 dark:text-indigo-100 mb-2">
                                WebRTC Push
                            </h2>
                            <p class="text-sm lg:text-base text-indigo-700 dark:text-indigo-300">
                                Real-time Communication
                            </p>
                        </div>

                        <!-- Decorative Elements -->
                        <div class="absolute top-8 right-8 w-16 h-16 opacity-20">
                            <div class="w-full h-full rounded-full bg-indigo-300 dark:bg-indigo-600 animate-pulse"></div>
                        </div>
                        <div class="absolute bottom-8 left-8 w-12 h-12 opacity-20">
                            <div class="w-full h-full rounded-full bg-blue-300 dark:bg-blue-600 animate-pulse" style="animation-delay: 1s;"></div>
                        </div>
                        <div class="absolute top-1/2 left-4 w-8 h-8 opacity-20">
                            <div class="w-full h-full rounded-full bg-purple-300 dark:bg-purple-600 animate-pulse" style="animation-delay: 2s;"></div>
                        </div>
                    </div>

                    <!-- Subtle Border -->
                    <div
                        class="absolute inset-0 rounded-t-lg shadow-[inset_0px_0px_0px_1px_rgba(26,26,0,0.16)] lg:overflow-hidden lg:rounded-t-none lg:rounded-r-lg dark:shadow-[inset_0px_0px_0px_1px_#fffaed2d]"
                    />
                </div>
            </main>
        </div>
        <div class="hidden h-14.5 lg:block"></div>
    </div>
</template>