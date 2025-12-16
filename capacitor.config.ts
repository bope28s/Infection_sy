import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.germbattle.game',
  appName: 'Super Germ Battle',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;