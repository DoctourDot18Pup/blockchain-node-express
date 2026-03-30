module.exports = {
  testEnvironment: 'node',

  // Carga variables de entorno antes de que cualquier módulo sea requerido
  setupFiles: ['<rootDir>/test/setup.js'],

  // Reemplaza los módulos de BD con stubs (sin Supabase real)
  // y uuid con un stub CJS (uuid v13+ usa ESM, incompatible con Jest sin Babel)
  moduleNameMapper: {
    '^.+/db/grados$':   '<rootDir>/test/__mocks__/grados.js',
    '^.+/db/supabase$': '<rootDir>/test/__mocks__/supabase.js',
    '^uuid$':           '<rootDir>/test/__mocks__/uuid.js',
  },

  testMatch: ['<rootDir>/test/**/*.test.js'],
  testTimeout: 15000,
  verbose: true,
}
