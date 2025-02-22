import BABYLON from '@bjs';
import { GameControllerChild } from './GameControllerChild';
import { optimizeBoundingBoxes } from '../../lib/s3d/bsp/region-utils';
import { getEQFile, writeEQFile } from '../../lib/util/fileHandler';
import { GlobalStore } from '../../state';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { WebIO } from '@gltf-transform/core';
import { dedup, prune, textureCompress } from '@gltf-transform/functions';

const {
  Color3,
  Color4,
  Vector3,
  Texture,
  TransformNode,
  Mesh,
  StandardMaterial,
  PointLight,
  PointerEventTypes,
  SceneLoader,
  Tools,
  Scene,
  MeshBuilder,
  GlowLayer,
  Color3Gradient,
  CubeTexture,
  VertexData,
  SubMesh,
  MultiMaterial,
  GLTF2Export,
  STLExport,
} = BABYLON;
class ZoneController extends GameControllerChild {
  /**
   * @type {import('@babylonjs/core/scene').Scene}
   */
  scene = null;
  hadStoredScene = false;
  zoneLoaded = false;
  zoneName = '';
  zoneMetadata = {};
  aabbTree = {};
  animatedMeshes = [];
  animationGroupMap = {};
  collideCounter = 0;
  objectAnimationPlaying = [];
  lastPosition = new Vector3(0, 0, 0);
  animationRange = 200;
  objectCullRange = 2000;
  /** @type {RecastJSPlugin} */
  navigationPlugin = null;

  loadCallbacks = [];
  clickCallbacks = [];

  /**
   * @type {Object.<string, Promise<AssetContainer>}
   */
  assetContainers = {};

  addClickCallback = (cb) => {
    this.clickCallbacks.push(cb);
  };
  removeClickCallback = (cb) => {
    this.clickCallbacks = this.clickCallbacks.filter((l) => l !== cb);
  };

  addLoadCallback = (cb) => {
    this.loadCallbacks.push(cb);
  };
  removeLoadCallback = (cb) => {
    this.loadCallbacks = this.loadCallbacks.filter((l) => l !== cb);
  };
  dispose() {
    this.SpawnController.dispose();
    if (this.scene) {
      this.scene.onPointerObservable.remove(this.onClick.bind(this));
      this.scene.onBeforeRenderObservable.remove(this.renderHook.bind(this));
      this.scene.dispose();
    }
    this.scene = null;
    this.hadStoredScene = false;
    this.zoneLoaded = false;
    this.zoneName = '';
    this.zoneMetadata = {};
    this.aabbTree = {};
    this.animatedMeshes = [];
    this.animationGroupMap = {};
    this.collideCounter = 0;
    this.objectAnimationPlaying = [];
    this.lastPosition = new Vector3(0, 0, 0);

    this.zoneLoaded = false;
  }
  async exportSTL(name) {
    const zone =
      this.currentScene.getMeshByName('zone') ??
      this.currentScene.getMeshByName('__root__');
    const objects =
      this.currentScene.getNodeByName('static-objects')?.getChildMeshes() ?? [];
    const zoneChildren = zone.getChildMeshes(false);
    const objectsChildren = zone.getChildMeshes(false);

    STLExport.CreateSTL(
      [zone, ...objects, ...zoneChildren, ...objectsChildren],
      true,
      `${name}`,
      undefined,
      undefined,
      false
    );
  }
  exportZone(name) {
    GlobalStore.actions.setLoading(true);
    GlobalStore.actions.setLoadingTitle(`Exporting zone ${name}`);
    GlobalStore.actions.setLoadingText('LOADING, PLEASE WAIT...');
    const staticObjects = this.objectContainer?.getChildMeshes() ?? [];
    const exportObjects = this.gc.settings.exportObjects;
    GLTF2Export.GLBAsync(this.scene, name, {
      shouldExportNode(node) {
        while (node.parent) {
          node = node.parent;
        }
        return exportObjects
          ? node.name === '__root__' ||
              node.name.startsWith('zone') ||
              staticObjects.includes(node) ||
              node.name === 'static-objects'
          : node.name === '__root__' || node.name.startsWith('zone');
      },
      shouldExportAnimation() {
        return false;
      },
    })
      .then(async (glb) => {
        GlobalStore.actions.setLoadingTitle(`Optimizing ${name}`);
        GlobalStore.actions.setLoadingText('Applying GLB optimizations');
        let blob = Object.values(glb.glTFFiles)[0];
        try {
          const arr = new Uint8Array(await blob.arrayBuffer());
          const io = new WebIO().registerExtensions(ALL_EXTENSIONS);
          const doc = await io.readBinary(arr);
          await doc.transform(
            dedup(),
            prune(),
            textureCompress({
              targetFormat: 'png',
            })
          );
          const bin = await io.writeBinary(doc);
          blob = new Blob([bin]);
        } catch (e) {
          console.warn(e);
        }

        const assetUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = assetUrl;
        link.download = `${name}.glb`;
        link.click();
      })
      .finally(() => {
        GlobalStore.actions.setLoading(false);
      });
  }

  loadViewerScene() {
    this.dispose();
    this.scene = null;
    if (!this.engine || !this.canvas || !this.gc.engineInitialized) {
      return;
    }
    this.scene = new Scene(this.engine);
    this.scene.onPointerDown = this.sceneMouseDown;
    this.scene.onPointerUp = this.sceneMouseUp;

    this.CameraController.createCamera(new Vector3(0, 250, 0));
    this.CameraController.camera.rotation = new Vector3(1.57, 1.548, 0);
    const glowLayer = new GlowLayer('glow', this.scene, {
      blurKernelSize: 10,
    });
    this.glowLayer = glowLayer;
    glowLayer.intensity = 0.7;
    glowLayer.customEmissiveColorSelector = function (
      mesh,
      subMesh,
      material,
      result
    ) {
      if (mesh?.metadata?.emissiveColor) {
        result.set(
          mesh?.metadata?.emissiveColor.r,
          mesh?.metadata?.emissiveColor.g,
          mesh?.metadata?.emissiveColor.b,
          0.5
        );
        if (mesh?.metadata?.occludedColor) {
          if (mesh.isOccluded) {
            result.set(
              mesh?.metadata?.occludedColor.r,
              mesh?.metadata?.occludedColor.g,
              mesh?.metadata?.occludedColor.b,
              0.5
            );
          }
        }
        if (mesh?.metadata?.onlyOccluded) {
          if (mesh.isOccluded) {
            result.set(
              mesh?.metadata?.emissiveColor.r,
              mesh?.metadata?.emissiveColor.g,
              mesh?.metadata?.emissiveColor.b,
              0.5
            );
          } else {
            result.set(
              mesh?.metadata?.emissiveColor.r,
              mesh?.metadata?.emissiveColor.g,
              mesh?.metadata?.emissiveColor.b,
              0.0
            );
          }
        }
      }
    };
    this.regionMaterial = new StandardMaterial('region-material', this.scene);

    this.regionMaterial.alpha = 0.3;
    this.regionMaterial.diffuseColor = new Color3(0, 127, 65); // Red color
    this.regionMaterial.emissiveColor = new Color4(0, 127, 65, 0.3); // Red color

    const hdrTexture = CubeTexture.CreateFromPrefilteredData(
      '/static/environment.env',
      this.scene
    );
    this.scene.environmentTexture = hdrTexture;
    this.scene.environmentIntensity = 1.0;

    // Click events
    this.scene.onPointerObservable.add(this.onClick.bind(this));

    // Setups
    this.SpawnController.setupSpawnController();

    return true;
  }

  /**
   *
   * @param {PointerInfo} pointerInfo
   */
  onClick(pointerInfo) {
    switch (pointerInfo.type) {
      case PointerEventTypes.POINTERDOWN:
        if (
          pointerInfo.pickInfo.hit &&
          (pointerInfo.pickInfo.pickedMesh?.metadata?.spawn ?? null) !== null
        ) {
          this.clickCallbacks.forEach((c) =>
            c(pointerInfo.pickInfo.pickedMesh?.metadata?.spawn)
          );
        }
        break;
      default:
        break;
    }
  }

  renderHook() {
    if (window.aabbPerf === undefined) {
      window.aabbPerf = 0;
    }
    if (window.aabbs === undefined) {
      window.aabbs = [];
    }
    this.skybox.position = this.CameraController.camera.position;
  }

  showRegions(value) {
    this.regionsShown = value;
    this.scene?.getNodeById('regions')?.setEnabled(value);
  }

  moveSpawn(spawn) {
    if (!spawn) {
      return;
    }
    const spawnMesh = this.scene?.getMeshById(`zone-spawn-${spawn.id}`);
    if (spawnMesh) {
      spawnMesh.position.x = spawn.y;
      spawnMesh.position.y = spawn.z;
      spawnMesh.position.z = spawn.x;
      spawnMesh.metadata = { spawn };
    }
  }

  pickRaycastForLoc(callback) {
    const zoneMesh = this.scene.getMeshByName('zone');
    if (!zoneMesh) {
      return;
    }

    zoneMesh.isPickable = true;

    // Create node for moving
    const raycastMesh = MeshBuilder.CreateSphere(
      'raycast-sphere',
      { diameter: 3, segments: 32 },
      this.scene
    );
    const pointLight = new PointLight(
      'pointLight',
      new Vector3(0, 10, 0),
      this.scene
    );
    // pointLight.parent = raycastMesh;
    // Set the intensity of the point light
    pointLight.intensity = 500.0;
    pointLight.range = 300;
    pointLight.radius = 50;

    // Optional: Adjust other properties like the light's color
    pointLight.diffuse = new Color3(1, 1, 1); // White light
    pointLight.position = raycastMesh.position;
    const material = new StandardMaterial('raycast-sphere', this.scene);

    material.emissiveColor = new Color3(1, 1, 0);
    raycastMesh.material = material;
    let chosenLocation = null;

    const tooltip = document.createElement('div');
    tooltip.className = 'raycast-tooltip';
    document.body.appendChild(tooltip);

    const mouseMove = (e) => {
      // Calculate the pick ray from the camera position and mouse position

      const pickResult = this.scene.pick(
        this.scene.pointerX,
        this.scene.pointerY,
        null,
        false,
        this.CameraController.camera,
        (p0, p1, p2, ray) => {
          const p0p1 = p0.subtract(p1);
          const p2p1 = p2.subtract(p1);
          const normal = Vector3.Cross(p0p1, p2p1);
          return Vector3.Dot(ray.direction, normal) > 0;
        }
      );

      // Check if the ray intersects with the specific mesh
      if (pickResult.hit && pickResult.pickedMesh === zoneMesh) {
        // Perform actions based on the hit
        const hitPoint = pickResult.pickedPoint;
        raycastMesh.position.set(hitPoint.x, hitPoint.y + 5, hitPoint.z);
        chosenLocation = { x: hitPoint.x, y: hitPoint.y + 5, z: hitPoint.z };

        tooltip.style.left = `${e.pageX - tooltip.clientWidth / 2}px`;
        tooltip.style.top = `${e.pageY + tooltip.clientHeight / 2}px`;
        tooltip.innerHTML = `<p>[T] to commit - [Escape] to cancel</p><p>X: ${hitPoint.z.toFixed(
          2
        )}, Y: ${hitPoint.x.toFixed(2)}, Z: ${(hitPoint.y + 5).toFixed(2)}</p>`;
      }
    };
    const self = this;
    function finish(loc) {
      window.removeEventListener('keydown', keyHandler);
      self.canvas.removeEventListener('mousemove', mouseMove);
      zoneMesh.isPickable = false;
      raycastMesh.dispose();
      pointLight.dispose();
      document.body.removeChild(tooltip);
      callback(loc);
    }
    function keyHandler(e) {
      if (e.key === 'Escape') {
        finish(null);
      }

      if (e.key?.toLowerCase() === 't') {
        finish(chosenLocation);
      }
    }
    window.addEventListener('keydown', keyHandler);
    this.canvas.addEventListener('mousemove', mouseMove);
  }

  setFlySpeed(value) {
    this.cameraFlySpeed = value;
    if (!this.CameraController?.camera) {
      return;
    }
    this.CameraController.camera.speed = value;
  }

  setClipPlane(value) {
    if (!this.CameraController?.camera || !this.skybox) {
      return;
    }
    this.CameraController.camera.maxZ = value;
    const scaleValue = value / 10000;
    this.skybox.scaling.setAll(scaleValue);
  }

  setGlow(value) {
    if (!this.glowLayer) {
      return;
    }
    this.glowLayer.intensity = value ? 0.7 : 0;
    if (value) {
    } else {
    }
  }

  mergeMeshesWithMaterials = (meshes, scene) => {
    // Prepare arrays for the merged mesh data
    const positions = [];
    const indices = [];
    const normals = [];
    const uvs = [];
    let currentIndex = 0;

    // Store the submesh data
    const subMeshes = [];
    const materials = [];

    // Create a new mesh for the merged result
    const newMergedMesh = new Mesh('mergedMesh', scene);

    // Iterate through each mesh
    meshes.forEach((mesh) => {
      // Ensure the mesh has been updated (i.e., make sure the vertex data is up to date)
      mesh.bakeCurrentTransformIntoVertices();

      // Get the vertex data
      const vertexData = VertexData.ExtractFromMesh(mesh);

      // Store the material of the current mesh
      materials.push(mesh.material);

      // Push the vertex data into our arrays
      const vertexStart = currentIndex;
      const indexStart = indices.length;

      positions.push(...vertexData.positions);
      normals.push(...vertexData.normals);
      uvs.push(...vertexData.uvs);

      // Adjust the indices and add them
      const adjustedIndices = vertexData.indices.map(
        (index) => index + currentIndex
      );
      indices.push(...adjustedIndices);

      // Create a new submesh for the current mesh
      subMeshes.push(
        new SubMesh(
          materials.length - 1, // materialIndex
          vertexStart, // verticesStart
          vertexData.positions.length / 3, // verticesCount
          indexStart, // indexStart
          adjustedIndices.length, // indexCount
          mesh
        )
      );

      // Update the current index
      currentIndex += vertexData.positions.length / 3;
    });

    // Create vertex data for the new mesh
    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.uvs = uvs;

    // Apply the vertex data to the new mesh
    vertexData.applyToMesh(newMergedMesh);

    // Apply the submeshes to the new mesh
    // newMergedMesh.subMeshes = subMeshes;

    // Assign the multi-material to the new mesh
    const multiMaterial = new MultiMaterial('multiMaterial', scene);
    multiMaterial.subMaterials = materials;
    newMergedMesh.material = multiMaterial;

    return newMergedMesh;
  };

  async loadModel(name) {
    GlobalStore.actions.setLoading(true);
    GlobalStore.actions.setLoadingTitle(`Loading ${name}`);
    GlobalStore.actions.setLoadingText(`Loading ${name} zone`);
    if (!(await this.loadViewerScene())) {
      this.gc.openAlert('Error loading zone', 'warning');
      GlobalStore.actions.setLoading(false);
      return;
    }
    if (this.cameraFlySpeed !== undefined && this.CameraController?.camera) {
      this.CameraController.camera.speed = this.cameraFlySpeed;
    }
    this.scene.onBeforeRenderObservable.add(this.renderHook.bind(this));
    // Skybox
    const skybox = MeshBuilder.CreateBox(
      'skyBox',
      { size: 10000.0 },
      this.scene
    );
    this.skybox = skybox;
    const skyboxMaterial = new StandardMaterial('skyBox', this.scene);
    skyboxMaterial.backFaceCulling = false;

    const png_array = [];
    const map = ['px', 'py', 'pz', 'nx', 'ny', 'nz'];
    for (let i = 0; i < 6; i++) {
      png_array.push(`/static/skybox_${map[i]}.jpg`);
    }
    skyboxMaterial.reflectionTexture = new CubeTexture(
      '/',
      this.scene,
      [],
      false,
      png_array,
      undefined,
      undefined,
      undefined,
      undefined,
      '.jpg'
    );
    skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
    skyboxMaterial.diffuseColor = new Color3Gradient(0, 0, 0);
    skyboxMaterial.specularColor = new Color3(0, 0, 0);
    skybox.material = skyboxMaterial;

    const zone = await SceneLoader.ImportMeshAsync(
      '',
      '/eq/zones/',
      `${name}.glb`,
      this.scene,
      undefined,
      '.glb'
    ).catch((e) => {
      console.log('Error while loading zone', e);
    });
    console.log('settings', this.gc.settings);
    if (!this.gc.settings.importBoundary) {
      console.log('Disposing');
      zone.meshes.forEach((m) => {
        if (m.material?.metadata?.gltf?.extras?.boundary) {
          m.dispose();
        }
      });
    }

    // const zoneMesh = this.mergeMeshesWithMaterials(zone.meshes.filter((m) => m.getTotalVertices() > 0), this.currentScene);
    if (import.meta.env.VITE_LOCAL_DEV !== 'true') {
      const zoneMesh = Mesh.MergeMeshes(
        zone.meshes.filter((m) => m.getTotalVertices() > 0),
        true,
        true,
        undefined,
        false,
        true
      );
      zoneMesh.name = 'zone';
      zoneMesh.isPickable = false;
    }

    const metadata = await getEQFile('zones', `${name}.json`, 'json');
    if (metadata) {
      this.metadata = metadata;
      this.objectContainer = new TransformNode(
        'static-objects',
        this.currentScene
      );

      for (const [key, value] of Object.entries(metadata.objects)) {
        for (const mesh of await this.instantiateObjects(key, value)) {
          if (!mesh) {
            continue;
          }
          mesh.parent = this.objectContainer;
        }
      }

      const regionNode = new TransformNode('regions', this.scene);
      this.regionNode = regionNode;
      regionNode.setEnabled(!!this.regionsShown);
      console.log('Unoptimized', metadata.unoptimizedRegions);
      if (!metadata.regions?.length && metadata.unoptimizedRegions?.length) {
        metadata.regions = await optimizeBoundingBoxes(
          metadata.unoptimizedRegions
        );
        delete metadata.unoptimizedRegions;
        await writeEQFile('zones', `${name}.json`, JSON.stringify(metadata));
      }
      console.log('Regions', metadata.regions);
      let idx = 0;

      // Build out geometry, will have an option to toggle this on or off in the gui
      for (const region of metadata.regions) {
        const minVertex = new Vector3(
          region.minVertex[0],
          region.minVertex[1],
          region.minVertex[2]
        );
        const maxVertex = new Vector3(
          region.maxVertex[0],
          region.maxVertex[1],
          region.maxVertex[2]
        );

        // Calculate the dimensions of the box
        const width = maxVertex.x - minVertex.x;
        const height = maxVertex.y - minVertex.y;
        const depth = maxVertex.z - minVertex.z;

        // Create the box mesh
        const box = MeshBuilder.CreateBox(
          'box',
          {
            width : width,
            height: height,
            depth : depth,
          },
          this.scene
        );

        box.metadata = region.region;
        box.name = region.name || `Region-${idx++}`;
        // Set the position of the box to the center
        box.position = new Vector3(
          region.center[0],
          region.center[1],
          region.center[2]
        );

        box.material = this.regionMaterial;
        box.parent = regionNode;
      }
    }
    await this.addTextureAnimations();

    this.loadCallbacks.forEach((l) => l());
    this.zoneLoaded = true;

    GlobalStore.actions.setLoading(false);
  }

  async instantiateObjects(modelName, model) {
    const container = await SceneLoader.LoadAssetContainerAsync(
      '/eq/objects/',
      `${modelName}.glb`,
      this.scene,
      undefined,
      '.glb'
    ).catch((_e) => null);
    if (!container) {
      return [];
    }
    const mergedMeshes = [];

    for (const [idx, v] of Object.entries(model)) {
      const meshes = [];

      const { x, y, z, rotateX, rotateY, rotateZ, scale } = v;
      const instanceContainer = container.instantiateModelsToScene(
        () => `${modelName}_${idx}`,
        undefined,
        { doNotInstantiate: true }
      );
      if (this.gc.settings.disableAnimations) {
        instanceContainer.animationGroups?.forEach((ag) =>
          this.scene.removeAnimationGroup(ag)
        );
        instanceContainer.animationGroups = [];
      }

      const hasAnimations = instanceContainer.animationGroups.length > 0;

      for (const mesh of instanceContainer.rootNodes[0].getChildMeshes()) {
        if (mesh.getTotalVertices() > 0) {
          // mesh.rotation = new Vector3(
          //   Tools.ToRadians(rotateX),
          //   Tools.ToRadians(-rotateY) + Tools.ToRadians(90),
          //   Tools.ToRadians(rotateZ)
          // );
          meshes.push(mesh);
        }
      }
      try {
        let rootNode = instanceContainer.rootNodes[0];
        const instanceSkeleton = instanceContainer.skeletons[0];
        const skeletonRoot = rootNode.getChildren(undefined, true)[0];

        const mergedMesh = Mesh.MergeMeshes(
          meshes,
          true,
          true,
          undefined,
          true,
          true
        );
        if (mergedMesh) {
          skeletonRoot.parent = mergedMesh;
          skeletonRoot.skeleton = instanceSkeleton;
          rootNode.dispose();
          rootNode = mergedMesh;
          rootNode.name = rootNode.id = `${modelName}_${idx}`;
          rootNode.position = new Vector3(x, y, z);

          rootNode.rotation = new Vector3(
            Tools.ToRadians(rotateX),
            Tools.ToRadians(rotateY),
            Tools.ToRadians(rotateZ)
          );
          const hasMorphTargets = rootNode
            .getChildMeshes()
            .some((mesh) => mesh.morphTargetManager !== null);

          if (hasMorphTargets) {
            rootNode.visibility = 0;
          }
          rootNode.checkCollisions = true;
          rootNode.scaling.z = rootNode.scaling.y = rootNode.scaling.x = scale;
          rootNode.metadata = {
            animated  : hasAnimations,
            zoneObject: true,
          };
          // Reassign the skeleton to the merged mesh
          if (instanceSkeleton) {
            rootNode.skeleton = instanceSkeleton;
          }
          rootNode.addLODLevel(2000, null);
          rootNode.id = `${modelName}_${idx}`;
          if (!hasAnimations) {
            rootNode.freezeWorldMatrix();
          } else {
            setTimeout(() => {
              instanceContainer.animationGroups.forEach((ag) => {
                ag.play(true);
              });
            }, 1000);
          }
          mergedMeshes.push(rootNode);
        }
      } catch (e) {
        console.warn(`Warning merging object ${modelName}`, e);
      }

      instanceContainer.rootNodes[0].dispose();
    }

    return mergedMeshes;
  }

  async addTextureAnimations() {
    const addTextureAnimation = (material, textureAnimation) => {
      const [baseTexture] = material.getActiveTextures();
      return textureAnimation.frames.map((f) => {
        return new Texture(
          f,
          this.scene,
          baseTexture.noMipMap,
          baseTexture.invertY,
          baseTexture.samplingMode
        );
      });
    };

    let animationTimerMap = {};
    const animationTexturesCache = {};

    for (const material of this.scene.materials) {
      if (!material.metadata?.gltf?.extras?.animationDelay) {
        continue;
      }

      const textureAnimation = material.metadata?.gltf?.extras;
      if (textureAnimation) {
        let allTextures;
        if (animationTexturesCache[material.id]) {
          allTextures = animationTexturesCache[material.id];
        } else {
          allTextures = await addTextureAnimation(material, textureAnimation);
          animationTexturesCache[material.id] = allTextures;
        }
        animationTimerMap = {
          ...animationTimerMap,
          [textureAnimation.animationDelay]: {
            ...(animationTimerMap[textureAnimation.animationDelay] ?? {}),
            materials: [
              ...(animationTimerMap[textureAnimation.animationDelay]
                ?.materials ?? []),
              {
                frames      : textureAnimation.frames,
                currentFrame: 1,
                allTextures,
                material,
              },
            ],
          },
        };
      }
    }

    for (const [time, value] of Object.entries(animationTimerMap)) {
      const interval = setInterval(() => {
        for (const material of value.materials) {
          material.currentFrame =
            material.currentFrame + 1 > material.frames.length
              ? 1
              : material.currentFrame + 1;
          for (const texture of material.material.getActiveTextures()) {
            if (material.allTextures[material.currentFrame - 1]) {
              texture._texture =
                material.allTextures[material.currentFrame - 1]._texture;
            }
          }
        }
      }, +time * 2);

      for (const material of value.materials) {
        material.material.onDisposeObservable.add(() => {
          clearInterval(interval);
        });
      }
    }
  }
}

export const zoneController = new ZoneController();
window.zone = zoneController;
