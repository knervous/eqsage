import React, { useCallback, useEffect, useState } from 'react';

import {
  Button,
  FormControl,
  Input,
  InputLabel,
  List,
  ListItem,
  ListSubheader,
  Stack,
  Typography,
} from '@mui/material';
import { CommonDialog } from '../spire/dialogs/common';
import { getEQDir, writeEQFile, writeFile } from '../../lib/util/fileHandler';
import { useAlertContext } from '../../context/alerts';
import { usePermissions } from '../../hooks/permissions';
import { useProject } from './hooks/metadata';
import { createS3DZone } from '../../lib/s3d/export/s3d-export';

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
    zb.metadata.regions.map((_, idx) => idx).join(',')
  );
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
    const indices = regionString.split(',').map(a => +a);
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
  }, [fsWrite, zb, name, regionString]);

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
      maxWidth="xs"
      title={"Export S3D"}
      open
      hideButtons
      aria-labelledby="draggable-dialog-title"
    >
      <FormControl size="small" variant="standard" sx={{ margin: "20px" }}>
        <InputLabel>Regions</InputLabel>
        <Input
          value={regionString}
          onChange={(e) => setRegionString(e.target.value)}
        />
      </FormControl>
      <Stack direction="row" justifyContent={"space-evenly"}>
        <Button
          sx={{ width: "50%" }}
          variant="outlined"
          onClick={() => onFolderSelected()}
        >
          Select Output Folder ({fsHandle?.name ?? "none"})
        </Button>

        <Button
          sx={{ width: "50%" }}
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
            window.toggleRegion(true);
          }}
        >
          Toggle
        </Button>
      </Stack>
    </CommonDialog>
  );
};
