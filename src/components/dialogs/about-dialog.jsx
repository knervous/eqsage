import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import YouTubeIcon from '@mui/icons-material/YouTube';
import CodeIcon from '@mui/icons-material/Code';
import { DiscordIcon } from '../spire/icons/discord';

import './about-dialog.scss';

const Link = ({ Icon, text, link }) => (
  <Stack className="hover-link" direction="row">
    <Icon />
    <Typography
      onClick={() => window.open(link, '_blank')}
      sx={{ marginLeft: '10px', userSelect: 'none', fontSize: '15px' }}
      gutterBottom
    >
      {text}
    </Typography>
  </Stack>
);

export const AboutDialog = ({ open, setOpen }) => {
  return (
    <Dialog
      fullWidth
      maxWidth="sm"
      open={open}
      onClose={() => setOpen(false)}
      aria-labelledby="draggable-dialog-title"
    >
      <DialogTitle
        style={{ margin: '0 auto' }}
        id="draggable-dialog-title"
      >
        Welcome to EQ Sage!
      </DialogTitle>
      <DialogContent className='about-content'>
        <div>
          <Stack
            alignContent="center"
            justifyContent="space-between"
            direction="row"
            spacing={1}
          ></Stack>

          <Typography
            sx={{ fontSize: 17, marginBottom: 2 }}
            color="text.secondary"
            gutterBottom
          >
            EQ Sage is a multipurpose tool that interacts with local EverQuest
            files in order to decode, view, preview and export to different
            formats. The project is open source and is always being actively
            discussed in the EQEmu Discord server.
          </Typography>
          <Typography
            sx={{ fontSize: 17, marginBottom: 2 }}
            color="text.secondary"
            gutterBottom
          >
            Here are some links to chats and projects:
          </Typography>

          <Link
            Icon={GitHubIcon}
            text="EQ Sage GitHub"
            link="https://github.com/knervous/eqsage"
          />
          <Link
            Icon={DiscordIcon}
            text="EQEmu Discord (in channel #project-requiem)"
            link="https://discord.gg/785p886eCw"
          />
          <Link
            Icon={YouTubeIcon}
            text="YouTube Channel"
            link="https://www.youtube.com/@knervous9471"
          />
          <Link
            Icon={CodeIcon}
            text="EQ Advanced Maps"
            link="https://eqmap.vercel.app"
          />
          <Link
            Icon={CodeIcon}
            text="EQ: Requiem"
            link="https://eqrequiem.com"
          />
     
          <Typography
            sx={{ fontSize: 17, marginBottom: 2 }}
            color="text.secondary"
            gutterBottom
          >
            And I can be reached via eqadvancedmaps@gmail.com. This game and the projects surrounding
            it are all about community--that means you! So don't hesitate to reach out and say hello, pitch an idea or provide some feedback.
          </Typography>
          <Typography
            sx={{ fontSize: 17, marginBottom: 2 }}
            color="text.secondary"
            gutterBottom
          >
            Enjoy your time exploring the worlds through this technical lens and keep coming back--there's much more in store!
          </Typography>
          <Typography
            sx={{ fontSize: 17, marginBottom: 2 }}
            color="text.secondary"
            gutterBottom
          >
            - temp0
          </Typography>
        </div>
      </DialogContent>
      <DialogActions disableSpacing sx={{ margin: '0 auto' }}>
        <Button
          sx={{ color: 'white' }}
          autoFocus
          onClick={() => setOpen(false)}
        >
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
};
