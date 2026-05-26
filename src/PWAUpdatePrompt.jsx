import { useRegisterSW } from 'virtual:pwa-register/react';
import { Snackbar, Button } from '@mui/material';

function PWAUpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
      }
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <>
      <Snackbar
        open={offlineReady}
        autoHideDuration={6000}
        onClose={close}
        message="App ist offline einsatzbereit"
      />
      <Snackbar
        open={needRefresh}
        onClose={close}
        message="Neue Version verfügbar"
        action={
          <>
            <Button color="secondary" size="small" onClick={() => updateServiceWorker(true)}>
              Aktualisieren
            </Button>
            <Button color="inherit" size="small" onClick={close}>
              Schließen
            </Button>
          </>
        }
      />
    </>
  );
}

export default PWAUpdatePrompt;
