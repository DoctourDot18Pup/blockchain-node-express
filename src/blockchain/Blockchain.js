const Block       = require('./Block')
const Transaction = require('./Transaction')

const DIFFICULTY = parseInt(process.env.PROOF_OF_WORK_DIFFICULTY || '3')

class Blockchain {
  constructor() {
    this.chain                = []
    this.transaccionesPendientes = []
    this.nodos                = new Set()

    // Crear bloque génesis al inicializar
    this._crearBloqueGenesis()
  }

  // ─── Bloque génesis ──────────────────────────────────────────────────────────

  _crearBloqueGenesis() {
    const genesis = new Block(
      0,
      Date.now(),
      { mensaje: 'Bloque Génesis - Red Blockchain Grados Académicos' },
      '0',
      0
    )
    this.chain.push(genesis)
    console.log(`[Blockchain] Bloque génesis creado: ${genesis.hashActual}`)
  }

  // ─── Getters ─────────────────────────────────────────────────────────────────

  get ultimoBloque() {
    return this.chain[this.chain.length - 1]
  }

  // ─── Proof of Work ───────────────────────────────────────────────────────────

  /**
   * Encuentra el nonce que hace que el hash del nuevo bloque
   * comience con N ceros (según DIFFICULTY)
   *
   * @param {Object} data - Datos a incluir en el bloque
   * @returns {Block} Bloque válido con PoW resuelto
   */
  proofOfWork(data) {
    const index        = this.chain.length
    const timestamp    = Date.now()
    const hashAnterior = this.ultimoBloque.hashActual
    let nonce          = 0

    console.log(`[PoW] Minando bloque #${index} con dificultad ${DIFFICULTY}...`)

    let bloque = new Block(index, timestamp, data, hashAnterior, nonce)

    while (!bloque.cumpleDificultad(DIFFICULTY)) {
      nonce++
      bloque = new Block(index, timestamp, data, hashAnterior, nonce)
    }

    console.log(`[PoW] Bloque #${index} minado! nonce=${nonce} hash=${bloque.hashActual}`)
    return bloque
  }

  // ─── Minado ──────────────────────────────────────────────────────────────────

  /**
   * Mina todas las transacciones pendientes, las empaqueta en un bloque
   * y limpia la lista de pendientes
   *
   * @param {string} nodId - ID del nodo que mina (firmado_por)
   * @returns {Block} Bloque minado
   */
  minar(nodeId) {
    if (this.transaccionesPendientes.length === 0) {
      throw new Error('No hay transacciones pendientes para minar')
    }

    const data = {
      transacciones: [...this.transaccionesPendientes],
      minadoPor:     nodeId,
    }

    const bloque = this.proofOfWork(data)
    this.chain.push(bloque)
    this.transaccionesPendientes = []

    return bloque
  }

  // ─── Transacciones ───────────────────────────────────────────────────────────

  /**
   * Agrega una transacción a la lista de pendientes
   * @param {Object} datosGrado - Campos del grado académico
   * @returns {Transaction}
   */
  agregarTransaccion(datosGrado) {
    const tx = new Transaction(datosGrado)
    this.transaccionesPendientes.push(tx)
    console.log(`[Transaccion] Nueva transacción agregada: ${tx.id}`)
    return tx
  }

  // ─── Validación ──────────────────────────────────────────────────────────────

  /**
   * Verifica la integridad completa de una cadena:
   * - Cada bloque tiene el hash correcto
   * - Cada bloque apunta al hash anterior correcto
   * - Cada bloque cumple con la dificultad de PoW
   *
   * @param {Block[]} chain - Cadena a validar (default: la propia)
   * @returns {boolean}
   */
  esValida(chain = this.chain) {
    for (let i = 1; i < chain.length; i++) {
      const actual   = chain[i]
      const anterior = chain[i - 1]

      // Verificar que el hash almacenado coincide con el recalculado
      const bloqueRecalculado = new Block(
        actual.index,
        actual.timestamp,
        actual.data,
        actual.hashAnterior,
        actual.nonce
      )
      if (actual.hashActual !== bloqueRecalculado.hashActual) {
        console.warn(`[Validacion] Hash inválido en bloque #${i}`)
        return false
      }

      // Verificar encadenamiento
      if (actual.hashAnterior !== anterior.hashActual) {
        console.warn(`[Validacion] Encadenamiento roto en bloque #${i}`)
        return false
      }

      // Verificar Proof of Work
      if (!actual.cumpleDificultad(DIFFICULTY)) {
        console.warn(`[Validacion] PoW inválido en bloque #${i}`)
        return false
      }
    }
    return true
  }

  // ─── Consenso ────────────────────────────────────────────────────────────────

  /**
   * Reemplaza la cadena local si recibe una cadena válida más larga
   * @param {Block[]} cadenaExterna
   * @returns {boolean} true si se reemplazó, false si se mantuvo la local
   */
  reemplazarCadena(cadenaExterna) {
    if (
      cadenaExterna.length > this.chain.length &&
      this.esValida(cadenaExterna)
    ) {
      console.log(`[Consenso] Cadena reemplazada: ${this.chain.length} → ${cadenaExterna.length} bloques`)
      this.chain = cadenaExterna
      return true
    }
    return false
  }

  // ─── Nodos ───────────────────────────────────────────────────────────────────

  registrarNodo(direccion) {
    this.nodos.add(direccion.replace(/\/$/, ''))
    console.log(`[Red] Nodo registrado: ${direccion}. Total nodos: ${this.nodos.size}`)
  }

  getNodos() {
    return Array.from(this.nodos)
  }
}

module.exports = Blockchain
