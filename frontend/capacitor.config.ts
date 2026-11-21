import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.heyhacene.remotivity',
  appName: 'Remotivity',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_launcher',
      iconColor: '#06B6D4'
    }
  }
};

export default config;
