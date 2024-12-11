import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Button,
  Divider,
  FormControl,
  Stack,
  Checkbox,
  FormControlLabel,
  Typography,
  Slider,
} from '@mui/material';
import { RecastNavigationJSPlugin } from '../../../plugins/RecastNavigationJSPlugin';
import { gameController } from '../../../viewer/controllers/GameController';
import { useProject } from '../hooks/metadata';
import { getEQSageDir, writeEQFile } from '../../../lib/util/fileHandler';
import { useAlertContext } from '../../../context/alerts';
import AZoneCore from '../../../modules/azone';
import AWaterCore from '../../../modules/awater';

let navigationPlugin;
const zb = gameController.ZoneBuilderController;
const initializePlugin = () => {
  if (navigationPlugin) {
    return;
  }
  navigationPlugin = new RecastNavigationJSPlugin();
  return navigationPlugin;
};

const defaultParameters = {
  cs                    : 0.8,
  ch                    : 0.4,
  walkableSlopeAngle    : 60,
  walkableHeight        : 6.0,
  walkableClimb         : 6.6,
  walkableRadius        : 1.3,
  maxEdgeLen            : 12,
  maxSimplificationError: 1.3,
  minRegionArea         : 8,
  mergeRegionArea       : 20,
  maxVertsPerPoly       : 6,
  detailSampleDist      : 18,
  detailSampleMaxError  : 1,
  tileSize              : 512,
};

export const NavigationDrawer = () => {
  const { updateProject, project, name } = useProject();
  const cleanupCallback = useRef(null);
  const [loading, setLoading] = useState(false);
  const isMounted = useRef(false);
  const [wireframe, setWireFrame] = useState(false);
  const [config, setConfig] = useState(
    project?.nav?.config ?? defaultParameters
  );
  const { openAlert } = useAlertContext();

  /**
   * @type {RecastNavigationJSPlugin}
   */
  const recastPlugin = useMemo(
    () => navigationPlugin || initializePlugin(),
    []
  ); // eslint-disable-line
  const [debugMesh, setDebugMesh] = useState(null);
  const exportNav = useCallback(async () => {
    const data = recastPlugin.serializeNav(project?.nav?.params);
    await writeEQFile('nav', `${name}.nav`, data);
    openAlert(`Successfully saved under EQ/nav/${name}.nav`);
    console.log('Got data', data);
  }, [recastPlugin, project?.nav?.params, name, openAlert]);

  const buildNavMesh = useCallback(async () => {
    setLoading(true);
    console.log('Building', recastPlugin);
    while (zb.scene.getNodeByName('NavMeshDebug')) {
      zb.scene.getNodeByName('NavMeshDebug').dispose();
    }
    debugMesh?.dispose();
    const meshes = zb.zoneContainer
      .getChildMeshes()
      .concat(zb.objectContainer.getChildMeshes());
    try {
      const params = await recastPlugin.createNavMesh(meshes, config);
      if (!isMounted.current) {
        setLoading(false);
        return;
      }
      const mesh = recastPlugin.createDebugNavMesh(zb.scene);
      setDebugMesh(mesh);

      const data = recastPlugin.getNavmeshData();
      updateProject((p) => {
        p.nav = {
          config,
          data,
          params
        };
        return p;
      });
    } catch (e) {
      console.log('Error creating nav mesh', e);
    }

    setLoading(false);
  }, [recastPlugin, config, debugMesh, updateProject]);

  const updateConfig = (prop, val) => setConfig((c) => ({ ...c, [prop]: val }));

  const importCrowd = useCallback(() => {
    zb.pickRaycastForLoc({
      async commitCallback(loc) {
        if (!loc) {
          return;
        }
        if (cleanupCallback.current) {
          cleanupCallback.current();
        }
        cleanupCallback.current = recastPlugin.createCrowd(4, 2, zb.scene, loc);
      },
    });
  }, [recastPlugin]);

  const exportZone = useCallback(async () => {
    const [file] = await window.showOpenFilePicker({
      startIn: await getEQSageDir(),
      types  : [
        {
          description: 'EverQuest EQG File',
          accept     : {
            'application/octet-stream': ['.eqg']
          }
        }
      ]
    });
    if (file) {
      const buffer = await file.getFile().then(f => f.arrayBuffer());
      const name = file.name.replace('.eqg', '');
      const byteArray = new Uint8Array(buffer);
      const AZone = await AZoneCore({
        locateFile: (file) => {
          return `/static/${file}`;
        },
        print   : console.log,
        printErr: console.error,
      });
      const AWater = await AWaterCore({
        locateFile: (file) => {
          return `/static/${file}`;
        },
        print   : console.log,
        printErr: console.error,
      });

      AZone.FS.writeFile(`${name}.eqg`, byteArray);
      AWater.FS.writeFile(`${name}.eqg`, byteArray);

      const zoneNamePtr = AZone._malloc(name.length + 1);
      AZone.stringToUTF8(name, zoneNamePtr, name.length + 1);

      const waterNamePtr = AWater._malloc(name.length + 1);
      AWater.stringToUTF8(name, waterNamePtr, name.length + 1);

      // There are transient FS errors that don't mean anything here
      try {
        if (AZone._convert(zoneNamePtr, false) !== 0) {
          throw new Error('Failed AZone conversion');
        }
      } catch (e) {
        console.warn(e);
      }
      try {
        if (AWater._convert(waterNamePtr) !== 0) {
          throw new Error('Failed AWater conversion');
        }
      } catch (e) {
        console.warn(e);
      }

      AZone._free(zoneNamePtr);
      AWater._free(waterNamePtr);
        
      const mapFile = `${name}.map`;
      const wtrFile = `${name}.wtr`;

      await writeEQFile('nav', mapFile, AZone.FS.readFile(mapFile));
      await writeEQFile('nav', wtrFile, AWater.FS.readFile(wtrFile));
      openAlert(`Successfully wrote EQ/eqsage/nav/${mapFile} and EQ/eqsage/nav/${wtrFile}`);
    }
    console.log('Got file', file);
  }, [openAlert]);

  useEffect(() => {
    if (!debugMesh) {
      return;
    }

    if (wireframe) {
      zb.overlayWireframe(debugMesh);
    }
    return () => {
      zb.disposeOverlayWireframe();
    };
  }, [wireframe, debugMesh]);

  useEffect(() => {
    return () => {
      debugMesh?.dispose();
    };
  }, [debugMesh]);

  useEffect(() => {
    isMounted.current = true;
    if (project?.nav?.data) {
      recastPlugin.init().then(() => {
        recastPlugin.buildFromNavmeshData(project.nav.data);
        setDebugMesh(recastPlugin.createDebugNavMesh(zb.scene));
      });
    }
    return () => {
      if (cleanupCallback.current) {
        cleanupCallback.current();
      }
      
      isMounted.current = false;
    };
  }, []); // eslint-disable-line
  return (
    <Stack direction="column" sx={{ height: '90%', maxHeight: '90%', overflowY: 'auto', padding: '10px' }}>
      <Button
        fullWidth
        variant={'outlined'}
        disabled={loading}
        sx={{ margin: '3px auto' }}
        onClick={buildNavMesh}
      >
        <Typography
          variant="h6"
          sx={{
            color     : 'text.primary',
            textAlign : 'center',
            userSelect: 'none',
            fontSize  : '17px',
          }}
        >
          {loading ? 'Generating...' : 'Build Navigation Mesh'}
        </Typography>
      </Button>
      <Button
        fullWidth
        variant={'outlined'}
        disabled={loading || !debugMesh}
        sx={{ margin: '3px auto' }}
        onClick={importCrowd}
      >
        <Typography
          variant="h6"
          sx={{
            color     : loading || !debugMesh ? 'text.secondary' : 'text.primary',
            textAlign : 'center',
            userSelect: 'none',
            fontSize  : '17px',
          }}
        >
          Spawn Agents
        </Typography>
      </Button>
      <Button
        fullWidth
        variant={'outlined'}
        sx={{ margin: '3px auto' }}
        disabled={loading || !debugMesh}
        onClick={exportNav}
      >
        <Typography
          variant="h6"
          sx={{
            color     : loading || !debugMesh ? 'text.secondary' : 'text.primary',
            textAlign : 'center',
            userSelect: 'none',
            fontSize  : '17px',
          }}
        >
          Export NavMesh to .nav
        </Typography>
      </Button>  <Button
        fullWidth
        variant={'outlined'}
        disabled={loading || !debugMesh}
        sx={{ margin: '3px auto' }}
        onClick={exportZone}
      >
        <Typography
          variant="h6"
          sx={{
            color     : loading || !debugMesh ? 'text.secondary' : 'text.primary',
            textAlign : 'center',
            userSelect: 'none',
            fontSize  : '17px',
          }}
        >
          {'Export EQG => .map/.wtr'}
        </Typography>
      </Button>
      <FormControlLabel
        control={
          <Checkbox
            disabled={!debugMesh}
            checked={wireframe}
            onChange={({ target: { checked } }) => setWireFrame(checked)}
          />
        }
        label="Overlay Wireframe"
      />
      <Divider sx={{ margin: '5px' }} />
      <FormControl sx={{}} fullWidth>
        <Typography
          sx={{ fontSize: 14, marginTop: 2, width: '80%' }}
          color="text.secondary"
          gutterBottom
        >
          Cell Size ({config.cs})
        </Typography>
        <Slider
          value={config.cs}
          onChange={(e) => updateConfig('cs', e.target.value)}
          step={0.1}
          min={0.1}
          max={2}
        />
      </FormControl>
      <FormControl sx={{}} fullWidth>
        <Typography
          sx={{ fontSize: 14, marginTop: 2, width: '80%' }}
          color="text.secondary"
          gutterBottom
        >
          Cell Height ({config.ch})
        </Typography>
        <Slider
          value={config.ch}
          onChange={(e) => updateConfig('ch', e.target.value)}
          step={0.1}
          min={0.1}
          max={2}
        />
      </FormControl>
      <FormControl sx={{}} fullWidth>
        <Typography
          sx={{ fontSize: 14, marginTop: 2, width: '80%' }}
          color="text.secondary"
          gutterBottom
        >
          Walkable Slope Angle ({config.walkableSlopeAngle})
        </Typography>
        <Slider
          value={config.walkableSlopeAngle}
          onChange={(e) => updateConfig('walkableSlopeAngle', e.target.value)}
          step={1}
          min={1}
          max={180}
        />
      </FormControl>
      <FormControl sx={{}} fullWidth>
        <Typography
          sx={{ fontSize: 14, marginTop: 2, width: '80%' }}
          color="text.secondary"
          gutterBottom
        >
          Walkable Height ({config.walkableHeight})
        </Typography>
        <Slider
          value={config.walkableHeight}
          onChange={(e) => updateConfig('walkableHeight', e.target.value)}
          step={0.1}
          min={1}
          max={20}
        />
      </FormControl>
      <FormControl sx={{}} fullWidth>
        <Typography
          sx={{ fontSize: 14, marginTop: 2, width: '80%' }}
          color="text.secondary"
          gutterBottom
        >
          Walkable Climb ({config.walkableClimb})
        </Typography>
        <Slider
          value={config.walkableClimb}
          onChange={(e) => updateConfig('walkableClimb', e.target.value)}
          step={0.1}
          min={1}
          max={20}
        />
      </FormControl>
      <FormControl sx={{}} fullWidth>
        <Typography
          sx={{ fontSize: 14, marginTop: 2, width: '80%' }}
          color="text.secondary"
          gutterBottom
        >
          Walkable Radius ({config.walkableRadius})
        </Typography>
        <Slider
          value={config.walkableRadius}
          onChange={(e) => updateConfig('walkableRadius', e.target.value)}
          step={0.1}
          min={1}
          max={20}
        />
      </FormControl>
      <FormControl sx={{}} fullWidth>
        <Typography
          sx={{ fontSize: 14, marginTop: 2, width: '80%' }}
          color="text.secondary"
          gutterBottom
        >
          Tile Size ({config.tileSize})
        </Typography>
        <Slider
          value={config.tileSize}
          onChange={(e) => updateConfig('tileSize', e.target.value)}
          step={1}
          min={1}
          max={2048}
        />
      </FormControl>
    </Stack>
  );
};
