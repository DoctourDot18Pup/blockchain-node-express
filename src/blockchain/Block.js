const { sha256 } = require('../utils/hash')

class Block {
  /**
   * @param {string} personaId      - UUID de la persona (null en génesis)
   * @param {string} institucionId  - UUID de la institución (null en génesis)
   * @param {string} tituloObtenido - Título académico obtenido
   * @param {string} fechaFin       - Fecha de graduación (YYYY-MM-DD)
   * @param {string} hashAnterior   - Hash del bloque previo ('' en génesis)
   * @param {number} nonce          - Número encontrado por Proof of Work
   * @param {Object} extra          - Campos opcionales: programa_id, numero_cedula, titulo_tesis, menciones, fecha_inicio, firmado_por
   */
  constructor(personaId, institucionId, tituloObtenido, fechaFin, hashAnterior = '', nonce = 0, extra = {}) {
    this.personaId      = personaId
    this.institucionId  = institucionId
    this.tituloObtenido = tituloObtenido
    this.fechaFin       = fechaFin
    this.hashAnterior   = hashAnterior
    this.nonce          = nonce

    // Campos opcionales del contrato
    this.programaId   = extra.programaId   ?? null
    this.fechaInicio  = extra.fechaInicio  ?? null
    this.numeroCedula = extra.numeroCedula ?? null
    this.tituloTesis  = extra.tituloTesis  ?? null
    this.menciones    = extra.menciones    ?? null
    this.firmadoPor   = extra.firmadoPor   ?? null

    this.hashActual = this.calcularHash()
  }

  /**
   * Calcula el SHA256 usando la fórmula canónica del contrato:
   * sha256(persona_id + institucion_id + titulo_obtenido + fecha_fin + hash_anterior + nonce)
   */
  calcularHash() {
    return sha256(
      this.personaId      ?? '',
      this.institucionId  ?? '',
      this.tituloObtenido ?? '',
      this.fechaFin       ?? '',
      this.hashAnterior,
      this.nonce,
    )
  }

  /**
   * Verifica si el hash cumple la dificultad de PoW
   * @param {number} difficulty - Cantidad de ceros iniciales requeridos
   */
  cumpleDificultad(difficulty) {
    return this.hashActual.startsWith('0'.repeat(difficulty))
  }
}

module.exports = Block