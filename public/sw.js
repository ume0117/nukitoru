// sw.js - Nukitoru Service Worker
// PWA インストール要件を満たすための最小限の実装
// すべての処理はブラウザ内で完結しているためキャッシュ戦略は不要

const CACHE_NAME = 'nukitoru-v3'

self.addEventListener('install', (event) => {
  // 即座にアクティベート
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // ネットワーク優先（オフラインキャッシュなし）
  event.respondWith(fetch(event.request))
})
