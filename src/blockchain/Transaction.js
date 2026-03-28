const { v4: uuidv4 } = require('uuid')

class Transaction {
  /**
   * Representa un grado académico pendiente de minar.
   * Todos los campos usan snake_case según el contrato de red.
   *
   * @param {string} persona_id       - UUID de la persona
   * @param {string} institucion_id   - UUID de la institución
   * @param {string} programa_id      - UUID del programa
   * @param {string} titulo_obtenido  - Nombre del título
   * @param {string} fecha_fin        - Fecha de graduación (YYYY-MM-DD)
   * @param {string} [fecha_inicio]   - Fecha de inicio (opcional)
   * @param {string} [numero_cedula]  - Número de cédula profesional (opcional)
   * @param {string} [titulo_tesis]   - Título de tesis (opcional)
   * @param {string} [menciones]      - Menciones honoríficas (opcional)
   * @param {string} firmado_por      - Nodo que firma la transacción
   */
  constructor({
    persona_id,
    institucion_id,
    programa_id,
    titulo_obtenido,
    fecha_fin,
    fecha_inicio   = null,
    numero_cedula  = null,
    titulo_tesis   = null,
    menciones      = null,
    firmado_por,
  }) {
    this.id              = uuidv4()
    this.persona_id      = persona_id
    this.institucion_id  = institucion_id
    this.programa_id     = programa_id
    this.titulo_obtenido = titulo_obtenido
    this.fecha_fin       = fecha_fin
    this.fecha_inicio    = fecha_inicio
    this.numero_cedula   = numero_cedula
    this.titulo_tesis    = titulo_tesis
    this.menciones       = menciones
    this.firmado_por     = firmado_por
    this.creado_en       = new Date().toISOString()
  }
}

module.exports = Transaction