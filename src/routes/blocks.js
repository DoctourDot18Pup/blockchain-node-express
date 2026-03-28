const express = require('express')
const router  = express.Router()

/**
 * POST /blocks/receive
 * Recibe un bloque propagado por otro nodo y lo valida antes de aceptarlo.
 * También limpia de la mempool local las transacciones ya confirmadas.
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

  // Limpiar de la mempool local las transacciones que este bloque ya confirmó
  // Se compara por persona_id + titulo_obtenido + fecha_fin como identificador único
  blockchain.transaccionesPendientes = blockchain.transaccionesPendientes.filter(tx =>
    !(tx.persona_id      === bloque.persona_id      &&
      tx.titulo_obtenido === bloque.titulo_obtenido  &&
      tx.fecha_fin       === bloque.fecha_fin)
  )

  console.log(`[Red] Bloque aceptado desde peer | hash: ${bloque.hash_actual.slice(0, 12)}...`)
  console.log(`[Red] Mempool local: ${blockchain.transaccionesPendientes.length} transacciones pendientes`)

  res.json({ mensaje: 'Bloque aceptado', bloque })
})

module.exports = router