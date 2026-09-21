import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const outputDirectory = join(projectRoot, 'dist')

// Some synced or sandboxed folders allow writing but not deleting. In that case
// the build overwrites dist in place and warns that removed files may remain.
try {
  await rm(outputDirectory, { recursive: true, force: true })
} catch (error) {
  if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code)) throw error
  console.warn(`Não foi possível limpar dist (${error.code}). Os arquivos serão sobrescritos. Arquivos removidos do projeto podem continuar em dist.`)
}
await mkdir(outputDirectory, { recursive: true })
// Writes file contents in place. fs.cp unlinks existing files first, which fails
// in folders without delete permission.
async function copyTree(from, to) {
  await mkdir(to, { recursive: true })
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const source = join(from, entry.name), target = join(to, entry.name)
    if (entry.isDirectory()) await copyTree(source, target)
    else if (entry.isFile()) await writeFile(target, await readFile(source))
  }
}

await copyTree(join(projectRoot, 'src'), join(outputDirectory, 'src'))
await copyTree(join(projectRoot, 'public'), join(outputDirectory, 'public'))

const html = await readFile(join(projectRoot, 'index.html'), 'utf8')
await writeFile(join(outputDirectory, 'index.html'), html)

console.log('Build concluído em dist/.')
