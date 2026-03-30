/**
 * Configuración global de entorno para tests.
 * Se ejecuta antes de que cualquier módulo sea cargado (setupFiles).
 *
 * DIFFICULTY=1 → minado casi instantáneo en tests
 * MAX_MEMPOOL_SIZE=3 → límite pequeño para probar el rechazo fácilmente
 */
process.env.PROOF_OF_WORK_DIFFICULTY = '1'
process.env.MAX_MEMPOOL_SIZE         = '3'
process.env.NODE_ID                  = 'nodo-test'
process.env.PORT                     = '0'

// Credenciales ficticias: supabase.js las requiere para no lanzar error.
// No se usan porque grados.js está mockeado globalmente via moduleNameMapper.
process.env.SUPABASE_URL      = 'https://mock.supabase.co'
process.env.SUPABASE_ANON_KEY = 'mock-anon-key'
