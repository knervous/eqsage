import React, { useCallback, useEffect, useState } from 'react';

import {
  Button,
  List,
  ListItem,
  ListSubheader,
  Stack,
  Typography,
} from '@mui/material';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { SubMesh } from '@babylonjs/core/Meshes/subMesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { CommonDialog } from '../spire/dialogs/common';
import {
  getEQDir,
  getEQFile,
  getEQSageDir,
  writeEQFile,
  writeFile,
} from '../../lib/util/fileHandler';
import { PFSArchive } from '../../lib/pfs/pfs';
import { useAlertContext } from '../../context/alerts';
import { SoundInstance } from '../../lib/s3d/sound/sound';
import { TypedArrayWriter } from '../../lib/util/typed-array-reader';
import { RegionType } from '../../lib/s3d/bsp/bsp-tree';
import { mat4, vec3 } from 'gl-matrix';
import { usePermissions } from '../../hooks/permissions';
import { useProject } from './hooks/metadata';
import { imageProcessor } from '../../lib/util/image/image-processor';
import { quailProcessor } from '../../modules/quail';
import { createBsp } from '../../lib/s3d/export/export';
import { createS3DZone } from '../../lib/s3d/export/s3d-export';

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
    const zoneMeshes = zb.zoneContainer.getChildMeshes();
    const zoneMaterials = zoneMeshes.flatMap(m => m.material).filter(Boolean);
    await createS3DZone(name, zb.currentScene, [], zoneMaterials, zoneMeshes, [], zb.metadata.regions)
    // const s3d = await getEQFile('root', 'qeynos2.s3d', 'arrayBuffer');
    // const res = await quailProcessor.convertS3D([{data: s3d}])
    // console.log('Dialog got result', res);
    // setExporting(false);
    // console.log("Regions", metadata.regions);
    // const bspTree = createBsp(
    //   zb.zoneContainer.getChildMeshes(),
    //   metadata.regions
    // );
    // console.log("Generated BSP tree", bspTree);

    // const s3d = await getEQFile("root", "qeynos2.s3d", "arrayBuffer");
    // const res = await quailProcessor.convertS3D(
    //   { data: s3d, extra: bspTree },
    // );
    // await writeFile(fsHandle, "test.s3d", new Uint8Array(res));
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
              src="/static/q.png"
            ></img>
            <img height="45" src="/static/qi.png"></img>
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
            Note: This feature is in development and currently does not work,
            only the client aspects are functional
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
