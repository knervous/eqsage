import React from 'react';
import ReactDOM from 'react-dom/client';
import { Main } from './components/main/main';
import { GlobalStoreProvider } from './state';
import { MainProvider } from './components/main/context';
import { SettingsProvider } from './context/settings';

import './index.css';
import { AlertProvider } from './context/alerts';

function render() {
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
render();
