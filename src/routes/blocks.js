const express = require('express')
const router  = express.Router()

/**
 * POST /blocks/receive
 * Recibe un bloque propagado por otro nodo y lo valida antes de aceptarlo.
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

module.exports = router