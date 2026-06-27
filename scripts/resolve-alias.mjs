import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function resolveAliasPath(specifier) {
  const relativePath = specifier.slice(2)
  const candidates = [
    path.join(root, relativePath),
    path.join(root, `${relativePath}.js`),
    path.join(root, `${relativePath}.mjs`),
    path.join(root, relativePath, 'index.js'),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return pathToFileURL(candidate).href
    }
  }

  return pathToFileURL(path.join(root, relativePath)).href
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    return nextResolve(resolveAliasPath(specifier), context)
  }

  return nextResolve(specifier, context)
}
