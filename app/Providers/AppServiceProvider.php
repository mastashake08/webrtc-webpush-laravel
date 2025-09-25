<?php

namespace App\Providers;

use App\Notifications\Channels\WebPushChannel;
use App\Services\WebPushService;
use Illuminate\Notifications\ChannelManager;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Register the WebPushService
        $this->app->singleton(WebPushService::class, function ($app) {
            return new WebPushService();
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Register the custom WebPush notification channel
        Notification::resolved(function (ChannelManager $service) {
            $service->extend('webpush', function ($app) {
                return new WebPushChannel($app[WebPushService::class]);
            });
        });
    }
}
