import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import 'katex/dist/katex.min.css'
import 'highlight.js/styles/github-dark.css'
import './index.css'
import App from './App.tsx'
import APIExplorerPage from './pages/APIExplorerPage.tsx'
import MessageProvider from './components/MessageProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <MessageProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/api-explorer" element={<APIExplorerPage />} />
        </Routes>
      </MessageProvider>
    </BrowserRouter>
  </StrictMode>,
)
