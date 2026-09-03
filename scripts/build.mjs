import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const outputDirectory = join(projectRoot, 'dist')

await rm(outputDirectory, { recursive: true, force: true })
await mkdir(outputDirectory, { recursive: true })
await cp(join(projectRoot, 'src'), join(outputDirectory, 'src'), { recursive: true })
await cp(join(projectRoot, 'public'), join(outputDirectory, 'public'), { recursive: true })

const html = await readFile(join(projectRoot, 'index.html'), 'utf8')
await writeFile(join(outputDirectory, 'index.html'), html)

console.log('Build concluído em dist/.')
