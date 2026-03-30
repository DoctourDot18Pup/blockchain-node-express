/**
 * Mejora 5 — Rate limiting en /mine y /transactions
 *
 * express-rate-limit devuelve HTTP 429 cuando se supera el límite
 * en la ventana de 1 minuto:
 *   /mine          → máximo 10 requests/min
 *   /transactions  → máximo 30 requests/min
 *
 * Estrategia: cada test usa una instancia fresca de la app (createTestApp),
 * por lo que el conteo del rate limiter arranca desde cero en cada test.
 */
const request       = require('supertest')
const createTestApp = require('./helpers/createTestApp')

// Payload mínimo válido para POST /transactions
function txPayload(titulo = 'Ingeniería en Sistemas') {
  return {
    persona_id:      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    institucion_id:  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    programa_id:     'cccccccc-cccc-cccc-cccc-cccccccccccc',
    titulo_obtenido: titulo,
    fecha_fin:       '2024-12-01',
    firmado_por:     'nodo-test',
  }
}

describe('Mejora 5 — Rate limiting', () => {

  // ── /mine (límite: 10 req/min) ───────────────────────────────────────────────
  describe('POST /mine — límite 10 requests/minuto', () => {
    test('las primeras 10 peticiones no son bloqueadas por el rate limiter', async () => {
      const { app } = createTestApp()

      for (let i = 0; i < 10; i++) {
        const res = await request(app).post('/mine')
        // El rate limiter deja pasar: la respuesta viene del route handler
        // (400 porque no hay transacciones, pero NO 429)
        expect(res.status).not.toBe(429)
      }
    })

    test('la petición 11 recibe HTTP 429 del rate limiter', async () => {
      const { app } = createTestApp()

      for (let i = 0; i < 10; i++) {
        await request(app).post('/mine')
      }

      const res = await request(app).post('/mine')
      expect(res.status).toBe(429)
      expect(res.body.error).toMatch(/Demasiadas peticiones de minado/)
    })

    test('la respuesta 429 incluye el header RateLimit-Limit con valor 10', async () => {
      const { app } = createTestApp()

      for (let i = 0; i < 10; i++) {
        await request(app).post('/mine')
      }

      const res = await request(app).post('/mine')
      expect(res.status).toBe(429)
      // express-rate-limit agrega headers estándar (standardHeaders: true)
      expect(res.headers['ratelimit-limit']).toBe('10')
    })
  })

  // ── /transactions (límite: 30 req/min) ──────────────────────────────────────
  describe('POST /transactions — límite 30 requests/minuto', () => {
    test('las primeras 30 peticiones no son bloqueadas por el rate limiter', async () => {
      const { app } = createTestApp()

      // Usar títulos distintos para evitar deduplicación de la mempool
      for (let i = 0; i < 30; i++) {
        const res = await request(app)
          .post('/transactions')
          .send(txPayload(`Carrera ${i}`))

        expect(res.status).not.toBe(429)
      }
    })

    test('la petición 31 recibe HTTP 429 del rate limiter', async () => {
      const { app } = createTestApp()

      for (let i = 0; i < 30; i++) {
        await request(app)
          .post('/transactions')
          .send(txPayload(`Carrera ${i}`))
      }

      const res = await request(app)
        .post('/transactions')
        .send(txPayload('Carrera Extra'))

      expect(res.status).toBe(429)
      expect(res.body.error).toMatch(/Demasiadas transacciones/)
    })

    test('la respuesta 429 incluye el header RateLimit-Limit con valor 30', async () => {
      const { app } = createTestApp()

      for (let i = 0; i < 30; i++) {
        await request(app).post('/transactions').send(txPayload(`Carrera ${i}`))
      }

      const res = await request(app).post('/transactions').send(txPayload('Extra'))
      expect(res.status).toBe(429)
      expect(res.headers['ratelimit-limit']).toBe('30')
    })
  })

  // ── Independencia entre endpoints ────────────────────────────────────────────
  describe('los límites de /mine y /transactions son independientes', () => {
    test('agotar /mine no afecta el límite de /transactions', async () => {
      const { app } = createTestApp()

      // Agotar /mine
      for (let i = 0; i < 10; i++) {
        await request(app).post('/mine')
      }
      const mineBloqueado = await request(app).post('/mine')
      expect(mineBloqueado.status).toBe(429)

      // /transactions sigue funcionando con su propio contador
      const txRes = await request(app)
        .post('/transactions')
        .send(txPayload())
      expect(txRes.status).not.toBe(429)
    })
  })
})
