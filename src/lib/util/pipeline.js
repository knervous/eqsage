// import fs from 'fs'
// import path from 'path'
// import { execSync } from 'child_process'
// import { glob } from 'glob'
// import { NodeIO } from '@gltf-transform/core'
// import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
// import { gzip } from 'node-gzip'
// import {
//   resample,
//   draco,
//   textureCompress,
//   DRACO_DEFAULTS
// } from '@gltf-transform/functions'
// import sharp from 'sharp'
// import draco3d from 'draco3dgltf'

// import supportedZones from './supportedZones.json' assert { type: 'json' }

// // Configure I/O.
// const io = new NodeIO()
//   .registerExtensions(ALL_EXTENSIONS)
//   .registerDependencies({
//     'draco3d.decoder': await draco3d.createDecoderModule(),
//     'draco3d.encoder': await draco3d.createEncoderModule()
//   })

// const optimize = async (inputPath, outputPath, doOptimize = true) => {
//   const input = await io.read(inputPath)
  
//   if (doOptimize) {
//     await input.transform(
//       // Losslessly resample animation frames.
//       resample(),
//       // Compress mesh geometry with Draco.
//       draco({ ...DRACO_DEFAULTS, quantizationVolume: 'scene' }),
//       // Convert textures to WebP (Requires glTF Transform v3 and Node.js).
//       textureCompress({
//         encoder: sharp,
//         targetFormat: 'webp'
//       })
//     )
//   }

//   const glb = await io.writeBinary(input)
//   fs.writeFileSync(`${outputPath}.gz`, await gzip(glb))
// }

// const modelPaths = [
//   'global_chr',
//   'global2_chr',
//   'global3_chr',
//   'global4_chr',
//   'global5_chr',
//   'global6_chr',
//   'global7_chr'
// ]
// const objectPaths = ['gequip', 'gequip2', 'gequip3', 'gequip4', 'gequip5', 'gequip6', 'gequip8']

// ;
// //const cwd = `F:\\source\\LanternExtractorMain\\LanternExtractor\\bin\\Debug\\net6.0\\win-x64`; // './Debug';
// const cwd = './Debug/net6.0/win-x64';

// (async () => {
//   // Extract data with Lantern
//   // // Objects
//   // for (const path of objectPaths) {
//   //   try {
//   //     console.log('Unpacking objects in ', path)
//   //     execSync(`LanternExtractor.exe ${path}`, { cwd })
//   //   } catch (e) {
//   //     console.error('Got error', e)
//   //     process.exit(1)
//   //   }
//   // }

//   // Models
//   // for (const path of modelPaths) {
//   //   try {
//   //     console.log('Unpacking models in ', path)
//   //     execSync(`LanternExtractor.exe ${path}`, { cwd })
//   //   } catch (e) {
//   //     console.error('Got error', e)
//   //     process.exit(1)
//   //   }
//   // }

//   // // Zones
//   // for (const [longName, shortName] of supportedZones) {
//   //   try {
//   //     console.log('Unpacking zone', longName, ' - ', shortName)
//   //     execSync(`LanternExtractor.exe ${shortName}`, { cwd })
//   //   } catch (e) {
//   //     console.error('Got error', e)
//   //     process.exit(1)
//   //   }
//   // }

//   // Copying, optimize, map data
//   // Characters
//   // const items = (await glob('Debug/**/gequip*/*.glb')).reduce(
//   //   (acc, val) => {
//   //     const itemPath = path.basename(val)
//   //     if (!acc.some(c => path.basename(c) === itemPath)) {
//   //       acc.push(val)
//   //     }
//   //     return acc
//   //   },
//   //   []
//   // )
//   // for (const item of items) {
//   //   const newPath = path.resolve(`output/items/${path.basename(item)}`)
//   //   await optimize(item, newPath)
//   // }

//   // Characters
//   // const characters = (await glob('Debug/**/global/Characters/*.glb')).reduce(
//   //   (acc, val) => {
//   //     const charPath = path.basename(val)
//   //     if (!acc.some(c => path.basename(c) === charPath)) {
//   //       acc.push(val)
//   //     }
//   //     return acc
//   //   },
//   //   []
//   // )
//   // for (const char of characters) {
//   //   console.log(`Optimizing ${path.basename(char)}`)
//   //   const newPath = path.resolve(`output/models/${path.basename(char)}`)
//   //   await optimize(char, newPath)
//   // }

//   // Zones
//   const zones = await glob(`${cwd}/**/Zone/*.glb`)
 
//   for (const zone of zones.filter(z => z.endsWith('load.glb'))) {
//     const newPath = path.resolve(
//       `output/zones/${path.parse(path.basename(zone)).name}`
//     )
//     console.log(`Copying and optimizing ${path.basename(zone)}`)
//     await optimize(zone, `${newPath}.glb`)


//     // Zone metadata
//     const basePath = zone.replace(path.basename(zone), '')
//     const getInstancesPath = inst =>
//       path.join(basePath, `${inst}_instances.txt`)
//     const getEntries = inst =>
//       fs
//         .readFileSync(getInstancesPath(inst))
//         .toString()
//         .split('\r\n')
//         .filter(a => !a.startsWith('#'))
//         .filter(Boolean)
//         fs.writeFileSync(`${newPath}_aabb_tree.json`, fs.readFileSync(`${basePath}aabb_tree.json`))
//     const zoneMetadata = {
//       objects: {},
//       lights: [],
//       music: [],
//       sound2d: [],
//       sound3d: []
//     }
//     const animatedList = JSON.parse(fs.readFileSync(path.join(basePath, `animated_objects.json`)));
//     if (fs.existsSync(getInstancesPath('object'))) {
//       const objects = {}
//       for (let e of getEntries('object')) {
//         const [
//           modelName,
//           posX,
//           posY,
//           posZ,
//           rotX,
//           rotY,
//           rotZ,
//           scaleX,
//           scaleY,
//           scaleZ,
//           colorIndex
//         ] = e.split(',')
//         if (!objects[modelName]) {
//           objects[modelName] = []
//         }
//         objects[modelName].push({
//           pos: [+posX, +posY, +posZ],
//           rot: [+rotX, +rotY, +rotZ],
//           scale: [+scaleX, +scaleY, +scaleZ],
//           color: +colorIndex,
//           animated: animatedList.includes(modelName)
//         })
//       }
//       zoneMetadata.objects = objects
//     }

//     if (fs.existsSync(getInstancesPath('light'))) {
//       const lights = []
//       for (let e of getEntries('light')) {
//         const [posX, posY, posZ, radius, r, g, b] = e.split(',')
//         lights.push({
//           pos: [+posX, +posY, +posZ],
//           radius: +radius,
//           r: +r,
//           g: +g,
//           b: +b
//         })
//       }
//       zoneMetadata.lights = lights
//     }

//     if (fs.existsSync(getInstancesPath('music'))) {
//       const music = []
//       for (let e of getEntries('music')) {
//         const [posX, posY, posZ, radius, dayId, nightId, dayCount, nightCount, fadeMs] =
//           e.split(',')

//         music.push({
//           pos: [+posX, +posY, +posZ],
//           radius: +radius,
//           dayId: +dayId,
//           nightId: +nightId,
//           dayCount: +dayCount,
//           nightCount: +nightCount,
//           fadeMs: +fadeMs
//         })
//       }
//       zoneMetadata.music = music
//     }

//     if (fs.existsSync(getInstancesPath('sound2d'))) {
//       const sound = []
//       for (let e of getEntries('sound2d')) {
//         const [
//           posX,
//           posY,
//           posZ,
//           radius,
//           daySound,
//           nightSound,
//           dayCooldown,
//           nightCooldown,
//           randomDelay,
//           volumeDay,
//           volumeNight,
//         ] = e.split(',')

//         sound.push({
//           pos: [+posX, +posY, +posZ],
//           radius: +radius,
//           daySound: daySound,
//           nightSound: nightSound,
//           dayCooldown: +dayCooldown,
//           nightCooldown: +nightCooldown,
//           randomDelay: +randomDelay,
//           volumeDay: +volumeDay,
//           volumeNight: +volumeNight,
//         })
//       }
//       zoneMetadata.sound2d = sound
//     }

//     if (fs.existsSync(getInstancesPath('sound3d'))) {
//       const sounds = []
//       for (let e of getEntries('sound3d')) {
//         const [
//           posX,
//           posY,
//           posZ,
//           radius,
//           sound,
//           cooldown,
//           cooldownRandom,
//           volume,
//           multiplier,
//         ] = e.split(',')

//         sounds.push({
//           pos: [+posX, +posY, +posZ],
//           radius: +radius,
//           sound: sound,
//           cooldown: +cooldown,
//           cooldownRandom: +cooldownRandom,
//           volume: +volume,
//           multiplier: +multiplier,
//         });
//       }
//       zoneMetadata.sound3d = sounds
//     }
//     fs.writeFileSync(`${newPath}.json`, JSON.stringify(zoneMetadata))
//   }

//   // Objects
//   const objects = (await glob('Debug/**/load/Objects/*.glb')).reduce((acc, val) => {
//     const charPath = path.basename(val)
//     if (!acc.some(c => path.basename(c) === charPath)) {
//       acc.push(val)
//     }
//     return acc
//   }, [])
//   for (const obj of objects) {
//     const newPath = path.resolve(`output/objects/${path.basename(obj)}`)
//     console.log(`Copying and optimizing ${path.basename(obj)}`)
//     await optimize(obj, newPath)
//   }

//   // Textures
//   const allTextures = (await glob('Debug/**/load/Objects/Textures/*.png')).reduce(
//     (acc, val) => {
//       const charPath = path.basename(val)
//       if (!acc.some(c => path.basename(c) === charPath)) {
//         acc.push(val)
//       }
//       return acc
//     },
//     []
//   )
//   for (const texture of allTextures) {
//     const newPath = path.resolve(
//       `output/textures/${path.basename(texture)}`
//     )
//     fs.copyFileSync(texture, newPath)
//   }

// })()
