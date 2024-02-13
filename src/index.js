import React from 'react';
import ReactDOM from 'react-dom/client';

import './index.css';
import { Main } from './components/main/main';
import { GlobalStoreProvider } from './state';


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <GlobalStoreProvider>
    <Main />
  </GlobalStoreProvider>
);

// Hot Module Replacement API
if (module.hot) {
  console.log('Module hot', module);
  // module.hot.accept('./App', render);
}