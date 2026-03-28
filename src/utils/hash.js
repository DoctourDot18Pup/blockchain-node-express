const crypto = require('crypto')

/**
 * Genera el hash SHA256 canónico de un bloque de la red.
 *
 * Contrato de red: concatenación directa de 6 campos en orden fijo,
 * sin separadores, sin JSON.stringify.
 * Fórmula: sha256(persona_id + institucion_id + titulo_obtenido + fecha_fin + hash_anterior + nonce)
 *
 * @param {string} personaId       - UUID de la persona
 * @param {string} institucionId   - UUID de la institución
 * @param {string} tituloObtenido  - Título académico obtenido
 * @param {string} fechaFin        - Fecha de graduación (YYYY-MM-DD)
 * @param {string} hashAnterior    - Hash del bloque previo (o "" en génesis)
 * @param {number} nonce           - Número encontrado por Proof of Work
 * @returns {string} Hash SHA256 hexadecimal (64 chars)
 */
function sha256(personaId, institucionId, tituloObtenido, fechaFin, hashAnterior, nonce) {
  const contenido = `${personaId}${institucionId}${tituloObtenido}${fechaFin}${hashAnterior}${nonce}`
  return crypto
    .createHash('sha256')
    .update(contenido)
    .digest('hex')
}

module.exports = { sha256 }