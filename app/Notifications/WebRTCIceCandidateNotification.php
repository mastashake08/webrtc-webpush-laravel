<?php

namespace App\Notifications;

use App\Contracts\WebPushNotification;
use App\Notifications\Channels\WebPushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\DatabaseMessage;
use Illuminate\Notifications\Notification;

class WebRTCIceCandidateNotification extends Notification implements ShouldQueue, WebPushNotification
{
    use Queueable;

    private array $iceCandidate;
    private int $senderUserId;
    private string $callId;

    /**
     * Create a new notification instance.
     *
     * @param array $iceCandidate The ICE candidate data
     * @param int $senderUserId The user sending the ICE candidate
     * @param string $callId The call session ID
     */
    public function __construct(array $iceCandidate, int $senderUserId, string $callId)
    {
        $this->iceCandidate = $iceCandidate;
        $this->senderUserId = $senderUserId;
        $this->callId = $callId;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return [WebPushChannel::class]; // Only WebPush, no database storage for ICE candidates
    }

    /**
     * Get the WebPush representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toWebPush(object $notifiable): array
    {
        return [
            'title' => 'WebRTC Connection',
            'body' => 'Establishing connection...',
            'icon' => '/favicon.ico',
            'badge' => '/favicon.ico',
            'tag' => 'webrtc-ice-' . $this->callId,
            'silent' => true, // Silent notification for ICE candidates
            'data' => [
                'type' => 'webrtc_ice_candidate',
                'call_id' => $this->callId,
                'sender_id' => $this->senderUserId,
                'ice_candidate' => $this->iceCandidate,
                'timestamp' => now()->timestamp,
            ]
        ];
    }
}