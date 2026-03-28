const express = require('express')
const axios   = require('axios')
const router  = express.Router()

/**
 * POST /transactions
 * Recibe una transacción en snake_case, la agrega a pendientes y la propaga.
 * Header X-Propagated: true evita re-propagación infinita.
 */
router.post('/', async (req, res) => {
  const blockchain = req.app.get('blockchain')
  const propagado  = req.headers['x-propagated'] === 'true'

  const camposRequeridos = ['persona_id', 'institucion_id', 'programa_id', 'titulo_obtenido', 'fecha_fin', 'firmado_por']
  const faltantes = camposRequeridos.filter(c => !req.body[c])

  if (faltantes.length > 0) {
    return res.status(400).json({ error: `Campos requeridos: ${faltantes.join(', ')}` })
  }

  const tx = blockchain.agregarTransaccion(req.body)

  if (!propagado) {
    const nodos = blockchain.getNodos()
    const propagaciones = nodos.map(nodo =>
      axios.post(`${nodo}/transactions`, req.body, {
        headers: { 'X-Propagated': 'true' }
      }).catch(err => console.warn(`[Propagacion] Fallo nodo ${nodo}: ${err.message}`))
    )
    await Promise.allSettled(propagaciones)
  }

  res.status(201).json({
    mensaje:     'Transacción agregada',
    transaccion: tx,
    propagada:   !propagado,
  })
})

/**
 * GET /transactions/pending
 * Lista las transacciones pendientes de minar.
 */
router.get('/pending', (req, res) => {
  const blockchain = req.app.get('blockchain')
  res.json({
    transacciones: blockchain.transaccionesPendientes,
    total:         blockchain.transaccionesPendientes.length,
  })
})

module.exports = router