// Service Worker mínimo do nutrIAprova.
// Hoje: exibir notificações push vindas do backend (quando integrarmos VAPID)
// e responder ao clique levando para a rota apropriada.
// Proposital: SEM cache de assets, para não bagunçar o fluxo do Vite durante
// dev/preview — o navegador continua servindo tudo pela rede.

self.addEventListener("install", (event) => {
  // Ativa imediatamente a nova versão do SW sem esperar abas antigas.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Recebe push do backend (quando houver subscription VAPID) ou pode ser
// disparado manualmente via `registration.showNotification` pelo cliente.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "nutrIAprova", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "nutrIAprova";
  const options = {
    body: data.body || "Você tem uma nova atividade na plataforma.",
    icon: data.icon || "/favicon.svg",
    badge: "/favicon.svg",
    data: { url: data.url || "/" },
    tag: data.tag || "nutriaprova-generic",
    renotify: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Ao clicar na notificação, foca uma aba existente ou abre uma nova.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});
