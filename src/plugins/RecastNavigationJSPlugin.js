import BABYLON from '@bjs';

import * as Comlink from 'comlink';
import { init } from '@recast-navigation/core';
import { zlibSync } from 'fflate';

import { generateTileCache } from 'recast-navigation/generators';
import {
  Crowd,
  exportNavMesh,
  getRandomSeed,
  importNavMesh,
  NavMeshQuery,
  setRandomSeed,
} from 'recast-navigation';
import { TypedArrayWriter } from '../lib/util/typed-array-reader.js';

const {
  VertexData,
  CreateBox,
  TransformNode,
  CreateGreasedLine,
  Mesh,
  PointerEventTypes,
  VertexBuffer,
  Epsilon,
  Vector3,
  Observable,
  StandardMaterial,
  Color3,
} = BABYLON;

const DEFAULT_TILE_SIZE = 16;

function _CreateNavMeshConfig(parameters) {
  const cfg = {
    borderSize            : parameters.borderSize ? parameters.borderSize : 0,
    cs                    : parameters.cs,
    ch                    : parameters.ch,
    detailSampleDist      : parameters.detailSampleDist,
    detailSampleMaxError  : parameters.detailSampleMaxError,
    maxEdgeLen            : parameters.maxEdgeLen,
    maxSimplificationError: parameters.maxSimplificationError,
    maxVertsPerPoly       : parameters.maxVertsPerPoly,
    mergeRegionArea       : parameters.mergeRegionArea,
    minRegionArea         : parameters.minRegionArea,
    walkableClimb         : parameters.walkableClimb,
    walkableSlopeAngle    : parameters.walkableSlopeAngle,
    walkableHeight        : parameters.walkableHeight,
    walkableRadius        : parameters.walkableRadius,
  };

  if ('tileSize' in parameters) {
    if (parameters.tileSize === 0) {
      parameters.tileSize = DEFAULT_TILE_SIZE;
    }

    cfg.tileSize = parameters.tileSize;
  }

  return cfg;
}

const transformPositions = (positions) => {
  const transformedPositions = new Float32Array(positions.length);

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];

    // Rearrange components: X -> Z, Y stays Y, Z -> X
    transformedPositions[i] = z; // New X = Old Z
    transformedPositions[i + 1] = y; // New Y = Old Y
    transformedPositions[i + 2] = x; // New Z = Old X
  }

  return transformedPositions;
};

const transformIndices = (indices) => {
  const updatedIndices = new Uint32Array(indices.length);

  for (let i = 0; i < indices.length; i += 3) {
    updatedIndices[i] = indices[i]; // Keep the first index
    updatedIndices[i + 1] = indices[i + 2]; // Swap the second and third indices
    updatedIndices[i + 2] = indices[i + 1]; // Swap the second and third indices
  }

  return updatedIndices;
};

const inverseTransformVector3 = (vector) => {
  return new Vector3(vector.z, vector.y, vector.x);
};
const transformVector3 = (vector) => {
  return new Vector3(vector.z, vector.y, vector.x);
};
export class RecastNavigationJSPlugin {
  /** @type {Comlink.Remote<import('./nav-worker.js')['default']>} */
  #navWorker = null;

  /**
   * @type {import('@babylonjs/core').Scene}
   */
  _scene = null;
  constructor() {
    this.bjsRECAST = {};
    this.name = 'RecastNavigationJSPlugin';
    this.navMesh = null;
    this._navMeshQuery = null;
    this._agents = [];
    this._maximumSubStepCount = 10;
    this._timeStep = 1 / 60;
    this._timeFactor = 1;
    this._tileCache = null;
    this._positions = new Float32Array();
    this._indices = new Uint32Array();

    const worker = new Worker(new URL('./nav-worker.js', import.meta.url), {
      type: 'module',
    });
    this.#navWorker = Comlink.wrap(worker);

    this.setTimeStep();
  }

  setTimeStep(newTimeStep = 1 / 60) {
    this._timeStep = newTimeStep;
  }

  getTimeStep() {
    return this._timeStep;
  }

  setMaximumSubStepCount(newStepCount = 10) {
    this._maximumSubStepCount = newStepCount;
  }

  getMaximumSubStepCount() {
    return this._maximumSubStepCount;
  }

  set timeFactor(value) {
    this._timeFactor = Math.max(value, 0);
  }

  get timeFactor() {
    return this._timeFactor;
  }

  /**
   *
   * @param {[import('@babylonjs/core').Mesh]} meshes
   * @returns
   */
  async _getPositionsAndIndices(meshes) {
    // Filter out invalid or empty meshes
    const validMeshes = meshes.filter(
      (mesh) =>
        mesh &&
        mesh.getIndices() &&
        mesh.getVerticesData(VertexBuffer.PositionKind) &&
        !mesh.metadata?.gltf?.extras?.passThrough &&
        mesh.position.y > -20000
    );

    if (validMeshes.length === 0) {
      return [new Float32Array(), new Uint32Array()];
    }

    // Merge meshes into one
    const merged = Mesh.MergeMeshes(
      validMeshes,
      false,
      true,
      undefined,
      false,
      false
    );

    if (!merged) {
      return [new Float32Array(), new Uint32Array()];
    }

    const positions = merged.getVerticesData(VertexBuffer.PositionKind) || [];
    const indices = merged.getIndices() || [];

    merged.dispose();

    return [Float32Array.from(positions), Uint32Array.from(indices)];
  }
  async init() {
    if (this.initPromise) {
      await this.initPromise;
      return;
    }
    this.initPromise = init();
    await this.initPromise;
  }

  async createNavMesh(meshes, parameters) {
    if (meshes.length === 0) {
      throw new Error('At least one mesh is needed to create the nav mesh.');
    }
    await this.init();
    const [positions, indices] = await this._getPositionsAndIndices(meshes);
    const swappedPositions = transformPositions(positions);
    const swappedIndices = transformIndices(indices);
    // Store transformed positions and indices
    this._positions = swappedPositions;
    this._indices = swappedIndices;

    const config = _CreateNavMeshConfig(parameters);

    const { data, params } = await this.#navWorker.generateNavMesh(
      this._positions,
      this._indices,
      config
    );

    this.buildFromNavmeshData(new Uint8Array(data));
    return params;
  }

  createDebugNavMesh(scene) {
    const [positions, indices] = this.navMesh.getDebugNavMesh();
    const swappedPositions = transformPositions(positions);
    const swappedIndices = transformIndices(indices);

    // Create a new mesh for the debug navmesh
    const mesh = new Mesh('NavMeshDebug', scene);
    const vertexData = new VertexData();

    vertexData.indices = swappedIndices;
    vertexData.positions = swappedPositions;
    vertexData.applyToMesh(mesh, true);

    // Create a material for the debug mesh
    const matdebug = new StandardMaterial('mat-navmesh-debug', scene);
    matdebug.emissiveColor = new Color3(0, 0, 1); // Blue color
    matdebug.backFaceCulling = false;
    matdebug.disableLighting = true;
    matdebug.alpha = 0.25; // Semi-transparent
    mesh.material = matdebug;

    return mesh;
  }

  /**
   *
   * @param {import('recast-navigation').NavMeshParamsType} params
   */
  serializeNav(params) {
    const buffer = new ArrayBuffer(1024);
    const writer = new TypedArrayWriter(buffer);

    let numberOfTiles = 0;
    for (let tileIdx = 0; tileIdx < this.navMesh.getMaxTiles(); tileIdx++) {
      const tile = this.navMesh.getTile(tileIdx);
      if (!tile || !tile.header() || !tile.dataSize()) {
        continue;
      }
      numberOfTiles++;
    }
    writer.writeUint32(numberOfTiles);
    writer.writeFloat32(params.orig.x);
    writer.writeFloat32(params.orig.y);
    writer.writeFloat32(params.orig.z);
    writer.writeFloat32(params.tileWidth);
    writer.writeFloat32(params.tileHeight);
    writer.writeInt32(params.maxTiles);
    writer.writeInt32(params.maxPolys);

    for (let tileIdx = 0; tileIdx < this.navMesh.getMaxTiles(); tileIdx++) {
      const tile = this.navMesh.getTile(tileIdx);
      if (!tile || !tile.header() || !tile.dataSize()) {
        continue;
      }
      writer.writeUint32(this.navMesh.getTileRef(tile));
      const dataSize = tile.dataSize();
      writer.writeInt32(dataSize);
      const tileData = new Uint8Array(dataSize);
      for (let i = 0; i < dataSize; i++) {
        tileData[i] = tile.data(i);
      }
      writer.writeUint8Array(tileData);
    }
    const compressed = zlibSync(new Uint8Array(writer.buffer), {
      level: 6,
    });

    const dataWriter = new TypedArrayWriter(new ArrayBuffer(1024));
    dataWriter.writeCString('EQNAVMESH');
    dataWriter.setCursor(dataWriter.cursor - 1);
    dataWriter.writeUint32(2); // Version
    dataWriter.writeUint32(compressed.length);
    dataWriter.writeUint32(writer.buffer.byteLength + 128);
    dataWriter.writeUint8Array(compressed);
    return dataWriter.buffer;
  }

  getClosestPoint(position) {
    const transformedPosition = inverseTransformVector3(position);

    const ret = this._navMeshQuery.findClosestPoint(transformedPosition);
    return new Vector3(ret.point.x, ret.point.y, ret.point.z);
  }

  getRandomPointAround(position, maxRadius) {
    const ret = this._navMeshQuery.findRandomPointAroundCircle(
      position,
      maxRadius
    );

    return new Vector3(ret.randomPoint.x, ret.randomPoint.y, ret.randomPoint.z);
  }

  _convertNavPathPoints(navPath) {
    const positions = [];

    if (navPath.success) {
      const pointCount = navPath.path.length;
      for (let pt = 0; pt < pointCount; pt++) {
        const p = navPath.path[pt];
        positions.push(transformVector3(new Vector3(p.x, p.y, p.z)));
      }
    } else {
      console.warn('Unable to convert navigation path points.');
    }

    return positions;
  }

  computePath(start, end) {
    const transformedStart = inverseTransformVector3(start);
    const transformedEnd = inverseTransformVector3(end);

    const navPath = this._navMeshQuery.computePath(
      transformedStart,
      transformedEnd
    );

    return this._convertNavPathPoints(navPath);
  }

  createCrowd(maxAgents, maxAgentRadius, scene, { x, y, z }) {
    this._scene = scene;
    const crowd = new RecastJSCrowd(this, maxAgents, maxAgentRadius, scene);

    const agentParams = {
      radius               : 2.1,
      height               : 2.2,
      maxSpeed             : 20.0,
      collisionQueryRange  : 2.5,
      pathOptimizationRange: 0.0,
      separationWeight     : 2.0,
    };
    const matTarget = new StandardMaterial('target', this._scene);
    matTarget.emissiveColor = new Color3(255, 255, 255);
    const targetCube = CreateBox(
      'target-cube',
      { size: 2, height: 2 },
      this._scene
    );
    targetCube.material = matTarget;

    const transforms = [];

    for (let i = 0; i < maxAgents; i++) {
      const agentCube = CreateBox('agent', { size: 3 }, this._scene);

      const matAgent = new StandardMaterial('mat2', this._scene);
      const variation = Math.random();

      matAgent.diffuseColor =
        matAgent.specularColor =
        matAgent.emissiveColor =
          new Color3(0.4 + variation * 0.6, 0.3, 1.0 - variation * 0.3);
      agentCube.material = matAgent;

      const randomPos = this.getRandomPointAround(new Vector3(x, y, z), 0.5);

      const transform = new TransformNode('agent-parent');
      transforms.push(transform);
      const agentIndex = crowd.addAgent(
        inverseTransformVector3(randomPos),
        agentParams,
        transform
      );
      this._agents.push({
        idx   : agentIndex,
        trf   : transform,
        mesh  : agentCube,
        target: targetCube,
      });
    }

    let startingPoint;

    const getGroundPosition = () => {
      const pickinfo = this._scene.pick(
        this._scene.pointerX,
        this._scene.pointerY,
        (m) => m.name === 'NavMeshDebug'
      );
      if (pickinfo.hit) {
        return pickinfo.pickedPoint;
      }

      return null;
    };

    const pointerCallback = (pointerInfo) => {
      switch (pointerInfo.type) {
        case PointerEventTypes.POINTERDOWN:
          if (pointerInfo.event.buttons !== 1) {
            return;
          }
          if (pointerInfo.pickInfo?.hit) {
            const pathPoints = [];

            startingPoint = getGroundPosition();
            if (startingPoint) {
              // Transform the starting point for the navmesh query

              const agents = crowd.getAgents();
              for (let i = 0; i < agents.length; i++) {
                const agentIndex = agents[i];

                // Get the closest point on the navmesh in Recast's coordinate system
                const closestPointRecast = this.getClosestPoint(startingPoint);

                crowd.agentGoto(agentIndex, closestPointRecast);

                pathPoints.push(
                  this.computePath(
                    inverseTransformVector3(crowd.getAgentPosition(agentIndex)),
                    startingPoint
                  )
                );
              }

              this._scene.getMeshByName('path-line')?.dispose();

              CreateGreasedLine(
                'path-line',
                {
                  points: pathPoints,
                },
                {
                  width: 0.5,
                }
              );
            }
          }
          break;
        default:
          break;
      }
    };

    const renderCallback = () => {
      const agentCount = this._agents.length;
      for (let i = 0; i < agentCount; i++) {
        const agent = this._agents[i];
        agent.mesh.position = inverseTransformVector3(
          crowd.getAgentPosition(agent.idx)
        );
        crowd.getAgentNextTargetPathToRef(agent.idx, agent.target.position);

        const vel = crowd.getAgentVelocity(agent.idx);
        if (vel.length() > 0.2) {
          vel.normalize();
          const desiredRotation = Math.atan2(vel.x, vel.z);
          agent.mesh.rotation.y =
            agent.mesh.rotation.y +
            (desiredRotation - agent.mesh.rotation.y) * 0.05;
        }
      }
    };

    const pCallback = this._scene.onPointerObservable.add(pointerCallback);
    const rCallback = this._scene.onBeforeRenderObservable.add(renderCallback);

    return () => {
      pCallback.remove();
      rCallback.remove();
      this._scene.getMeshByName('path-line')?.dispose();
      this._scene.getMeshByName('target-cube')?.dispose();
      crowd.dispose();
      this._agents.forEach(({ mesh }) => {
        mesh.dispose();
      });
      transforms.forEach((t) => t.dispose());
      this._agents = [];
    };
  }

  setDefaultQueryExtent(extent) {
    this._navMeshQuery.defaultQueryHalfExtents = extent;
  }

  getDefaultQueryExtent() {
    return new Vector3(
      this._navMeshQuery.defaultQueryHalfExtents.x,
      this._navMeshQuery.defaultQueryHalfExtents.y,
      this._navMeshQuery.defaultQueryHalfExtents.z
    );
  }

  getDefaultQueryExtentToRef(result) {
    result.set(
      this._navMeshQuery.defaultQueryHalfExtents.x,
      this._navMeshQuery.defaultQueryHalfExtents.y,
      this._navMeshQuery.defaultQueryHalfExtents.z
    );
  }

  buildFromNavmeshData(data) {
    const result = importNavMesh(data);
    this.navMesh = result.navMesh;
    this._navMeshQuery = new NavMeshQuery(this.navMesh);
  }

  getNavmeshData() {
    return exportNavMesh(this.navMesh);
  }

  dispose() {
    // nothing to dispose
  }

  _createTileCache(tileSize = 32) {
    if (!this._tileCache) {
      const { success, navMesh, tileCache } = generateTileCache(
        this._positions,
        this._indices,
        {
          tileSize,
        }
      );
      if (!success) {
        console.error('Unable to generateTileCache.');
      } else {
        this._tileCache = tileCache;
        this.navMesh = navMesh;
      }
    }
  }

  addCylinderObstacle(position, radius, height) {
    this._createTileCache();
    return (
      this._tileCache?.addCylinderObstacle(position, radius, height) ?? null
    );
  }

  addBoxObstacle(position, extent, angle) {
    this._createTileCache();
    return this._tileCache?.addBoxObstacle(position, extent, angle) ?? null;
  }

  removeObstacle(obstacle) {
    this._tileCache?.removeObstacle(obstacle);
  }

  isSupported() {
    return true;
  }

  getRandomSeed() {
    return getRandomSeed();
  }

  setRandomSeed(seed) {
    setRandomSeed(seed);
  }
}

export class RecastJSCrowd {
  constructor(plugin, maxAgents, maxAgentRadius, scene) {
    this.bjsRECASTPlugin = plugin;
    this.recastCrowd = new Crowd(plugin.navMesh, {
      maxAgents,
      maxAgentRadius,
    });

    this.transforms = [];
    this.agents = [];
    this.reachRadii = [];
    this._agentDestinationArmed = [];
    this._agentDestination = [];
    this._scene = scene;

    this.onReachTargetObservable = new Observable();

    this._onBeforeAnimationsObserver = scene.onBeforeAnimationsObservable.add(
      () => {
        this.update(
          scene.getEngine().getDeltaTime() * 0.001 * plugin.timeFactor
        );
      }
    );
  }

  addAgent(pos, parameters, transform) {
    const agentParams = {
      radius               : parameters.radius,
      height               : parameters.height,
      maxAcceleration      : parameters.maxAcceleration,
      maxSpeed             : parameters.maxSpeed,
      collisionQueryRange  : parameters.collisionQueryRange,
      pathOptimizationRange: parameters.pathOptimizationRange,
      separationWeight     : parameters.separationWeight,
      reachRadius          : parameters.reachRadius
        ? parameters.reachRadius
        : parameters.radius,
    };

    const agent = this.recastCrowd.addAgent(
      { x: pos.x, y: pos.y, z: pos.z },
      agentParams
    );

    this.transforms.push(transform);
    this.agents.push(agent.agentIndex);
    this.reachRadii.push(
      parameters.reachRadius ? parameters.reachRadius : parameters.radius
    );
    this._agentDestinationArmed.push(false);
    this._agentDestination.push(new Vector3(0, 0, 0));

    return agent.agentIndex;
  }

  getAgentPosition(index) {
    const agentPos = this.recastCrowd.getAgent(index)?.position() ?? {
      x: 0,
      y: 0,
      z: 0,
    };
    return new Vector3(agentPos.x, agentPos.y, agentPos.z);
  }

  getAgentPositionToRef(index, result) {
    const agentPos = this.recastCrowd.getAgent(index)?.position() ?? {
      x: 0,
      y: 0,
      z: 0,
    };
    result.set(agentPos.x, agentPos.y, agentPos.z);
  }

  getAgentVelocity(index) {
    const agentVel = this.recastCrowd.getAgent(index)?.velocity() ?? {
      x: 0,
      y: 0,
      z: 0,
    };
    return new Vector3(agentVel.x, agentVel.y, agentVel.z);
  }

  getAgentVelocityToRef(index, result) {
    const agentVel = this.recastCrowd.getAgent(index)?.velocity() ?? {
      x: 0,
      y: 0,
      z: 0,
    };
    result.set(agentVel.x, agentVel.y, agentVel.z);
  }

  getAgentNextTargetPath(index) {
    const pathTargetPos = this.recastCrowd
      .getAgent(index)
      ?.nextTargetInPath() ?? {
      x: 0,
      y: 0,
      z: 0,
    };
    return new Vector3(pathTargetPos.x, pathTargetPos.y, pathTargetPos.z);
  }

  getAgentNextTargetPathToRef(index, result) {
    const pathTargetPos = inverseTransformVector3(
      this.recastCrowd.getAgent(index)?.nextTargetInPath() ?? {
        x: 0,
        y: 0,
        z: 0,
      }
    );
    result.set(pathTargetPos.x, pathTargetPos.y, pathTargetPos.z);
  }

  getAgentState(index) {
    return this.recastCrowd.getAgent(index)?.state() ?? 0;
  }

  overOffmeshConnection(index) {
    return this.recastCrowd.getAgent(index)?.overOffMeshConnection() ?? false;
  }

  agentGoto(index, destination) {
    this.recastCrowd.getAgent(index)?.requestMoveTarget(destination);

    const item = this.agents.indexOf(index);
    if (item > -1) {
      this._agentDestinationArmed[item] = true;
      this._agentDestination[item].set(
        destination.x,
        destination.y,
        destination.z
      );
    }
  }

  getAgents() {
    return this.agents;
  }

  update(deltaTime) {
    this.recastCrowd.update(deltaTime);

    if (deltaTime <= Epsilon) {
      return;
    }

    const timeStep = this.bjsRECASTPlugin.getTimeStep();
    const maxStepCount = this.bjsRECASTPlugin.getMaximumSubStepCount();
    if (timeStep <= Epsilon) {
      this.recastCrowd.update(deltaTime);
    } else {
      let iterationCount = Math.floor(deltaTime / timeStep);
      if (maxStepCount && iterationCount > maxStepCount) {
        iterationCount = maxStepCount;
      }
      if (iterationCount < 1) {
        iterationCount = 1;
      }

      const step = deltaTime / iterationCount;
      for (let i = 0; i < iterationCount; i++) {
        this.recastCrowd.update(step);
      }
    }

    for (let index = 0; index < this.agents.length; index++) {
      const agentIndex = this.agents[index];
      const agentPosition = this.getAgentPosition(agentIndex);
      this.transforms[index].position = inverseTransformVector3(agentPosition);

      if (this._agentDestinationArmed[index]) {
        const dx = agentPosition.x - this._agentDestination[index].x;
        const dz = agentPosition.z - this._agentDestination[index].z;
        const radius = this.reachRadii[index];
        const groundY =
          this._agentDestination[index].y - this.reachRadii[index];
        const ceilingY =
          this._agentDestination[index].y + this.reachRadii[index];
        const distanceXZSquared = dx * dx + dz * dz;
        if (
          agentPosition.y > groundY &&
          agentPosition.y < ceilingY &&
          distanceXZSquared < radius * radius
        ) {
          this._agentDestinationArmed[index] = false;
          this.onReachTargetObservable.notifyObservers({
            agentIndex : agentIndex,
            destination: this._agentDestination[index],
          });
        }
      }
    }
  }

  setDefaultQueryExtent(extent) {
    this.bjsRECASTPlugin.setDefaultQueryExtent(extent);
  }

  getDefaultQueryExtent() {
    return this.bjsRECASTPlugin.getDefaultQueryExtent();
  }

  getDefaultQueryExtentToRef(result) {
    this.bjsRECASTPlugin.getDefaultQueryExtentToRef(result);
  }

  getCorners(index) {
    const corners = this.recastCrowd.getAgent(index)?.corners();
    if (!corners) {
      return [];
    }

    const positions = [];
    for (let i = 0; i < corners.length; i++) {
      positions.push(new Vector3(corners[i].x, corners[i].y, corners[i].z));
    }
    return positions;
  }

  dispose() {
    this.recastCrowd.destroy();

    if (this._onBeforeAnimationsObserver) {
      this._scene.onBeforeAnimationsObservable.remove(
        this._onBeforeAnimationsObserver
      );
      this._onBeforeAnimationsObserver = null;
    }

    this.onReachTargetObservable.clear();
  }
}
