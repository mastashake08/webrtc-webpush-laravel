<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Carbon\Carbon;

class WebRTCSession extends Model
{
    use HasFactory;

    protected $table = 'webrtc_sessions';
    protected $fillable = [
        'call_id',
        'caller_id',
        'target_user_id',
        'call_type',
        'sdp_offer',
        'sdp_answer',
        'status',
        'expires_at',
    ];

    protected $casts = [
        'sdp_offer' => 'array',
        'sdp_answer' => 'array',
        'expires_at' => 'datetime',
    ];

    /**
     * Get the caller user
     */
    public function caller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'caller_id');
    }

    /**
     * Get the target user
     */
    public function targetUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_user_id');
    }

    /**
     * Check if session is expired
     */
    public function isExpired(): bool
    {
        return Carbon::now()->isAfter($this->expires_at);
    }

    /**
     * Mark session as accepted
     */
    public function markAsAccepted(): void
    {
        $this->update(['status' => 'accepted']);
    }

    /**
     * Mark session as declined
     */
    public function markAsDeclined(): void
    {
        $this->update(['status' => 'declined']);
    }

    /**
     * Mark session as ended
     */
    public function markAsEnded(): void
    {
        $this->update(['status' => 'ended']);
    }

    /**
     * Set SDP answer
     */
    public function setSdpAnswer(array $sdpAnswer): void
    {
        $this->update(['sdp_answer' => $sdpAnswer]);
    }

    /**
     * Scope for active sessions
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'pending')
                    ->where('expires_at', '>', Carbon::now());
    }

    /**
     * Clean up expired sessions
     */
    public static function cleanupExpired(): int
    {
        return self::where('expires_at', '<', Carbon::now())
                   ->whereIn('status', ['pending', 'accepted'])
                   ->update(['status' => 'expired']);
    }
}
