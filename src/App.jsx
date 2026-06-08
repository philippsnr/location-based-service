import { App as F7App, View, Page } from 'framework7-react';
import Map from './Map.jsx';
import PWAUpdatePrompt from './PWAUpdatePrompt.jsx';

const f7params = {
  name: 'Location Based Service',
  id: 'de.dhbw.location-based-service',
  theme: 'auto',
};

function App() {
  return (
    <F7App {...f7params}>
      <View main>
        <Page>
          <Map />
          <PWAUpdatePrompt />
        </Page>
      </View>
    </F7App>
  );
}

export default App;
