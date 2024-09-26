import Editor, { useMonaco } from '@monaco-editor/react';

import List from '@mui/material/List';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';

import {
  Box,
  Stack,
  Typography,
  Accordion,
  Button,
  AccordionSummary,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMainContext } from '../../../main/context';
import { useZoneContext } from '../../../zone/zone-context';
import { getFiles } from './quest-dir';
import { MonacoService } from './monaco';
import LoadingSpinner from './Loading';
import { CSharpIcon } from '../../../common/icons/csharp';
import { useAlertContext } from '../../../../context/alerts';

const drawerWidth = 240;

const monacoService = new MonacoService();

const defaultText = `class Guard_Gehnus
{
    public void Spawn(NpcEvent e)
    {
        e.npc.Say($"Spawned");
    }
}`;


export const QuestEditor = ({ ready, fsHandle, demo }) => {
  const monaco = useMonaco();
  const { spawns } = useZoneContext();
  const { openAlert } = useAlertContext();
  const [loading, setLoading] = useState(true);
  const [zoneInfo, setZoneInfo] = useState({});
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const { selectedZone, Spire } = useMainContext();
  const listSpawns = useMemo(
    () => spawns.map((s) => s?.spawnentries ?? []).flat(),
    [spawns]
  );
  const npcFiles = useMemo(
    () =>
      files.filter((f) =>
        listSpawns.some((ls) => f.name.startsWith(ls?.npc_type?.name))
      ),
    [listSpawns, files]
  );

  const itemFile = useMemo(
    () => files?.find((f) => f?.name === 'item.cs'),
    [files]
  );
  const spellFile = useMemo(
    () => files?.find((f) => f?.name === 'spell.cs'),
    [files]
  );
  const playerFile = useMemo(
    () => files?.find((f) => f?.name === 'player.cs'),
    [files]
  );
  const projectFile = useMemo(
    () => files?.find((f) => f?.name?.endsWith('.csproj')),
    [files]
  );
  const otherFiles = useMemo(
    () =>
      files?.filter(
        (f) =>
          ![files, itemFile, spellFile, playerFile, projectFile].includes(f) &&
          !npcFiles.includes(f)
      ),
    [files, itemFile, spellFile, playerFile, projectFile, npcFiles]
  );

  const saveFile = useCallback(() => {
    if (!selectedFile || !monaco?.editor?.getModels()?.length) {
      return;
    }
    (async () => {
      const writable = await selectedFile.createWritable();
      await writable.write(monaco.editor.getModels()[0].getValue());
      await writable.close();
      openAlert(`Successfully saved ${selectedFile.name}`);
    })();
  }, [selectedFile, monaco, openAlert]);

  const onKeyDown = useCallback(e => {
    e.stopPropagation();
    if (e.key.toLowerCase() === 's' && (e.ctrlKey || e.metaKey)) {
      saveFile();
      e.preventDefault();
    }
  }, [saveFile]);

  useEffect(() => {
    if (!Spire || !selectedZone) {
      return;
    }

    Spire.Zones.getZoneById(selectedZone.zoneidnumber).then((zone) => {
      setZoneInfo(zone);
    });
  }, [selectedZone, Spire]);

  useEffect(() => {
    if (!ready || !fsHandle) {
      return;
    }
    (async () => {
      const dirFiles = await getFiles(
        fsHandle,
        zoneInfo?.short_name ?? 'qeynos'
      );
      setFiles(dirFiles);
    })();
  }, [ready, fsHandle, zoneInfo]);

  useEffect(() => {
    if (!monaco) {
      return;
    }

    monacoService.initialize(monaco).then(() => {
      setLoading(false);
    });
  }, [monaco]);

  useEffect(() => {
    if (!selectedFile) {
      return;
    }

    (async () => {
      if (!monaco?.editor?.getModels()?.length) {
        return;
      }
      const model = monaco.editor.getModels()[0];
      const fileContents = await selectedFile?.getFile()?.then((f) => f.text());
      if (fileContents !== undefined) {
        if (selectedFile.name?.endsWith('csproj')) {
          monacoService.lang = 'xml';
          monaco.editor.setModelLanguage(model, 'xml');
        } else {
          monacoService.lang = 'csharp';
          monaco.editor.setModelLanguage(model, 'csharp');
        }
        model.setValue(fileContents);
      }
    })();
  }, [selectedFile, monaco]);

  useEffect(() => {
    if (demo && monaco) {
      const model = monaco.editor.getModels()[0];
      model.setValue(defaultText);
    }
  }, [demo, monaco]);

  return (
    <Box className={ready || demo ? 'quest-editor-open' : 'quest-editor-closed'} onKeyDown={onKeyDown} sx={{ minHeight: '700px' }}>
      <Stack direction={'row'}>
        <Box
          sx={{
            width               : drawerWidth,
            flexShrink          : 0,
            '& .MuiDrawer-paper': {
              width    : drawerWidth,
              boxSizing: 'border-box',
            },
          }}
          className="editor-accordion"
          variant="persistent"
          anchor="left"
          open={true}
        >
          <Stack
            alignItems={'center'}
            justifyContent={'space-between'}
            sx={{
              margin : '3px 0 10px 0',
              height : '50px',
              padding: '0 5px',
            }}
            direction={'row'}
          >
            <Typography
              sx={{
                maxWidth    : 'calc(100% - 60px) !important',
                whiteSpace  : 'nowrap',
                overflow    : 'hidden',
                textOverflow: 'ellipsis',
                fontSize    : '14px !important',
                paddingRight: '15px',
              }}
            >
              File: {selectedFile?.name ?? ''}
            </Typography>
            <Button
              onClick={saveFile}
              sx={{ height: '30px' }}
              disabled={!selectedFile}
              variant={'outlined'}
            >
              Save
            </Button>
          </Stack>

          <Accordion defaultExpanded disableGutters>
            <AccordionSummary
              className="editor-accordion-summary"
              expandIcon={<ExpandMoreIcon />}
            >
              <Typography>Zone Project: ({projectFile ? 1 : 0} / 1)</Typography>
            </AccordionSummary>
            <List>
              {projectFile && (
                <ListItem
                  className={
                    selectedFile === projectFile ? 'editor-file-selected' : ''
                  }
                  onClick={() => {
                    setSelectedFile(projectFile);
                  }}
                  sx={{ userSelect: 'none' }}
                >
                  <CSharpIcon width={15} height={15} />
                  <ListItemText>{projectFile.name}</ListItemText>
                </ListItem>
              )}
            </List>
          </Accordion>
          <Accordion defaultExpanded disableGutters>
            <AccordionSummary
              className="editor-accordion-summary"
              expandIcon={<ExpandMoreIcon />}
            >
              <Typography>
                Spawned NPCs: ({npcFiles.length} / {listSpawns.length})
              </Typography>
            </AccordionSummary>
            <List>
              {npcFiles.map((npcFile) => (
                <ListItem
                  className={
                    selectedFile === npcFile ? 'editor-file-selected' : ''
                  }
                  onClick={() => {
                    setSelectedFile(npcFile);
                  }}
                  sx={{ userSelect: 'none' }}
                >
                  <CSharpIcon width={15} height={15} />
                  <ListItemText>{npcFile.name}</ListItemText>
                </ListItem>
              ))}
            </List>
          </Accordion>
          <Accordion defaultExpanded disableGutters>
            <AccordionSummary
              className="editor-accordion-summary"
              expandIcon={<ExpandMoreIcon />}
            >
              <Typography>Player: ({playerFile ? 1 : 0} / 1)</Typography>
            </AccordionSummary>
            <List>
              {playerFile && (
                <ListItem
                  className={
                    selectedFile === playerFile ? 'editor-file-selected' : ''
                  }
                  onClick={() => {
                    setSelectedFile(playerFile);
                  }}
                  sx={{ userSelect: 'none' }}
                >
                  <CSharpIcon width={15} height={15} />
                  <ListItemText>player.cs</ListItemText>
                </ListItem>
              )}
            </List>
          </Accordion>
          <Accordion defaultExpanded disableGutters>
            <AccordionSummary
              className="editor-accordion-summary"
              expandIcon={<ExpandMoreIcon />}
            >
              <Typography>Item: ({itemFile ? 1 : 0} / 1)</Typography>
            </AccordionSummary>
            <List>
              {itemFile && (
                <ListItem
                  className={
                    selectedFile === itemFile ? 'editor-file-selected' : ''
                  }
                  onClick={() => {
                    setSelectedFile(itemFile);
                  }}
                  sx={{ userSelect: 'none' }}
                >
                  <CSharpIcon width={15} height={15} />
                  <ListItemText>item.cs</ListItemText>
                </ListItem>
              )}
            </List>
          </Accordion>
          <Accordion defaultExpanded disableGutters>
            <AccordionSummary
              className="editor-accordion-summary"
              expandIcon={<ExpandMoreIcon />}
            >
              <Typography>Spell: ({spellFile ? 1 : 0} / 1)</Typography>
            </AccordionSummary>
            <List>
              {spellFile && (
                <ListItem
                  className={
                    spellFile === itemFile ? 'editor-file-selected' : ''
                  }
                  onClick={() => {
                    setSelectedFile(spellFile);
                  }}
                  sx={{ userSelect: 'none' }}
                >
                  <CSharpIcon width={15} height={15} />
                  <ListItemText>spell.cs</ListItemText>
                </ListItem>
              )}
            </List>
          </Accordion>
          <Accordion defaultExpanded disableGutters>
            <AccordionSummary
              className="editor-accordion-summary"
              expandIcon={<ExpandMoreIcon />}
            >
              <Typography>Other: ({otherFiles.length})</Typography>
            </AccordionSummary>
            <List>
              {otherFiles.map((otherFile) => (
                <ListItem
                  className={
                    selectedFile === otherFile ? 'editor-file-selected' : ''
                  }
                  onClick={() => {
                    setSelectedFile(otherFile);
                  }}
                  sx={{ userSelect: 'none' }}
                >
                  {otherFile.name.endsWith('.cs') ? (
                    <CSharpIcon width={15} height={15} />
                  ) : (
                    <Box sx={{ width: 15, height: 15 }}></Box>
                  )}
                  <ListItemText>{otherFile.name}</ListItemText>
                </ListItem>
              ))}
            </List>
          </Accordion>
        </Box>
        {loading && <LoadingSpinner />}
        <Editor
          theme={'vs-dark'}
          height="700px"
          width={'100%'}
          defaultLanguage="csharp"
          defaultValue={demo ? defaultText : ''}
        />
      </Stack>
    </Box>
  );
};
