/* eslint-disable */
import {precacheAndRoute} from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST);
console.log('hi')
// Listen for install event, set callback
self.addEventListener('install', (event) => {
  console.log('installed');
});