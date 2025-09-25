<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Minishlink\WebPush\VAPID;

class GenerateVapidKeys extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'webpush:vapid {--show : Display the generated keys}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Generate VAPID keys for WebPush notifications';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        try {
            $keys = VAPID::createVapidKeys();
            
            $this->info('VAPID keys generated successfully!');
            $this->line('');
            $this->line('Add these to your .env file:');
            $this->line('');
            $this->line('VAPID_PUBLIC_KEY=' . $keys['publicKey']);
            $this->line('VAPID_PRIVATE_KEY=' . $keys['privateKey']);
            $this->line('VAPID_SUBJECT=' . config('app.url'));
            $this->line('');
            
            if ($this->option('show')) {
                $this->table(
                    ['Key Type', 'Value'],
                    [
                        ['Public Key', $keys['publicKey']],
                        ['Private Key', $keys['privateKey']],
                        ['Subject', config('app.url')]
                    ]
                );
            }
            
            $this->warn('Important: Keep your private key secure and never expose it publicly!');
            
            return self::SUCCESS;
            
        } catch (\Exception $e) {
            $this->error('Failed to generate VAPID keys: ' . $e->getMessage());
            return self::FAILURE;
        }
    }
}