import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { register } from 'node:module'

const scriptsDir = path.dirname(fileURLToPath(import.meta.url))

register(pathToFileURL(path.join(scriptsDir, 'resolve-alias.mjs')).href, pathToFileURL(import.meta.url))
