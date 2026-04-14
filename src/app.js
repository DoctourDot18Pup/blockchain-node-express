require('dotenv').config()

const express    = require('express')
const path       = require('path')
const Blockchain = require('./blockchain/Blockchain')
const logger     = require('./middleware/logger')

const chainRoutes       = require('./routes/chain')
const mineRoutes        = require('./routes/mine')
const transactionRoutes = require('./routes/transactions')
const nodeRoutes        = require('./routes/nodes')
const blocksRoutes      = require('./routes/blocks')

const swaggerUi  = require('swagger-ui-express')
const YAML       = require('yamljs')
const swaggerDoc = YAML.load(path.join(__dirname, '../swagger.yaml'))
const cors       = require('cors')
const rateLimit  = require('express-rate-limit')

async function startServer() {
  const app  = express()
  const PORT = process.env.PORT || 8001

  const blockchain = new Blockchain()
  await blockchain.inicializar()
  app.set('blockchain', blockchain)

  app.use(express.json())
  app.use(cors())
  app.use(logger)

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

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc))

  app.get('/health', (req, res) => {
    res.json({
      status:     'ok',
      node_id:    process.env.NODE_ID || 'nodo-1',
      port:       PORT,
      bloques:    blockchain.chain.length,
      pendientes: blockchain.transaccionesPendientes.length,
      peers:      blockchain.getNodos(),
    })
  })

  app.post('/genesis', async (req, res) => {
    if (blockchain.chain.length > 0) {
      return res.status(400).json({ mensaje: 'La cadena ya tiene bloques' })
    }
    blockchain._crearBloqueGenesis()
    res.status(201).json({
      mensaje: 'Bloque génesis creado',
      bloque:  blockchain.chain[0],
    })
  })

  app.use((req, res) => {
    res.status(404).json({ error: `Ruta ${req.method} ${req.path} no encontrada` })
  })

  app.use((err, req, res, next) => {
    console.error(`[Error] ${err.message}`)
    res.status(500).json({ error: 'Error interno del servidor' })
  })

  app.listen(PORT, () => {
    console.log(`\n Nodo blockchain corriendo`)
    console.log(`   NODE_ID : ${process.env.NODE_ID || 'nodo-1'}`)
    console.log(`   Puerto  : ${PORT}`)
    console.log(`   PoW     : ${'0'.repeat(parseInt(process.env.PROOF_OF_WORK_DIFFICULTY || '3'))}...\n`)
  })
}

startServer().catch(err => {
  console.error('[Fatal] No se pudo iniciar el servidor:', err.message)
  process.exit(1)
})
