const Block = require('./Block')
const Transaction = require('./Transaction')
const { sha256 } = require('../utils/hash')

const DIFFICULTY = parseInt(process.env.PROOF_OF_WORK_DIFFICULTY || '3')

class Blockchain {
  constructor() {
    this.chain = []
    this.transaccionesPendientes = []
    this.nodos = new Set()
  }

  /**
   * Inicializa la cadena cargando desde Supabase.
   * Si no hay bloques persistidos, crea el bloque génesis.
   */
  async inicializar() {
    const { cargarCadena, cargarPeers } = require('../db/grados')

    const [bloquesPersistidos, peersPersistidos] = await Promise.all([
      cargarCadena(),
      cargarPeers(process.env.NODE_ID || 'nodo-1'),
    ])

    if (bloquesPersistidos.length > 0) {
      this.chain = bloquesPersistidos
      console.log(`[Blockchain] Cadena restaurada desde Supabase: ${this.chain.length} bloque(s)`)
    } else {
      this._crearBloqueGenesis()
    }

    peersPersistidos.forEach(dir => this.nodos.add(dir))
    if (peersPersistidos.length > 0) {
      console.log(`[Blockchain] ${peersPersistidos.length} peer(s) restaurados desde Supabase`)
    }
  }

  // ─── Bloque génesis ──────────────────────────────────────────────────────────

  _crearBloqueGenesis() {
    // El génesis usa campos nulos/vacíos — se calcula el nonce igual que cualquier bloque
    let nonce = 0
    let hash = sha256('', '', 'GENESIS', '2000-01-01', '', nonce)
    while (!hash.startsWith('0'.repeat(DIFFICULTY))) {
      nonce++
      hash = sha256('', '', 'GENESIS', '2000-01-01', '', nonce)
    }

    const genesis = {
      persona_id: null,
      institucion_id: null,
      programa_id: null,
      titulo_obtenido: 'GENESIS',
      fecha_fin: '2000-01-01',
      hash_anterior: null,
      hash_actual: hash,
      nonce,
      firmado_por: 'sistema',
    }

    this.chain.push(genesis)
    console.log(`[Blockchain] Bloque génesis creado: ${hash}`)
  }

  // ─── Getters ─────────────────────────────────────────────────────────────────

  get ultimoBloque() {
    return this.chain[this.chain.length - 1]
  }

  // ─── Proof of Work ───────────────────────────────────────────────────────────

  proofOfWork(tx) {
    const hashAnterior = this.ultimoBloque.hash_actual
    let nonce = 0

    console.log(`[PoW] Minando con dificultad ${'0'.repeat(DIFFICULTY)}...`)

    let hash = sha256(
      tx.persona_id ?? '',
      tx.institucion_id ?? '',
      tx.titulo_obtenido ?? '',
      tx.fecha_fin ?? '',
      hashAnterior,
      nonce,
    )
    while (!hash.startsWith('0'.repeat(DIFFICULTY))) {
      nonce++
      hash = sha256(
        tx.persona_id ?? '',
        tx.institucion_id ?? '',
        tx.titulo_obtenido ?? '',
        tx.fecha_fin ?? '',
        hashAnterior,
        nonce,
      )
    }

    console.log(`[PoW] Nonce encontrado: ${nonce} | Hash: ${hash}`)
    return { nonce, hash, hashAnterior }
  }

  // ─── Minado ──────────────────────────────────────────────────────────────────

  async minar(nodeId) {
    if (this.transaccionesPendientes.length === 0) {
      throw new Error('No hay transacciones pendientes para minar')
    }

    // Un bloque por transacción — alineado con Flask, Laravel y NextJS
    const tx = this.transaccionesPendientes[0]

    const { nonce, hash, hashAnterior } = this.proofOfWork(tx)

    const bloque = {
      persona_id: tx.persona_id,
      institucion_id: tx.institucion_id,
      programa_id: tx.programa_id ?? null,
      titulo_obtenido: tx.titulo_obtenido,
      fecha_inicio: tx.fecha_inicio ?? null,
      fecha_fin: tx.fecha_fin,
      numero_cedula: tx.numero_cedula ?? null,
      titulo_tesis: tx.titulo_tesis ?? null,
      menciones: tx.menciones ?? null,
      hash_actual: hash,
      hash_anterior: hashAnterior,
      nonce,
      firmado_por: nodeId,
    }

    this.chain.push(bloque)
    this.transaccionesPendientes.shift()

    // Persistir en Supabase de forma no bloqueante
    const { persistirBloque } = require('../db/grados')
    persistirBloque(bloque, nodeId).catch(err =>
      console.error('[Blockchain] Error de persistencia:', err.message)
    )

    return bloque
  }

  // ─── Transacciones ───────────────────────────────────────────────────────────

  agregarTransaccion(datos) {
    const maxMempool = parseInt(process.env.MAX_MEMPOOL_SIZE || '100')
    if (this.transaccionesPendientes.length >= maxMempool) {
      throw new Error(`Mempool llena (máximo ${maxMempool} transacciones pendientes)`)
    }
    const tx = new Transaction(datos)
    this.transaccionesPendientes.push(tx)
    console.log(`[Transaccion] Nueva transacción agregada: ${tx.id}`)
    return tx
  }

  // ─── Validación ──────────────────────────────────────────────────────────────

  esValida(chain = this.chain) {
    for (let i = 1; i < chain.length; i++) {
      const actual = chain[i]
      const anterior = chain[i - 1]

      // Verificar encadenamiento
      if (actual.hash_anterior !== anterior.hash_actual) {
        console.warn(`[Validacion] Encadenamiento roto en bloque #${i}`)
        return false
      }

      // Recalcular hash con la fórmula canónica
      const hashRecalculado = sha256(
        actual.persona_id ?? '',
        actual.institucion_id ?? '',
        actual.titulo_obtenido ?? '',
        actual.fecha_fin ?? '',
        actual.hash_anterior ?? '',
        actual.nonce,
      )

      if (actual.hash_actual !== hashRecalculado) {
        console.warn(`[Validacion] Hash inválido en bloque #${i}`)
        return false
      }

      const difficulty = parseInt(process.env.PROOF_OF_WORK_DIFFICULTY || '3')
      if (!actual.hash_actual.startsWith('0'.repeat(difficulty))) {
        console.warn(`[Validacion] PoW inválido en bloque #${i}`)
        return false
      }
    }
    return true
  }

  // ─── Consenso ────────────────────────────────────────────────────────────────

  reemplazarCadena(cadenaExterna) {
    if (cadenaExterna.length > this.chain.length && this.esValida(cadenaExterna)) {
      console.log(`[Consenso] Cadena reemplazada: ${this.chain.length} → ${cadenaExterna.length} bloques`)
      this.chain = cadenaExterna
      return true
    }
    return false
  }

  // ─── Nodos ───────────────────────────────────────────────────────────────────

  registrarNodo(url) {
    const dir = url.replace(/\/$/, '')

    // Un nodo nunca debe registrarse a sí mismo
    const propioPort = process.env.PORT || '8001'
    const propiasUrls = [
      `http://localhost:${propioPort}`,
      `http://127.0.0.1:${propioPort}`,
    ]
    if (propiasUrls.includes(dir)) {
      console.warn(`[Red] Ignorado: intento de registrar el nodo propio (${dir})`)
      return
    }

    this.nodos.add(dir)
    console.log(`[Red] Nodo registrado: ${dir}. Total nodos: ${this.nodos.size}`)

    const { guardarPeer } = require('../db/grados')
    guardarPeer(process.env.NODE_ID || 'nodo-1', dir)
      .catch(err => console.error('[Blockchain] Error guardando peer:', err.message))
  }

  getNodos() {
    return Array.from(this.nodos)
  }
}

module.exports = Blockchain