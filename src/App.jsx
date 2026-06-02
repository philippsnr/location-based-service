import { useState, useCallback } from 'react';
import { Box, Typography, AppBar, Toolbar, Button } from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';
import ClearIcon from '@mui/icons-material/Clear';
import { App as F7App, View, Page } from 'framework7-react';
import Map from './Map.jsx';
import PWAUpdatePrompt from './PWAUpdatePrompt.jsx';

const f7params = {
  name: 'Location Based Service',
  id: 'de.dhbw.location-based-service',
  theme: 'auto',
};

function App() {
  const [hasMarker, setHasMarker] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);

  const handleReset = useCallback(() => {
    setResetSignal(prev => prev + 1);
    setHasMarker(false);
  }, []);

  return (
    <F7App {...f7params}>
      <View main>
        <Page>
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <AppBar position="static">
              <Toolbar>
                <PublicIcon sx={{ mr: 1 }} />
                <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
                  Location Based Service
                </Typography>
                {hasMarker && (
                  <Button
                    color="inherit"
                    startIcon={<ClearIcon />}
                    onClick={handleReset}
                    sx={{ 
                      mr: 1,
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      }
                    }}
                  >
                    Reset
                  </Button>
                )}
              </Toolbar>
            </AppBar>

            <Map onMarkerChange={setHasMarker} resetSignal={resetSignal} />
          </Box>
          <PWAUpdatePrompt />
        </Page>
      </View>
    </F7App>
  );
}

export default App;
