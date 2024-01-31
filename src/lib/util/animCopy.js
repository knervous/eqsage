// import { Document, NodeIO } from '@gltf-transform/core';
// import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
// import { resample, prune, dedup, draco, textureCompress } from '@gltf-transform/functions';
// import sharp from 'sharp'; // Node.js only.
// import draco3d from 'draco3dgltf';
// import fs from 'fs';

// // Configure I/O.
// const io = new NodeIO()
//     .registerExtensions(ALL_EXTENSIONS)
//     .registerDependencies({
//         'draco3d.decoder': await draco3d.createDecoderModule(), // Optional.
//         'draco3d.encoder': await draco3d.createEncoderModule(), // Optional.
//     });


// export const optimize = async path => {
//     const input = await io.read(path);
//     await input.transform(
//         // Losslessly resample animation frames.
//         resample(),
//         // Remove unused nodes, textures, or other data.
//         prune(),
//         // Remove duplicate vertex or texture data, if any.
//         dedup(),
//         // Compress mesh geometry with Draco.
//         draco(),
//         // Convert textures to WebP (Requires glTF Transform v3 and Node.js).
//         textureCompress({
//             encoder: sharp,
//             targetFormat: 'webp',
//         }),
//     );
    
//     const glb = await io.writeBinary(input)
//     fs.writeFileSync(path, glb);
// }

// // (async () => {
// //     const input = await io.read('./Characters/elm.glb');
// //     const output = await io.read('./Characters/qcm.glb');

// //     const outputDocument = new Document().merge(input).merge(output);
// //     const root = outputDocument.getRoot();

// //     // find the skin
// //     const skin = root.listSkins()[1]

// //     // get animation channels
// //     for (const anim of root.listAnimations()) {
// //         const animationChannels = anim.listChannels()
// //         animationChannels.forEach((channel) => {
// //             const curTargetNode = channel.getTargetNode().getName()
// //             const newTargetNode = skin.listJoints().find((node) => node.getName() === curTargetNode)
// //             if (newTargetNode) channel.setTargetNode(newTargetNode)
// //         })
// //     }

// //     // cleanup
// //     const numTextures = input.getRoot().listTextures().length;
// //     root.listTextures().slice(0, numTextures).forEach(t => t.dispose());

// //     const numMaterials = input.getRoot().listMaterials().length;
// //     root.listMaterials().slice(0, numMaterials).forEach(t => t.dispose());

// //     root.listScenes()[0].dispose();
// //     root.listNodes()[0].dispose()
// //     root.listSkins()[0].dispose();


// //     const buffer = root.listBuffers()[0];
// //     root.listAccessors().forEach((a) => a.setBuffer(buffer));
// //     root.listBuffers().forEach((b, index) => index > 0 ? b.dispose() : null);
// //     await outputDocument.transform(
// //         // Losslessly resample animation frames.
// //         resample(),
// //         // Remove unused nodes, textures, or other data.
// //         prune(),
// //         // Remove duplicate vertex or texture data, if any.
// //         dedup(),
// //         // Compress mesh geometry with Draco.
// //         draco(),
// //         // Convert textures to WebP (Requires glTF Transform v3 and Node.js).
// //         textureCompress({
// //             encoder: sharp,
// //             targetFormat: 'webp',
// //         }),
// //     );
    
// //     const glb = await io.writeBinary(outputDocument)
// //     fs.writeFileSync('./output.glb', glb);
// // })()