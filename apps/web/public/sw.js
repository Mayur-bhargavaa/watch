// Service Worker for Watch Party: Web Push (banners while the site is closed) and notification clicks.
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Watch Party', body: event.data ? event.data.text() : '' };
  }
  var title = data.title || 'Watch Party';
  var options = {
    body: data.body || '',
    icon: '/logos/direct.png',
    badge: '/logos/direct.png',
    tag: data.tag || undefined,
    renotify: !!(data.tag && data.renotify),
    requireInteraction: !!data.requireInteraction,
    data: { url: data.url || '/dashboard' }
  };

  event.waitUntil(
    // Skip the banner when the user is already looking at the app (the page shows its own toast)
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].focused && clientList[i].visibilityState === 'visible') return;
      }
      return self.registration.showNotification(title, options);
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var raw = (event.notification.data && event.notification.data.url) || '/dashboard';

  // Only ever open pages of this site
  var target;
  try {
    target = new URL(raw, self.location.origin);
    if (target.origin !== self.location.origin) target = new URL('/dashboard', self.location.origin);
  } catch (e) {
    target = new URL('/dashboard', self.location.origin);
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      var sameOrigin = clientList.filter(function (c) {
        try {
          return new URL(c.url).origin === self.location.origin;
        } catch (e) {
          return false;
        }
      });
      // Prefer a window that already shows the target page
      for (var i = 0; i < sameOrigin.length; i++) {
        if (sameOrigin[i].url === target.href && 'focus' in sameOrigin[i]) return sameOrigin[i].focus();
      }
      if (sameOrigin.length && 'focus' in sameOrigin[0]) {
        var client = sameOrigin[0];
        return (client.navigate ? client.navigate(target.href) : Promise.resolve(client)).then(function (c) {
          return (c || client).focus();
        });
      }
      if (self.clients.openWindow) return self.clients.openWindow(target.href);
    })
  );
});

// The browser rotated the subscription: the page re-registers it the next time it opens.
self.addEventListener('pushsubscriptionchange', function (event) {
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      clientList.forEach(function (c) {
        c.postMessage({ type: 'push:resubscribe' });
      });
    })
  );
});
