/**
 * Mejora 1 — Verificación de integridad del hash en POST /blocks/receive
 *
 * ANTES del fix: el endpoint solo verificaba que el hash empezara con '0...'
 * y que hash_anterior coincidiera. Un peer malicioso podía enviar datos
 * alterados con un hash válido en formato pero incorrecto para los datos.
 *
 * DESPUÉS del fix: se recalcula el hash desde los campos del bloque y se
 * compara con hash_actual. Si no coinciden → HTTP 400.
 */
const request        = require('supertest')
const { sha256 }     = require('../src/utils/hash')
const createTestApp  = require('./helpers/createTestApp')

describe('Mejora 1 — Integridad del hash en /blocks/receive', () => {
  let app, blockchain

  beforeEach(() => {
    ;({ app, blockchain } = createTestApp())
  })

  // ── Helpers locales ──────────────────────────────────────────────────────────

  function construirBloqueValido() {
    const genesis   = blockchain.chain[0]
    const DIFFICULTY = parseInt(process.env.PROOF_OF_WORK_DIFFICULTY || '1')

    const datos = {
      persona_id:      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      institucion_id:  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      titulo_obtenido: 'Ingeniería en Sistemas',
      fecha_fin:       '2024-12-01',
      hash_anterior:   genesis.hash_actual,
    }

    let nonce = 0
    let hash  = sha256(datos.persona_id, datos.institucion_id, datos.titulo_obtenido, datos.fecha_fin, datos.hash_anterior, nonce)
    while (!hash.startsWith('0'.repeat(DIFFICULTY))) {
      nonce++
      hash = sha256(datos.persona_id, datos.institucion_id, datos.titulo_obtenido, datos.fecha_fin, datos.hash_anterior, nonce)
    }

    return { ...datos, nonce, hash_actual: hash, firmado_por: 'nodo-peer' }
  }

  // ── Tests ────────────────────────────────────────────────────────────────────

  test('acepta un bloque con hash correcto y hash_anterior válido → 200', async () => {
    const bloque = construirBloqueValido()

    const res = await request(app)
      .post('/blocks/receive')
      .send(bloque)

    expect(res.status).toBe(200)
    expect(res.body.mensaje).toBe('Bloque aceptado')
    expect(blockchain.chain).toHaveLength(2)
  })

  test('rechaza bloque sin hash_actual en el body → 400', async () => {
    const res = await request(app)
      .post('/blocks/receive')
      .send({ persona_id: 'algo', hash_anterior: 'x' }) // falta hash_actual

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/hash_actual/)
  })

  test('rechaza bloque con hash_anterior incorrecto → 409', async () => {
    const bloque = construirBloqueValido()
    bloque.hash_anterior = 'hash-que-no-existe-en-la-cadena'
    // Recalcular hash_actual para que sea consistente con los datos (pero hash_anterior es malo)
    bloque.hash_actual = sha256(
      bloque.persona_id, bloque.institucion_id, bloque.titulo_obtenido,
      bloque.fecha_fin, bloque.hash_anterior, bloque.nonce
    )

    const res = await request(app)
      .post('/blocks/receive')
      .send(bloque)

    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/hash anterior/)
  })

  test('[Mejora 1] rechaza bloque con datos alterados aunque el hash_anterior sea correcto → 400', async () => {
    const bloqueOriginal = construirBloqueValido()

    // Simular peer malicioso: datos alterados, se mantiene el hash del bloque original
    // Antes del fix este bloque era ACEPTADO (solo verificaba PoW prefix y hash_anterior)
    const bloqueTampeado = {
      ...bloqueOriginal,
      titulo_obtenido: 'Titulo Inyectado Maliciosamente',
      // hash_actual y hash_anterior sin cambiar → hash no corresponde a los datos
    }

    const res = await request(app)
      .post('/blocks/receive')
      .send(bloqueTampeado)

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Hash inválido/)
  })

  test('[Mejora 1] rechaza bloque con persona_id alterado manteniendo hash original → 400', async () => {
    const bloqueOriginal = construirBloqueValido()

    const bloqueTampeado = {
      ...bloqueOriginal,
      persona_id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', // persona diferente
      // hash_actual no actualizado → no corresponde a esta persona
    }

    const res = await request(app)
      .post('/blocks/receive')
      .send(bloqueTampeado)

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Hash inválido/)
  })

  test('agrega el bloque correctamente a la cadena local después de aceptarlo', async () => {
    const bloque = construirBloqueValido()
    expect(blockchain.chain).toHaveLength(1) // solo génesis

    await request(app).post('/blocks/receive').send(bloque)

    expect(blockchain.chain).toHaveLength(2)
    expect(blockchain.chain[1].hash_actual).toBe(bloque.hash_actual)
  })
})
