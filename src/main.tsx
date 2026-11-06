import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { AuthProvider } from './lib/auth'
import { variablesManquantes } from './lib/supabase'

function ConfigurationManquante() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6">
        <h1 className="text-xl font-semibold">Configuration Supabase manquante</h1>
        <p className="mt-2 text-sm text-ink-2">
          L’application a été construite sans les variables d’environnement suivantes :
        </p>
        <ul className="mt-2 list-disc pl-5 font-mono text-sm">
          {variablesManquantes.map((v) => <li key={v}>{v}</li>)}
        </ul>
        <p className="mt-4 text-sm text-ink-2">
          Sur Vercel : <strong>Settings &gt; Environment Variables</strong>, ajoutez-les (environnement Production),
          puis <strong>Deployments &gt; ⋯ &gt; Redeploy</strong>. Les variables sont lues au moment du build :
          un redéploiement est obligatoire après les avoir ajoutées.
        </p>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {variablesManquantes.length > 0 ? (
      <ConfigurationManquante />
    ) : (
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    )}
  </StrictMode>,
)
