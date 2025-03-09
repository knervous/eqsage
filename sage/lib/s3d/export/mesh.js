import { globals } from '../../globals';

const { SubMesh, Vector3, Color3, VertexBuffer, MeshBuilder } = globals.BABYLON;

const createMeshTemplate = (index, materialPalette) => ({
  Tag                  : `R${index}_DMSPRITEDEF`,
  DmTrackTag           : '',
  Params2              : [0, 0, 0],
  BoundingBoxMin       : [0, 0, 0],
  BoundingBoxMax       : [0, 0, 0],
  CenterOffset         : [], // <--- We will fill this
  Vertices             : [],
  UVs                  : [],
  VertexNormals        : [],
  VertexColors         : [],
  SkinAssignmentGroups : null,
  MaterialPaletteTag   : materialPalette.Tag,
  Faces                : [],
  MeshOps              : null,
  FaceMaterialGroups   : [],
  VertexMaterialGroups : [],
  BoundingRadius       : 0, // <--- We will fill this
  FPScale              : 1,
  PolyhedronTag        : 'NEGATIVE_TWO',
  HexOneFlag           : 1,
  HexTwoFlag           : 1,
  HexFourThousandFlag  : 0,
  HexEightThousandFlag : 1,
  HexTenThousandFlag   : 1,
  HexTwentyThousandFlag: 0,
});

const createRegions = regions => {
  const meshes = [];
  const push = 1.01;
  for (const region of regions) {
    const minVertex = new Vector3(
      region.minVertex[0] + push,
      region.minVertex[1] + push,
      region.minVertex[2] + push
    );
    const maxVertex = new Vector3(
      region.maxVertex[0] - push,
      region.maxVertex[1] - push,
      region.maxVertex[2] - push
    );

    const width = maxVertex.x - minVertex.x;
    const height = maxVertex.y - minVertex.y;
    const depth = maxVertex.z - minVertex.z;

    const box = MeshBuilder.CreateBox(
      'box',
      {
        width    : width,
        height   : height,
        depth    : depth,
        updatable: true,
      },
      null
    );
    box.position = new Vector3(
      region.center[0],
      region.center[1],
      region.center[2]
    );
    box.metadata = {
      region,
    };
    meshes.push(box);
  }
  return meshes;
};

/**
 *
 * @param {import('@babylonjs/core/scene').Scene} scene
 * @param {{Tag: string}} materialPalette
 * @param {[import('@babylonjs/core/Meshes/mesh').Mesh]} zoneMeshes
 * @param {[import('@babylonjs/core/Meshes/mesh').Mesh]} collisionMeshes
 * @param {Map<import('@babylonjs/core/Materials/material').Material, number>} materialMap
 * @param {boolean} computeBoundingMinMax
 */
export const createMeshes = (
  scene,
  materialPalette,
  zoneMeshes,
  collisionMeshes,
  materialMap,
  regions = [],
  computeBoundingMinMax = false
) => {
  const dmSpriteDef2s = [];
  const regionMeshes = createRegions(regions);

  // Merge zone meshes + collision meshes (marked isBoundary)
  const meshes = zoneMeshes
    .concat(collisionMeshes.map((m) => {
      m.isBoundary = true;
      return m;
    }))
    .concat(regionMeshes.map((m) => {
      m.eqRegion = true;
      return m;
    }))
    .filter((mesh) => {
      const isSubmesh = mesh instanceof SubMesh;
      const parentMesh = isSubmesh ? mesh.getMesh() : mesh;
      return parentMesh.getTotalVertices() > 0;
    });

  // We’ll keep a running offset if we have multiple submeshes
  let idx = 0;
  for (const [_idx, mesh] of Object.entries(meshes)) {
    let vertexOffset = 0;
    const boundary = mesh.isBoundary;
    const template = createMeshTemplate(+idx + 1, materialPalette);

    const passThroughFlag = mesh.eqRegion || mesh.metadata?.gltf?.extras?.passThrough ? 1 : 0;
    const isSubmesh = mesh instanceof SubMesh;
    const parentMesh = isSubmesh ? mesh.getMesh() : mesh;

    template.A_originalMesh = mesh.name;
    if (mesh.name.startsWith('M0000')) {
      continue;
    }
    
    // Grab positions, normals, etc. (submesh vs. standard mesh)
    const positions = isSubmesh
      ? parentMesh
        .getVerticesData(VertexBuffer.PositionKind)
        .slice(
          mesh.verticesStart * 3,
          (mesh.verticesStart + mesh.verticesCount) * 3
        )
      : parentMesh.getVerticesData(VertexBuffer.PositionKind);

    const normals = isSubmesh
      ? parentMesh
        .getVerticesData(VertexBuffer.NormalKind)
        .slice(
          mesh.verticesStart * 3,
          (mesh.verticesStart + mesh.verticesCount) * 3
        )
      : parentMesh.getVerticesData(VertexBuffer.NormalKind);

    const uvs = isSubmesh
      ? parentMesh
        .getVerticesData(VertexBuffer.UVKind)
        .slice(
          mesh.verticesStart * 2,
          (mesh.verticesStart + mesh.verticesCount) * 2
        )
      : parentMesh.getVerticesData(VertexBuffer.UVKind);

    // ------------------------------------------------------------
    // 1) Prepare to track the bounding box in the *new* coordinate
    //    system (which you said is: (-x, z, y) ).
    // ------------------------------------------------------------
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    // 2) Collect vertex colors (light sampling) + transform vertices
    for (let i = 0; i < positions.length; i += 3) {
      // Original Babylon positions
      const oldX = positions[i];
      const oldY = positions[i + 1];
      const oldZ = positions[i + 2];

      // NEW coordinate according to your note: (-x, z, y)
      // If you truly need negative X, uncomment the line with negative:
      // const newX = -oldX;
      const newX = oldX; // <-- If you actually want to keep X as is
      const newY = oldZ;
      const newZ = oldY;

      // Update bounding box min/max
      if (newX < minX) {
        minX = newX;
      }
      if (newY < minY) {
        minY = newY;
      }
      if (newZ < minZ) {
        minZ = newZ;
      }
      if (newX > maxX) {
        maxX = newX;
      }
      if (newY > maxY) {
        maxY = newY;
      }
      if (newZ > maxZ) {
        maxZ = newZ;
      }

      // Pull the corresponding normal (and normalize)
      const normal = new Vector3(
        normals?.[i] ?? 0,
        normals?.[i + 1] ?? 0,
        normals?.[i + 2] ?? 0
      ).normalize();

      // Basic lighting accumulation
      let finalColor = new Color3(0, 0, 0);
      scene.lights.forEach((light) => {
        if (light.zoneLight) {
          const lightDirection = light.position
            .subtractFromFloats(oldX, oldY, oldZ)
            .normalize();
          const distance = Vector3.Distance(
            light.position,
            new Vector3(oldX, oldY, oldZ)
          );
          const constantAttenuation = 1.0;
          const linearAttenuation = 0.05;
          const quadraticAttenuation = 0.002;
          const attenuation =
            1.0 /
            (constantAttenuation +
              linearAttenuation * distance +
              quadraticAttenuation * distance * distance);

          const diffuseIntensity =
            Math.max(0, Vector3.Dot(normal, lightDirection)) * attenuation;
          const diffuseComponent = light.diffuse.scale(diffuseIntensity);
          finalColor = finalColor.add(diffuseComponent);
        }
      });

      // Convert finalColor to 0–255
      const r = Math.min(255, Math.max(0, Math.round(finalColor.r * 255)));
      const g = Math.min(255, Math.max(0, Math.round(finalColor.g * 255)));
      const b = Math.min(255, Math.max(0, Math.round(finalColor.b * 255)));

      // Push final vertex color
      template.VertexColors.push([r, g, b, 255]);
    }

    // ------------------------------------------------------------
    // 3) Now push the actual geometry data (positions, normals, uvs)
    //    into the template, also reapplying coordinate transforms.
    // ------------------------------------------------------------
    const vertexCount = positions.length / 3;
    for (let i = 0; i < vertexCount; i++) {
      const posIndex = i * 3;
      const uvIndex = i * 2;

      // Original coords
      const oldX = positions[posIndex];
      const oldY = positions[posIndex + 1];
      const oldZ = positions[posIndex + 2];

      // Transformed coords
      // const newX = -oldX;  // If you truly want negative
      const newX = oldX;
      const newY = oldZ;
      const newZ = oldY;

      // Push position
      template.Vertices.push([newX, newY, newZ]);

      // Push normal (with the same transform for consistency)
      const nx = normals?.[posIndex] ?? 0;
      const ny = normals?.[posIndex + 1] ?? 0;
      const nz = normals?.[posIndex + 2] ?? 0;
      // const nnx = -nx;
      const nnx = -nx;
      const nny = nz;
      const nnz = ny;
      template.VertexNormals.push([nnx, nny, nnz]);

      // Flip V for your engine if necessary
      template.UVs.push([uvs[uvIndex], -uvs[uvIndex + 1]]);
    }

    // ------------------------------------------------------------
    // 4) Faces / Indices
    // ------------------------------------------------------------
    const meshIndices = isSubmesh
      ? parentMesh
        .getIndices()
        .slice(mesh.indexStart, mesh.indexStart + mesh.indexCount)
      : parentMesh.getIndices();
    const triCount = meshIndices.length / 3;

    for (let i = 0; i < triCount; i++) {
      template.Faces.push({
        Passable: passThroughFlag,
        Triangle: [
          meshIndices[i * 3 + 0] + vertexOffset,
          meshIndices[i * 3 + 1] + vertexOffset,
          meshIndices[i * 3 + 2] + vertexOffset,
        ],
      });
    }
    if (!isSubmesh) {
      vertexOffset += vertexCount;
    }
    // ------------------------------------------------------------
    // 5) Fill material groups
    // ------------------------------------------------------------
    const matIdx = materialMap.has(mesh.material) ? materialMap.get(mesh.material) :
      materialMap.has(mesh.metadata?.region) ? 
        materialMap.get(mesh.metadata?.region) : 0;
    template.FaceMaterialGroups.push([
      template.Faces.length,
      +matIdx,
    ]);
    template.VertexMaterialGroups.push([
      template.Vertices.length,
      +matIdx,
    ]);


    if (computeBoundingMinMax) {
      template.BoundingBoxMin = [minX, minY, minZ];
      template.BoundingBoxMax = [maxX, maxY, maxZ];
    }

    template.BoundingRadius = 0;

    if (mesh.eqRegion) {
      template.CenterOffset = [mesh.position.x, mesh.position.z, mesh.position.y];
      template.region = mesh.metadata.region;
    } else {
      template.CenterOffset = [0, 0, 0];
    }


    // ------------------------------------------------------------
    // 7) Finally, push this mesh’s data into dmSpriteDef2s
    // ------------------------------------------------------------
    dmSpriteDef2s.push(template);
    idx++;
  
  }
  regionMeshes.forEach(r => r.dispose());
  return {
    dmSpriteDef2s,
  };
};
