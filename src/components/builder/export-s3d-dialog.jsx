import React, { useCallback, useEffect, useState } from 'react';

import {
  Button,
  List,
  ListItem,
  ListSubheader,
  Stack,
  Typography,
} from '@mui/material';
import { CommonDialog } from '../spire/dialogs/common';
import {
  getEQDir,
  writeEQFile,
  writeFile,
} from 'sage-core/util/fileHandler';
import { useAlertContext } from '../../context/alerts';
import { usePermissions } from 'sage-core/hooks/permissions';
import { useProject } from './hooks/metadata';
import { createS3DZone } from 'sage-core/s3d/export/s3d-export';

export function getCleanByteArray(arr) {
  const newBuffer = new ArrayBuffer(arr.byteLength);
  const newArray = new Uint8Array(newBuffer);
  newArray.set(arr);
  return newArray;
}


export const ExportS3DDialog = ({ open, setOpen }) => {
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
    const zoneMeshes = zb.zoneContainer.getChildMeshes().filter(m => m.getTotalVertices() > 0);
    const collisionMeshes = zb.boundaryContainer.getChildMeshes().filter(m => m.getTotalVertices() > 0);
    console.log('reg', metadata.regions)
    const s3d = await createS3DZone(name, zb.currentScene, zoneMeshes, collisionMeshes, metadata.lights, metadata.objects, metadata.regions)
    await writeFile(fsHandle, `${name}.s3d`, new Uint8Array(s3d));
    setExporting(false);
    openAlert(`Successfully wrote ${name}.s3d to ${fsHandle.name}/${name}.s3d`)
  }, [fsWrite, zb, name]);

  useEffect(() => {
    if (fsHandleSelected) {
      setFsHandle(fsHandleSelected);
    } else {
      getEQDir("output").then((d) => setFsHandle(d));
    }
  }, [fsHandleSelected]);
  const prefix = window.electronAPI ? './' : '/';

  return (
    <CommonDialog
      fullWidth
      maxWidth="sm"
      title={"Export S3D"}
      open={open}
      onClose={() => setOpen(false)}
      aria-labelledby="draggable-dialog-title"
    >
      {open && (
        <>
          <Stack
            sx={{ width: "100%", margin: "0 auto" }}
            justifyContent={"center"}
            alignContent={"center"}
            alignItems="center"
            direction="row"
          >
            <Typography
              sx={{
                fontSize: 28,
                marginBottom: "20px",
                marginTop: "15px",
                maxWidth: "100%",
              }}
              color="text.primary"
              gutterBottom
            >
              Powered by
            </Typography>
            <img
              height="45"
              style={{ margin: "0px 10px" }}
              src={`${prefix}static/q.png`}
            ></img>
            <img height="45" src={`${prefix}static/qi.png`}></img>
          </Stack>
          <Typography
            sx={{
              fontSize: 20,
              marginBottom: "20px",
              marginTop: "15px",
              maxWidth: "100%",
            }}
            color="text.primary"
            gutterBottom
          >
            Note: This feature is in development and isn't fully functional.
          </Typography>
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
            S3D Export will create a collection of files for the client and are
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
            sx={{ width: "100%", bgcolor: "transparent", margin: "5px" }}
            subheader={
              <ListSubheader
                sx={{ background: "transparent", fontSize: "18px" }}
                component="div"
              >
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
