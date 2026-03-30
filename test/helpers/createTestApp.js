/**
 * Factory que construye una aplicación Express lista para tests.
 *
 * Diferencias con app.js:
 * - No llama blockchain.inicializar() (evita Supabase)
 * - Crea el bloque génesis directamente con _crearBloqueGenesis()
 * - Replica los rate limiters del mismo modo que app.js
 * - Cada llamada devuelve una instancia fresca e independiente
 */
const express    = require('express')
const rateLimit  = require('express-rate-limit')
const cors       = require('cors')
const Blockchain = require('../../src/blockchain/Blockchain')

const chainRoutes       = require('../../src/routes/chain')
const mineRoutes        = require('../../src/routes/mine')
const transactionRoutes = require('../../src/routes/transactions')
const nodeRoutes        = require('../../src/routes/nodes')
const blocksRoutes      = require('../../src/routes/blocks')

function createTestApp() {
  const blockchain = new Blockchain()
  blockchain._crearBloqueGenesis()

  const app = express()
  app.set('blockchain', blockchain)
  app.use(express.json())
  app.use(cors())

  // Misma configuración que app.js — Mejora 5
  const limiteMine = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas peticiones de minado, intenta en un minuto' },
  })

  const limiteTransacciones = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas transacciones, intenta en un minuto' },
  })

  app.use('/chain',        chainRoutes)
  app.use('/mine',         limiteMine, mineRoutes)
  app.use('/transactions', limiteTransacciones, transactionRoutes)
  app.use('/nodes',        nodeRoutes)
  app.use('/blocks',       blocksRoutes)

  return { app, blockchain }
}

module.exports = createTestApp
