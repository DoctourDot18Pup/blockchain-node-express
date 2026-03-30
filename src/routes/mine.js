const express = require('express')
const axios   = require('axios')
const router  = express.Router()

/**
 * POST /mine
 * Mina la primera transacción pendiente, genera un bloque y lo propaga
 * a todos los peers mediante POST /blocks/receive (contrato común).
 */
router.post('/', async (req, res) => {
  const blockchain = req.app.get('blockchain')
  const nodeId     = process.env.NODE_ID || 'nodo-desconocido'

  try {
    const bloque = await blockchain.minar(nodeId)

    const nodos = blockchain.getNodos()
    const propagaciones = nodos.map(nodo =>
      axios.post(`${nodo}/blocks/receive`, bloque, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      }).catch(err => console.warn(`[Propagacion] Fallo nodo ${nodo}: ${err.message}`))
    )
    await Promise.allSettled(propagaciones)

    res.json({
      mensaje:    'Bloque minado y propagado',
      bloque,
      nodosMine:  nodeId,
      propagadoA: nodos,
    })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

module.exports = router