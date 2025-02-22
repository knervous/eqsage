import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  IconButton,
  ListItem,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Menu } from '@base-ui-components/react/menu';
import { SimpleTreeView, TreeItem } from '@mui/x-tree-view';
import FolderIcon from '@mui/icons-material/Folder';
import CloseIcon from '@mui/icons-material/Close';
import ConstructionIcon from '@mui/icons-material/Construction';

import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import SaveIcon from '@mui/icons-material/Save';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { usePermissions } from '@/hooks/permissions';
import Editor from '@monaco-editor/react';
import { Allotment } from 'allotment';
import { quailProcessor } from '@/modules/quail';
import { definitionProvider, wceLanguage } from './wce';

import './fs.scss';
import styles from './index.module.css';
import { NavFooter } from '../common/nav/nav-footer';
import { DrawerButton } from '../common/nav/drawer-button';

export const FileExplorer = ({ setMaxSize }) => {
  // Custom hook providing FS access
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
  const [fileHandle, setFileHandle] = useState(null);
  const [currentFileName, setCurrentFileName] = useState('');

  const refreshDirectory = useCallback(async () => {
    setTreeData(null);

    if (!fsHandle) {
      return;
    }

    // Updated loadTree: builds a full relative path for the node ID
    const loadTree = async (dirHandle, parentPath = '') => {
      const nodes = [];
      for await (const [name, handle] of dirHandle.entries()) {
        // Build the full relative path
        const currentPath = parentPath ? `${parentPath}/${name}` : name;
        if (handle.kind === 'directory') {
          const children = await loadTree(handle, currentPath);
          nodes.push({ id: currentPath, name, type: 'directory', children });
        } else {
          if (
            !['.bmp', '.dds', '.ds_store'].some((p) =>
              name.toLowerCase().endsWith(p)
            )
          ) {
            nodes.push({ id: currentPath, name, type: 'file', handle });
          }
        }
      }
      const files = nodes.filter((a) => a.type === 'file');
      const dirs = nodes.filter((a) => a.type === 'directory');
      const sort = (a, b) => (a.name < b.name ? -1 : 1);
      return [...files.sort(sort), ...dirs.sort(sort)];
    };

    const tree = await loadTree(fsHandle);
    setTreeData(tree);
  }, [fsHandle]);

  useEffect(() => {
    setMaxSize(fileHandle ? 900 : 200);
  }, [fileHandle, setMaxSize]);

  useEffect(() => {
    refreshDirectory();
  }, [refreshDirectory]);

  const parseWCE = useCallback(async () => {
    await quailProcessor.parseWce(fsHandle);
  }, [fsHandle]);

  const handleFileClick = async (node) => {
    console.log('Click node', node);
    if (node.handle) {
      try {
        const file = await node.handle.getFile();
        const text = await file.text();
        setFileContent(text);
        setFileHandle(file);
        setCurrentFileName(node.name);
      } catch (err) {
        console.error('Error reading file:', err);
      }
    }
  };

  const renderTree = (nodes, level = 0) =>
    nodes.map((node) => {
      const labelContent = (
        <Box
          sx={{
            display       : 'flex',
            alignItems    : 'center',
            justifyContent: 'space-between',
            width         : '100%',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {node.type === 'directory' ? (
              <FolderIcon fontSize="small" sx={{ mr: 1 }} />
            ) : (
              <InsertDriveFileIcon fontSize="small" sx={{ mr: 1 }} />
            )}
            <Typography variant="body2" sx={{ fontWeight: 'inherit' }}>
              {node.name}
            </Typography>
          </Box>
        </Box>
      );
      return (
        <TreeItem
          key={node.id}
          itemId={node.id}
          onClick={
            node.type === 'file'
              ? (e) => {
                e.stopPropagation();
                handleFileClick(node);
              }
              : undefined
          }
          label={labelContent}
          sx={{ '& > div': { padding: '5px 5px' } }}
        >
          {node.children && node.children.length > 0
            ? renderTree(node.children, level + 1)
            : null}
        </TreeItem>
      );
    });

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
      <NavFooter>
        <DrawerButton
          drawerState={{}}
          drawer="process"
          text={'Process WCE'}
          Icon={ConstructionIcon}
          toggleDrawer={parseWCE}
        />
      </NavFooter>
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
        <Allotment maxSize={500}>
          <Allotment.Pane minSize={50} maxSize={200}>
            <Box
              sx={{
                bgcolor: 'background.paper',
                height : '24px',
                width  : '100%',
              }}
            >
              <Stack
                sx={{ padding: '2px 8px' }}
                direction="row"
                justifyContent={'space-between'}
                alignContent="center"
              >
                <Typography
                  variant="pre"
                  sx={{ fontSize: '13px', lineHeight: '20px' }}
                >
                    EXPLORER
                </Typography>
                <Menu.Root>
                  <Menu.Trigger className={styles.Button}>
                    <MoreHorizIcon sx={{ width: '20px', height: '20px' }} />
                  </Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Positioner
                      className={styles.Positioner}
                      sideOffset={8}
                    >
                      <Menu.Popup className={styles.Popup}>
                        <Menu.Arrow className={styles.Arrow}></Menu.Arrow>
                        <Menu.Item
                          onClick={refreshDirectory}
                          className={styles.Item}
                        >
                            Reload
                        </Menu.Item>
                        <Menu.Separator className={styles.Separator} />
                        <Menu.Item onClick={unlink} className={styles.Item}>
                            Unlink Directory
                        </Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Root>
              </Stack>
            </Box>
            <SimpleTreeView
              defaultCollapseIcon={<FolderOpenIcon />}
              defaultExpandIcon={<FolderIcon />}
              sx={{
                minHeight    : 'calc(100% - 25px)',
                maxHeight    : 'calc(100vh - 54px)',
                padding      : '5px',
                color        : 'inherit',
                bgcolor      : 'background.paper',
                border       : 1,
                borderColor  : 'divider',
                overflow     : 'scroll',
                paddingBottom: '25px !important',
              }}
            >
              {treeData ? (
                renderTree(treeData)
              ) : (
                <Typography variant="body2">Loading...</Typography>
              )}
            </SimpleTreeView>
          </Allotment.Pane>
          {fileHandle ? (
            <Allotment.Pane maxSize={700}>
              <Stack
                sx={{ bgcolor: 'background.paper' }}
                direction="row"
                justifyContent={'space-between'}
              >
                <Typography variant="subtitle2" sx={{ padding: '0 10px', lineHeight: '26px' }}>
                  {currentFileName}
                </Typography>
                <Stack
                  sx={{
                    button: {
                      borderRadius: '0px',
                      width       : '26px',
                      height      : '26px',
                    },
                    svg: {
                      width : '16px',
                      height: '16px',
                    },
                  }}
                  direction="row"
                >
                  <IconButton>
                    <SaveIcon />
                  </IconButton>
                  <IconButton
                    onClick={() => {
                      setCurrentFileName('');
                      setFileContent('');
                      setFileHandle(null);
                    }}
                  >
                    <CloseIcon />
                  </IconButton>
                </Stack>
              </Stack>

              {currentFileName ? (
                <Editor
                  theme="vs-dark"
                  height="calc(100vh)"
                  width="100%"
                  value={fileContent}
                  language="wce"
                  beforeMount={(monaco) => {
                    monaco.languages.register({ id: 'wce' });
                    monaco.languages.setMonarchTokensProvider(
                      'wce',
                      wceLanguage
                    );
                    monaco.languages.registerDefinitionProvider(
                      'wce',
                      definitionProvider(monaco)
                    );
                  }}
                  onChange={(newValue) => setFileContent(newValue)}
                />
              ) : (
                <Box />
              )}
            </Allotment.Pane>
          ) : null}
        </Allotment>
      )}
    </Box>
  );
};
