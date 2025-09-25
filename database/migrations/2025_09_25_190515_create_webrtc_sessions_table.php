<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('webrtc_sessions', function (Blueprint $table) {
            $table->id();
            $table->string('call_id')->unique(); // Unique identifier for the call
            $table->unsignedBigInteger('caller_id'); // User making the call
            $table->unsignedBigInteger('target_user_id'); // User receiving the call
            $table->string('call_type')->default('video'); // video, audio, data
            $table->longText('sdp_offer'); // Store the full SDP offer data
            $table->longText('sdp_answer')->nullable(); // Store the SDP answer when call is accepted
            $table->string('status')->default('pending'); // pending, accepted, declined, ended
            $table->timestamp('expires_at'); // Session expiration time
            $table->timestamps();
            
            // Foreign key constraints
            $table->foreign('caller_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('target_user_id')->references('id')->on('users')->onDelete('cascade');
            
            // Indexes for performance
            $table->index(['caller_id', 'target_user_id']);
            $table->index('call_id');
            $table->index('status');
            $table->index('expires_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('webrtc_sessions');
    }
};
