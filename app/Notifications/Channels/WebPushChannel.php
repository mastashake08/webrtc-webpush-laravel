<?php

namespace App\Notifications\Channels;

use App\Contracts\WebPushNotification;
use App\Services\WebPushService;
use Illuminate\Notifications\Notification;

/**
 * Custom notification channel for WebPush notifications
 */
class WebPushChannel
{
    public function __construct(
        private WebPushService $webPushService
    ) {}

    /**
     * Send the given notification.
     */
    public function send(object $notifiable, Notification $notification): void
    {
        if (!$notification instanceof WebPushNotification) {
            throw new \InvalidArgumentException('Notification must implement WebPushNotification interface');
        }

        $message = $notification->toWebPush($notifiable);

        $this->webPushService->sendNotification($notifiable, $message);
    }
}