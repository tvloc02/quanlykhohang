import { registerAs } from '@nestjs/config';

export default registerAs('websocket', () => ({
  enabled: process.env.WEBSOCKET_ENABLED === 'true',
}));
