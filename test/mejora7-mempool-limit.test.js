/**
 * Mejora 7 — Límite de mempool en POST /transactions
 *
 * MAX_MEMPOOL_SIZE=3 (fijado en test/setup.js).
 *
 * Comportamiento esperado:
 *   - Las primeras 3 transacciones → HTTP 201 Created
 *   - La 4ª transacción → HTTP 507 Insufficient Storage
 *   - Después de minar, hay espacio de nuevo → HTTP 201
 */
const request       = require('supertest')
const createTestApp = require('./helpers/createTestApp')

function txPayload(titulo) {
  return {
    persona_id:      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    institucion_id:  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    programa_id:     'cccccccc-cccc-cccc-cccc-cccccccccccc',
    titulo_obtenido: titulo,
    fecha_fin:       '2024-12-01',
    firmado_por:     'nodo-test',
  }
}

describe('Mejora 7 — Límite de mempool vía HTTP', () => {
  let app, blockchain

  beforeEach(() => {
    ;({ app, blockchain } = createTestApp())
  })

  test('la primera transacción se agrega correctamente → 201', async () => {
    const res = await request(app)
      .post('/transactions')
      .send(txPayload('Ingeniería'))

    expect(res.status).toBe(201)
    expect(res.body.mensaje).toBe('Transacción agregada')
    expect(blockchain.transaccionesPendientes).toHaveLength(1)
  })

  test('hasta 3 transacciones se aceptan (MAX_MEMPOOL_SIZE=3)', async () => {
    for (const titulo of ['Medicina', 'Derecho', 'Arquitectura']) {
      const res = await request(app)
        .post('/transactions')
        .send(txPayload(titulo))
      expect(res.status).toBe(201)
    }
    expect(blockchain.transaccionesPendientes).toHaveLength(3)
  })

  test('[Mejora 7] la 4ª transacción es rechazada con HTTP 507', async () => {
    // Llenar el mempool
    await request(app).post('/transactions').send(txPayload('Medicina'))
    await request(app).post('/transactions').send(txPayload('Derecho'))
    await request(app).post('/transactions').send(txPayload('Arquitectura'))

    // La 4ª debe fallar
    const res = await request(app)
      .post('/transactions')
      .send(txPayload('Odontología'))

    expect(res.status).toBe(507)
    expect(res.body.error).toMatch(/Mempool llena/)
    // El mempool no creció
    expect(blockchain.transaccionesPendientes).toHaveLength(3)
  })

  test('[Mejora 7] el mensaje de error indica el límite configurado', async () => {
    for (const t of ['A', 'B', 'C']) {
      await request(app).post('/transactions').send(txPayload(t))
    }

    const res = await request(app)
      .post('/transactions')
      .send(txPayload('D'))

    expect(res.body.error).toMatch(/3/)          // menciona el límite
    expect(res.body.error).toMatch(/Mempool llena/)
  })

  test('después de minar, el mempool libera un slot y acepta otra transacción', async () => {
    // Llenar el mempool
    await request(app).post('/transactions').send(txPayload('Medicina'))
    await request(app).post('/transactions').send(txPayload('Derecho'))
    await request(app).post('/transactions').send(txPayload('Arquitectura'))

    // Minar → consume la primera transacción
    await request(app).post('/mine')
    expect(blockchain.transaccionesPendientes).toHaveLength(2)

    // Ahora hay espacio para una más
    const res = await request(app)
      .post('/transactions')
      .send(txPayload('Odontología'))

    expect(res.status).toBe(201)
    expect(blockchain.transaccionesPendientes).toHaveLength(3)
  })

  test('el endpoint GET /transactions/pending refleja el estado del mempool', async () => {
    await request(app).post('/transactions').send(txPayload('Medicina'))
    await request(app).post('/transactions').send(txPayload('Derecho'))

    const res = await request(app).get('/transactions/pending')
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(2)
    expect(res.body.transacciones).toHaveLength(2)
  })
})
