// Stub CJS de uuid para Jest (uuid v13+ usa ESM, incompatible con Jest sin Babel)
// Usa crypto.randomUUID() nativo de Node.js — mismo resultado que uuidv4
const { randomUUID } = require('crypto')
module.exports = { v4: randomUUID }
