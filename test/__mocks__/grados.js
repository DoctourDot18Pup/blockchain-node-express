/**
 * Stub de la capa de persistencia Supabase.
 * Reemplaza src/db/grados.js en todos los tests vía moduleNameMapper.
 *
 * - persistirBloque / guardarPeer: no hacen nada (fire-and-forget en producción)
 * - cargarCadena / cargarPeers: devuelven arrays vacíos → el nodo arranca sin datos
 */
module.exports = {
  persistirBloque: () => Promise.resolve(),
  cargarCadena:    () => Promise.resolve([]),
  cargarPeers:     () => Promise.resolve([]),
  guardarPeer:     () => Promise.resolve(),
}
