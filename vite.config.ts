import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Porta fixa: localStorage é por origem (host:porta). Sem strictPort o Vite
  // pula p/ 5177… quando 5176 está ocupada, trocando a origem e "perdendo" as
  // paletas salvas. Fixar a porta mantém os saves estáveis entre reloads.
  server: { port: 5176, strictPort: true },
})
