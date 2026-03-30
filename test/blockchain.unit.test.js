/**
 * Tests unitarios del núcleo de la blockchain.
 *
 * Cubren principalmente:
 *   - Mejora 3: DIFFICULTY dinámico en esValida()
 *   - Mejora 7: límite de mempool en agregarTransaccion()
 *   - Comportamiento base: proofOfWork, encadenamiento, integridad
 */
const Blockchain = require('../src/blockchain/Blockchain')
const { sha256 } = require('../src/utils/hash')

// ─── Dato de prueba reutilizable ──────────────────────────────────────────────
const TX_EJEMPLO = {
  persona_id:      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  institucion_id:  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  programa_id:     'cccccccc-cccc-cccc-cccc-cccccccccccc',
  titulo_obtenido: 'Ingeniería en Sistemas',
  fecha_fin:       '2024-12-01',
  firmado_por:     'nodo-test',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nuevaBlockchain() {
  const bc = new Blockchain()
  bc._crearBloqueGenesis()
  return bc
}

async function minarBloque(bc) {
  bc.agregarTransaccion(TX_EJEMPLO)
  return bc.minar('nodo-test')
}

// ─── Suite principal ──────────────────────────────────────────────────────────

describe('Blockchain — pruebas unitarias', () => {

  // ── proofOfWork ─────────────────────────────────────────────────────────────
  describe('proofOfWork()', () => {
    test('el hash resultante empieza con los ceros requeridos por DIFFICULTY', () => {
      const bc = nuevaBlockchain()
      const difficulty = parseInt(process.env.PROOF_OF_WORK_DIFFICULTY || '3')
      const { hash } = bc.proofOfWork(TX_EJEMPLO)

      expect(hash.startsWith('0'.repeat(difficulty))).toBe(true)
    })

    test('el nonce encontrado reproduce el mismo hash', () => {
      const bc = nuevaBlockchain()
      const { nonce, hash, hashAnterior } = bc.proofOfWork(TX_EJEMPLO)

      const reproducido = sha256(
        TX_EJEMPLO.persona_id,
        TX_EJEMPLO.institucion_id,
        TX_EJEMPLO.titulo_obtenido,
        TX_EJEMPLO.fecha_fin,
        hashAnterior,
        nonce,
      )
      expect(reproducido).toBe(hash)
    })
  })

  // ── esValida ─────────────────────────────────────────────────────────────────
  describe('esValida()', () => {
    test('cadena con solo el bloque génesis es válida', () => {
      const bc = nuevaBlockchain()
      expect(bc.esValida()).toBe(true)
    })

    test('cadena con un bloque correctamente minado es válida', async () => {
      const bc = nuevaBlockchain()
      await minarBloque(bc)
      expect(bc.esValida()).toBe(true)
    })

    test('rechaza cadena con hash_anterior roto (encadenamiento roto)', async () => {
      const bc = nuevaBlockchain()
      await minarBloque(bc)

      // Romper el encadenamiento: apuntar al bloque anterior incorrecto
      bc.chain[1] = { ...bc.chain[1], hash_anterior: 'hash-inventado-invalido' }

      expect(bc.esValida()).toBe(false)
    })

    test('rechaza cadena con hash_actual manipulado (datos alterados)', async () => {
      const bc = nuevaBlockchain()
      await minarBloque(bc)

      // Alterar un campo de datos → el hash ya no corresponde al contenido
      bc.chain[1] = { ...bc.chain[1], titulo_obtenido: 'Titulo Falso Inyectado' }

      expect(bc.esValida()).toBe(false)
    })

    // ── Mejora 3: DIFFICULTY dinámico ─────────────────────────────────────────
    describe('Mejora 3 — DIFFICULTY dinámico en esValida()', () => {
      const diffOriginal = process.env.PROOF_OF_WORK_DIFFICULTY

      afterEach(() => {
        // Restaurar el valor original después de cada test
        process.env.PROOF_OF_WORK_DIFFICULTY = diffOriginal
      })

      test('con DIFFICULTY=1 (setup), un bloque minado con 1 cero es válido', async () => {
        // setup.js fija DIFFICULTY=1, así que los bloques tienen 1 cero
        const bc = nuevaBlockchain()
        await minarBloque(bc)

        process.env.PROOF_OF_WORK_DIFFICULTY = '1'
        expect(bc.esValida()).toBe(true)
      })

      test('si se sube DIFFICULTY a 3, el mismo bloque (solo 1 cero) se rechaza', async () => {
        // El bloque fue minado con DIFFICULTY=1 → hash tiene exactamente 1 cero
        const bc = nuevaBlockchain()
        await minarBloque(bc)
        const hashBloque = bc.chain[1].hash_actual

        // Confirmar que el hash tiene solo 1 cero (no 3)
        expect(hashBloque.startsWith('0')).toBe(true)
        expect(hashBloque.startsWith('000')).toBe(false)

        // Subir la dificultad requerida en el entorno → esValida() lo detecta dinámicamente
        process.env.PROOF_OF_WORK_DIFFICULTY = '3'
        expect(bc.esValida()).toBe(false)
      })

      test('al restaurar DIFFICULTY=1, el mismo bloque vuelve a ser válido', async () => {
        const bc = nuevaBlockchain()
        await minarBloque(bc)

        process.env.PROOF_OF_WORK_DIFFICULTY = '3'
        expect(bc.esValida()).toBe(false)   // inválido con diff=3

        process.env.PROOF_OF_WORK_DIFFICULTY = '1'
        expect(bc.esValida()).toBe(true)    // válido de nuevo con diff=1
      })
    })
  })

  // ── agregarTransaccion — Mejora 7 ────────────────────────────────────────────
  describe('Mejora 7 — límite de mempool en agregarTransaccion()', () => {
    test('agrega transacciones hasta el límite (MAX_MEMPOOL_SIZE=3)', () => {
      const bc = nuevaBlockchain()

      bc.agregarTransaccion(TX_EJEMPLO)
      bc.agregarTransaccion({ ...TX_EJEMPLO, titulo_obtenido: 'Medicina' })
      bc.agregarTransaccion({ ...TX_EJEMPLO, titulo_obtenido: 'Derecho' })

      expect(bc.transaccionesPendientes).toHaveLength(3)
    })

    test('lanza error al intentar agregar más allá del límite', () => {
      const bc = nuevaBlockchain()

      bc.agregarTransaccion(TX_EJEMPLO)
      bc.agregarTransaccion({ ...TX_EJEMPLO, titulo_obtenido: 'Medicina' })
      bc.agregarTransaccion({ ...TX_EJEMPLO, titulo_obtenido: 'Derecho' })

      // La 4ª transacción supera MAX_MEMPOOL_SIZE=3
      expect(() => {
        bc.agregarTransaccion({ ...TX_EJEMPLO, titulo_obtenido: 'Arquitectura' })
      }).toThrow('Mempool llena')
    })

    test('minar libera un slot y permite agregar de nuevo', async () => {
      const bc = nuevaBlockchain()

      bc.agregarTransaccion(TX_EJEMPLO)
      bc.agregarTransaccion({ ...TX_EJEMPLO, titulo_obtenido: 'Medicina' })
      bc.agregarTransaccion({ ...TX_EJEMPLO, titulo_obtenido: 'Derecho' })

      await bc.minar('nodo-test') // consume la 1ª tx → mempool baja a 2

      // Ahora hay espacio para una más
      expect(() => {
        bc.agregarTransaccion({ ...TX_EJEMPLO, titulo_obtenido: 'Arquitectura' })
      }).not.toThrow()
      expect(bc.transaccionesPendientes).toHaveLength(3)
    })
  })

  // ── reemplazarCadena ─────────────────────────────────────────────────────────
  describe('reemplazarCadena() — consenso', () => {
    test('adopta cadena externa si es más larga y válida', async () => {
      const bcLocal    = nuevaBlockchain()
      const bcExterno  = nuevaBlockchain()

      await minarBloque(bcExterno)
      await minarBloque(bcExterno) // cadena externa tiene 3 bloques vs 1 local

      const reemplazada = bcLocal.reemplazarCadena(bcExterno.chain)

      expect(reemplazada).toBe(true)
      expect(bcLocal.chain).toHaveLength(3)
    })

    test('mantiene cadena local si la externa es igual de larga', async () => {
      const bcLocal   = nuevaBlockchain()
      const bcExterno = nuevaBlockchain()

      // Ambas en el mismo punto (solo génesis)
      const reemplazada = bcLocal.reemplazarCadena(bcExterno.chain)

      expect(reemplazada).toBe(false)
    })

    test('rechaza cadena externa manipulada aunque sea más larga', async () => {
      const bcLocal   = nuevaBlockchain()
      const bcExterno = nuevaBlockchain()

      await minarBloque(bcExterno)

      // Manipular el bloque de la cadena externa
      const cadenaFalsa = [...bcExterno.chain]
      cadenaFalsa[1] = { ...cadenaFalsa[1], titulo_obtenido: 'Titulo Manipulado' }

      const reemplazada = bcLocal.reemplazarCadena(cadenaFalsa)

      expect(reemplazada).toBe(false)
      expect(bcLocal.chain).toHaveLength(1) // sigue con solo el génesis
    })
  })
})
