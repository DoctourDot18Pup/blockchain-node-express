const supabase = require('./supabase')

/**
 * Persiste un bloque minado en la tabla grados.
 * Un bloque = un registro en la tabla (estructura plana, sin anidamiento).
 *
 * @param {Object} bloque  - Bloque recién minado con campos snake_case
 * @param {string} nodeId  - ID del nodo que mina
 */
async function persistirBloque(bloque, nodeId) {
  const registro = {
    persona_id:      bloque.persona_id      ?? null,
    institucion_id:  bloque.institucion_id  ?? null,
    programa_id:     bloque.programa_id     ?? null,
    titulo_obtenido: bloque.titulo_obtenido,
    fecha_inicio:    bloque.fecha_inicio    ?? null,
    fecha_fin:       bloque.fecha_fin,
    numero_cedula:   bloque.numero_cedula   ?? null,
    titulo_tesis:    bloque.titulo_tesis    ?? null,
    menciones:       bloque.menciones       ?? null,
    hash_actual:     bloque.hash_actual,
    hash_anterior:   bloque.hash_anterior   ?? null,
    nonce:           bloque.nonce,
    firmado_por:     bloque.firmado_por     ?? nodeId,
  }

  const { error } = await supabase.from('grados').insert([registro])

  if (error) {
    console.error('[DB] Error al persistir bloque:', error.message)
    throw error
  }

  console.log(`[DB] Bloque persistido en Supabase | hash: ${bloque.hash_actual.slice(0, 12)}...`)
}

/**
 * Carga todos los bloques desde Supabase ordenados cronológicamente
 * para reconstruir la cadena al reiniciar el nodo.
 *
 * @returns {Object[]} Bloques en formato plano (snake_case)
 */
async function cargarCadena() {
  const { data, error } = await supabase
    .from('grados')
    .select('*')
    .order('creado_en', { ascending: true })

  if (error) {
    console.error('[DB] Error al cargar cadena:', error.message)
    return []
  }

  return data || []
}

/**
 * Guarda la URL de un peer en la tabla nodos.
 *
 * @param {string} nodeId    - ID del nodo local (no usado en filtro)
 * @param {string} direccion - URL del peer (sin trailing slash)
 */
async function guardarPeer(nodeId, direccion) {
  const { error } = await supabase
    .from('nodos')
    .upsert(
      { url: direccion },
      { onConflict: 'url' }
    )

  if (error) console.error('[DB] Error al guardar peer:', error.message)
}

/**
 * Carga todos los peers registrados en la tabla nodos.
 *
 * @returns {string[]} Array de URLs de peers
 */
async function cargarPeers(nodeId) {
  const { data, error } = await supabase
    .from('nodos')
    .select('url')

  if (error) {
    console.error('[DB] Error al cargar peers:', error.message)
    return []
  }

  return (data || []).map(r => r.url)
}

module.exports = { persistirBloque, cargarCadena, guardarPeer, cargarPeers }