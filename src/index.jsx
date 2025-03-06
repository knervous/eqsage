import React from 'react';
import ReactDOM from 'react-dom/client';
import bjs from '@bjs';
import './electron';

import './index.css';


async function render() {
  const [
    { Main },
    { GlobalStoreProvider },
    { MainProvider },
    { SettingsProvider },
    { AlertProvider },
  ] = await Promise.all([
    import('./components/main/main'),
    import('./state'),
    import('./components/main/context'),
    import('./context/settings'),
    import('./context/alerts'),
  ]);
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <GlobalStoreProvider>
      <SettingsProvider>
        <AlertProvider>
          <MainProvider>
            <Main />
          </MainProvider>
        </AlertProvider>
      </SettingsProvider>
    </GlobalStoreProvider>
  );
}
bjs.initialize().then(render);
