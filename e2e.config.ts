import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';

export default {
	targets: [
		{
			engine: web(),
			app: {
				url: process.env.APP_URL ?? 'http://localhost:1800',
				command: {
					executable: 'pnpm',
					args: ['run', 'dev'],
					reuseExisting: true,
					log: '.e2e/logs/app.log'
				}
			}
		}
	]
} satisfies E2EConfig;
