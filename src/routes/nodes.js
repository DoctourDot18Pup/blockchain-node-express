const express = require('express')
const axios   = require('axios')
const router  = express.Router()

/**
 * POST /nodes/register
 * Registra un nodo peer. Campo: "url" (contrato común).
 */
router.post('/register', (req, res) => {
  const blockchain = req.app.get('blockchain')
  const { url }    = req.body

  if (!url) {
    return res.status(400).json({ error: 'Se requiere el campo "url"' })
  }

  blockchain.registrarNodo(url)

  res.json({
    mensaje:      'Nodo registrado',
    nodosActivos: blockchain.getNodos(),
  })
})

/**
 * POST /blocks/receive
 * Recibe un bloque propagado por otro nodo y lo valida antes de aceptarlo.
 * Montado en app.js bajo /blocks, por lo que esta ruta es /receive internamente.
 */
router.post('/receive', (req, res) => {
  const blockchain = req.app.get('blockchain')
  const bloque     = req.body

  if (!bloque || !bloque.hash_actual) {
    return res.status(400).json({ error: 'Body inválido: se requiere un bloque con hash_actual' })
  }

  const ultimoLocal = blockchain.ultimoBloque
  const DIFFICULTY  = parseInt(process.env.PROOF_OF_WORK_DIFFICULTY || '3')

  if (bloque.hash_anterior !== ultimoLocal.hash_actual) {
    return res.status(409).json({ error: 'El hash anterior no coincide — usa /nodes/resolve para sincronizar' })
  }

  if (!bloque.hash_actual.startsWith('0'.repeat(DIFFICULTY))) {
    return res.status(400).json({ error: 'El bloque no cumple el Proof of Work requerido' })
  }

  blockchain.chain.push(bloque)
  console.log(`[Red] Bloque aceptado desde peer | hash: ${bloque.hash_actual.slice(0, 12)}...`)

  res.json({ mensaje: 'Bloque aceptado', bloque })
})

/**
 * GET /nodes/resolve
 * Algoritmo de consenso: adopta la cadena válida más larga de los peers.
 */
router.get('/resolve', async (req, res) => {
  const blockchain = req.app.get('blockchain')
  const nodos      = blockchain.getNodos()

  if (nodos.length === 0) {
    return res.json({ mensaje: 'Sin peers registrados, cadena local mantenida', reemplazada: false })
  }

  let reemplazada = false

  const consultas = nodos.map(nodo =>
    axios.get(`${nodo}/chain`)
      .then(response => {
        const { chain } = response.data
        if (blockchain.reemplazarCadena(chain)) {
          reemplazada = true
          console.log(`[Consenso] Cadena adoptada desde ${nodo}`)
        }
      })
      .catch(err => console.warn(`[Consenso] No se pudo consultar ${nodo}: ${err.message}`))
  )

  await Promise.allSettled(consultas)

  res.json({
    mensaje:    reemplazada ? 'Cadena reemplazada por una más larga' : 'Cadena local es la más larga',
    reemplazada,
    longitud:   blockchain.chain.length,
  })
})

/**
 * GET /nodes
 * Lista todos los nodos registrados.
 */
router.get('/', (req, res) => {
  const blockchain = req.app.get('blockchain')
  res.json({
    nodos: blockchain.getNodos(),
    total: blockchain.getNodos().length,
  })
})

module.exports = router