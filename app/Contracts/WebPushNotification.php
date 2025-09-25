<?php

namespace App\Contracts;

/**
 * Interface for notifications that support WebPush delivery
 */
interface WebPushNotification
{
    /**
     * Get the WebPush representation of the notification.
     *
     * @param mixed $notifiable
     * @return array
     */
    public function toWebPush(object $notifiable): array;
}