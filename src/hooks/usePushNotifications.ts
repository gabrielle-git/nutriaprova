import { useCallback, useEffect, useState } from "react";

// Chave local persistida para lembrar a preferência da usuária entre sessões.
const STORAGE_KEY = "nutriaprova:notifPush";

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

interface UsePushNotificationsReturn {
  /** Indica se o navegador atual suporta Notification API + Service Worker. */
  supported: boolean;
  /** Status atual da permissão concedida pela usuária. */
  permission: PushPermission;
  /** Preferência salva (switch ON/OFF). Só fica true se a permissão também foi concedida. */
  enabled: boolean;
  /** Liga o push (pede permissão + registra SW + envia notificação de teste). */
  enable: () => Promise<boolean>;
  /** Desliga o push localmente (não revoga a permissão do navegador, só esquece a preferência). */
  disable: () => void;
}

/**
 * Hook de notificações push do nutrIAprova.
 *
 * Fluxo ao ativar:
 *  1. checa suporte (Notification + serviceWorker)
 *  2. registra `/sw.js` (se ainda não estiver)
 *  3. chama `Notification.requestPermission()`
 *  4. dispara uma notificação-teste via `registration.showNotification`
 *  5. persiste a preferência em `localStorage`
 */
export function usePushNotifications(): UsePushNotificationsReturn {
  const supported =
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator;

  const [permission, setPermission] = useState<PushPermission>(() => {
    if (!supported) return "unsupported";
    return (Notification.permission as PushPermission) || "default";
  });

  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  // Reflete mudanças externas (ex.: usuária bloqueou manual no navegador).
  useEffect(() => {
    if (!supported) return;
    const update = () => setPermission(Notification.permission as PushPermission);
    update();
    // Nem todos os navegadores suportam o evento, mas onde suportam é útil.
    try {
      navigator.permissions
        ?.query({ name: "notifications" as PermissionName })
        .then((status) => {
          status.onchange = () => setPermission(Notification.permission as PushPermission);
        })
        .catch(() => {
          /* ignorado — navegadores sem suporte a permissions.query */
        });
    } catch {
      /* noop */
    }
  }, [supported]);

  const enable = useCallback(async (): Promise<boolean> => {
    if (!supported) {
      setPermission("unsupported");
      return false;
    }

    try {
      // Registra (ou recupera) o SW. Quando já está ativo, getRegistration devolve direto.
      let registration = await navigator.serviceWorker.getRegistration("/sw.js");
      if (!registration) {
        registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      }
      await navigator.serviceWorker.ready;

      // Pede permissão — só abre o prompt do browser se ainda for "default".
      const result = await Notification.requestPermission();
      setPermission(result as PushPermission);

      if (result !== "granted") {
        try {
          localStorage.setItem(STORAGE_KEY, "false");
        } catch {
          /* ignora quota/disabled storage */
        }
        setEnabled(false);
        return false;
      }

      // Notificação-teste imediata, confirma para a usuária que funcionou.
      registration.showNotification("Notificações ativadas!", {
        body: "Você vai receber avisos de validações, pagamentos e novidades por aqui.",
        icon: "/favicon.svg",
        tag: "nutriaprova-welcome",
      });

      try {
        localStorage.setItem(STORAGE_KEY, "true");
      } catch {
        /* noop */
      }
      setEnabled(true);
      return true;
    } catch (err) {
      console.warn("[usePushNotifications] erro ao habilitar:", err);
      setEnabled(false);
      try {
        localStorage.setItem(STORAGE_KEY, "false");
      } catch {
        /* noop */
      }
      return false;
    }
  }, [supported]);

  const disable = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "false");
    } catch {
      /* noop */
    }
    setEnabled(false);
    // Obs.: não dá para "revogar" a permissão programaticamente; a usuária
    // precisa entrar nas configurações do navegador se quiser bloquear de vez.
  }, []);

  return { supported, permission, enabled, enable, disable };
}
