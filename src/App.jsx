import { App as F7App, View, Page } from 'framework7-react';
import Map from './Map.jsx';
import PWAUpdatePrompt from './PWAUpdatePrompt.jsx';

/**
 * @file Root application component. Sets up the Framework7 app shell and hosts
 * the map and the PWA update prompt on a single full-screen page.
 */

/**
 * Framework7 app parameters (app name, id and theme).
 * @type {{name: string, id: string, theme: string}}
 */
const f7params = {
  name: 'Location Based Service',
  id: 'de.dhbw.location-based-service',
  theme: 'auto',
};

/**
 * Root component: renders the Framework7 shell containing the {@link Map} and
 * the {@link PWAUpdatePrompt}.
 * @returns {import('react').ReactElement}
 */
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
