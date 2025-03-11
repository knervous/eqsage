import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Box,
  Button,
  FormControl,
  Input,
  InputLabel,
  List,
  ListItem,
  ListSubheader,
  Stack,
  Collapse,
  IconButton,
  Typography,
} from '@mui/material';
import { CommonDialog } from '../spire/dialogs/common';
import { getEQDir, writeEQFile, writeFile } from 'sage-core/util/fileHandler';
import { useAlertContext } from '../../context/alerts';
import { usePermissions } from 'sage-core/hooks/permissions';
import { useProject } from './hooks/metadata';
import { createS3DZone } from 'sage-core/s3d/export/s3d-export';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';

export const DebugDialog = () => {
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
  ] = usePermissions('zb-s3d-out');
  const [fsHandle, setFsHandle] = useState(null);
  const [regionString, setRegionString] = useState(
    zb.metadata.regions
      .map((_, idx) => idx)
      .join(',')
  );
  const [bspTree, setBspTree] = useState(null);

  // Load the BSP tree from the global window object
  useEffect(() => {
    setBspTree(window.bsp?.root || null);
  }, []);

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

    // Zone
    const zoneMeshes = zb.zoneContainer
      .getChildMeshes()
      .filter((m) => m.getTotalVertices() > 0);
    const collisionMeshes = zb.boundaryContainer
      .getChildMeshes()
      .filter((m) => m.getTotalVertices() > 0);
    const indices = regionString.split(",").map((a) => +a);
    const filteredRegions = [];
    metadata.regions.forEach((r, i) => {
      if (indices.includes(i)) {
        filteredRegions.push(r);
      }
    });
    console.log("reg", filteredRegions);

    const s3d = await createS3DZone(
      name,
      zb.currentScene,
      zoneMeshes,
      collisionMeshes,
      metadata.lights,
      metadata.objects,
      filteredRegions
    );
    await writeFile(fsHandle, `${name}.s3d`, new Uint8Array(s3d));
    setExporting(false);
    openAlert(`Successfully wrote ${name}.s3d to ${fsHandle.name}/${name}.s3d`);
    setBspTree(window.bsp);
  }, [fsWrite, zb, name, regionString]);

  useEffect(() => {
    if (fsHandleSelected) {
      setFsHandle(fsHandleSelected);
    } else {
      getEQDir("output").then((d) => setFsHandle(d));
    }
  }, [fsHandleSelected]);

  // Recursive component to display the BSP tree with collapsible nodes
  const BspNode = ({ node, left, right, level = 0 }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!node) return null;

    const handleToggleExpand = () => {
      setIsExpanded((prev) => !prev);
    };

    const handleShowNode = () => {
      if (window.showBspNode) {
        console.log("Node", node);
        window.showBspNode(node);
      }
    };
    const childCount = useMemo(() => node.childCount, [node]);
    const region = useMemo(
      () => node.polygons.some((p) => p.regions.length),
      [node]
    );
    return (
      <Box sx={{ marginLeft: `${level * 5}px`, marginTop: "10px" }}>
        <Stack direction="row" alignItems="center">
          <IconButton size="small" onClick={handleToggleExpand}>
            {isExpanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
          <Typography
            variant="body2"
            sx={{
              color: region ? "green" : "white",
              fontWeight: "bold",
              flexGrow: 1,
            }}
          >
            [{level}] {level === 0 ? "Root" : left ? "Left" : "Right"} ::
            Children {childCount}
          </Typography>
          <Button size="small" variant="outlined" onClick={handleShowNode}>
            Show
          </Button>
        </Stack>
        {/* Collapsible children */}
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          {node.left && <BspNode node={node.left} level={level + 1} left />}
          {node.right && <BspNode node={node.right} level={level + 1} right />}
        </Collapse>
      </Box>
    );
  };

  return (
    <CommonDialog
      fullWidth
      maxWidth="xs"
      title={"Export S3D"}
      open
      hideButtons
      aria-labelledby="draggable-dialog-title"
    >
      <FormControl
        variant="outlined"
        sx={{ margin: "20px 0px", width: "100%" }}
      >
        <InputLabel>Regions</InputLabel>
        <Input
          value={regionString}
          onChange={(e) => setRegionString(e.target.value)}
        />
      </FormControl>
      <Stack direction="row" justifyContent={"space-evenly"}>
        <Button
          sx={{ width: "100%" }}
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
      </Stack>
      <Stack
        sx={{ marginTop: "10px" }}
        direction="row"
        justifyContent={"space-evenly"}
      >
        <Button
          variant="outlined"
          onClick={() => {
            window.debug(false);
          }}
        >
          Grid
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            window.debugPoly();
          }}
        >
          Poly
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            window.debug(true);
          }}
        >
          Planes
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            window.debug(true, true, 300);
          }}
        >
          Divider
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            window.toggleRegion(true);
          }}
        >
          Toggle
        </Button>
      </Stack>
      <Box sx={{ maxHeight: "200px", maxWidth: "100%", overflow: "auto" }}>
        {bspTree ? (
          <BspNode node={bspTree} />
        ) : (
          <Typography sx={{ margin: "10px" }} variant="body2">
            No BSP tree loaded.
          </Typography>
        )}
      </Box>
    </CommonDialog>
  );
};
