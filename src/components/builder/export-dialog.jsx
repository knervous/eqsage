import React, { useCallback, useEffect, useState } from 'react';

import {
  Button,
  List,
  ListItem,
  ListSubheader,
  Typography,
} from '@mui/material';
import BABYLON from '@bjs';

import { WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { CommonDialog } from '../spire/dialogs/common';
import {
  getEQDir,
  getEQFile,
  getEQSageDir,
  writeEQFile,
  writeFile,
} from 'sage-core/util/fileHandler';
import { PFSArchive } from 'sage-core/pfs/pfs';
import { useAlertContext } from '../../context/alerts';
import { SoundInstance } from 'sage-core/s3d/sound/sound';
import { TypedArrayWriter } from 'sage-core/util/typed-array-reader';
import { RegionType } from 'sage-core/s3d/bsp/bsp-tree';
import { mat4, vec3 } from 'gl-matrix';
import { usePermissions } from 'sage-core/hooks/permissions';
import { useProject } from './hooks/metadata';
import { imageProcessor } from 'sage-core/util/image/image-processor';

const { SubMesh, Vector3, Color3, VertexBuffer, PBRMaterial } = BABYLON;

const version = 2;
const shadersUsed = [
  'Opaque_MaxC1.fx',
  'Opaque_MaxCB1.fx',
  'Opaque_MaxCG1.fx',
  'Opaque_MaxCSG1.fx',
  'Opaque_MaxCBSG1.fx',
  'Opaque_MaxWaterFall.fx',
  'Opaque_MaxWater.fx',
  'Alpha_MaxCBSG1.fx',
  'Alpha_MaxC1.fx',
  'Chroma_MaxC1.fx',
];
const propertiesUsed = [
  // Normal
  'e_TextureDiffuse0', // ex sp_tunn05.dds or png will swap out later
  'e_TextureGlow0', // ex sp_tunn05.dds or png will swap out later
  'e_TextureNormal0', // ex sp_tunn05.dds or png will swap out later
  'e_TextureEnvironment0', // ex sp_tunn05.dds or png will swap out later
  // Glow
  'e_fShininess0',
  // Waterfall
  'e_fSlide1X', // ex -0.12
  'e_fSlide1Y', // ex -0.32
  'e_fSlide2X', // ex 0
  'e_fSlide2Y', // ex -0.5
  // Water static
  'e_fFresnelBias', // 0.17
  'e_fFresnelPower', // 10
  'e_fWaterColor1', // 255 0 0 21
  'e_fWaterColor2', // 255 0 30 23
  'e_fReflectionAmount', // 0.5
  'e_fReflectionColor', // 255 255 255 255
  // Water flowing -- all from above plus
  // e_fSlide properties
];

const io = new WebIO().registerExtensions(ALL_EXTENSIONS);

async function compressPNG(inputBuffer) {
  const result = await imageProcessor.compressImage(inputBuffer);
  const byteArray = new Uint8Array(result);
  return byteArray;
}

export function getCleanByteArray(arr) {
  const newBuffer = new ArrayBuffer(arr.byteLength);
  const newArray = new Uint8Array(newBuffer);
  newArray.set(arr);
  return newArray;
}

const cStringLengthReduce = (arr) =>
  arr.reduce((acc, name) => acc + name.length + 1, 0);

export const ExportDialog = ({ open, setOpen }) => {
  const { openAlert } = useAlertContext();
  const [exporting, setExporting] = useState(false);
  const [exportedFiles, setExportedFiles] = useState([]);
  const { zb, name } = useProject();
  const [
    _apiSupported,
    _onDrop,
    _checkHandlePermissions,
    fsHandleSelected,
    onFolderSelected,
  ] = usePermissions('zb-out');
  const [fsHandle, setFsHandle] = useState(null);

  const fsWrite = useCallback(
    async (folder, name, data, subdir) => {
      setExportedFiles((f) => [...f, name]);
      if (fsHandle) {
        await writeFile(fsHandle, name, data);
        return;
      }
      await writeEQFile(folder, name, data, subdir);
    },
    [fsHandle]
  );

  /* eslint-disable */
  const doExport = useCallback(async () => {
    setExporting(true);
    setExportedFiles([]);
    const metadata = zb.metadata;
    if (!metadata) {
      setExporting(false);
      return;
    }

    const objectPaths = await getEQFile("data", "objectPaths.json", "json");
    console.log("object paths", objectPaths);
    const newFiles = [];
    newFiles.push(`${name}.eqg`);

    // Asset text file
    await fsWrite(
      "output",
      `${name}_assets.txt`,
      [...metadata.assets].concat(metadata.characterFiles).join("\r\n"),
      name
    );
    newFiles.push(`${name}_assets.txt`);

    // Chr text file
    await fsWrite(
      "output",
      `${name}_chr.txt`,
      [...metadata.chr].join("\r\n"),
      name
    );
    newFiles.push(`${name}_chr.txt`);

    // Create emt sound file
    const soundInstances = [];
    for (const sound of metadata.sounds) {
      const si = SoundInstance.fromObject(sound);
      soundInstances.push(si.getEmtString());
    }
    await fsWrite("output", `${name}.emt`, soundInstances.join("\r\n"), name);
    newFiles.push(`${name}.emt`);

    // Create EQG
    const eqgArchive = new PFSArchive();
    const imageWritePromises = [];
    const writePfsFile = (fileName, data, override = false) => {
      if (eqgArchive.fileExists(fileName) && !override) {
        return;
      }

      // Compress all png and let this happen with some concurrency.
      // First write a blank file so this doesn't get hit twice, then store the promise for later
      // Where we can await until they're all finished before finalizing
      if (fileName.endsWith(".png") && !override) {
        // Skip compression for materials that need alpha testing since jpeg doesn't support opacity.
        // Figure out multimaterial and submeshes with indexed positions later
        for (const m of zb.scene.materials) {
          if (
            m.name.toLowerCase() === fileName.replace(".png", "").toLowerCase() &&
            (m.needAlphaTesting() || m?.albedoTexture?.hasAlpha)
          ) {
            eqgArchive.setFile(fileName, data);
            return;
          }
        }
        const convertedName = fileName.replace(".png", ".jpg");
        eqgArchive.setFile(convertedName, "");
        imageWritePromises.push(
          new Promise((res) =>
            compressPNG(data).then((buffer) => {
              writeEQFile('TEMP', convertedName, buffer);
              eqgArchive.setFile(
                convertedName,
                new Uint8Array(buffer)
              );
              res();
            })
          )
        );
        return true;
      } else {
        eqgArchive.setFile(fileName, data);
      }
    };

    const names = [];

    // Animated textures
    for (const m of zb.scene.materials) {
      if (m.metadata?.gltf?.extras?.animationDelay) {
        const needsAlphaTesting =
          m.needAlphaTesting() || m?.albedoTexture?.hasAlpha;
        const { frames, animationDelay } = m.metadata?.gltf?.extras;
        const text = [
          frames.length,
          animationDelay,
          ...frames.map((p) => `${p}.${needsAlphaTesting ? "png" : "jpg"}`),
        ];
        // Pull from disk
        for (const frame of frames) {
          const name = `${frame}.png`;
          if (!eqgArchive.fileExists(name)) {
            const png = await getEQFile("textures", name);
            if (png) {
              writePfsFile(name, new Uint8Array(png), needsAlphaTesting);
            }
          }
        }
        writePfsFile(`${frames[0]}.txt`, text.join("\r\n"), needsAlphaTesting);
      }
    }

    const writeEqgMod = async (
      terrain,
      meshes,
      modelName,
      litNames = [],
      bones = []
    ) => {
      let textureNames = [...names];
      if (terrain) {
        const water_e = await fetch("/static/water_e.dds").then((r) =>
          r.arrayBuffer()
        );
        textureNames.push("water_e.dds");
        writePfsFile("water_e.dds", new Uint8Array(water_e));
        const water_n = await fetch("/static/water_n.dds").then((r) =>
          r.arrayBuffer()
        );

        textureNames.push("water_n.dds");
        writePfsFile("water_n.dds", new Uint8Array(water_n));

        const test = await fetch("/static/ra_watertest_c_01.dds").then((r) =>
          r.arrayBuffer()
        );
        textureNames.push("watertest.dds");
        writePfsFile("watertest.dds", new Uint8Array(test));
      }

      if (terrain) {
        const zoneTextures = zb.zoneContainer.getChildMeshes().flatMap(m => m?.material?.getActiveTextures() ?? []);
        zoneTextures.forEach(texture => {
          let texName = texture.name;
          texName = texName.replace(' (Base Color)', '');
          if (!texName.endsWith('.png')) {
            texName = `${texName}.png`;
          }
          const didChange = writePfsFile(texName, texture._buffer instanceof ArrayBuffer ? new Uint8Array(texture._buffer) : texture._buffer);
          textureNames.push(
            didChange ? texName.replace(".png", "") + '.jpg' : texName
          );
        })
      } else {
        const cleanGlb = getCleanByteArray(zb.project.modelFiles[modelName]);
        const document = await io.readBinary(cleanGlb);
        const root = document.getRoot();

        root.listTextures().forEach((texture) => {
          const textureName = `${texture.getName().toLowerCase()}.png`;
          const didChange = writePfsFile(textureName, texture.getImage());
          textureNames.push(
            didChange ? textureName.replace(".png", "") + ".jpg" : textureName
          );
        });
      }

      for (const mesh of meshes) {
        const material = mesh.material ?? mesh.getMaterial?.();
        if (material instanceof PBRMaterial && material.albedoTexture) {
          const needsAlphaTesting =
            material.needAlphaTesting() || material.albedoTexture?.hasAlpha;
          const textureName = `${material.name}.${
            needsAlphaTesting ? "png" : "jpg"
          }`.toLowerCase();
          textureNames.push(textureName);
        }
      }

      textureNames = Array.from(new Set(textureNames));

      const matNames = Array.from(
        new Set(
          meshes
            .map((mesh) => (mesh.material ?? mesh.getMaterial?.()).name)
            .filter(Boolean)
        )
      );

      const materialNames = matNames.map((_, idx) => `mat${idx}`);

      const totalStrings = [
        ...matNames,
        ...materialNames,
        ...textureNames,
        ...shadersUsed,
        ...propertiesUsed,
      ];

      const getStringIdx = (str) => {
        const idx = totalStrings.indexOf(str);
        if (idx === -1) {
          throw new Error("Not found string: ", str);
        }
        const subArr = totalStrings.slice(0, idx);
        return cStringLengthReduce(subArr);
      };
      const preamble = terrain ? "EQGT" : "EQGM";
      const headerSize = 20; // version(4) + listLength(4) + materialCount(4) + vertCount(4) + triCount(4)
      const postHeaderIdx = preamble.length + headerSize;
      const listLength = cStringLengthReduce(totalStrings);

      const vertices = [];
      const indices = [];
      const materials = [];
      const vertexColors = [];
      let vertexOffset = 0;
      let matCount = 0;

      for (const [idx, mesh] of Object.entries(meshes)) {
        const boundary = mesh.isBoundary;
        const realMatIdx = matNames.findIndex(
          (m) => (mesh.material ?? mesh.getMaterial?.())?.name === m
        );
        const textureIdx = textureNames.findIndex(
          (t) =>
            t.replace(".jpg", "").replace(".png", "") ===
            (mesh.material ?? mesh.getMaterial?.())?.name?.toLowerCase()
        );

        const passThroughFlag = mesh.metadata?.gltf?.extras?.passThrough
          ? 0x01
          : 65536;
        const isSubmesh = mesh instanceof SubMesh;
        const parentMesh = isSubmesh ? mesh.getMesh() : mesh;
        const needsAlphaTesting = parentMesh.material?._subMaterials?.length
          ? parentMesh.material._subMaterials.some(
              (m) => m.needAlphaTesting() || m.albedoTexture?.hasAlpha
            )
          : parentMesh.material.needAlphaTesting() ||
            parentMesh.material?.albedoTexture?.hasAlpha;
        const positions = isSubmesh
          ? mesh
              .getMesh()
              .getVerticesData(VertexBuffer.PositionKind)
              .slice(
                mesh.verticesStart * 3,
                (mesh.verticesStart + mesh.verticesCount) * 3
              )
          : mesh.getVerticesData(VertexBuffer.PositionKind);

        const normals = isSubmesh
          ? mesh
              .getMesh()
              .getVerticesData(VertexBuffer.NormalKind)
              .slice(
                mesh.verticesStart * 3,
                (mesh.verticesStart + mesh.verticesCount) * 3
              )
          : mesh.getVerticesData(VertexBuffer.NormalKind);

        const uvs = isSubmesh
          ? mesh
              .getMesh()
              .getVerticesData(VertexBuffer.UVKind)
              .slice(
                mesh.verticesStart * 2,
                (mesh.verticesStart + mesh.verticesCount) * 2
              )
          : mesh.getVerticesData(VertexBuffer.UVKind);

        for (var i = 0; i < positions.length; i += 3) {
          var position = new Vector3(
            positions[i],
            positions[i + 1],
            positions[i + 2]
          );
          var normal = new Vector3(
            normals[i],
            normals[i + 1],
            normals[i + 2]
          ).normalize();

          // Initialize the final color as black
          var finalColor = new Color3(0, 0, 0);

          // Iterate over all lights in the scene and accumulate their contribution
          zb.scene.lights.forEach(function (light) {
            var lightColor = light.diffuse; // Use light's diffuse color for calculations

            // For directional light
            if (light.zoneLight) {
              var lightDirection = light.position
                .subtract(position)
                .normalize();
              var distance = Vector3.Distance(light.position, position);
              // Apply standard attenuation (simplified)
              var constantAttenuation = 1.0;
              var linearAttenuation = 0.05; // You can adjust this value for your scene
              var quadraticAttenuation = 0.002; // Adjust this as well

              var attenuation =
                1.0 /
                (constantAttenuation +
                  linearAttenuation * distance +
                  quadraticAttenuation * distance * distance);

              // var attenuation = 1.0 / (light.range * distance);  // Simplified attenuation
              var diffuseIntensity =
                Math.max(0, Vector3.Dot(normal, lightDirection)) * attenuation;
              var diffuseComponent = lightColor.scale(diffuseIntensity);
              // Add the diffuse component to the final color
              finalColor = finalColor.add(diffuseComponent);
            }
          });

          // Scale the finalColor values to the 0–255 range
          var r = Math.min(255, Math.max(0, Math.round(finalColor.r * 255)));
          var g = Math.min(255, Math.max(0, Math.round(finalColor.g * 255)));
          var b = Math.min(255, Math.max(0, Math.round(finalColor.b * 255)));

          // Push the integer RGB values to the vertex color array (ignore alpha if not needed)
          vertexColors.push([r, g, b, 255]); // RGBA with full opacity
        }
        const meshIndices = isSubmesh
          ? mesh
              .getMesh()
              .getIndices()
              .slice(mesh.indexStart, mesh.indexStart + mesh.indexCount)
          : mesh.getIndices();
        const vertexCount = positions.length / 3;
        const triCount = meshIndices.length / 3;
        const shaders = mesh.metadata?.gltf?.extras?.shaders ?? [
          {
            name: !needsAlphaTesting ? "Opaque_MaxC1.fx" : "Alpha_MaxC1.fx",
            properties: {
              e_TextureDiffuse0: {
                type: 2,
                value: textureNames[textureIdx],
              },
            },
          },
        ];
        for (const [shaderIdx, shader] of Object.entries(shaders)) {
          matCount++;
          materials.push(
            +idx + +shaderIdx, // Index
            getStringIdx(materialNames[realMatIdx]), // Material Name
            getStringIdx(shader.name), // Shader Name
            Object.keys(shader.properties).length,
            // One Property for now until we support more shaders
            ...Object.entries(shader.properties).flatMap(([name, p]) => [
              getStringIdx(name),
              p.type,
              {
                TYPE: p.type,
                VALUE:
                  p.type === 2
                    ? name === "e_TextureDiffuse0" || name === "e_TextureGlow0"
                      ? shader.name.includes("Water.fx")
                        ? getStringIdx("watertest.dds")
                        : getStringIdx(textureNames[textureIdx])
                      : name === "e_TextureNormal0"
                      ? getStringIdx("water_n.dds")
                      : getStringIdx("water_e.dds")
                    : p.value,
              },
            ])
          );
        }

        for (let i = 0; i < vertexCount; i++) {
          const posIndex = i * 3;
          const uvIndex = i * 2;

          vertices.push(
            positions[posIndex], // X
            positions[posIndex + 2], // Z
            positions[posIndex + 1] // Y
          );
          vertices.push(
            normals[posIndex], // X
            normals[posIndex + 2], // Z
            normals[posIndex + 1] // Y
          );

          vertices.push(uvs[uvIndex], -uvs[uvIndex + 1]);
        }

        for (let i = 0; i < triCount; i++) {
          indices.push(
            meshIndices[i * 3] + vertexOffset, // X
            meshIndices[i * 3 + 2] + vertexOffset, // Z
            meshIndices[i * 3 + 1] + vertexOffset, // Y
            boundary ? -1 : +idx, // Material Index
            passThroughFlag // Polygon flag
          );
        }
        if (!isSubmesh) {
          vertexOffset += vertexCount;
        }
      }
      for (const litName of litNames) {
        const preamble = "EQGP";
        const count = vertices.length / 8;
        const totalLength = 5 + 4 + count * 4;
        const litBuffer = new ArrayBuffer(totalLength);
        const litWriter = new TypedArrayWriter(litBuffer);
        litWriter.writeCString(preamble);
        litWriter.setCursor(litWriter.cursor - 1);
        litWriter.writeUint32(count);
        for (let i = 0; i < count; i++) {
          const [r, g, b, a] = vertexColors[i];
          litWriter.writeUint8(r);
          litWriter.writeUint8(g);
          litWriter.writeUint8(b);
          litWriter.writeUint8(a);
        }
        writePfsFile(litName, new Uint8Array(litBuffer));
      }

      const vertLength = vertices.length * 4; // Each value 4 bytes
      const indLength = indices.length * 4; // All values here 4 bytes
      const matLength = materials.length * 4; // All values here 4 bytes

      const totalLength =
        postHeaderIdx +
        listLength +
        vertLength +
        indLength +
        matLength +
        (!terrain ? 4 : 0);

      const buffer = new ArrayBuffer(totalLength);
      const writer = new TypedArrayWriter(buffer);

      // Write preamble
      writer.writeString(preamble);

      // Header
      writer.writeUint32(version);
      writer.writeUint32(listLength);
      writer.writeUint32(matCount); // 7 props in here that will be different when mats have dynamic props
      writer.writeUint32(vertices.length / 8); // 8 props in here
      writer.writeUint32(indices.length / 5); // 5 props in here

      // bones
      if (!terrain) {
        writer.writeUint32(bones.length);
      }

      for (const str of totalStrings) {
        writer.writeCString(str);
      }

      // Materials
      materials.forEach((m) => {
        if (m.TYPE !== undefined) {
          if (m.TYPE === 0) {
            writer.writeFloat32(m.VALUE);
          } else {
            writer.writeUint32(m.VALUE);
          }
        } else {
          writer.writeUint32(m);
        }
      });

      // Vertices
      vertices.forEach((v) => {
        writer.writeFloat32(v);
      });

      // Polygons
      const indicesPropertyCount = 5;
      for (let i = 0; i < indices.length / indicesPropertyCount; i++) {
        const v1 = indices[i * indicesPropertyCount];
        const v2 = indices[i * indicesPropertyCount + 1];
        const v3 = indices[i * indicesPropertyCount + 2];
        const material = indices[i * indicesPropertyCount + 3];
        const flags = indices[i * indicesPropertyCount + 4];
        writer.writeUint32(v1);
        writer.writeUint32(v2);
        writer.writeUint32(v3);
        writer.writeInt32(material);
        writer.writeUint32(flags);
      }
      writePfsFile(
        modelName + (terrain ? ".ter" : ".mod"),
        new Uint8Array(buffer)
      );
    };

    const zoneMeshes = zb.scene
      .getNodeById("zone")
      .getChildMeshes()
      .filter((m) => m.getTotalVertices() > 0)
      .concat(
        ...(
          zb.scene
            .getNodeById("boundary")
            ?.getChildMeshes()
            ?.filter((m) => m.getTotalIndices() > 0) ?? []
        ).map((m) => {
          m.isBoundary = true;
          return m;
        })
      );
    await writeEqgMod(true, zoneMeshes, `ter_${name}`, [`ter_${name}.lit`]);

    {
      // write .ZON and .MOD files
      const preamble = "EQGZ";
      const headerSize = 24;
      const terrainFileName = `ter_${name}.ter`;
      const terrainName = `ter_${name}`;
      const modelNames = [terrainFileName].concat(
        ...Object.keys(metadata.objects).map((k) => k.toLowerCase() + ".mod")
      );
      const objectNames = [terrainName];
      // Start at 1 because of terrain
      let objectCount = 1;
      for (const [key, list] of Object.entries(metadata.objects)) {
        const mesh = zb.scene
          .getNodeById("objects")
          .getChildMeshes()
          .find((o) => o.name.startsWith(`${key}_`));
        if (mesh) {
          await writeEqgMod(
            false,
            mesh.subMeshes || mesh.getChildMeshes(),
            `${mesh.name.replace("_0", "")}`,
            Object.keys(list).map((i) => `${key}${i}.lit`),
            []
          ).catch((e) => {
            console.warn(`error writing mesh ${mesh.name}`, e);
          });
          for (const idx in list) {
            objectNames.push(`${key}${idx}`);
            objectCount++;
          }
        } else {
          console.warn(`Missing mesh for objects ${key}`);
        }
      }
      const lightNames = metadata.lights.map((_l, idx) => `light${idx}`);
      const regionNames = [];
      const regions = [];
      const regionTypeMap = {
        [RegionType.Water]: "AWT",
        [RegionType.Lava]: "ALV",
        [RegionType.Pvp]: "APK",
        [RegionType.Zoneline]: "ATP",
        [RegionType.Slippery]: "ASL",
        [RegionType.Normal]: "APV",
      };

      let regionCount = 0;
      for (const [idx, r] of Object.entries(metadata.regions)) {
        const {
          maxVertex,
          minVertex,
          center: [x, y, z],
        } = r;
        const extX = (maxVertex[0] - minVertex[0]) / 2;
        const extY = (maxVertex[1] - minVertex[1]) / 2;
        const extZ = (maxVertex[2] - minVertex[2]) / 2;
        if (extX === 0 && extY === 0 && extZ === 0) {
          continue;
        }

        let name = `${regionTypeMap[r.regionType]}`;
        if (r.regionType === RegionType.Zoneline) {
          name += `_${(r.zoneLineInfo.index ?? r.zoneLineInfo.zoneIndex)
            .toString()
            .padStart(2, "0")}_zoneline${idx}`;
        } else {
          name += `_region${idx}`;
        }
        regionNames.push(name);
        regions[name] = r;
        regionCount++;

        regions.push([name, x, y, z, extX, extY, extZ]);
      }

      const totalZonStrings = [
        ...modelNames,
        ...lightNames,
        ...regionNames,
        ...objectNames,
      ];
      const getStringIdx = (str) => {
        const idx = totalZonStrings.indexOf(str);
        if (idx === -1) {
          throw new Error("Not found string in .zon write: ", str);
        }
        const subArr = totalZonStrings.slice(0, idx);
        return cStringLengthReduce(subArr);
      };

      const objectSize = 4 + 4 + 7 * 4; // Model ID (int32) + Location (uint32) + 7 floats (7 * float32)
      const regionSize = 4 + 3 * 4 + 4 + 2 * 4 + 3 * 4; // Location (uint32) + 3 floats + rotation + 2 flags + 3 extents

      // temp
      const lightCount = metadata.lights.length;
      const modelIndicesLength = modelNames.length * 4;
      const lightSize = 4 * 8; // Location + 7 floats
      const listLength = cStringLengthReduce(totalZonStrings);
      const postHeaderIdx = preamble.length + headerSize;
      const totalLength =
        modelIndicesLength +
        postHeaderIdx +
        listLength +
        objectCount * objectSize +
        regionCount * regionSize +
        lightCount * lightSize;

      const buffer = new ArrayBuffer(totalLength);
      const writer = new TypedArrayWriter(buffer);

      // Write preamble
      writer.writeString(preamble);

      // Write header
      writer.writeUint32(1); // Version
      writer.writeUint32(listLength); // List length
      writer.writeUint32(modelNames.length); // Model count
      writer.writeUint32(objectCount); // Object count
      writer.writeUint32(regionCount); // Region count
      writer.writeUint32(lightCount); // Light count

      // String list
      for (const str of totalZonStrings) {
        writer.writeCString(str);
      }
      const rotChange = Math.PI / 180;

      for (const name of modelNames) {
        writer.writeUint32(getStringIdx(name));
      }

      // Terrain
      writer.writeInt32(getStringIdx(terrainFileName));
      writer.writeUint32(getStringIdx(terrainName));
      writer.writeFloat32(0);
      writer.writeFloat32(0);
      writer.writeFloat32(0);
      writer.writeFloat32(0);
      writer.writeFloat32(0);
      writer.writeFloat32(0);
      writer.writeFloat32(1);

      // Objects
      for (const [key, list] of Object.entries(metadata.objects)) {
        for (const [idx, obj] of Object.entries(list)) {
          const modelKeyName = `${key}${idx}`;
          if (!objectNames.includes(modelKeyName)) {
            continue;
          }
          let { x, y, z } = obj;
          const position = vec3.fromValues(x, y, z); // Replace x, y, z with the object's position

          const flipMatrix = mat4.create();
          mat4.scale(flipMatrix, flipMatrix, [1, -1, -1]); // Scale X and Z by -1

          // Apply the flip transformation to the rotated position
          const flippedPosition = vec3.create();
          vec3.transformMat4(flippedPosition, position, flipMatrix);

          writer.writeInt32(modelNames.indexOf(key.toLowerCase() + ".mod"));
          writer.writeUint32(getStringIdx(modelKeyName));

          writer.writeFloat32(x);
          writer.writeFloat32(z);
          writer.writeFloat32(y);

          writer.writeFloat32((-obj.rotateY * Math.PI) / 180);
          writer.writeFloat32(0);
          writer.writeFloat32(0);

          // writer.writeFloat32(obj.rotateZ * rotChange);
          // writer.writeFloat32(obj.rotateY * rotChange);
          writer.writeFloat32(obj.scale);
        }
      }

      for (const [key, x, y, z, extX, extY, extZ] of regions) {
        writer.writeUint32(getStringIdx(key));
        writer.writeFloat32(x);
        writer.writeFloat32(z);
        writer.writeFloat32(y);
        writer.writeFloat32(0);
        writer.writeUint32(0); // Flag unknown 1
        writer.writeUint32(0); // Flag unknown 2
        writer.writeFloat32(extX);
        writer.writeFloat32(extZ);
        writer.writeFloat32(extY);
      }

      for (const [idx, light] of Object.entries(metadata.lights)) {
        writer.writeUint32(getStringIdx(`light${idx}`));
        writer.writeFloat32(light.x);
        writer.writeFloat32(light.z);
        writer.writeFloat32(light.y);
        writer.writeFloat32(light.r);
        writer.writeFloat32(light.g);
        writer.writeFloat32(light.b);
        writer.writeFloat32(30);
      }

      writePfsFile(`${name}.zon`, new Uint8Array(buffer));
    }

    await Promise.all(imageWritePromises);
    await new Promise((res) => setTimeout(res, 0));
    const savePerf = performance.now();
    const file = eqgArchive.saveToFile();
    console.log(`Took ${performance.now() - savePerf} to pack archive`);
    await fsWrite("output", `${name}.eqg`, file, name);
    const defaultDir = `${(await getEQSageDir()).name}/output/${name}`;
    openAlert(`Saved files to ${fsHandle?.name ?? `${defaultDir}`}`);
    setExporting(false);
  }, [fsWrite, zb, name]);

  useEffect(() => {
    if (fsHandleSelected) {
      setFsHandle(fsHandleSelected);
    } else {
      getEQDir("output").then((d) => setFsHandle(d));
    }
  }, [fsHandleSelected]);

  return (
    <CommonDialog
      fullWidth
      maxWidth="sm"
      title={"Export EQG"}
      open={open}
      onClose={() => setOpen(false)}
      aria-labelledby="draggable-dialog-title"
    >
      {open && (
        <>
          <Typography
            sx={{
              fontSize: 16,
              marginBottom: "20px",
              marginTop: "15px",
              maxWidth: "100%",
            }}
            color="text.primary"
            gutterBottom
          >
            EQG Export will create a collection of files for the client and are
            listed below. The default selected output folder will be inside your
            EQ directory under eqsage/output. To distribute these client files
            as a server operator, consider using EQ Nexus to host your files.
          </Typography>

          <Button
            sx={{ width: "80%", margin: "5px 10%" }}
            variant="outlined"
            onClick={() => onFolderSelected()}
          >
            Select Output Folder ({fsHandle?.name ?? "none"})
          </Button>

          <Button
            sx={{ width: "80%", margin: "5px 10%" }}
            variant="outlined"
            disabled={exporting}
            onClick={() =>
              doExport().catch((e) => {
                console.log(`ERROR export`, e);
                setExporting(false);
              })
            }
          >
            {exporting ? "Export in progress..." : "Export Zone"}
          </Button>
          <List
            sx={{ width: "100%", bgcolor: "transparent", margin: '5px' }}
            subheader={
              <ListSubheader sx={{ background: "transparent", fontSize: '18px' }} component="div">
                Exported Files ({exportedFiles.length})
              </ListSubheader>
            }
          >
            {exportedFiles.map((f) => (
              <ListItem>{f}</ListItem>
            ))}
          </List>
        </>
      )}
    </CommonDialog>
  );
};
