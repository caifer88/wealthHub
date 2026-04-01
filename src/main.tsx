import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { WealthProvider } from './context/WealthContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <WealthProvider>
        <App />
      </WealthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
