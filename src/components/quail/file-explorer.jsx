import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { SimpleTreeView, TreeItem } from '@mui/x-tree-view';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { usePermissions } from '@/hooks/permissions';
import Editor from '@monaco-editor/react';
import { Allotment } from 'allotment';
import { quailProcessor } from '@/modules/quail';

import './fs.scss';

export const FileExplorer = () => {
  // Custom hook providing FS access (fsHandle is a FileSystemDirectoryHandle)
  const [
    _apiSupported,
    onDrop,
    _checkHandlePermissions,
    fsHandle,
    onFolderSelected,
    unlink,
  ] = usePermissions('quail-workspace');

  const [treeData, setTreeData] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [currentFileName, setCurrentFileName] = useState('');

  useEffect(() => {
    if (!fsHandle) {
      setTreeData(null);
      return;
    }

    let counter = 0;

    const loadTree = async (dirHandle, parentId = '') => {
      const nodes = [];
      for await (const [name, handle] of dirHandle.entries()) {
        counter++;
        const nodeId = parentId
          ? `${parentId}/${name}-${counter}`
          : `${name}-${counter}`;
        if (handle.kind === 'directory') {
          const children = await loadTree(handle, nodeId);
          nodes.push({ id: nodeId, name, type: 'directory', children });
        } else {
          if (!['.bmp', '.dds'].some((p) => name.toLowerCase().endsWith(p))) {
            nodes.push({ id: nodeId, name, type: 'file', handle });
          }
        }
      }
      return nodes;
    };

    (async () => {
      const tree = await loadTree(fsHandle);
      setTreeData(tree);
    })();
  }, [fsHandle]);

  const parseWCE = useCallback(async () => {
    await quailProcessor.parseWce(fsHandle);
  }, [fsHandle]);

  const handleFileClick = async (node) => {
    if (node.handle) {
      try {
        const file = await node.handle.getFile();
        const text = await file.text();
        setFileContent(text);
        setCurrentFileName(node.name);
      } catch (err) {
        console.error('Error reading file:', err);
      }
    }
  };

  const renderTree = (nodes) =>
    nodes.map((node) => (
      <TreeItem
        key={node.id}
        itemId={node.id}
        label={
          <Box
            onClick={() => node.type === 'file' && handleFileClick(node)}
            sx={{
              display   : 'flex',
              alignItems: 'center',
              cursor    : node.type === 'file' ? 'pointer' : 'default',
            }}
          >
            {node.type === 'directory' ? (
              <FolderIcon fontSize="small" sx={{ mr: 1 }} />
            ) : (
              <InsertDriveFileIcon fontSize="small" sx={{ mr: 1 }} />
            )}
            <Typography
              variant="body2"
              sx={{ fontWeight: 'inherit', flexGrow: 1 }}
            >
              {node.name}
            </Typography>
          </Box>
        }
      >
        {node.children && node.children.length > 0
          ? renderTree(node.children)
          : null}
      </TreeItem>
    ));

  return (
    <Box
      onDrop={onDrop}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="fs-bg"
      sx={{
        height : '100vh',
        bgcolor: 'background.default',
        color  : 'text.primary',
      }}
    >
      <Box
        sx={{
          padding     : '10px',
          borderBottom: 1,
          borderColor : 'divider',
          display     : 'flex',
        }}
      >
        <Typography variant="h6">Quail Workspace v0.1</Typography>
        {fsHandle && (
          <Button
            sx={{ marginLeft: '10px' }}
            onClick={unlink}
            variant="outlined"
            size="small"
          >
            Unlink
          </Button>
        )}
      </Box>

      {!fsHandle ? (
        <Box
          className="fs-start"
          sx={{
            width    : '75%',
            margin   : '0 auto',
            padding  : '25px',
            textAlign: 'center',
          }}
        >
          <Typography variant="h5">Welcome to Quail Workspace!</Typography>
          <Typography variant="body1">
            Drop a Quail root WCE folder to get started
          </Typography>
          <Button
            sx={{ margin: '15px auto' }}
            onClick={onFolderSelected}
            variant="outlined"
          >
            Select Folder
          </Button>
        </Box>
      ) : (
        <Box sx={{ overflowY: 'auto', height: 'calc(100vh - 60px)' }}>
          <Allotment>
            <Allotment.Pane minSize={50} maxSize={200}>
              <SimpleTreeView
                defaultCollapseIcon={<FolderOpenIcon />}
                defaultExpandIcon={<FolderIcon />}
                sx={{
                  minHeight    : 'calc(100% - 25px)',
                  maxHeight    : 'calc(100vh - 54px)',
                  color        : 'inherit',
                  bgcolor      : 'background.paper',
                  border       : 1,
                  borderColor  : 'divider',
                  // borderRadius : 1,
                  // padding      : 1,
                  overflow     : 'scroll',
                  paddingBottom: '25px !important'
                }}
              >
                {treeData ? (
                  renderTree(treeData)
                ) : (
                  <Typography variant="body2">Loading...</Typography>
                )}
              </SimpleTreeView>
            </Allotment.Pane>
            <Allotment.Pane snap>
              <Stack
                justifyContent={'center'}
                sx={{ height: '50px', width: '100%' }}
                direction="row"
              >
                <Button
                  size="small"
                  sx={{ margin: '0px 15px', height: '40px' }}
                  variant="outlined"
                >
                  Save File
                </Button>
                <Button
                  size="small"
                  sx={{ margin: '0px 15px', height: '40px' }}
                  variant="outlined"
                >
                  Sync Files
                </Button>
                <Button
                  size="small"
                  onClick={parseWCE}
                  sx={{ margin: '0px 15px', height: '40px' }}
                  variant="outlined"
                >
                  Parse WCE
                </Button>
                <TextField
                  select
                  size="small"
                  sx={{ minWidth: '150px' }}
                  label="Select Model"
                  value={''}
                >
                  <MenuItem value={-1}>None</MenuItem>
                </TextField>
              </Stack>
              {/* Optionally show the current file name */}
              {currentFileName && (
                <Typography variant="subtitle2" sx={{ padding: '0 10px' }}>
                  {currentFileName}
                </Typography>
              )}
              <Editor
                theme="vs-dark"
                height="calc(100vh - 100px)"
                width="100%"
                value={fileContent}
                onChange={(newValue) => setFileContent(newValue)}
              />
            </Allotment.Pane>
          </Allotment>
        </Box>
      )}
    </Box>
  );
};
