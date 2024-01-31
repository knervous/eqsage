import React from 'react';
import ReactDOM from 'react-dom/client';

import '../index.css';
import App from '../App';
import { GlobalStoreProvider } from '../state';

export const mountEqSage = (domNode, external) => {
  const root = ReactDOM.createRoot(domNode);
  root.render(
    <GlobalStoreProvider external={external}>
      <App />
    </GlobalStoreProvider>
  );
};
