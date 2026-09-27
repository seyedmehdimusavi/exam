import { FamilyMember } from '../app/core/models/models';

/**
 * Template only. The app is built with environment.local.ts instead (angular.json
 * fileReplacements), which holds the real Firebase config and family list and is
 * never committed. To set up: copy this file to environment.local.ts and fill it in.
 */
export const environment = {
  // Firebase Console → Project settings → General → Your apps → Web app config.
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
  },

  // Family members on the login screen; each needs a Firebase Auth user whose password is a 6-digit PIN.
  family: [{ name: 'Parent', email: 'parent@example.com' }] satisfies FamilyMember[],

  pinLength: 6,
};
