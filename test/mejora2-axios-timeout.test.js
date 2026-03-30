/**
 * Mejora 2 — Timeout de 5s en llamadas Axios a peers
 *
 * Verificamos que las rutas que propagan bloques/transacciones
 * incluyen la opción timeout en sus llamadas Axios.
 *
 * Estrategia: usar un servidor HTTP lento (demora > 5s) como peer falso,
 * registrarlo y confirmar que la propagación se completa en < 6s
 * (el timeout cancela la llamada sin bloquear la respuesta principal).
 */
const request       = require('supertest')
const http          = require('http')
const createTestApp = require('./helpers/createTestApp')

// Crea un servidor HTTP que nunca responde (simula peer caído/colgado)
// No usa setTimeout para no dejar timers huérfanos al cerrar el test
function crearPeerLento() {
  const server = http.createServer((_req, _res) => {
    // Intencionalmente nunca llama a res.end() → la conexión queda abierta
    // hasta que Axios la cancela por timeout (5s)
  })
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

describe('Mejora 2 — Timeout en propagación a peers', () => {
  let peerLento
  let peerUrl

  beforeAll(async () => {
    peerLento = await crearPeerLento()
    const { port } = peerLento.address()
    peerUrl = `http://127.0.0.1:${port}`
  })

  afterAll(done => {
    // closeAllConnections() fuerza el cierre de conexiones Axios abiertas
    if (peerLento.closeAllConnections) peerLento.closeAllConnections()
    peerLento.close(done)
  })

  test('propagar un bloque a un peer lento no bloquea la respuesta del nodo local', async () => {
    const { app, blockchain } = createTestApp()

    // Registrar el peer lento
    blockchain.nodos.add(peerUrl)

    // Agregar una transacción y minar
    blockchain.agregarTransaccion({
      persona_id:      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      institucion_id:  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      programa_id:     'cccccccc-cccc-cccc-cccc-cccccccccccc',
      titulo_obtenido: 'Ingeniería en Sistemas',
      fecha_fin:       '2024-12-01',
      firmado_por:     'nodo-test',
    })

    const inicio = Date.now()
    const res = await request(app).post('/mine')
    const duracion = Date.now() - inicio

    expect(res.status).toBe(200)
    expect(res.body.bloque).toBeDefined()

    // La respuesta llegó ANTES de los 7s
    // → el timeout de 5s en Axios canceló la espera al peer, sin bloquear el nodo
    expect(duracion).toBeLessThan(7000)
  }, 12000)

  test('propagar transacción a peer lento no bloquea la respuesta', async () => {
    const { app, blockchain } = createTestApp()
    blockchain.nodos.add(peerUrl)

    const inicio = Date.now()
    const res = await request(app)
      .post('/transactions')
      .send({
        persona_id:      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        institucion_id:  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        programa_id:     'cccccccc-cccc-cccc-cccc-cccccccccccc',
        titulo_obtenido: 'Medicina',
        fecha_fin:       '2024-06-01',
        firmado_por:     'nodo-test',
      })
    const duracion = Date.now() - inicio

    expect(res.status).toBe(201)
    // El timeout de 5s en Axios cancela el peer → respuesta en < 7s
    expect(duracion).toBeLessThan(7000)
  }, 12000)
})
