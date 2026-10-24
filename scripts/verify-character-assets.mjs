import {createHash} from 'node:crypto';
import {access, readFile} from 'node:fs/promises';

const expected = new Map(Object.entries({
  'assets/characters/commander/sword-ready/v001/idle.webp': 'a1862842ab7399448f8ade7b288ed48319597c1f43e2349adc2751abc08d3a9f',
  'assets/characters/commander/sword-ready/v001/poster.webp': 'd9d7a4da52bf10c71e4996efa68a0a8d4b1294ddb52a01b08c6da943f833630a',
  'assets/characters/commander/sword-ready/v001/head.webp': '6afc41e8eacdfaa6c0a2900f08226c087f865835af0f0ee1594d5c1442ebb8f5',
  'assets/rogue-pointing/pointing.webp': '5015db6e821d7e6bc226f3e89686ea24be25e1285beea9be182aef6af069a1ba',
  'assets/rogue-pointing/poster.webp': 'e40283b40d1ac8970a75c79e043e134161ec184017c458ab72d569fdd386d740',
  'assets/rogue-pointing/head.webp': 'e035ae51566a5c8ae013080303ed5db64272b43dcac53da17671dd1ac8f55703',
  'assets/characters/cube-wanderer/cube-wind/v002/web/idle.webp': 'a49bb9d14618a73f3627d657b89b99148272018d4baaedeaa50c01796442851d',
  'assets/characters/healer/crosier-victory/v002/web/idle.webp': '00dde6e6df7354bdf4553afe9eb093a8ffcad22e5b7efb4a08aadb0d5f2d26ec',
  'assets/characters/swordsman/sword-wind/v002/idle.webp': '76648f50fbc086e5367731e37faea27c1e47d5d4fb911f6787e1f9eda2632471',
  'assets/characters/swordsman/sword-wind/v002/poster.webp': '80ed503ec4c4f6599bf99797c249812d1566b6fd21f30c87b5cc273f5d99cffb',
  'assets/characters/swordsman/sword-wind/v002/head.webp': '959a46b37c8431504575988f10b5922d87524c6bd0f27bbabeb2c144a9de80af'
}));

const knownRegistryDigests = new Set([
  '101474990bea71f19419824645143348e54ae264bcd6af71af5e704b499fae5c', // committed v002 baseline
  '873d458a2d8e09ddb82df2e2128cc400114e8a5086ce283d41e1511cfdb7c3e9'  // existing approved v004 working tree
]);
const optionalApproved = new Map(Object.entries({
  'assets/characters/swordsman/sword-wind/v004/idle.webp': '6410f4ec8b929131c4e9dfadfd0cc4891aafbba3b8bfbd4f453c729f3ab1373f',
  'assets/characters/swordsman/sword-wind/v004/poster.webp': 'fa316b6e624d1da775492ea5dba63c70f567a22b26c3fbe125edcf4459c86573',
  'assets/characters/swordsman/sword-wind/v004/head.webp': '959a46b37c8431504575988f10b5922d87524c6bd0f27bbabeb2c144a9de80af'
}));

for (const [path, digest] of expected) {
  const actual = createHash('sha256').update(await readFile(path)).digest('hex');
  if (actual !== digest) throw new Error(`Protected character file changed: ${path}`);
}

const registry = await readFile('characters/registry.js', 'utf8');
const registryDigest = createHash('sha256').update(registry).digest('hex');
if (!knownRegistryDigests.has(registryDigest)) throw new Error('Protected character registry changed outside an approved version.');
if (!registry.includes('assets/characters/commander/sword-ready/') || !registry.includes('assets/rogue-pointing/')) {
  throw new Error('Commander and Rogue ownership mappings must remain distinct.');
}
for (const [path, digest] of optionalApproved) {
  try { await access(path); } catch { continue; }
  const actual = createHash('sha256').update(await readFile(path)).digest('hex');
  if (actual !== digest) throw new Error(`Approved optional character file changed: ${path}`);
}
const migration = await readFile('backend/internal/store/migrations/001_characters.sql', 'utf8');
for (const id of ['commander','guardian','rogue','mage','healer','courier','swordsman','bard']) {
  if (!migration.includes(`('${id}'`)) throw new Error(`Roster character missing: ${id}`);
}
console.log(`Protected the registry, ${expected.size} committed animation files, optional approved v004 assets, and all eight roster identities.`);
